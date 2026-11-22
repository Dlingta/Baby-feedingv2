import {
  BiologicalSex,
  GrowthMetricKey,
  LmsParams,
  LmsTableData,
  MeasurementMethod,
  ReferenceCurvePoint,
  WhoIndicatorCode,
} from '../types/growth';
import { getWhoLmsTable, ReferenceLoadMode } from '../data/whoGrowthStandards';
import { WHO_DAYS_PER_MONTH } from './ageCalculator';

/** WHO 2006 规定：卧位身长平均比立位身高长 0.7 cm */
export const WHO_RECUMBENT_STANDING_DIFF_CM = 0.7;

/**
 * WHO 标准 LMS 公式计算 Z-score：
 * - 当 L != 0 时：Z = ((X / M)^L - 1) / (L * S)
 * - 当 L == 0 时：Z = ln(X / M) / S
 *
 * 依据 WHO Child Growth Standards (2006) 技术规范：
 * 对体重相关指标（wfa / wfl / wfh / bfa），当 |Z| > 3 时采用 ±3SD 处外推斜率限制极端尾部分布，
 * 避免偏态分布外推出现不合理数值或 NaN。
 */
export function calculateLmsZScore(
  value: number,
  l: number,
  m: number,
  s: number,
  useWhoTailAdjustment = true
): number | null {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(l) ||
    !Number.isFinite(m) ||
    !Number.isFinite(s) ||
    value <= 0 ||
    m <= 0 ||
    s <= 0
  ) {
    return null;
  }

  let z: number;
  if (Math.abs(l) < 1e-7) {
    z = Math.log(value / m) / s;
  } else {
    z = (Math.pow(value / m, l) - 1) / (l * s);
  }

  if (!Number.isFinite(z)) {
    return null;
  }

  if (useWhoTailAdjustment) {
    if (z > 3) {
      const sd3pos = calculateValueFromLms(3, l, m, s);
      const sd2pos = calculateValueFromLms(2, l, m, s);
      if (sd3pos !== null && sd2pos !== null && sd3pos > sd2pos) {
        const sd23pos = sd3pos - sd2pos;
        z = 3 + (value - sd3pos) / sd23pos;
      }
    } else if (z < -3) {
      const sd3neg = calculateValueFromLms(-3, l, m, s);
      const sd2neg = calculateValueFromLms(-2, l, m, s);
      if (sd3neg !== null && sd2neg !== null && sd2neg > sd3neg) {
        const sd23neg = sd2neg - sd3neg;
        z = -3 + (value - sd3neg) / sd23neg;
      }
    }
  }

  return Number.isFinite(z) ? Number(z.toFixed(2)) : null;
}

/**
 * 反向由 Z-score 与 LMS 参数求参考曲线对应数值 X：
 * - L != 0: X = M * (1 + L * S * Z)^(1 / L)
 * - L == 0: X = M * exp(S * Z)
 */
export function calculateValueFromLms(
  z: number,
  l: number,
  m: number,
  s: number
): number | null {
  if (
    !Number.isFinite(z) ||
    !Number.isFinite(l) ||
    !Number.isFinite(m) ||
    !Number.isFinite(s) ||
    m <= 0 ||
    s <= 0
  ) {
    return null;
  }

  if (Math.abs(l) < 1e-7) {
    const val = m * Math.exp(s * z);
    return Number.isFinite(val) ? val : null;
  }

  const inner = 1 + l * s * z;
  if (inner <= 0) {
    return null;
  }
  const val = m * Math.pow(inner, 1 / l);
  return Number.isFinite(val) ? val : null;
}

/**
 * 在 WHO LMS 表格中按横坐标 x（日龄或身长/身高 cm）线性插值查找 L、M、S。
 * 若 x 超出官方表区间，默认返回 null（除非显式 clamp=true）。
 */
export function lookupLmsParams(
  table: LmsTableData,
  x: number,
  options?: { clamp?: boolean }
): LmsParams | null {
  if (!table || !table.lms.length || !Number.isFinite(x)) {
    return null;
  }

  const maxIndex = table.lms.length - 1;
  const minX = table.start;
  const maxX = table.start + maxIndex * table.step;

  let clamped = false;
  let targetX = x;

  if (x < minX || x > maxX) {
    if (!options?.clamp) {
      return null;
    }
    clamped = true;
    targetX = Math.max(minX, Math.min(maxX, x));
  }

  const floatIdx = (targetX - table.start) / table.step;
  const lowIdx = Math.max(0, Math.min(maxIndex, Math.floor(floatIdx)));
  const highIdx = Math.max(0, Math.min(maxIndex, Math.ceil(floatIdx)));

  const [l0, m0, s0] = table.lms[lowIdx];
  if (lowIdx === highIdx) {
    return { l: l0, m: m0, s: s0, x: targetX, clamped };
  }

  const [l1, m1, s1] = table.lms[highIdx];
  const ratio = floatIdx - lowIdx;
  return {
    l: l0 + (l1 - l0) * ratio,
    m: m0 + (m1 - m0) * ratio,
    s: s0 + (s1 - s0) * ratio,
    x: targetX,
    clamped,
  };
}

/**
 * WHO 2006 测量方式转换（仅用于标准匹配，不覆盖原始记录）：
 * - 0～24 月龄（< 731 天）WHO 标准为卧位身长：若实际采用立位测量，转换值 = 原始值 + 0.7 cm
 * - ≥ 24 月龄（≥ 731 天）WHO 标准为立位身高：若实际采用卧位测量，转换值 = 原始值 - 0.7 cm
 */
export function normalizeHeightForWhoStandard(
  rawHeightCm: number,
  ageDays: number,
  method?: MeasurementMethod
): {
  rawHeightCm: number;
  standardHeightCm: number;
  expectedMethod: MeasurementMethod;
  actualMethod: MeasurementMethod;
  wasConverted: boolean;
  conversionNote?: string;
} {
  const expectedMethod: MeasurementMethod = ageDays < 731 ? 'recumbent' : 'standing';
  const actualMethod: MeasurementMethod = method ?? expectedMethod;

  if (actualMethod === expectedMethod) {
    return {
      rawHeightCm,
      standardHeightCm: rawHeightCm,
      expectedMethod,
      actualMethod,
      wasConverted: false,
    };
  }

  if (expectedMethod === 'recumbent' && actualMethod === 'standing') {
    const converted = Number((rawHeightCm + WHO_RECUMBENT_STANDING_DIFF_CM).toFixed(2));
    return {
      rawHeightCm,
      standardHeightCm: converted,
      expectedMethod,
      actualMethod,
      wasConverted: true,
      conversionNote: `未满 24 月龄按 WHO 规范立位转卧位（+0.7 cm -> ${converted.toFixed(1)} cm），原始记录已保留`,
    };
  }

  const converted = Number((rawHeightCm - WHO_RECUMBENT_STANDING_DIFF_CM).toFixed(2));
  return {
    rawHeightCm,
    standardHeightCm: converted,
    expectedMethod,
    actualMethod,
    wasConverted: true,
    conversionNote: `满 24 月龄按 WHO 规范卧位转立位（-0.7 cm -> ${converted.toFixed(1)} cm），原始记录已保留`,
  };
}

export function getRecommendedMethodForAge(exactMonths: number | null): {
  method: MeasurementMethod;
  label: string;
  tip: string;
} {
  if (exactMonths !== null && exactMonths >= 24) {
    return {
      method: 'standing',
      label: '立位测量',
      tip: '宝宝已满 24 月龄，依据 WHO 标准建议使用「立位测量」记录身高。',
    };
  }
  return {
    method: 'recumbent',
    label: '卧位测量',
    tip: '0～24 月龄婴幼儿依据 WHO 标准建议使用「卧位测量」记录身长。',
  };
}

export function metricToAgeIndicator(metric: GrowthMetricKey): WhoIndicatorCode {
  if (metric === 'heightCm') return 'lhfa';
  if (metric === 'weightKg') return 'wfa';
  return 'hcfa';
}

/**
 * 为 0～36 月龄生成动态变化的 WHO 标准参考曲线点集（-2SD, -1SD, Median, +1SD, +2SD）
 */
export function buildWhoReferenceCurveSeries(
  metric: GrowthMetricKey,
  sex: BiologicalSex | null,
  overrideMode?: ReferenceLoadMode
): ReferenceCurvePoint[] {
  if (!sex) {
    return [];
  }
  const indicator = metricToAgeIndicator(metric);
  const table = getWhoLmsTable(indicator, sex, overrideMode);
  if (!table) {
    return [];
  }

  const points: ReferenceCurvePoint[] = [];
  // 每 0.5 月龄采样一次（共 73 个点），使 0~36 月龄曲线平滑且准确反映早期快速增长
  for (let half = 0; half <= 72; half++) {
    const month = half * 0.5;
    const day = Math.round(month * WHO_DAYS_PER_MONTH);
    const lms = lookupLmsParams(table, day, { clamp: true });
    if (!lms) continue;

    const sdNeg2 = calculateValueFromLms(-2, lms.l, lms.m, lms.s);
    const sdNeg1 = calculateValueFromLms(-1, lms.l, lms.m, lms.s);
    const median = calculateValueFromLms(0, lms.l, lms.m, lms.s);
    const sdPos1 = calculateValueFromLms(1, lms.l, lms.m, lms.s);
    const sdPos2 = calculateValueFromLms(2, lms.l, lms.m, lms.s);

    if (
      sdNeg2 !== null &&
      sdNeg1 !== null &&
      median !== null &&
      sdPos1 !== null &&
      sdPos2 !== null
    ) {
      points.push({
        month,
        day,
        sdNeg2: Number(sdNeg2.toFixed(2)),
        sdNeg1: Number(sdNeg1.toFixed(2)),
        median: Number(median.toFixed(2)),
        sdPos1: Number(sdPos1.toFixed(2)),
        sdPos2: Number(sdPos2.toFixed(2)),
      });
    }
  }

  return points;
}
