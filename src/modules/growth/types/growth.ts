export type GrowthViewRoute = 'overview' | 'assessment' | 'entry';

export type GrowthMetricKey = 'heightCm' | 'weightKg' | 'headCm';

export type MeasurementMethod = 'recumbent' | 'standing';

export type BiologicalSex = 'male' | 'female';

export type WhoIndicatorCode = 'wfa' | 'lhfa' | 'wfl' | 'wfh' | 'bfa' | 'hcfa';

export interface GrowthBabyProfile {
  babyId: string;
  name: string;
  birthDate: string; // YYYY-MM-DD or ''
  sex: BiologicalSex | null;
  isPreterm: boolean;
  gestationalAgeWeeks?: number;
  expectedDueDate?: string;
}

export interface GrowthMeasurement {
  id: string;
  babyId: string;
  date: string; // YYYY-MM-DD
  heightCm?: number; // 原始身长/身高测量值（不可被转换覆盖）
  weightKg?: number;
  headCm?: number;
  measurementMethod?: MeasurementMethod; // 原始测量方式：卧位 / 立位
  note: string;
  isDemo?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgeCalculationResult {
  birthDate: string;
  measurementDate: string;
  ageDays: number;
  exactMonths: number; // ageDays / 30.4375 (WHO 标准平均月长)
  calendarYears: number;
  calendarMonths: number;
  calendarDays: number;
  totalCalendarMonths: number;
  displayAge: string; // 例如：2岁1个月 / 8个月12天 / 41天
  compactAge: string; // 例如：25.0 月龄
  isValid: boolean;
  isOutOf0To36Range: boolean;
  pretermGuard: {
    isPreterm: boolean;
    hasCompletePretermInfo: boolean;
    requiresClinicalCorrectionRule: boolean;
    notice: string | null;
  };
}

export interface LmsParams {
  l: number;
  m: number;
  s: number;
  x: number;
  clamped: boolean;
}

export interface LmsTableData {
  indicator: WhoIndicatorCode;
  sex: BiologicalSex;
  xAxis: 'day' | 'length' | 'height';
  start: number;
  step: number;
  lms: ReadonlyArray<readonly [number, number, number]>;
}

export interface WhoReferenceVersion {
  versionId: string;
  standardName: string;
  guidelineName: string;
  version: string;
  ageRangeLabel: string;
  unitsSummary: string;
  updatedAt: string;
  status: 'loaded' | 'unloaded';
  sourceNote: string;
}

export type EvaluationSeverity = 'normal' | 'attention' | 'professional' | 'insufficient';

export type IndicatorStatusCode =
  | 'within_reference'
  | 'underweight'
  | 'severe_underweight'
  | 'stunting'
  | 'severe_stunting'
  | 'wasting'
  | 'severe_wasting'
  | 'overweight'
  | 'obesity'
  | 'above_reference'
  | 'head_small'
  | 'head_large'
  | 'pending_verification'
  | 'insufficient_data'
  | 'reference_unloaded'
  | 'out_of_range';

export interface IndicatorEvaluation {
  key: 'WAZ' | 'LAZ' | 'WLZ' | 'BMIZ';
  title: string;
  shortLabel: string;
  whoIndicator: WhoIndicatorCode;
  rawValue: number | null;
  evaluatedValue: number | null;
  unit: string;
  conversionNote?: string;
  zScore: number | null;
  percentile: number | null;
  percentileLabel: string;
  medianReference: number | null;
  statusCode: IndicatorStatusCode;
  statusLabel: string;
  severity: EvaluationSeverity;
  referenceStandard: string;
  guidelineBoundaryNote: string;
  explanation: string;
  detailMessage: string;
}

export interface HeadCircumferenceEvaluation {
  key: 'HCZ';
  title: string;
  rawValue: number | null;
  unit: 'cm';
  zScore: number | null;
  percentile: number | null;
  percentileLabel: string;
  medianReference: number | null;
  statusCode: IndicatorStatusCode;
  statusLabel: string;
  severity: EvaluationSeverity;
  referenceStandard: string;
  advice: string;
}

export type OverallAssessmentCode =
  | 'within_reference'
  | 'needs_attention'
  | 'professional_eval'
  | 'insufficient_data'
  | 'pending_verification'
  | 'reference_unloaded';

export interface GrowthAssessmentResult {
  assessmentId: string;
  measurementId: string;
  babyId: string;
  measurementDate: string;
  computedAt: string;
  referenceVersionId: string;
  referenceStandardName: string;
  age: AgeCalculationResult | null;
  overallCode: OverallAssessmentCode;
  overallLabel: string;
  overallSeverity: EvaluationSeverity;
  overallSummary: string;
  blockingReasons: string[];
  pretermNotice: string | null;
  indicators: {
    WAZ: IndicatorEvaluation;
    LAZ: IndicatorEvaluation;
    WLZ: IndicatorEvaluation;
    BMIZ: IndicatorEvaluation;
  };
  headCircumference: HeadCircumferenceEvaluation;
  disclaimer: string;
}

export interface GrowthReminderItem {
  monthAge: number;
  label: string;
  source: string;
  status: 'completed' | 'upcoming' | 'overdue' | 'future';
  completedDate?: string;
  targetDate?: string;
}

export interface GrowthValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  isPartial: boolean;
  missingFields: string[];
}

export interface ReferenceCurvePoint {
  month: number;
  day: number;
  sdNeg2: number;
  sdNeg1: number;
  median: number;
  sdPos1: number;
  sdPos2: number;
}
