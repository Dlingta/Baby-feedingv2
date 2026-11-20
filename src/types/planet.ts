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
  | '5.1'
  | '5.2'
  | '5.3'
  | '5.4'
  | '6.1';

export interface BabyProfile {
  name: string;
  planetName: string;
  birthDate: string; // YYYY-MM-DD or '' when uninitialized
  gender: 'boy' | 'girl' | 'star';
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
  recorder: string;
}

export interface GrowthRecord {
  id: string;
  date: string; // YYYY-MM-DD
  heightCm: number;
  weightKg: number;
  headCm: number;
  note: string;
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
}

export type IllnessCareCategory = 'temperature' | 'medicine' | 'hydration';

export interface IllnessRecord {
  id: string;
  date: string;
  time: string;
  careCategory?: IllnessCareCategory;
  title?: string;
  summary?: string;
  amountMl?: number;
  handled?: boolean;
  temperatureC: number;
  symptoms: string[];
  medication: string;
  recorder: string;
}

export interface ChecklistItem {
  id: string;
  title: string;
  subtitle: string;
  completed: boolean;
}

export interface PlanetAppState {
  profile: BabyProfile;
  diaries: DiaryEntry[];
  feedings: FeedingRecord[];
  growths: GrowthRecord[];
  vaccines: VaccineDose[];
  illnesses: IllnessRecord[];
  checklist: ChecklistItem[];
}
