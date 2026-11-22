import { BabyProfile, GrowthRecord } from '../../../types/planet';
import {
  BiologicalSex,
  GrowthAssessmentResult,
  GrowthBabyProfile,
  GrowthMeasurement,
  GrowthReminderItem,
  WhoReferenceVersion,
} from '../types/growth';
import {
  getCurrentReferenceVersion,
  ReferenceLoadMode,
} from '../data/whoGrowthStandards';
import { calculateGrowthAge } from '../calculations/ageCalculator';
import { evaluateGrowthMeasurement } from '../calculations/growthAssessment';

const STORAGE_KEYS = {
  ASSESSMENTS: 'planet_growth_assessments_v1',
  REF_VERSIONS: 'planet_growth_reference_versions_v1',
};

/** 国家卫生健康委《婴幼儿营养喂养评估服务指南（试行）》规定的 9 次关键月龄评估节点 */
export const NHC_ASSESSMENT_MONTH_MILESTONES = [1, 3, 6, 8, 12, 18, 24, 30, 36] as const;

export function mapPlanetProfileToGrowthProfile(profile: BabyProfile): GrowthBabyProfile {
  const sex: BiologicalSex | null =
    profile.gender === 'boy'
      ? 'male'
      : profile.gender === 'girl'
      ? 'female'
      : null;

  return {
    babyId: profile.babyId || 'baby-primary',
    name: profile.name?.trim() || '',
    birthDate: profile.birthDate || '',
    sex,
    isPreterm: Boolean(profile.isPreterm),
    gestationalAgeWeeks: profile.gestationalAgeWeeks,
    expectedDueDate: profile.expectedDueDate,
  };
}

export function mapPlanetRecordsToMeasurements(
  records: GrowthRecord[],
  babyId = 'baby-primary'
): GrowthMeasurement[] {
  return records
    .map((r) => ({
      id: r.id,
      babyId,
      date: r.date,
      heightCm: typeof r.heightCm === 'number' && Number.isFinite(r.heightCm) ? r.heightCm : undefined,
      weightKg: typeof r.weightKg === 'number' && Number.isFinite(r.weightKg) ? r.weightKg : undefined,
      headCm: typeof r.headCm === 'number' && Number.isFinite(r.headCm) ? r.headCm : undefined,
      measurementMethod: r.measurementMethod,
      note: r.note || '',
      isDemo: r.isDemo,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function mapMeasurementToPlanetRecord(m: GrowthMeasurement): GrowthRecord {
  return {
    id: m.id,
    date: m.date,
    heightCm: m.heightCm,
    weightKg: m.weightKg,
    headCm: m.headCm,
    measurementMethod: m.measurementMethod,
    note: m.note,
    isDemo: m.isDemo,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
  };
}

/**
 * 持久化数据服务层（当前使用 localStorage，接口设计独立解耦，后续可平滑替换 Supabase / Firebase）
 */
export const growthStorageService = {
  loadSavedAssessments(): Record<string, GrowthAssessmentResult> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, GrowthAssessmentResult>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  },

  saveAssessments(map: Record<string, GrowthAssessmentResult>): void {
    try {
      localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(map));
    } catch {
      // ignore quota errors
    }
  },

  recordReferenceVersionHistory(version: WhoReferenceVersion): WhoReferenceVersion[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.REF_VERSIONS);
      const list: WhoReferenceVersion[] = raw ? JSON.parse(raw) : [];
      const exists = list.some((v) => v.versionId === version.versionId);
      const next = exists
        ? list.map((v) => (v.versionId === version.versionId ? version : v))
        : [version, ...list].slice(0, 10);
      localStorage.setItem(STORAGE_KEYS.REF_VERSIONS, JSON.stringify(next));
      return next;
    } catch {
      return [version];
    }
  },

  /**
   * 同步重算所有测量记录的营养评价快照（当新增、编辑、删除测量记录或更新宝宝档案/参考版本时调用）
   */
  recomputeAndPersistAssessments(
    profile: GrowthBabyProfile,
    measurements: GrowthMeasurement[],
    referenceMode?: ReferenceLoadMode
  ): Record<string, GrowthAssessmentResult> {
    const refVer = getCurrentReferenceVersion();
    this.recordReferenceVersionHistory(refVer);

    const nextMap: Record<string, GrowthAssessmentResult> = {};
    for (const item of measurements) {
      nextMap[item.id] = evaluateGrowthMeasurement(profile, item, { referenceMode });
    }
    this.saveAssessments(nextMap);
    return nextMap;
  },
};

function addCalendarMonthsIso(birthDateStr: string, monthsToAdd: number): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) return undefined;
  const [y, m, d] = birthDateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + monthsToAdd, d));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/**
 * 依据国家卫生健康委《婴幼儿营养喂养评估服务指南（试行）》生成 0～3 岁 9 次关键月龄评估提醒
 */
export function buildGrowthReminders(
  profile: GrowthBabyProfile,
  measurements: GrowthMeasurement[],
  todayStr: string
): GrowthReminderItem[] {
  const currentAge = profile.birthDate
    ? calculateGrowthAge(profile.birthDate, todayStr)
    : null;

  return NHC_ASSESSMENT_MONTH_MILESTONES.map((monthAge) => {
    const matched = measurements.find((m) => {
      if (!profile.birthDate) return false;
      const ageAtMeas = calculateGrowthAge(profile.birthDate, m.date);
      if (!ageAtMeas || !ageAtMeas.isValid) return false;
      const tolerance = monthAge <= 6 ? 0.65 : 1.0;
      return Math.abs(ageAtMeas.exactMonths - monthAge) <= tolerance;
    });

    const targetDate = profile.birthDate
      ? addCalendarMonthsIso(profile.birthDate, monthAge)
      : undefined;

    if (matched) {
      return {
        monthAge,
        label: `${monthAge}月龄`,
        source: '国家卫健委试行指南',
        status: 'completed',
        completedDate: matched.date,
        targetDate,
      };
    }

    if (!currentAge || !currentAge.isValid) {
      return {
        monthAge,
        label: `${monthAge}月龄`,
        source: '国家卫健委试行指南',
        status: 'future',
        targetDate,
      };
    }

    if (currentAge.exactMonths >= monthAge - 0.5 && currentAge.exactMonths <= monthAge + 0.8) {
      return {
        monthAge,
        label: `${monthAge}月龄`,
        source: '国家卫健委试行指南',
        status: 'upcoming',
        targetDate,
      };
    }

    if (currentAge.exactMonths > monthAge + 0.8) {
      return {
        monthAge,
        label: `${monthAge}月龄`,
        source: '国家卫健委试行指南',
        status: 'overdue',
        targetDate,
      };
    }

    return {
      monthAge,
      label: `${monthAge}月龄`,
      source: '国家卫健委试行指南',
      status: 'future',
      targetDate,
    };
  });
}
