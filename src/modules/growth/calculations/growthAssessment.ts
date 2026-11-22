import {
  EvaluationSeverity,
  GrowthAssessmentResult,
  GrowthBabyProfile,
  GrowthMeasurement,
  HeadCircumferenceEvaluation,
  IndicatorEvaluation,
  IndicatorStatusCode,
  OverallAssessmentCode,
  WhoIndicatorCode,
} from '../types/growth';
import {
  getCurrentReferenceVersion,
  getWhoLmsTable,
  ReferenceLoadMode,
} from '../data/whoGrowthStandards';
import { calculateGrowthAge } from './ageCalculator';
import {
  calculateLmsZScore,
  lookupLmsParams,
  normalizeHeightForWhoStandard,
} from './lmsCalculator';
import {
  formatPercentileLabel,
  zScoreToPercentile,
} from './percentileCalculator';

const GUIDELINE_DISCLAIMER =
  '评价结果仅用于成长监测和营养状况参考，不替代专业医疗诊断。';

const INDICATOR_EXPLANATIONS: Record<'WAZ' | 'LAZ' | 'WLZ' | 'BMIZ', string> = {
  WAZ: '年龄别体重（WAZ）反映宝宝当前体重与同年龄、同性别儿童参考体重之间的相对位置，主要用于筛查低体重（急性或慢性营养不良风险），不能单独用于判定超重或肥胖。',
  LAZ: '年龄别身长/身高（LAZ）反映宝宝身长/身高与同年龄、同性别儿童参考值之间的相对位置，主要用于识别生长迟缓（长期慢性营养不足或生长受限）。',
  WLZ: '身长/身高别体重（WLZ）反映宝宝体重与相同身长/身高、同性别儿童参考体重之间的比例关系，主要用于识别消瘦、超重与肥胖（0～24月龄对应身长别体重，24～36月龄对应身高别体重）。',
  BMIZ: '年龄别 BMI（体质指数 = 体重kg ÷ 身长m²）结合宝宝的精确月龄和生理性别进行评价，用于辅助筛查消瘦、超重与肥胖，不可直接套用成人 BMI 数值标准。',
};

function makeUnavailableIndicator(
  key: 'WAZ' | 'LAZ' | 'WLZ' | 'BMIZ',
  title: string,
  shortLabel: string,
  whoIndicator: WhoIndicatorCode,
  unit: string,
  rawValue: number | null,
  statusCode: IndicatorStatusCode,
  statusLabel: string,
  detailMessage: string,
  referenceStandard: string
): IndicatorEvaluation {
  return {
    key,
    title,
    shortLabel,
    whoIndicator,
    rawValue,
    evaluatedValue: null,
    unit,
    zScore: null,
    percentile: null,
    percentileLabel: '待计算',
    medianReference: null,
    statusCode,
    statusLabel,
    severity: 'insufficient',
    referenceStandard,
    guidelineBoundaryNote: '需完整档案、生理性别与有效参考数据方可计算对应边界。',
    explanation: INDICATOR_EXPLANATIONS[key],
    detailMessage,
  };
}

/**
 * 依据国家卫生健康委《婴幼儿营养喂养评估服务指南（试行）》与 WHO Child Growth Standards (2006)
 * 分别对四项核心指标及头围进行独立判定（绝不用统一 ±2SD 粗暴套用所有指标）。
 */
function classifyWaz(z: number): {
  statusCode: IndicatorStatusCode;
  statusLabel: string;
  severity: EvaluationSeverity;
  detailMessage: string;
} {
  if (z < -3) {
    return {
      statusCode: 'severe_underweight',
      statusLabel: '重度低体重',
      severity: 'professional',
      detailMessage: '年龄别体重低于 -3SD，提示重度低体重风险，建议尽快前往儿童保健或儿科专业评估。',
    };
  }
  if (z < -2) {
    return {
      statusCode: 'underweight',
      statusLabel: '低体重',
      severity: 'attention',
      detailMessage: '年龄别体重低于 -2SD（<P3），符合低体重筛查边界，建议结合喂养情况与儿保随访。',
    };
  }
  if (z > 2) {
    return {
      statusCode: 'above_reference',
      statusLabel: '高于参考区间',
      severity: 'attention',
      detailMessage:
        '年龄别体重高于 +2SD，但 WAZ 不直接等同于超重或肥胖，请重点结合身长/身高别体重（WLZ）与年龄别 BMI 综合判断。',
    };
  }
  return {
    statusCode: 'within_reference',
    statusLabel: '参考区间内',
    severity: 'normal',
    detailMessage: '年龄别体重处于同龄同性别儿童参考区间（-2SD ～ +2SD）内。',
  };
}

function classifyLaz(z: number): {
  statusCode: IndicatorStatusCode;
  statusLabel: string;
  severity: EvaluationSeverity;
  detailMessage: string;
} {
  if (z < -3) {
    return {
      statusCode: 'severe_stunting',
      statusLabel: '重度生长迟缓',
      severity: 'professional',
      detailMessage: '年龄别身长/身高低于 -3SD，提示重度生长迟缓风险，建议尽快接受儿童保健专业评估。',
    };
  }
  if (z < -2) {
    return {
      statusCode: 'stunting',
      statusLabel: '生长迟缓',
      severity: 'attention',
      detailMessage: '年龄别身长/身高低于 -2SD（<P3），符合生长迟缓筛查边界，需持续监测身高增速并咨询儿保人员。',
    };
  }
  if (z > 2) {
    return {
      statusCode: 'above_reference',
      statusLabel: '高于参考区间',
      severity: 'normal',
      detailMessage: '年龄别身长/身高高于 +2SD，通常反映身高较同龄儿童偏高，建议持续记录生长速度。',
    };
  }
  return {
    statusCode: 'within_reference',
    statusLabel: '参考区间内',
    severity: 'normal',
    detailMessage: '年龄别身长/身高处于同龄同性别儿童参考区间（-2SD ～ +2SD）内。',
  };
}

/**
 * 身长/身高别体重（WLZ）与年龄别 BMI（BMIZ）评价边界：
 * 依据国家卫生健康委《婴幼儿营养喂养评估服务指南（试行）》：
 * - < -2SD（<P3）：消瘦（< -3SD 为重度消瘦）
 * - -2SD ～ +1SD：参考区间内
 * - > +1SD 且 <= +2SD（P85～P97）：超重（注：WHO 2006 对 0~5 岁该区间表述为“超重风险”）
 * - > +2SD（>=P97）：肥胖（注：WHO 2006 对 0~5 岁 >+2SD 为超重、>+3SD 为肥胖；此处严格标明两套标准差异）
 */
function classifyProportionalWeight(
  z: number,
  metricName: string
): {
  statusCode: IndicatorStatusCode;
  statusLabel: string;
  severity: EvaluationSeverity;
  detailMessage: string;
} {
  if (z < -3) {
    return {
      statusCode: 'severe_wasting',
      statusLabel: '重度消瘦',
      severity: 'professional',
      detailMessage: `${metricName}低于 -3SD，提示重度消瘦（急性营养不良高风险），建议尽快就医评估。`,
    };
  }
  if (z < -2) {
    return {
      statusCode: 'wasting',
      statusLabel: '消瘦',
      severity: 'attention',
      detailMessage: `${metricName}低于 -2SD（<P3），符合消瘦筛查边界，建议排查近期喂养摄入或疾病影响并咨询儿保人员。`,
    };
  }
  if (z > 2) {
    return {
      statusCode: 'obesity',
      statusLabel: '肥胖（卫健委标准）',
      severity: 'professional',
      detailMessage: `${metricName}高于 +2SD（≥P97），依据国家卫健委试行指南达肥胖筛查边界（WHO 2006 对 0～5 岁 >+2SD 界定为超重、>+3SD 为肥胖），建议由儿保医生结合喂养结构综合评估。`,
    };
  }
  if (z > 1) {
    return {
      statusCode: 'overweight',
      statusLabel: '超重（卫健委标准）',
      severity: 'attention',
      detailMessage: `${metricName}位于 +1SD ～ +2SD（P85～P97）之间，依据国家卫健委试行指南达超重筛查边界（WHO 2006 表述为超重风险），建议关注喂养节律与活动量。`,
    };
  }
  return {
    statusCode: 'within_reference',
    statusLabel: '参考区间内',
    severity: 'normal',
    detailMessage: `${metricName}处于适宜参考区间（-2SD ～ +1SD）内，体格匀称度良好。`,
  };
}

function classifyHeadCircumference(z: number): {
  statusCode: IndicatorStatusCode;
  statusLabel: string;
  severity: EvaluationSeverity;
  advice: string;
} {
  if (z < -2) {
    return {
      statusCode: 'head_small',
      statusLabel: '低于参考区间',
      severity: z < -3 ? 'professional' : 'attention',
      advice:
        '头围低于同龄同性别 -2SD，头围用于神经与颅脑发育监测，不归入体重营养分级；建议咨询儿童保健专业人员复测与评估。',
    };
  }
  if (z > 2) {
    return {
      statusCode: 'head_large',
      statusLabel: '高于参考区间',
      severity: z > 3 ? 'professional' : 'attention',
      advice:
        '头围高于同龄同性别 +2SD，头围用于发育监测而非营养状态分级；建议携带连续头围曲线咨询儿童保健专业人员。',
    };
  }
  return {
    statusCode: 'within_reference',
    statusLabel: '参考区间内',
    severity: 'normal',
    advice: '头围处于同龄同性别儿童 -2SD ～ +2SD 参考区间内（仅用于生长发育监测，不参与营养体重分级）。',
  };
}

export function evaluateGrowthMeasurement(
  profile: GrowthBabyProfile | null,
  measurement: GrowthMeasurement | null,
  options?: { referenceMode?: ReferenceLoadMode }
): GrowthAssessmentResult {
  const refVersion = getCurrentReferenceVersion();
  const effectiveRefLoaded =
    options?.referenceMode ? options.referenceMode === 'official_who_2006' : refVersion.status === 'loaded';
  const refLabel = effectiveRefLoaded
    ? `${refVersion.standardName} · ${refVersion.guidelineName}`
    : '参考数据未加载';

  const blockingReasons: string[] = [];
  if (!profile || !profile.birthDate) {
    blockingReasons.push('尚未完善宝宝出生日期，无法计算精确月龄');
  }
  if (!profile || !profile.sex) {
    blockingReasons.push('缺少宝宝生理性别（男宝 / 女宝），无法匹配 WHO 性别参考曲线');
  }
  if (!measurement) {
    blockingReasons.push('暂无测量记录，请先录入身高、体重或头围数据');
  }
  if (!effectiveRefLoaded) {
    blockingReasons.push('WHO 生长标准参考数据未加载，暂无法计算 Z-score 与百分位数');
  }

  const age =
    profile?.birthDate && measurement?.date
      ? calculateGrowthAge(profile.birthDate, measurement.date, {
          isPreterm: profile.isPreterm,
          gestationalAgeWeeks: profile.gestationalAgeWeeks,
          expectedDueDate: profile.expectedDueDate,
        })
      : null;

  if (age && !age.isValid) {
    blockingReasons.push('测量日期早于出生日期，无法进行评价');
  } else if (age?.isOutOf0To36Range) {
    blockingReasons.push('当前月龄超出本模块 0～36 月龄婴幼儿评估适用范围');
  }

  const pretermGuardTriggered = Boolean(age?.pretermGuard.requiresClinicalCorrectionRule);
  if (age?.pretermGuard.isPreterm && !age.pretermGuard.hasCompletePretermInfo) {
    blockingReasons.push('早产儿出生孕周或预产期资料未完善，不得擅自给出校正后评价');
  }

  // 若存在硬性前置条件缺失（无档案/无性别/无测量/参考数据未加载/日期非法/超出0-36月龄）
  if (
    blockingReasons.length > 0 ||
    !profile ||
    !profile.sex ||
    !measurement ||
    !age ||
    !age.isValid ||
    age.isOutOf0To36Range
  ) {
    const isRefError = !effectiveRefLoaded;
    const isPretermIncomplete = Boolean(
      age?.pretermGuard.isPreterm && !age.pretermGuard.hasCompletePretermInfo
    );
    const reasonText = blockingReasons.join('；');
    const code: IndicatorStatusCode = isRefError
      ? 'reference_unloaded'
      : isPretermIncomplete
      ? 'pending_verification'
      : age?.isOutOf0To36Range
      ? 'out_of_range'
      : 'insufficient_data';
    const badgeLabel = isRefError
      ? '参考数据未加载'
      : isPretermIncomplete
      ? '待核实'
      : '待计算';

    return {
      assessmentId: `assess-${measurement?.id || 'empty'}-${Date.now()}`,
      measurementId: measurement?.id || '',
      babyId: profile?.babyId || '',
      measurementDate: measurement?.date || '',
      computedAt: new Date().toISOString(),
      referenceVersionId: isRefError ? 'WHO-UNLOADED' : refVersion.versionId,
      referenceStandardName: refLabel,
      age,
      overallCode: isRefError
        ? 'reference_unloaded'
        : isPretermIncomplete
        ? 'pending_verification'
        : 'insufficient_data',
      overallLabel: isRefError
        ? '参考数据未加载'
        : isPretermIncomplete
        ? '待核实（早产儿资料未完善）'
        : '数据不足，暂无法评价',
      overallSeverity: 'insufficient',
      overallSummary: reasonText || '请先完善宝宝出生日期、生理性别与测量数据。',
      blockingReasons,
      pretermNotice: age?.pretermGuard.notice || null,
      indicators: {
        WAZ: makeUnavailableIndicator(
          'WAZ',
          '年龄别体重',
          'WAZ',
          'wfa',
          'kg',
          measurement?.weightKg ?? null,
          code,
          badgeLabel,
          reasonText,
          refLabel
        ),
        LAZ: makeUnavailableIndicator(
          'LAZ',
          '年龄别身长/身高',
          'LAZ',
          'lhfa',
          'cm',
          measurement?.heightCm ?? null,
          code,
          badgeLabel,
          reasonText,
          refLabel
        ),
        WLZ: makeUnavailableIndicator(
          'WLZ',
          '身长/身高别体重',
          'WLZ',
          age && age.ageDays >= 731 ? 'wfh' : 'wfl',
          'kg',
          measurement?.weightKg ?? null,
          code,
          badgeLabel,
          reasonText,
          refLabel
        ),
        BMIZ: makeUnavailableIndicator(
          'BMIZ',
          '年龄别 BMI',
          'BMIZ',
          'bfa',
          'kg/m²',
          null,
          code,
          badgeLabel,
          reasonText,
          refLabel
        ),
      },
      headCircumference: {
        key: 'HCZ',
        title: '年龄别头围（发育监测）',
        rawValue: measurement?.headCm ?? null,
        unit: 'cm',
        zScore: null,
        percentile: null,
        percentileLabel: '待计算',
        medianReference: null,
        statusCode: code,
        statusLabel: badgeLabel,
        severity: 'insufficient',
        referenceStandard: refLabel,
        advice: reasonText || '完善性别、出生日期与头围数值后可单独生成头围发育参考。',
      },
      disclaimer: GUIDELINE_DISCLAIMER,
    };
  }

  const sex = profile.sex;
  const ageDays = age.ageDays;

  // 若存在身长/身高，则按 WHO 规范执行立位/卧位 0.7cm 匹配转换（绝不覆盖原始值）
  const normalizedHeight =
    typeof measurement.heightCm === 'number' && Number.isFinite(measurement.heightCm)
      ? normalizeHeightForWhoStandard(measurement.heightCm, ageDays, measurement.measurementMethod)
      : null;

  // 1. WAZ：年龄别体重
  let wazEval: IndicatorEvaluation;
  const wfaTable = getWhoLmsTable('wfa', sex, options?.referenceMode);
  if (typeof measurement.weightKg !== 'number' || !Number.isFinite(measurement.weightKg)) {
    wazEval = makeUnavailableIndicator(
      'WAZ',
      '年龄别体重',
      'WAZ',
      'wfa',
      'kg',
      null,
      'insufficient_data',
      '待完善资料',
      '本次记录未填写体重数值。',
      refLabel
    );
  } else if (!wfaTable) {
    wazEval = makeUnavailableIndicator(
      'WAZ',
      '年龄别体重',
      'WAZ',
      'wfa',
      'kg',
      measurement.weightKg,
      'reference_unloaded',
      '参考数据未加载',
      'WHO 年龄别体重（wfa）参考表未加载。',
      refLabel
    );
  } else {
    const lms = lookupLmsParams(wfaTable, ageDays);
    const z = lms ? calculateLmsZScore(measurement.weightKg, lms.l, lms.m, lms.s, true) : null;
    if (!lms || z === null) {
      wazEval = makeUnavailableIndicator(
        'WAZ',
        '年龄别体重',
        'WAZ',
        'wfa',
        'kg',
        measurement.weightKg,
        'out_of_range',
        '超出参考范围',
        '当前日龄超出 WHO 参考表范围。',
        refLabel
      );
    } else {
      const pct = zScoreToPercentile(z);
      const cls = classifyWaz(z);
      wazEval = {
        key: 'WAZ',
        title: '年龄别体重',
        shortLabel: 'WAZ',
        whoIndicator: 'wfa',
        rawValue: measurement.weightKg,
        evaluatedValue: measurement.weightKg,
        unit: 'kg',
        zScore: z,
        percentile: pct,
        percentileLabel: formatPercentileLabel(pct),
        medianReference: Number(lms.m.toFixed(2)),
        statusCode: pretermGuardTriggered ? 'pending_verification' : cls.statusCode,
        statusLabel: pretermGuardTriggered ? `待核实（未校正：${cls.statusLabel}）` : cls.statusLabel,
        severity: pretermGuardTriggered ? 'insufficient' : cls.severity,
        referenceStandard: 'WHO 2006 wfa + 国家卫健委试行指南',
        guidelineBoundaryNote: '低体重：<-2SD（<P3）；重度低体重：<-3SD；参考区间：-2SD ～ +2SD',
        explanation: INDICATOR_EXPLANATIONS.WAZ,
        detailMessage: pretermGuardTriggered
          ? `${cls.detailMessage}（注：早产儿当前按实际月龄计算，校正年龄评价需经儿保医生核实。）`
          : cls.detailMessage,
      };
    }
  }

  // 2. LAZ：年龄别身长/身高
  let lazEval: IndicatorEvaluation;
  const lhfaTable = getWhoLmsTable('lhfa', sex, options?.referenceMode);
  if (!normalizedHeight) {
    lazEval = makeUnavailableIndicator(
      'LAZ',
      '年龄别身长/身高',
      'LAZ',
      'lhfa',
      'cm',
      null,
      'insufficient_data',
      '待完善资料',
      '本次记录未填写身长/身高数值。',
      refLabel
    );
  } else if (!lhfaTable) {
    lazEval = makeUnavailableIndicator(
      'LAZ',
      '年龄别身长/身高',
      'LAZ',
      'lhfa',
      'cm',
      normalizedHeight.rawHeightCm,
      'reference_unloaded',
      '参考数据未加载',
      'WHO 年龄别身长/身高（lhfa）参考表未加载。',
      refLabel
    );
  } else {
    const lms = lookupLmsParams(lhfaTable, ageDays);
    const z = lms
      ? calculateLmsZScore(normalizedHeight.standardHeightCm, lms.l, lms.m, lms.s, false)
      : null;
    if (!lms || z === null) {
      lazEval = makeUnavailableIndicator(
        'LAZ',
        '年龄别身长/身高',
        'LAZ',
        'lhfa',
        'cm',
        normalizedHeight.rawHeightCm,
        'out_of_range',
        '超出参考范围',
        '当前日龄超出 WHO 参考表范围。',
        refLabel
      );
    } else {
      const pct = zScoreToPercentile(z);
      const cls = classifyLaz(z);
      lazEval = {
        key: 'LAZ',
        title: '年龄别身长/身高',
        shortLabel: 'LAZ',
        whoIndicator: 'lhfa',
        rawValue: normalizedHeight.rawHeightCm,
        evaluatedValue: normalizedHeight.standardHeightCm,
        unit: 'cm',
        conversionNote: normalizedHeight.conversionNote,
        zScore: z,
        percentile: pct,
        percentileLabel: formatPercentileLabel(pct),
        medianReference: Number(lms.m.toFixed(1)),
        statusCode: pretermGuardTriggered ? 'pending_verification' : cls.statusCode,
        statusLabel: pretermGuardTriggered ? `待核实（未校正：${cls.statusLabel}）` : cls.statusLabel,
        severity: pretermGuardTriggered ? 'insufficient' : cls.severity,
        referenceStandard: 'WHO 2006 lhfa + 国家卫健委试行指南',
        guidelineBoundaryNote: '生长迟缓：<-2SD（<P3）；重度生长迟缓：<-3SD；参考区间：-2SD ～ +2SD',
        explanation: INDICATOR_EXPLANATIONS.LAZ,
        detailMessage: pretermGuardTriggered
          ? `${cls.detailMessage}（注：早产儿当前按实际月龄计算，校正年龄评价需经儿保医生核实。）`
          : cls.detailMessage,
      };
    }
  }

  // 3. WLZ：身长/身高别体重（<24 月龄使用 wfl，>=24 月龄使用 wfh）
  const wlIndicator: WhoIndicatorCode = ageDays < 731 ? 'wfl' : 'wfh';
  let wlzEval: IndicatorEvaluation;
  const wlTable = getWhoLmsTable(wlIndicator, sex, options?.referenceMode);
  if (
    !normalizedHeight ||
    typeof measurement.weightKg !== 'number' ||
    !Number.isFinite(measurement.weightKg)
  ) {
    wlzEval = makeUnavailableIndicator(
      'WLZ',
      ageDays < 731 ? '身长别体重' : '身高别体重',
      'WLZ',
      wlIndicator,
      'kg',
      measurement.weightKg ?? null,
      'insufficient_data',
      '待完善资料',
      '需同时具备身长/身高与体重数据方可计算身长/身高别体重。',
      refLabel
    );
  } else if (!wlTable) {
    wlzEval = makeUnavailableIndicator(
      'WLZ',
      ageDays < 731 ? '身长别体重' : '身高别体重',
      'WLZ',
      wlIndicator,
      'kg',
      measurement.weightKg,
      'reference_unloaded',
      '参考数据未加载',
      `WHO ${wlIndicator.toUpperCase()} 参考表未加载。`,
      refLabel
    );
  } else {
    const lms = lookupLmsParams(wlTable, normalizedHeight.standardHeightCm);
    const z = lms ? calculateLmsZScore(measurement.weightKg, lms.l, lms.m, lms.s, true) : null;
    if (!lms || z === null) {
      wlzEval = makeUnavailableIndicator(
        'WLZ',
        ageDays < 731 ? '身长别体重' : '身高别体重',
        'WLZ',
        wlIndicator,
        'kg',
        measurement.weightKg,
        'out_of_range',
        '超出参考范围',
        `当前标准身长/身高（${normalizedHeight.standardHeightCm.toFixed(1)} cm）超出 WHO ${
          wlIndicator === 'wfl' ? '45～110 cm' : '65～120 cm'
        } 公布范围。`,
        refLabel
      );
    } else {
      const pct = zScoreToPercentile(z);
      const cls = classifyProportionalWeight(z, ageDays < 731 ? '身长别体重' : '身高别体重');
      wlzEval = {
        key: 'WLZ',
        title: ageDays < 731 ? '身长别体重' : '身高别体重',
        shortLabel: 'WLZ',
        whoIndicator: wlIndicator,
        rawValue: measurement.weightKg,
        evaluatedValue: measurement.weightKg,
        unit: 'kg',
        conversionNote: normalizedHeight.conversionNote,
        zScore: z,
        percentile: pct,
        percentileLabel: formatPercentileLabel(pct),
        medianReference: Number(lms.m.toFixed(2)),
        statusCode: cls.statusCode,
        statusLabel: cls.statusLabel,
        severity: cls.severity,
        referenceStandard: `WHO 2006 ${wlIndicator} + 国家卫健委试行指南`,
        guidelineBoundaryNote:
          '消瘦：<-2SD；参考区间：-2SD ～ +1SD；超重：+1SD ～ +2SD；肥胖：>+2SD（按卫健委指南，WHO 2006 肥胖界值 >+3SD）',
        explanation: INDICATOR_EXPLANATIONS.WLZ,
        detailMessage: cls.detailMessage,
      };
    }
  }

  // 4. BMIZ：年龄别 BMI
  let bmizEval: IndicatorEvaluation;
  const bfaTable = getWhoLmsTable('bfa', sex, options?.referenceMode);
  const bmiVal =
    normalizedHeight &&
    typeof measurement.weightKg === 'number' &&
    Number.isFinite(measurement.weightKg) &&
    normalizedHeight.standardHeightCm > 0
      ? Number(
          (
            measurement.weightKg /
            Math.pow(normalizedHeight.standardHeightCm / 100, 2)
          ).toFixed(2)
        )
      : null;

  if (bmiVal === null) {
    bmizEval = makeUnavailableIndicator(
      'BMIZ',
      '年龄别 BMI',
      'BMIZ',
      'bfa',
      'kg/m²',
      null,
      'insufficient_data',
      '待完善资料',
      '需同时具备身长/身高与体重数据方可计算年龄别 BMI。',
      refLabel
    );
  } else if (!bfaTable) {
    bmizEval = makeUnavailableIndicator(
      'BMIZ',
      '年龄别 BMI',
      'BMIZ',
      'bfa',
      'kg/m²',
      bmiVal,
      'reference_unloaded',
      '参考数据未加载',
      'WHO 年龄别 BMI（bfa）参考表未加载。',
      refLabel
    );
  } else {
    const lms = lookupLmsParams(bfaTable, ageDays);
    const z = lms ? calculateLmsZScore(bmiVal, lms.l, lms.m, lms.s, true) : null;
    if (!lms || z === null) {
      bmizEval = makeUnavailableIndicator(
        'BMIZ',
        '年龄别 BMI',
        'BMIZ',
        'bfa',
        'kg/m²',
        bmiVal,
        'out_of_range',
        '超出参考范围',
        '当前日龄超出 WHO 参考表范围。',
        refLabel
      );
    } else {
      const pct = zScoreToPercentile(z);
      const cls = classifyProportionalWeight(z, '年龄别 BMI');
      bmizEval = {
        key: 'BMIZ',
        title: '年龄别 BMI',
        shortLabel: 'BMIZ',
        whoIndicator: 'bfa',
        rawValue: bmiVal,
        evaluatedValue: bmiVal,
        unit: 'kg/m²',
        conversionNote: normalizedHeight?.conversionNote,
        zScore: z,
        percentile: pct,
        percentileLabel: formatPercentileLabel(pct),
        medianReference: Number(lms.m.toFixed(2)),
        statusCode: pretermGuardTriggered ? 'pending_verification' : cls.statusCode,
        statusLabel: pretermGuardTriggered ? `待核实（未校正：${cls.statusLabel}）` : cls.statusLabel,
        severity: pretermGuardTriggered ? 'insufficient' : cls.severity,
        referenceStandard: 'WHO 2006 bfa + 国家卫健委试行指南',
        guidelineBoundaryNote:
          '消瘦：<-2SD；参考区间：-2SD ～ +1SD；超重：+1SD ～ +2SD；肥胖：>+2SD（按同龄同性别标准，不可套用成人 BMI）',
        explanation: INDICATOR_EXPLANATIONS.BMIZ,
        detailMessage: pretermGuardTriggered
          ? `${cls.detailMessage}（注：早产儿当前按实际月龄计算，校正年龄评价需经儿保医生核实。）`
          : cls.detailMessage,
      };
    }
  }

  // 5. HCZ：年龄别头围（独立发育监测，不参与上述体重营养状态综合分级）
  let headEval: HeadCircumferenceEvaluation;
  const hcfaTable = getWhoLmsTable('hcfa', sex, options?.referenceMode);
  if (typeof measurement.headCm !== 'number' || !Number.isFinite(measurement.headCm)) {
    headEval = {
      key: 'HCZ',
      title: '年龄别头围（发育监测）',
      rawValue: null,
      unit: 'cm',
      zScore: null,
      percentile: null,
      percentileLabel: '待计算',
      medianReference: null,
      statusCode: 'insufficient_data',
      statusLabel: '未录入头围',
      severity: 'insufficient',
      referenceStandard: 'WHO 2006 hcfa',
      advice: '本次测量未录入头围。头围用于单独监测颅脑与生长发育，不归入体重营养状态分级。',
    };
  } else if (!hcfaTable) {
    headEval = {
      key: 'HCZ',
      title: '年龄别头围（发育监测）',
      rawValue: measurement.headCm,
      unit: 'cm',
      zScore: null,
      percentile: null,
      percentileLabel: '待计算',
      medianReference: null,
      statusCode: 'reference_unloaded',
      statusLabel: '参考数据未加载',
      severity: 'insufficient',
      referenceStandard: '参考数据未加载',
      advice: 'WHO 年龄别头围（hcfa）参考表未加载。',
    };
  } else {
    const lms = lookupLmsParams(hcfaTable, ageDays);
    const z = lms ? calculateLmsZScore(measurement.headCm, lms.l, lms.m, lms.s, false) : null;
    if (!lms || z === null) {
      headEval = {
        key: 'HCZ',
        title: '年龄别头围（发育监测）',
        rawValue: measurement.headCm,
        unit: 'cm',
        zScore: null,
        percentile: null,
        percentileLabel: '待计算',
        medianReference: null,
        statusCode: 'out_of_range',
        statusLabel: '超出参考范围',
        severity: 'insufficient',
        referenceStandard: 'WHO 2006 hcfa',
        advice: '当前日龄超出头围参考表范围。',
      };
    } else {
      const pct = zScoreToPercentile(z);
      const cls = classifyHeadCircumference(z);
      headEval = {
        key: 'HCZ',
        title: '年龄别头围（发育监测）',
        rawValue: measurement.headCm,
        unit: 'cm',
        zScore: z,
        percentile: pct,
        percentileLabel: formatPercentileLabel(pct),
        medianReference: Number(lms.m.toFixed(1)),
        statusCode: pretermGuardTriggered ? 'pending_verification' : cls.statusCode,
        statusLabel: pretermGuardTriggered ? `待核实（未校正：${cls.statusLabel}）` : cls.statusLabel,
        severity: pretermGuardTriggered ? 'insufficient' : cls.severity,
        referenceStandard: 'WHO 2006 hcfa（单独发育监测）',
        advice: pretermGuardTriggered
          ? `${cls.advice}（早产儿请由儿保医生结合校正月龄复核。）`
          : cls.advice,
      };
    }
  }

  // 综合营养状况评价（仅汇总 4 项核心营养指标，不混入头围；绝不因仅 1 项正常就判全部正常）
  const coreList = [wazEval, lazEval, wlzEval, bmizEval];
  const hasProfessional = coreList.some((c) => c.severity === 'professional');
  const hasAttention = coreList.some((c) => c.severity === 'attention');
  const missingCore = coreList.filter((c) => c.severity === 'insufficient');

  let overallCode: OverallAssessmentCode;
  let overallLabel: string;
  let overallSeverity: EvaluationSeverity;
  let overallSummary: string;

  if (pretermGuardTriggered) {
    overallCode = 'pending_verification';
    overallLabel = '待核实（早产儿需医生确认校正规则）';
    overallSeverity = 'insufficient';
    overallSummary =
      '系统已按实际月龄计算参考数值供记录留档；因早产儿是否适用校正年龄及停止校正节点需结合临床评估确定，暂不自动给出综合营养分级。';
  } else if (hasProfessional) {
    const flagged = coreList
      .filter((c) => c.severity === 'professional')
      .map((c) => `${c.title}（${c.statusLabel}）`)
      .join('、');
    overallCode = 'professional_eval';
    overallLabel = '建议专业评估';
    overallSeverity = 'professional';
    overallSummary = `检测到 ${flagged}，建议携带连续生长曲线与喂养记录前往儿童保健门诊接受专业评估。`;
  } else if (hasAttention) {
    const flagged = coreList
      .filter((c) => c.severity === 'attention')
      .map((c) => `${c.title}（${c.statusLabel}）`)
      .join('、');
    overallCode = 'needs_attention';
    overallLabel = '需要关注';
    overallSeverity = 'attention';
    overallSummary = `${flagged}，建议结合近期喂养摄入、睡眠及连续多月生长趋势持续观察，必要时咨询儿保人员。`;
  } else if (missingCore.length > 0) {
    const missingNames = missingCore.map((c) => c.title).join('、');
    overallCode = 'insufficient_data';
    overallLabel = '数据不足，暂无法评价';
    overallSeverity = 'insufficient';
    overallSummary = `尚缺少「${missingNames}」的完整计算数据，不可仅凭单项正常判定整体营养状况，请补齐身长/身高与体重后查看综合评价。`;
  } else {
    overallCode = 'within_reference';
    overallLabel = '参考区间内';
    overallSeverity = 'normal';
    overallSummary =
      '四项核心营养评价指标（WAZ、LAZ、WLZ、BMIZ）均位于同龄同性别适宜参考区间内，请继续按月龄规律监测生长趋势。';
  }

  return {
    assessmentId: `assess-${measurement.id}-${refVersion.versionId}`,
    measurementId: measurement.id,
    babyId: profile.babyId,
    measurementDate: measurement.date,
    computedAt: new Date().toISOString(),
    referenceVersionId: refVersion.versionId,
    referenceStandardName: refLabel,
    age,
    overallCode,
    overallLabel,
    overallSeverity,
    overallSummary,
    blockingReasons,
    pretermNotice: age.pretermGuard.notice,
    indicators: {
      WAZ: wazEval,
      LAZ: lazEval,
      WLZ: wlzEval,
      BMIZ: bmizEval,
    },
    headCircumference: headEval,
    disclaimer: GUIDELINE_DISCLAIMER,
  };
}
