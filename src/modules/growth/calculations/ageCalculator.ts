import { AgeCalculationResult, GrowthBabyProfile } from '../types/growth';

/** WHO 生长标准平均月长（365.25 / 12 = 30.4375 天） */
export const WHO_DAYS_PER_MONTH = 30.4375;
export const MAX_SUPPORTED_MONTHS = 36;
export const MAX_SUPPORTED_DAYS = Math.round(MAX_SUPPORTED_MONTHS * WHO_DAYS_PER_MONTH); // 1096 天

function parseIsoDateUtc(dateStr: string): Date | null {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return dt;
}

function daysInUtcMonth(year: number, monthIndex0: number): number {
  return new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
}

/**
 * 精确计算出生日期到测量日期之间的年龄：
 * - 完整考虑闰年与每月不同天数（28/29/30/31 天）
 * - 同时保留出生日龄、WHO 精确月龄（日龄 / 30.4375）、自然历法年/月/日
 * - 对早产儿仅记录提示与核实标记，在未确认临床校正规则前绝不自动篡改评估月龄
 */
export function calculateGrowthAge(
  birthDateStr: string,
  measurementDateStr: string,
  pretermInfo?: Pick<GrowthBabyProfile, 'isPreterm' | 'gestationalAgeWeeks' | 'expectedDueDate'>
): AgeCalculationResult | null {
  const birth = parseIsoDateUtc(birthDateStr);
  const target = parseIsoDateUtc(measurementDateStr);

  if (!birth || !target) {
    return null;
  }

  const diffMs = target.getTime() - birth.getTime();
  const ageDays = Math.floor(diffMs / 86_400_000);

  if (ageDays < 0) {
    return {
      birthDate: birthDateStr,
      measurementDate: measurementDateStr,
      ageDays,
      exactMonths: ageDays / WHO_DAYS_PER_MONTH,
      calendarYears: 0,
      calendarMonths: 0,
      calendarDays: 0,
      totalCalendarMonths: 0,
      displayAge: '测量日期早于出生日期',
      compactAge: '--',
      isValid: false,
      isOutOf0To36Range: true,
      pretermGuard: {
        isPreterm: Boolean(pretermInfo?.isPreterm),
        hasCompletePretermInfo: false,
        requiresClinicalCorrectionRule: false,
        notice: null,
      },
    };
  }

  // 自然历法精确年/月/日计算（考虑闰年与各月天数）
  const bY = birth.getUTCFullYear();
  const bM = birth.getUTCMonth();
  const bD = birth.getUTCDate();

  const tY = target.getUTCFullYear();
  const tM = target.getUTCMonth();
  const tD = target.getUTCDate();

  let years = tY - bY;
  let months = tM - bM;
  let days = tD - bD;

  if (days < 0) {
    months -= 1;
    const prevMonthYear = tM === 0 ? tY - 1 : tY;
    const prevMonthIndex = tM === 0 ? 11 : tM - 1;
    const prevMonthMaxDays = daysInUtcMonth(prevMonthYear, prevMonthIndex);
    // 若出生日大于上月天数（例如 1 月 31 日生、3 月 1 日测），按上月末日对齐
    const effectiveBirthDay = Math.min(bD, prevMonthMaxDays);
    days = prevMonthMaxDays - effectiveBirthDay + tD;
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalCalendarMonths = years * 12 + months;
  const exactMonths = Number((ageDays / WHO_DAYS_PER_MONTH).toFixed(2));

  let displayAge = '';
  if (years > 0) {
    displayAge = months > 0 ? `${years}岁${months}个月` : `${years}周岁`;
    if (days > 0 && years < 2) {
      displayAge += `${days}天`;
    }
  } else if (months > 0) {
    displayAge = days > 0 ? `${months}个月${days}天` : `${months}个月`;
  } else {
    displayAge = `${ageDays}天`;
  }

  const compactAge =
    exactMonths < 1 ? `${ageDays}天` : `${exactMonths.toFixed(1)}月龄`;

  // 早产儿处理：检查是否完整填写孕周或预产期，并且明确提示未自动执行校正年龄替代
  const isPreterm = Boolean(pretermInfo?.isPreterm);
  const validGestational =
    typeof pretermInfo?.gestationalAgeWeeks === 'number' &&
    pretermInfo.gestationalAgeWeeks >= 22 &&
    pretermInfo.gestationalAgeWeeks < 37;
  const validDueDate = Boolean(pretermInfo?.expectedDueDate && parseIsoDateUtc(pretermInfo.expectedDueDate));
  const hasCompletePretermInfo = isPreterm && (validGestational || validDueDate);

  let pretermNotice: string | null = null;
  if (isPreterm) {
    if (!hasCompletePretermInfo) {
      pretermNotice =
        '已标记为早产儿，但尚未完善出生孕周（<37周）或预产期资料；系统未自动校正年龄，营养评价标记为「待核实」，请补充资料并咨询儿保医生。';
    } else if (exactMonths <= 24) {
      pretermNotice = `早产儿（出生孕周 ${
        pretermInfo?.gestationalAgeWeeks ? `${pretermInfo.gestationalAgeWeeks}周` : '已填预产期'
      }）：校正年龄的适用条件与停止校正时间需由儿童保健医生依据正式标准确认，当前不自动替换实际月龄，相关评价需结合校正年龄核实。`;
    }
  }

  return {
    birthDate: birthDateStr,
    measurementDate: measurementDateStr,
    ageDays,
    exactMonths,
    calendarYears: years,
    calendarMonths: months,
    calendarDays: days,
    totalCalendarMonths,
    displayAge,
    compactAge,
    isValid: true,
    isOutOf0To36Range: ageDays > MAX_SUPPORTED_DAYS,
    pretermGuard: {
      isPreterm,
      hasCompletePretermInfo,
      requiresClinicalCorrectionRule: isPreterm && exactMonths <= 24,
      notice: pretermNotice,
    },
  };
}
