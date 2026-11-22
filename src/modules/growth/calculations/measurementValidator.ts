import { GrowthValidationResult, MeasurementMethod } from '../types/growth';

export interface MeasurementValidationInput {
  date: string;
  todayStr: string;
  birthDate?: string;
  heightCm?: number;
  weightKg?: number;
  headCm?: number;
  measurementMethod?: MeasurementMethod;
  allowFutureImport?: boolean;
}

/**
 * 校验成长测量表单输入：
 * - 日期不可晚于当天（除非显式开启特殊数据导入模式）
 * - 日期不可早于宝宝出生日期
 * - 至少填写一项测量数值，允许保存部分测量记录但明确标出缺失项
 * - 对超出 0～3 岁常见生理合理范围的异常数值给出明确拦截或提醒
 */
export function validateGrowthMeasurement(
  input: MeasurementValidationInput
): GrowthValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingFields: string[] = [];

  if (!input.date || !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    errors.push('请选择有效的测量日期。');
  } else {
    if (!input.allowFutureImport && input.date > input.todayStr) {
      errors.push('测量日期不能晚于当前日期（如需导入未来模拟数据，请先开启“特殊数据导入”开关）。');
    }
    if (input.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(input.birthDate) && input.date < input.birthDate) {
      errors.push('测量日期不能早于宝宝出生日期。');
    }
  }

  const hasHeight = typeof input.heightCm === 'number' && Number.isFinite(input.heightCm);
  const hasWeight = typeof input.weightKg === 'number' && Number.isFinite(input.weightKg);
  const hasHead = typeof input.headCm === 'number' && Number.isFinite(input.headCm);

  if (!hasHeight) missingFields.push('身长/身高');
  if (!hasWeight) missingFields.push('体重');
  if (!hasHead) missingFields.push('头围');

  if (!hasHeight && !hasWeight && !hasHead) {
    errors.push('请至少输入身高、体重或头围中的一项测量数据。');
  }

  if (hasHeight) {
    const h = input.heightCm!;
    if (h <= 0 || h < 25 || h > 135) {
      errors.push('身长/身高数值异常（0～3 岁合理录入范围为 25.0～135.0 cm），请核对单位是否为 cm。');
    } else if (h < 38 || h > 115) {
      warnings.push(`当前身长/身高 ${h.toFixed(1)} cm 接近 0～3 岁边界，请确认是否准确。`);
    }
  }

  if (hasWeight) {
    const w = input.weightKg!;
    if (w <= 0 || w < 0.4 || w > 35) {
      errors.push('体重数值异常（0～3 岁合理录入范围为 0.40～35.00 kg），请核对单位是否为 kg（公斤）。');
    } else if (w < 1.5 || w > 24) {
      warnings.push(`当前体重 ${w.toFixed(2)} kg 接近 0～3 岁边界，请确认是否为公斤（kg）而非斤。`);
    }
  }

  if (hasHead) {
    const hc = input.headCm!;
    if (hc <= 0 || hc < 20 || hc > 62) {
      errors.push('头围数值异常（0～3 岁合理录入范围为 20.0～62.0 cm），请核对单位是否为 cm。');
    } else if (hc < 28 || hc > 56) {
      warnings.push(`当前头围 ${hc.toFixed(1)} cm 偏离 0～3 岁常见范围，请复核测量数值。`);
    }
  }

  const isPartial = missingFields.length > 0 && missingFields.length < 3;
  if (isPartial) {
    warnings.push(
      `尚未填写「${missingFields.join('、')}」，保存后将保留原始记录，相关营养评价将标记为「待完善资料 / 数据不足」。`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    isPartial,
    missingFields,
  };
}
