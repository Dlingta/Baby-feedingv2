import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateGrowthAge, WHO_DAYS_PER_MONTH } from '../calculations/ageCalculator';
import {
  buildWhoReferenceCurveSeries,
  calculateLmsZScore,
  calculateValueFromLms,
  normalizeHeightForWhoStandard,
} from '../calculations/lmsCalculator';
import {
  formatPercentileLabel,
  zScoreToPercentile,
} from '../calculations/percentileCalculator';
import { validateGrowthMeasurement } from '../calculations/measurementValidator';
import { evaluateGrowthMeasurement } from '../calculations/growthAssessment';
import { GrowthBabyProfile, GrowthMeasurement } from '../types/growth';

const BASE_BOY_PROFILE: GrowthBabyProfile = {
  babyId: 'baby-test-boy',
  name: '小星星',
  sex: 'male',
  birthDate: '2024-01-01',
  isPreterm: false,
};

test('1. Exact calendar age & leap-year calculation', () => {
  // 2024 is a leap year (Feb has 29 days)
  const leapYearAge = calculateGrowthAge('2024-02-29', '2025-02-28');
  assert.ok(leapYearAge);
  assert.equal(leapYearAge.isValid, true);
  assert.equal(leapYearAge.ageDays, 365);
  assert.equal(leapYearAge.calendarYears, 0);
  assert.equal(leapYearAge.calendarMonths, 11);
  assert.equal(leapYearAge.calendarDays, 30);
  assert.equal(
    leapYearAge.exactMonths,
    Number((365 / WHO_DAYS_PER_MONTH).toFixed(2))
  );

  // Month-end alignment: Jan 31 -> Mar 1 in leap year 2024 (Feb has 29 days -> 30 days elapsed)
  const monthEndAge = calculateGrowthAge('2024-01-31', '2024-03-01');
  assert.ok(monthEndAge);
  assert.equal(monthEndAge.isValid, true);
  assert.equal(monthEndAge.ageDays, 30);
  assert.equal(monthEndAge.calendarMonths, 1);
  assert.equal(monthEndAge.calendarDays, 1);

  // Measurement date before birthDate -> invalid
  const negativeAge = calculateGrowthAge('2024-06-01', '2024-05-31');
  assert.ok(negativeAge);
  assert.equal(negativeAge.isValid, false);
  assert.equal(negativeAge.ageDays, -1);

  // Malformed date -> null
  assert.equal(calculateGrowthAge('2024-02-30', '2024-05-01'), null);
});

test('2. WHO LMS Z-score formula (L != 0, L == 0, inverse, tail adjustment, invalid guard)', () => {
  // L != 0 exact check
  const zNonZero = calculateLmsZScore(10.0, -0.3521, 9.6479, 0.1066, false);
  assert.ok(zNonZero !== null);
  assert.ok(Math.abs(zNonZero - 0.34) <= 0.02);

  // L == 0 exact check: Z = ln(X / M) / S
  const zZeroL = calculateLmsZScore(10.0, 0, 10.0, 0.1, false);
  assert.equal(zZeroL, 0);
  const zZeroLPos = calculateLmsZScore(10.0 * Math.exp(0.1), 0, 10.0, 0.1, false);
  assert.equal(zZeroLPos, 1);

  // Inverse calculateValueFromLms round-trip
  const valAtPos2 = calculateValueFromLms(2, 0.1738, 9.6479, 0.1066);
  assert.ok(valAtPos2 !== null);
  const roundTripZ = calculateLmsZScore(valAtPos2, 0.1738, 9.6479, 0.1066, false);
  assert.equal(roundTripZ, 2);

  // WHO |Z| > 3 linear tail extrapolation: for negative L, unadjusted LMS compresses toward an asymptote;
  // WHO replaces |Z| > 3 with linear slope (SD3 - SD2), yielding 3 + (X - SD3pos) / (SD3pos - SD2pos)
  const l = -0.3521;
  const m = 9.6479;
  const s = 0.1066;
  const sd3pos = calculateValueFromLms(3, l, m, s)!;
  const sd2pos = calculateValueFromLms(2, l, m, s)!;
  const expectedTailZ = Number((3 + (20 - sd3pos) / (sd3pos - sd2pos)).toFixed(2));
  const adjustedHighZ = calculateLmsZScore(20, l, m, s, true);
  const unadjustedHighZ = calculateLmsZScore(20, l, m, s, false);
  assert.equal(adjustedHighZ, expectedTailZ);
  assert.ok(unadjustedHighZ !== null && adjustedHighZ !== null);
  assert.notEqual(adjustedHighZ, unadjustedHighZ);

  // Invalid/non-positive inputs -> null
  assert.equal(calculateLmsZScore(0, 1, 10, 0.1), null);
  assert.equal(calculateLmsZScore(-5, 1, 10, 0.1), null);
  assert.equal(calculateLmsZScore(Number.NaN, 1, 10, 0.1), null);
});

test('3. Normal CDF percentile conversion & extreme Z safety', () => {
  assert.equal(zScoreToPercentile(0), 50);
  assert.equal(zScoreToPercentile(1.96), 97.5);
  assert.equal(zScoreToPercentile(-2), 2.3);

  // Extreme Z scores must never produce NaN or Infinity
  const highPct = zScoreToPercentile(50);
  const lowPct = zScoreToPercentile(-50);
  assert.ok(highPct !== null && Number.isFinite(highPct) && highPct <= 100);
  assert.ok(lowPct !== null && Number.isFinite(lowPct) && lowPct >= 0);
  assert.equal(zScoreToPercentile(Number.NaN), null);
  assert.equal(formatPercentileLabel(null), '待计算');
  assert.equal(formatPercentileLabel(0.04), '< P0.1');
  assert.equal(formatPercentileLabel(99.96), '> P99.9');
});

test('4. Non-destructive recumbent/standing +/-0.7cm WHO conversion', () => {
  // < 24 months (365 days), standing measurement -> +0.7cm for WHO length table, raw preserved
  const under2Standing = normalizeHeightForWhoStandard(75.0, 365, 'standing');
  assert.equal(under2Standing.rawHeightCm, 75.0);
  assert.equal(under2Standing.standardHeightCm, 75.7);
  assert.equal(under2Standing.wasConverted, true);

  // >= 24 months (800 days), recumbent measurement -> -0.7cm for WHO height table, raw preserved
  const over2Recumbent = normalizeHeightForWhoStandard(90.0, 800, 'recumbent');
  assert.equal(over2Recumbent.rawHeightCm, 90.0);
  assert.equal(over2Recumbent.standardHeightCm, 89.3);
  assert.equal(over2Recumbent.wasConverted, true);

  // Matching posture -> no conversion
  const matching = normalizeHeightForWhoStandard(75.0, 365, 'recumbent');
  assert.equal(matching.wasConverted, false);
  assert.equal(matching.standardHeightCm, 75.0);
});

test('5. WHO reference curve series dynamically grows with age (never static flat lines)', () => {
  const heightCurves = buildWhoReferenceCurveSeries('heightCm', 'male');
  assert.equal(heightCurves.length, 73); // 0 to 36 months at 0.5-month steps
  assert.ok(heightCurves[0].median < heightCurves[24].median);
  assert.ok(heightCurves[24].median < heightCurves[72].median);
  assert.ok(heightCurves[12].sdNeg2 < heightCurves[12].median);
  assert.ok(heightCurves[12].median < heightCurves[12].sdPos2);

  // Missing sex or unloaded mode returns empty array (no fabricated curves)
  assert.equal(buildWhoReferenceCurveSeries('heightCm', null).length, 0);
  assert.equal(buildWhoReferenceCurveSeries('heightCm', 'male', 'unloaded').length, 0);
});

test('6. Measurement form validator rules', () => {
  // Future date blocked by default
  const futureBlocked = validateGrowthMeasurement({
    date: '2026-01-01',
    todayStr: '2025-11-18',
    birthDate: '2024-01-01',
    heightCm: 80,
    weightKg: 10.5,
  });
  assert.equal(futureBlocked.valid, false);

  // Future date allowed when explicit import toggle is enabled
  const futureImport = validateGrowthMeasurement({
    date: '2026-01-01',
    todayStr: '2025-11-18',
    birthDate: '2024-01-01',
    heightCm: 80,
    weightKg: 10.5,
    allowFutureImport: true,
  });
  assert.equal(futureImport.valid, true);

  // Before birthDate blocked
  const beforeBirth = validateGrowthMeasurement({
    date: '2023-12-31',
    todayStr: '2025-11-18',
    birthDate: '2024-01-01',
    heightCm: 50,
  });
  assert.equal(beforeBirth.valid, false);

  // Out-of-bounds value blocked
  const absurdHeight = validateGrowthMeasurement({
    date: '2025-01-01',
    todayStr: '2025-11-18',
    birthDate: '2024-01-01',
    heightCm: 210,
  });
  assert.equal(absurdHeight.valid, false);

  // Partial record allowed with explicit warning
  const partialRecord = validateGrowthMeasurement({
    date: '2025-01-01',
    todayStr: '2025-11-18',
    birthDate: '2024-01-01',
    heightCm: 76.0,
  });
  assert.equal(partialRecord.valid, true);
  assert.equal(partialRecord.isPartial, true);
  assert.ok(partialRecord.warnings.length > 0);
});

test('7. Growth assessment: healthy 12-month boy within WHO/NHC reference range', () => {
  const healthy12m: GrowthMeasurement = {
    id: 'm-healthy-12m',
    babyId: BASE_BOY_PROFILE.babyId,
    date: '2025-01-01', // 366 days (leap year 2024)
    heightCm: 75.7, // near WHO 12m boy median (~75.7 cm)
    weightKg: 9.6, // near WHO 12m boy median (~9.6 kg)
    headCm: 46.1, // near WHO 12m boy median (~46.1 cm)
    measurementMethod: 'recumbent',
    note: '',
  };

  const result = evaluateGrowthMeasurement(BASE_BOY_PROFILE, healthy12m);
  assert.equal(result.overallCode, 'within_reference');
  assert.equal(result.indicators.WAZ.statusCode, 'within_reference');
  assert.equal(result.indicators.LAZ.statusCode, 'within_reference');
  assert.equal(result.indicators.WLZ.statusCode, 'within_reference');
  assert.equal(result.indicators.BMIZ.statusCode, 'within_reference');
  assert.equal(result.headCircumference.statusCode, 'within_reference');
});

test('8. Growth assessment safety guards: missing sex, unloaded reference, preterm', () => {
  const m: GrowthMeasurement = {
    id: 'm-guard',
    babyId: BASE_BOY_PROFILE.babyId,
    date: '2025-01-01',
    heightCm: 75.7,
    weightKg: 9.6,
    headCm: 46.1,
    measurementMethod: 'recumbent',
    note: '',
  };

  // Missing sex -> insufficient_data, no fabricated scores
  const missingSex = evaluateGrowthMeasurement(
    { ...BASE_BOY_PROFILE, sex: null },
    m
  );
  assert.equal(missingSex.overallCode, 'insufficient_data');
  assert.equal(missingSex.indicators.WAZ.zScore, null);
  assert.equal(missingSex.indicators.LAZ.zScore, null);

  // Unloaded reference -> reference_unloaded
  const unloadedRef = evaluateGrowthMeasurement(BASE_BOY_PROFILE, m, {
    referenceMode: 'unloaded',
  });
  assert.equal(unloadedRef.overallCode, 'reference_unloaded');
  assert.equal(unloadedRef.indicators.WAZ.statusCode, 'reference_unloaded');
  assert.equal(unloadedRef.headCircumference.statusCode, 'reference_unloaded');

  // Preterm with incomplete gestational info -> pending_verification
  const pretermIncomplete = evaluateGrowthMeasurement(
    { ...BASE_BOY_PROFILE, isPreterm: true },
    m
  );
  assert.equal(pretermIncomplete.overallCode, 'pending_verification');
  assert.equal(pretermIncomplete.indicators.WAZ.statusCode, 'pending_verification');

  // Preterm with gestational age 33w (<=24m) -> pending_verification (never silently replaces age)
  const pretermComplete = evaluateGrowthMeasurement(
    { ...BASE_BOY_PROFILE, isPreterm: true, gestationalAgeWeeks: 33 },
    m
  );
  assert.equal(pretermComplete.overallCode, 'pending_verification');
  assert.equal(pretermComplete.indicators.WAZ.statusCode, 'pending_verification');
  assert.ok(pretermComplete.pretermNotice);
});

test('9. Growth assessment independent indicator boundaries & head circumference isolation', () => {
  // Stunting (LAZ < -2) with normal proportional weight (WLZ within range)
  const stuntedBoy = evaluateGrowthMeasurement(BASE_BOY_PROFILE, {
    id: 'm-stunted',
    babyId: BASE_BOY_PROFILE.babyId,
    date: '2025-01-01',
    heightCm: 69.5, // < -2SD for 12m boy (~71.0 cm)
    weightKg: 8.3, // proportional to 69.5 cm (median ~8.3 kg)
    headCm: 46.0,
    measurementMethod: 'recumbent',
    note: '',
  });
  assert.equal(stuntedBoy.indicators.LAZ.statusCode, 'stunting');
  assert.equal(stuntedBoy.indicators.WLZ.statusCode, 'within_reference');
  assert.equal(stuntedBoy.overallCode, 'needs_attention');

  // Moderate Wasting (-3 <= WLZ < -2) with normal WAZ (demonstrates WAZ vs WLZ independence: WHO 12m boy WFA -2SD ~ 7.74 kg, WFL@76cm -2SD ~ 8.1 kg)
  const wastedBoy = evaluateGrowthMeasurement(BASE_BOY_PROFILE, {
    id: 'm-wasted',
    babyId: BASE_BOY_PROFILE.babyId,
    date: '2025-01-01',
    heightCm: 76.0, // normal length
    weightKg: 7.75,
    headCm: 46.0,
    measurementMethod: 'recumbent',
    note: '',
  });
  assert.equal(wastedBoy.indicators.LAZ.statusCode, 'within_reference');
  assert.equal(wastedBoy.indicators.WAZ.statusCode, 'within_reference');
  assert.equal(wastedBoy.indicators.WLZ.statusCode, 'wasting');

  // Underweight (WAZ < -2) + Severe Wasting (WLZ < -3)
  const severelyWastedBoy = evaluateGrowthMeasurement(BASE_BOY_PROFILE, {
    id: 'm-severe-wasted',
    babyId: BASE_BOY_PROFILE.babyId,
    date: '2025-01-01',
    heightCm: 76.0,
    weightKg: 7.3,
    headCm: 46.0,
    measurementMethod: 'recumbent',
    note: '',
  });
  assert.equal(severelyWastedBoy.indicators.WAZ.statusCode, 'underweight');
  assert.equal(severelyWastedBoy.indicators.WLZ.statusCode, 'severe_wasting');
  assert.equal(severelyWastedBoy.overallCode, 'professional_eval');

  // Overweight (+1 < WLZ <= +2) under NHC guideline
  const overweightBoy = evaluateGrowthMeasurement(BASE_BOY_PROFILE, {
    id: 'm-overweight',
    babyId: BASE_BOY_PROFILE.babyId,
    date: '2025-01-01',
    heightCm: 75.7,
    weightKg: 11.2, // WLZ ~ +1.5
    headCm: 46.0,
    measurementMethod: 'recumbent',
    note: '',
  });
  assert.equal(overweightBoy.indicators.WLZ.statusCode, 'overweight');
  assert.equal(overweightBoy.indicators.BMIZ.statusCode, 'overweight');
  assert.equal(overweightBoy.overallCode, 'needs_attention');

  // Obesity (WLZ > +2) under NHC guideline
  const obeseBoy = evaluateGrowthMeasurement(BASE_BOY_PROFILE, {
    id: 'm-obese',
    babyId: BASE_BOY_PROFILE.babyId,
    date: '2025-01-01',
    heightCm: 75.7,
    weightKg: 12.6, // WLZ > +2.5
    headCm: 46.0,
    measurementMethod: 'recumbent',
    note: '',
  });
  assert.equal(obeseBoy.indicators.WLZ.statusCode, 'obesity');
  assert.equal(obeseBoy.overallCode, 'professional_eval');

  // Head circumference abnormal (< -2SD) must NOT change overall nutritional grading
  const headOnlyAbnormal = evaluateGrowthMeasurement(BASE_BOY_PROFILE, {
    id: 'm-head-only',
    babyId: BASE_BOY_PROFILE.babyId,
    date: '2025-01-01',
    heightCm: 75.7,
    weightKg: 9.6,
    headCm: 42.5, // < -2SD for 12m boy
    measurementMethod: 'recumbent',
    note: '',
  });
  assert.equal(headOnlyAbnormal.headCircumference.statusCode, 'head_small');
  assert.equal(headOnlyAbnormal.overallCode, 'within_reference');

  // Partial measurement (only height normal, missing weight) must NEVER be graded overall normal
  const heightOnly = evaluateGrowthMeasurement(BASE_BOY_PROFILE, {
    id: 'm-height-only',
    babyId: BASE_BOY_PROFILE.babyId,
    date: '2025-01-01',
    heightCm: 75.7,
    measurementMethod: 'recumbent',
    note: '',
  });
  assert.equal(heightOnly.indicators.LAZ.statusCode, 'within_reference');
  assert.equal(heightOnly.indicators.WAZ.statusCode, 'insufficient_data');
  assert.equal(heightOnly.overallCode, 'insufficient_data');
});
