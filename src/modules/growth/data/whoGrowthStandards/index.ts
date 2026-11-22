import { getTable, type Indicator, type Sex } from 'who-growth-standards';
import {
  BiologicalSex,
  LmsTableData,
  WhoIndicatorCode,
  WhoReferenceVersion,
} from '../../types/growth';

export type ReferenceLoadMode = 'official_who_2006' | 'unloaded';

const OFFICIAL_VERSION_META: WhoReferenceVersion = {
  versionId: 'WHO-2006-NHC-2022-v1',
  standardName: 'WHO Child Growth Standards (2006)',
  guidelineName: '国家卫生健康委《婴幼儿营养喂养评估服务指南（试行）》',
  version: 'WHO 2006 LMS（0–60 月龄日龄表 / 0.1cm 步长，本模块适用 0–36 月龄）',
  ageRangeLabel: '0～36 月龄（0～1096 日龄）',
  unitsSummary: '身长/身高：cm · 体重：kg · 头围：cm · BMI：kg/m²',
  updatedAt: '2006-04-27（WHO 官方发布） / 2022-05（国家卫健委试行指南）',
  status: 'loaded',
  sourceNote:
    '参考数据源自世界卫生组织（WHO）Multicentre Growth Reference Study 2006 官方发布的 LMS 原始参数表（wfa / lhfa / wfl / wfh / bfa / hcfa），本地离线计算，不依赖外部网络。',
};

const UNLOADED_VERSION_META: WhoReferenceVersion = {
  ...OFFICIAL_VERSION_META,
  versionId: 'WHO-UNLOADED',
  status: 'unloaded',
  sourceNote: '当前参考数据处于未加载状态。请重新加载官方 WHO 2006 标准表后再进行专业营养评价。',
};

let currentLoadMode: ReferenceLoadMode = 'official_who_2006';
const customTableOverrides = new Map<string, LmsTableData>();

function cacheKey(indicator: WhoIndicatorCode, sex: BiologicalSex): string {
  return `${indicator}:${sex}`;
}

export function getReferenceLoadMode(): ReferenceLoadMode {
  return currentLoadMode;
}

export function setReferenceLoadMode(mode: ReferenceLoadMode): void {
  currentLoadMode = mode;
}

export function registerCustomLmsTable(table: LmsTableData): void {
  customTableOverrides.set(cacheKey(table.indicator, table.sex), table);
}

export function clearCustomLmsTables(): void {
  customTableOverrides.clear();
}

export function getCurrentReferenceVersion(): WhoReferenceVersion {
  return currentLoadMode === 'official_who_2006'
    ? OFFICIAL_VERSION_META
    : UNLOADED_VERSION_META;
}

export function getReferenceTableMetadata(indicator: WhoIndicatorCode): {
  code: WhoIndicatorCode;
  zhName: string;
  enName: string;
  unit: string;
  xAxisLabel: string;
  validRange: string;
} {
  switch (indicator) {
    case 'wfa':
      return {
        code: 'wfa',
        zhName: '年龄别体重（WAZ）',
        enName: 'Weight-for-age',
        unit: 'kg',
        xAxisLabel: '日龄（0–1096 天 / 0–36 月龄）',
        validRange: '0–1856 日龄（本模块重点展示 0–36 月龄）',
      };
    case 'lhfa':
      return {
        code: 'lhfa',
        zhName: '年龄别身长/身高（LAZ）',
        enName: 'Length/height-for-age',
        unit: 'cm',
        xAxisLabel: '日龄（0–1096 天 / 0–36 月龄）',
        validRange: '0–1856 日龄（<24 月龄卧位身长，≥24 月龄立位身高）',
      };
    case 'wfl':
      return {
        code: 'wfl',
        zhName: '身长别体重（WLZ · 0–24月龄）',
        enName: 'Weight-for-length',
        unit: 'kg',
        xAxisLabel: '卧位身长（cm）',
        validRange: '45.0–110.0 cm（0.1 cm 步长）',
      };
    case 'wfh':
      return {
        code: 'wfh',
        zhName: '身高别体重（WLZ · 24–36月龄）',
        enName: 'Weight-for-height',
        unit: 'kg',
        xAxisLabel: '立位身高（cm）',
        validRange: '65.0–120.0 cm（0.1 cm 步长）',
      };
    case 'bfa':
      return {
        code: 'bfa',
        zhName: '年龄别 BMI（BMIZ）',
        enName: 'BMI-for-age',
        unit: 'kg/m²',
        xAxisLabel: '日龄（0–1096 天 / 0–36 月龄）',
        validRange: '0–1856 日龄',
      };
    case 'hcfa':
      return {
        code: 'hcfa',
        zhName: '年龄别头围（HCZ）',
        enName: 'Head circumference-for-age',
        unit: 'cm',
        xAxisLabel: '日龄（0–1096 天 / 0–36 月龄）',
        validRange: '0–1856 日龄',
      };
  }
}

/**
 * 获取指定指标与性别的 WHO 官方 LMS 参考数据表。
 * 若参考数据未加载则返回 null，调用方必须显示「参考数据未加载」，禁止使用虚构数值。
 */
export function getWhoLmsTable(
  indicator: WhoIndicatorCode,
  sex: BiologicalSex,
  overrideMode?: ReferenceLoadMode
): LmsTableData | null {
  const activeMode = overrideMode ?? currentLoadMode;
  if (activeMode === 'unloaded') {
    return null;
  }

  const custom = customTableOverrides.get(cacheKey(indicator, sex));
  if (custom) {
    return custom;
  }

  try {
    const raw = getTable(indicator as Indicator, sex as Sex);
    if (!raw || !Array.isArray(raw.lms) || raw.lms.length === 0) {
      return null;
    }
    return {
      indicator,
      sex,
      xAxis: raw.xAxis,
      start: raw.start,
      step: raw.step,
      lms: raw.lms,
    };
  } catch {
    return null;
  }
}
