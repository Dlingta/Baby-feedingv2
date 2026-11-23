export type ModuleTab = 'home' | 'diary' | 'feeding' | 'growth' | 'health' | 'settings';

export type ScreenCode =
  | '1.1'
  | '1.2'
  | '2.1'
  | '2.2'
  | '2.3'
  | '3.1'
  | '3.2'
  | '3.3'
  | '4.1'
  | '4.2'
  | '4.3'
  | '5.1'
  | '5.2'
  | '5.3'
  | '5.4'
  | '6.1';

export interface BabyProfile {
  babyId?: string;
  name: string;
  planetName: string;
  birthDate: string; // YYYY-MM-DD or '' when uninitialized
  gender: 'boy' | 'girl' | 'star';
  isPreterm?: boolean;
  gestationalAgeWeeks?: number; // 出生孕周（如 34）
  expectedDueDate?: string; // 预产期 YYYY-MM-DD（如适用）
  recorders: string[];
}

export type DiaryMood = 'glowing' | 'floating' | 'soft' | 'exploring' | 'full';
export type DiaryWeather = 'sunny' | 'cloudy' | 'rainy' | 'starry';

export interface DiaryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  content: string;
  reflection?: string;
  mood: DiaryMood;
  weather: DiaryWeather;
  recorder: string;
  photos: string[];
  updatedAt?: string;
}

export type FeedingType = 'breast' | 'formula' | 'solids' | 'supplement';

export interface FeedingRecord {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  type: FeedingType;
  breastSide?: 'left' | 'right' | 'both';
  durationMin?: number;
  amountMl?: number;
  foodName?: string;
  foodAmount?: string;
  note?: string;
  photoUrl?: string;
  recorder: string;
  updatedAt?: string;
}

export type GrowthMeasurementMethod = 'recumbent' | 'standing';

export interface GrowthRecord {
  id: string;
  date: string; // YYYY-MM-DD
  heightCm?: number;
  weightKg?: number;
  headCm?: number;
  measurementMethod?: GrowthMeasurementMethod;
  note: string;
  isDemo?: boolean;
  recorder?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type VaccineStatus = 'activated' | 'next' | 'locked';
export type VaccineBrandOrigin = '国产' | '进口' | '其他';
export type VaccineFundingType = '免费' | '自费';

export interface VaccineDose {
  id: string;
  order: number;
  name: string;
  doseLabel: string;
  recommendedMonth: string;
  description: string;
  status: VaccineStatus;
  inoculatedDate?: string;
  brandOrigin?: VaccineBrandOrigin;
  fundingType?: VaccineFundingType;
  note?: string;
  updatedAt?: string;
}

export type IllnessCareCategory = 'temperature' | 'medicine' | 'hydration';
export type DiseasePresetTag =
  | '体温异常'
  | '发烧'
  | '感冒'
  | '皮疹'
  | '咳嗽'
  | '腹泻'
  | '过敏'
  | '自定义';

export interface IllnessRecord {
  id: string;
  date: string;
  time: string;
  diseaseName?: string;
  diseaseTag?: DiseasePresetTag;
  careCategory?: IllnessCareCategory;
  title?: string;
  summary?: string;
  amountMl?: number;
  handled?: boolean;
  temperatureC?: number;
  symptoms: string[];
  medication: string;
  hospital?: string;
  diagnosis?: string;
  casePhotos?: string[];
  recorder: string;
  updatedAt?: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  subtitle: string;
  completed: boolean;
  updatedAt?: string;
}

export interface CoPilotParticipant {
  id: string;
  name: string;
  role: 'owner' | 'coPilot';
  status: 'accepted' | 'pending' | 'removed' | 'unknown';
}

export interface PlanetSyncMeta {
  schemaVersion: number;
  updatedAt: string;
  updatedBy?: string;
  /** 记录已删除条目的 ID -> 删除时间，防止多台 iPhone 离线合并时已删记录“复活” */
  deletedIds?: Record<string, string>;
}

export interface PlanetAppState {
  profile: BabyProfile;
  diaries: DiaryEntry[];
  feedings: FeedingRecord[];
  growths: GrowthRecord[];
  vaccines: VaccineDose[];
  illnesses: IllnessRecord[];
  checklist: ChecklistItem[];
  syncMeta?: PlanetSyncMeta;
}
