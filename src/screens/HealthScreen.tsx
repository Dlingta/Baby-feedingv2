import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Info,
  Lock,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import {
  DiseasePresetTag,
  IllnessRecord,
  PlanetAppState,
  VaccineBrandOrigin,
  VaccineChoiceOption,
  VaccineDose,
  VaccineFundingType,
} from '../types/planet';
import { getCurrentTimeStr, getTodayDateStr, shiftDateStr } from '../data/initialData';
import { CLINIC_VACCINE_TIPS } from '../data/vaccineCatalog';
import { AssetSlot } from '../components/Illustrations';
import {
  CosmicModuleHeader,
  CosmicSubHeader,
  HandDrawnCalendarIcon,
} from '../components/CosmicModuleHeader';

export type HealthViewMode = 'vaccine' | 'vaccine_sheet' | 'illness' | 'illness_form';

interface HealthScreenProps {
  state: PlanetAppState;
  currentRecorder: string;
  mode: HealthViewMode;
  activeSheetDoseId?: string | null;
  showSlotTag?: boolean;
  onChangeMode: (mode: HealthViewMode) => void;
  onBackHome: () => void;
  onConfirmVaccine: (
    doseId: string,
    date: string,
    note: string,
    brandOrigin?: VaccineBrandOrigin,
    fundingType?: VaccineFundingType,
    extra?: {
      selectedOptionId?: string;
      selectedOptionLabel?: string;
      brandName?: string;
      pricePaid?: string;
    }
  ) => void;
  onResetVaccine: (doseId: string) => void;
  onAddIllness: (record: IllnessRecord) => void;
  onToggleIllnessHandled: (id: string) => void;
  onDeleteIllness: (id: string) => void;
}

const BRAND_OPTIONS: VaccineBrandOrigin[] = ['国产', '进口', '其他'];
const FUNDING_OPTIONS: VaccineFundingType[] = ['免费', '自费'];

const DISEASE_PRESETS: DiseasePresetTag[] = [
  '体温异常',
  '发烧',
  '感冒',
  '皮疹',
  '咳嗽',
  '腹泻',
  '过敏',
  '自定义',
];

const SYMPTOM_OPTIONS = [
  '发热',
  '咳嗽',
  '流鼻涕',
  '皮疹',
  '呕吐',
  '腹泻',
  '食欲不振',
  '精神欠佳',
];

type IllnessFilterKey = 'all' | 'fever' | 'respiratory' | 'skin_other' | 'with_case';

type VaccineFilterKey = 'all' | 'mandatory' | 'optional' | 'activated' | 'pending';

/** 根据宝宝出生日期估算推荐接种日期（兼容“出生 24h 内”“1.5 月龄”“1 岁 6.5 月龄”“3 岁”等） */
function estimateDoseDate(birthDate: string, recommendedMonth: string): string {
  if (!birthDate) return recommendedMonth;
  if (recommendedMonth.includes('出生')) {
    return birthDate.replace(/-/g, '.');
  }
  const yearMonthMatch = recommendedMonth.match(
    /(\d+)\s*(?:周)?岁(?:\s*(\d+(?:\.\d+)?)\s*月龄)?/
  );
  if (yearMonthMatch) {
    const years = parseInt(yearMonthMatch[1], 10);
    const extraMonths = yearMonthMatch[2] ? parseFloat(yearMonthMatch[2]) : 0;
    const totalDays = Math.round(years * 365 + extraMonths * 30);
    return shiftDateStr(birthDate, totalDays).replace(/-/g, '.');
  }
  const monthMatch = recommendedMonth.match(/(\d+(?:\.\d+)?)\s*月龄/);
  if (monthMatch) {
    const months = parseFloat(monthMatch[1]);
    return shiftDateStr(birthDate, Math.round(months * 30)).replace(/-/g, '.');
  }
  return recommendedMonth;
}

function extractNumericPrice(priceHint?: string): string {
  if (!priceHint || priceHint.includes('免费')) return '';
  const m = priceHint.match(/(\d+(?:\.\d+)?)/);
  return m ? m[1] : '';
}

function getDiseaseLabel(rec: IllnessRecord): string {
  return (rec.diseaseName || rec.title || '体温异常').trim();
}

function hasMedicalCase(rec: IllnessRecord): boolean {
  return Boolean(
    rec.hospital?.trim() ||
      rec.diagnosis?.trim() ||
      (rec.casePhotos && rec.casePhotos.length > 0)
  );
}

function isFeverLike(rec: IllnessRecord): boolean {
  const label = getDiseaseLabel(rec);
  return (
    (typeof rec.temperatureC === 'number' && rec.temperatureC >= 37.5) ||
    label.includes('烧') ||
    label.includes('热') ||
    label.includes('体温')
  );
}

function getDiseaseIconSrc(rec: IllnessRecord): string {
  const label = getDiseaseLabel(rec);
  if (label.includes('烧') || label.includes('热') || label.includes('体温')) {
    return './assets/extracted/health_thermometer.png';
  }
  if (label.includes('感冒') || label.includes('咳') || label.includes('腹泻')) {
    return './assets/extracted/health_medicine_bottle.png';
  }
  return './assets/extracted/health_firstaid_kit.png';
}

export const HealthScreen: React.FC<HealthScreenProps> = ({
  state,
  currentRecorder,
  mode,
  activeSheetDoseId,
  showSlotTag = false,
  onChangeMode,
  onBackHome,
  onConfirmVaccine,
  onResetVaccine,
  onAddIllness,
  onToggleIllnessHandled,
  onDeleteIllness,
}) => {
  // 按宝宝性别过滤仅适用女孩的疫苗（如 9 岁 HPV）
  const visibleVaccines = useMemo(() => {
    if (state.profile.gender === 'boy') {
      return state.vaccines.filter((v) => v.id !== 'vac-opt-hpv');
    }
    return state.vaccines;
  }, [state.vaccines, state.profile.gender]);

  const defaultNextDose =
    visibleVaccines.find((v) => v.status === 'next') ||
    visibleVaccines.find((v) => v.status !== 'activated') ||
    visibleVaccines[0] ||
    state.vaccines[0];

  // 5.1 疫苗列表交互状态
  const [vaccineFilter, setVaccineFilter] = useState<VaccineFilterKey>('all');
  const [showAllVaccines, setShowAllVaccines] = useState(false);
  const [showHeaderPanel, setShowHeaderPanel] = useState(false);
  const [showClinicTips, setShowClinicTips] = useState(false);

  // 5.2 确认接种信息表单状态
  const [selectedDoseId, setSelectedDoseId] = useState<string>(
    activeSheetDoseId || defaultNextDose.id
  );
  const [vacOptionId, setVacOptionId] = useState<string>('');
  const [vacBrand, setVacBrand] = useState<VaccineBrandOrigin>('国产');
  const [vacFunding, setVacFunding] = useState<VaccineFundingType>('免费');
  const [vacBrandName, setVacBrandName] = useState<string>('');
  const [vacPricePaid, setVacPricePaid] = useState<string>('');
  const [vacDate, setVacDate] = useState<string>(() => getTodayDateStr());
  const [vacNote, setVacNote] = useState<string>('');

  // 5.3 生病记录列表状态
  const [illnessFilter, setIllnessFilter] = useState<IllnessFilterKey>('all');
  const [careDateFilter, setCareDateFilter] = useState<string>('');
  const [expandedIllnessId, setExpandedIllnessId] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);

  // 5.4 新建 / 编辑生病记录与病历录入状态
  const [editingIllnessId, setEditingIllnessId] = useState<string | null>(null);
  const [selectedDiseaseTag, setSelectedDiseaseTag] = useState<DiseasePresetTag>('发烧');
  const [customDiseaseName, setCustomDiseaseName] = useState<string>('');
  const [illDate, setIllDate] = useState<string>(() => getTodayDateStr());
  const [illTime, setIllTime] = useState<string>(() => getCurrentTimeStr());
  const [showFormTimeRow, setShowFormTimeRow] = useState(false);
  const [tempStr, setTempStr] = useState('38.5');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['发热']);
  const [medication, setMedication] = useState('');
  const [hospital, setHospital] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [casePhotos, setCasePhotos] = useState<string[]>([]);
  const [illHandled, setIllHandled] = useState(false);
  const [recorder, setRecorder] = useState(currentRecorder || state.profile.recorders[0] || '妈妈');
  const casePhotoInputRef = useRef<HTMLInputElement>(null);

  const syncFormFromDose = (dose: VaccineDose) => {
    const matchedOpt =
      (dose.selectedOptionId && dose.options?.find((o) => o.id === dose.selectedOptionId)) ||
      dose.options?.[0];
    const resolvedFunding: VaccineFundingType =
      dose.fundingType ||
      matchedOpt?.fundingType ||
      (dose.planCategory === 'optional' ? '自费' : '免费');
    const resolvedOrigin: VaccineBrandOrigin =
      dose.brandOrigin || matchedOpt?.brandOrigin || '国产';

    setSelectedDoseId(dose.id);
    setVacOptionId(matchedOpt?.id || '');
    setVacFunding(resolvedFunding);
    setVacBrand(resolvedOrigin);
    setVacBrandName(dose.brandName ?? matchedOpt?.brandName ?? '');
    setVacPricePaid(
      dose.pricePaid ?? (resolvedFunding === '自费' ? extractNumericPrice(matchedOpt?.priceHint) : '')
    );
    setVacDate(dose.inoculatedDate || getTodayDateStr());
    setVacNote(dose.note || '');
  };

  // 当从首页“去打卡”或侧栏直达 5.2 时，同步预填选中疫苗信息
  useEffect(() => {
    if (mode === 'vaccine_sheet') {
      const targetId = activeSheetDoseId || defaultNextDose.id;
      const target = visibleVaccines.find((v) => v.id === targetId) || defaultNextDose;
      if (target) {
        syncFormFromDose(target);
      }
    }
  }, [mode, activeSheetDoseId]);

  const activeDose =
    visibleVaccines.find((v) => v.id === selectedDoseId) || defaultNextDose;

  const activatedCount = visibleVaccines.filter((v) => v.status === 'activated').length;
  const mandatoryVaccines = useMemo(
    () => visibleVaccines.filter((v) => v.planCategory !== 'optional'),
    [visibleVaccines]
  );
  const optionalVaccines = useMemo(
    () => visibleVaccines.filter((v) => v.planCategory === 'optional'),
    [visibleVaccines]
  );
  const mandatoryActivatedCount = mandatoryVaccines.filter((v) => v.status === 'activated').length;
  const isIllnessView = mode === 'illness' || mode === 'illness_form';

  const openVaccineForm = (dose: VaccineDose) => {
    syncFormFromDose(dose);
    setShowHeaderPanel(false);
    onChangeMode('vaccine_sheet');
  };

  const handleSelectDoseInForm = (doseId: string) => {
    const found = visibleVaccines.find((v) => v.id === doseId);
    if (found) {
      syncFormFromDose(found);
    } else {
      setSelectedDoseId(doseId);
    }
  };

  const handleSelectOptionInForm = (opt: VaccineChoiceOption) => {
    setVacOptionId(opt.id);
    setVacFunding(opt.fundingType);
    setVacBrand(opt.brandOrigin);
    setVacBrandName(opt.brandName || '');
    setVacPricePaid(opt.fundingType === '自费' ? extractNumericPrice(opt.priceHint) : '');
  };

  const handleSaveVaccineForm = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedOpt = activeDose.options?.find((o) => o.id === vacOptionId);
    onConfirmVaccine(
      activeDose.id,
      vacDate || getTodayDateStr(),
      vacNote.trim() || '按计划顺利接种，留观 30 分钟无异常',
      vacBrand,
      vacFunding,
      {
        selectedOptionId: selectedOpt?.id || undefined,
        selectedOptionLabel: selectedOpt?.label || undefined,
        brandName: vacBrandName.trim() || undefined,
        pricePaid: vacFunding === '自费' ? vacPricePaid.trim() || undefined : undefined,
      }
    );
    onChangeMode('vaccine');
  };

  const openCreateIllnessForm = (preset: DiseasePresetTag = '发烧') => {
    setEditingIllnessId(null);
    setSelectedDiseaseTag(preset);
    setCustomDiseaseName('');
    setIllDate(getTodayDateStr());
    setIllTime(getCurrentTimeStr());
    setTempStr(preset === '发烧' || preset === '体温异常' ? '38.5' : '');
    setSelectedSymptoms(
      preset === '发烧' || preset === '体温异常'
        ? ['发热']
        : preset === '感冒'
        ? ['流鼻涕', '咳嗽']
        : preset === '皮疹'
        ? ['皮疹']
        : []
    );
    setMedication('');
    setHospital('');
    setDiagnosis('');
    setCasePhotos([]);
    setIllHandled(false);
    setRecorder(currentRecorder || state.profile.recorders[0] || '妈妈');
    setShowFormTimeRow(false);
    setShowHeaderPanel(false);
    onChangeMode('illness_form');
  };

  const openEditIllnessForm = (rec: IllnessRecord) => {
    const label = getDiseaseLabel(rec);
    const matchedPreset = DISEASE_PRESETS.find((p) => p !== '自定义' && p === label);
    setEditingIllnessId(rec.id);
    setSelectedDiseaseTag(matchedPreset || '自定义');
    setCustomDiseaseName(matchedPreset ? '' : label);
    setIllDate(rec.date);
    setIllTime(rec.time);
    setTempStr(typeof rec.temperatureC === 'number' ? String(rec.temperatureC) : '');
    setSelectedSymptoms(rec.symptoms || []);
    setMedication(rec.medication || '');
    setHospital(rec.hospital || '');
    setDiagnosis(rec.diagnosis || '');
    setCasePhotos(rec.casePhotos || []);
    setIllHandled(Boolean(rec.handled));
    setRecorder(rec.recorder || currentRecorder || state.profile.recorders[0] || '妈妈');
    setShowFormTimeRow(false);
    setShowHeaderPanel(false);
    onChangeMode('illness_form');
  };

  const handleSelectDiseasePreset = (preset: DiseasePresetTag) => {
    setSelectedDiseaseTag(preset);
    if (preset === '发烧' || preset === '体温异常') {
      if (!tempStr) setTempStr('38.5');
      if (!selectedSymptoms.includes('发热')) {
        setSelectedSymptoms((prev) => ['发热', ...prev]);
      }
    } else if (preset === '皮疹' && !selectedSymptoms.includes('皮疹')) {
      setSelectedSymptoms((prev) => ['皮疹', ...prev]);
    } else if (preset === '咳嗽' && !selectedSymptoms.includes('咳嗽')) {
      setSelectedSymptoms((prev) => ['咳嗽', ...prev]);
    } else if (preset === '腹泻' && !selectedSymptoms.includes('腹泻')) {
      setSelectedSymptoms((prev) => ['腹泻', ...prev]);
    }
  };

  const handleUploadCasePhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remainingSlots = Math.max(0, 4 - casePhotos.length);
    files.slice(0, remainingSlots).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCasePhotos((prev) => (prev.length < 4 ? [...prev, reader.result as string] : prev));
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const toggleSymptom = (sym: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleSaveIllnessForm = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedDisease =
      selectedDiseaseTag === '自定义'
        ? customDiseaseName.trim() || '自定义生病记录'
        : customDiseaseName.trim() || selectedDiseaseTag;

    const trimmedTemp = tempStr.trim();
    const parsedT = trimmedTemp ? parseFloat(trimmedTemp) : NaN;
    const safeTemp = Number.isFinite(parsedT) ? parsedT : undefined;

    const record: IllnessRecord = {
      id: editingIllnessId || `ill-${Date.now()}`,
      date: illDate || getTodayDateStr(),
      time: illTime || getCurrentTimeStr(),
      diseaseName: resolvedDisease,
      diseaseTag: selectedDiseaseTag,
      title: resolvedDisease,
      handled: illHandled,
      temperatureC: safeTemp,
      symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : [resolvedDisease],
      medication: medication.trim() || '按医嘱居家观察与护理',
      hospital: hospital.trim() || undefined,
      diagnosis: diagnosis.trim() || undefined,
      casePhotos: casePhotos.length > 0 ? casePhotos : undefined,
      recorder,
    };

    onAddIllness(record);
    setExpandedIllnessId(record.id);
    onChangeMode('illness');
  };

  // 5.1 过滤后的疫苗列表（默认聚焦近期 4-5 剂，支持按免费必打 / 自费可选 / 已完成筛选与全部展开）
  const filteredVaccines = useMemo(() => {
    const base = visibleVaccines.filter((dose) => {
      if (vaccineFilter === 'mandatory') return dose.planCategory !== 'optional';
      if (vaccineFilter === 'optional') return dose.planCategory === 'optional';
      if (vaccineFilter === 'activated') return dose.status === 'activated';
      if (vaccineFilter === 'pending') return dose.status !== 'activated';
      return true;
    });

    if (showAllVaccines || vaccineFilter !== 'all') {
      return base;
    }

    // 聚焦展示：最后 1 针已完成 + 下一针 + 紧随其后的 3 针待解锁
    const nextIdx = base.findIndex((v) => v.status === 'next');
    if (nextIdx === -1) return base.slice(0, 5);
    const start = Math.max(0, nextIdx - 1);
    return base.slice(start, Math.min(base.length, start + 5));
  }, [visibleVaccines, vaccineFilter, showAllVaccines]);

  // 5.3 过滤后的生病记录列表
  const filteredIllnesses = useMemo(() => {
    return state.illnesses.filter((rec) => {
      const label = getDiseaseLabel(rec);
      if (illnessFilter === 'fever' && !isFeverLike(rec)) {
        return false;
      }
      if (
        illnessFilter === 'respiratory' &&
        !(label.includes('感冒') || label.includes('咳') || rec.symptoms.includes('咳嗽') || rec.symptoms.includes('流鼻涕'))
      ) {
        return false;
      }
      if (
        illnessFilter === 'skin_other' &&
        (isFeverLike(rec) || label.includes('感冒') || label.includes('咳'))
      ) {
        return false;
      }
      if (illnessFilter === 'with_case' && !hasMedicalCase(rec)) {
        return false;
      }
      if (careDateFilter && rec.date !== careDateFilter) {
        return false;
      }
      return true;
    });
  }, [state.illnesses, illnessFilter, careDateFilter]);

  const parsedFormTemp = tempStr.trim() ? parseFloat(tempStr) : NaN;
  const isFormOverheat = Number.isFinite(parsedFormTemp) && parsedFormTemp >= 38.5;

  const handleBackClick = () => {
    if (mode === 'vaccine_sheet') {
      onChangeMode('vaccine');
    } else if (mode === 'illness_form') {
      onChangeMode('illness');
    } else {
      onBackHome();
    }
  };

  return (
    <div className="relative flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-clip pb-6">
      {/* 顶部微星光晕染背景 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-45"
        style={{
          backgroundImage: 'url(./assets/aistudio/____f8d9ecf9.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          WebkitMaskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
        }}
      />

      {/* 底部左右花草星球装饰边（限定在滚动页面底部，不覆盖固定底栏） */}
      <img
        src="./assets/extracted/health_footer_flowers.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 z-0 w-36 opacity-80"
      />
      <img
        src="./assets/extracted/health_footer_flowers.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 z-0 w-36 -scale-x-100 opacity-80"
      />

      {/* =================================================================
          5.1 疫苗护盾列表页（首屏完整锁定 var(--app-viewport-h)，底部主按钮下滑完整可见）
         ================================================================= */}
      {mode === 'vaccine' && (
        <>
          <div
            style={{ minHeight: 'var(--app-viewport-h)' }}
            className="relative z-10 flex w-full min-w-0 max-w-full flex-col"
          >
            <CosmicModuleHeader
              title="治愈工坊"
              subtitle="健康守护"
              onBack={handleBackClick}
              onCalendarClick={() => setShowHeaderPanel((v) => !v)}
              calendarActive={showHeaderPanel}
              calendarLabel="疫苗进度与筛选"
            />

            {showHeaderPanel && (
              <div className="relative z-20 mx-4 mb-2.5 rounded-[22px] border border-white/15 bg-[#122350]/88 px-3.5 py-3 shadow-[0_10px_24px_rgba(3,8,24,0.42)] backdrop-blur-md">
                <div className="flex items-center justify-between typo-meta">
                  <span className="font-medium text-amber-100">免疫规划必打进度</span>
                  <span className="font-typewriter typo-num text-amber-300">
                    必打 {mandatoryActivatedCount}/{mandatoryVaccines.length} · 全部 {activatedCount}/{visibleVaccines.length}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#85d965] to-[#fde047] transition-all duration-300"
                    style={{
                      width: `${Math.round(
                        (mandatoryActivatedCount / Math.max(1, mandatoryVaccines.length)) * 100
                      )}%`,
                    }}
                  />
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: 'all', label: `全部 (${visibleVaccines.length})` },
                      { id: 'mandatory', label: `免费必打 (${mandatoryVaccines.length})` },
                      { id: 'optional', label: `自费可选 (${optionalVaccines.length})` },
                      { id: 'activated', label: `已完成 (${activatedCount})` },
                      { id: 'pending', label: `待接种 (${visibleVaccines.length - activatedCount})` },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setVaccineFilter(opt.id);
                        if (opt.id !== 'all') setShowAllVaccines(true);
                      }}
                      className={`rounded-full px-2.5 py-1 typo-badge transition-all ${
                        vaccineFilter === opt.id
                          ? 'bg-gradient-to-b from-[#ffe260] to-[#f4b324] font-semibold text-[#1f1809]'
                          : 'bg-white/10 text-indigo-100/80 hover:bg-white/15'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative z-10 flex w-full min-w-0 max-w-full flex-1 flex-col px-4 pb-3">
              {/* 顶部二级模式切换胶囊：疫苗护盾 | 生病记录 */}
              <div className="mb-1 flex justify-center">
                <div className="inline-flex items-center rounded-full border border-white/15 bg-[#152550]/75 p-0.5 backdrop-blur-md shadow-[0_4px_14px_rgba(3,8,24,0.38)]">
                  <button
                    type="button"
                    onClick={() => onChangeMode('vaccine')}
                    className="rounded-full bg-gradient-to-b from-[#ffe25f] via-[#facc34] to-[#f2ab1a] px-4 py-1 typo-tab-active text-[#1f190d] shadow-[0_2px_10px_rgba(250,204,52,0.45)]"
                  >
                    疫苗护盾
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeMode('illness')}
                    className="rounded-full px-4 py-1 typo-tab text-indigo-100/80 transition-colors hover:text-white"
                  >
                    生病记录
                  </button>
                </div>
              </div>

              {/* 英雄插画区：左侧金盾标语 + 右侧持盾小男孩与巴哥犬（置于撕纸卡片后方） */}
              <div className="relative z-10 -mb-5 flex items-end justify-between px-1 pt-1">
                <div className="pb-6 pl-1">
                  <div className="flex items-center gap-1.5">
                    <img
                      src="./assets/extracted/health_shield_gold.png"
                      alt=""
                      aria-hidden="true"
                      className="h-9 w-8 object-contain drop-shadow-[0_0_12px_rgba(253,224,71,0.65)]"
                    />
                    <span className="typo-section-title text-[#fff8e7] drop-shadow">
                      健康防御，
                    </span>
                  </div>
                  <div className="mt-0.5 pl-0.5 typo-section-title text-[#fff8e7] drop-shadow">
                    从每一针开始
                  </div>
                  <svg viewBox="0 0 132 10" className="mt-0.5 h-2.5 w-32 opacity-90" fill="none" aria-hidden="true">
                    <path
                      d="M2 5 Q 18 2, 34 5 T 66 5 T 98 5 T 130 5"
                      stroke="#FACC15"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="mt-1 typo-meta text-amber-200/85 tabular-nums">
                    必打 {mandatoryActivatedCount}/{mandatoryVaccines.length} · 护盾共 {activatedCount}/{visibleVaccines.length} 剂
                  </div>
                </div>

                <AssetSlot slotName="health_boy_pug_shield" showSlotTag={showSlotTag} className="shrink-0">
                  <img
                    src="./assets/extracted/health_boy_pug_shield.png"
                    alt="手持护盾的小漫游者与巴哥犬"
                    referrerPolicy="no-referrer"
                    className="h-[118px] w-auto object-contain drop-shadow-[0_8px_16px_rgba(3,8,24,0.45)]"
                  />
                </AssetSlot>
              </div>

          {/* 撕纸疫苗时间轴主卡片 */}
          <div className="diary-paper-card relative z-20 min-w-0 px-1.5 py-2">
            {/* 卡片内快捷分类筛选：区分免费必打与自费可选 */}
            <div className="mb-1.5 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 pt-0.5 no-scrollbar">
              {(
                [
                  { id: 'all', label: '全部计划' },
                  { id: 'mandatory', label: `免费必打 (${mandatoryVaccines.length})` },
                  { id: 'optional', label: `自费可选 (${optionalVaccines.length})` },
                  { id: 'activated', label: `已打 (${activatedCount})` },
                ] as const
              ).map((chip) => {
                const active = vaccineFilter === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => {
                      setVaccineFilter(chip.id);
                      if (chip.id !== 'all') setShowAllVaccines(true);
                    }}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 ${
                      active
                        ? 'border border-[#ecc048] bg-gradient-to-b from-[#ffe469] to-[#f7c235] text-[#281e08] shadow-[0_2px_6px_rgba(247,194,53,0.3)]'
                        : 'border border-[#e4d8c3] bg-[#f7f0e2] text-[#6a5f51] hover:bg-[#efe4cf]'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>

            <div className="relative space-y-1">
              {filteredVaccines.map((dose, idx) => {
                const isActivated = dose.status === 'activated';
                const isNext = dose.status === 'next';
                const isLast = idx === filteredVaccines.length - 1;
                const isOptional = dose.planCategory === 'optional';
                const optionCount = dose.options?.length || 0;
                const displayDate = dose.inoculatedDate
                  ? dose.inoculatedDate.replace(/-/g, '.')
                  : estimateDoseDate(state.profile.birthDate, dose.recommendedMonth);

                const recordedSummary = [
                  dose.brandName || dose.selectedOptionLabel,
                  dose.brandOrigin,
                  dose.fundingType,
                  dose.pricePaid ? `¥${dose.pricePaid}` : '',
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <button
                    key={dose.id}
                    type="button"
                    onClick={() => openVaccineForm(dose)}
                    className="group relative flex w-full items-center justify-between gap-2 rounded-2xl px-1.5 py-2.5 text-left transition-colors hover:bg-[#efe3cb]/60 active:scale-[0.99]"
                  >
                    {/* 左侧时间轴虚线与状态圆点 */}
                    <div className="relative flex w-4 shrink-0 flex-col items-center self-stretch">
                      <span
                        className={`relative z-10 mt-3 h-2.5 w-2.5 rounded-full ${
                          isActivated
                            ? 'bg-[#66ba49] shadow-[0_0_6px_rgba(102,186,73,0.65)]'
                            : isNext
                            ? 'bg-[#f4b626] shadow-[0_0_8px_rgba(244,182,38,0.75)]'
                            : isOptional
                            ? 'bg-[#94b5cf]'
                            : 'bg-[#bdb3a4]'
                        }`}
                      />
                      {!isLast && (
                        <span
                          className="absolute top-[22px] bottom-[-18px] w-[1.5px] border-l border-dashed border-[#c8ba9f]"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    {/* 手绘图标：绿色护盾 / 蓝色疫苗瓶 / 灰蓝待解锁瓶 */}
                    <div className="flex h-10 w-9 shrink-0 items-center justify-center">
                      <img
                        src={
                          isActivated
                            ? './assets/extracted/health_shield_green.png'
                            : isNext
                            ? './assets/extracted/health_vial_blue.png'
                            : './assets/extracted/health_vial_locked.png'
                        }
                        alt=""
                        referrerPolicy="no-referrer"
                        className={`h-8 w-8 object-contain ${
                          !isActivated && !isNext ? 'opacity-75' : ''
                        }`}
                      />
                    </div>

                    {/* 日期 + 分类标签 + 疫苗名称与可选提示 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1 typo-meta text-[#5b5349] tabular-nums">
                        <span className="font-typewriter">{displayDate}</span>
                        <span className="text-[#8b7f70]">· {dose.recommendedMonth}</span>
                        {isOptional ? (
                          <span className="rounded-md bg-[#e5eff8] px-1.5 py-[1px] text-[10px] font-bold text-[#2b5e8a]">
                            {optionCount === 2
                              ? '自费·二选一'
                              : optionCount > 2
                              ? `自费·${optionCount}选一`
                              : '自费可选'}
                          </span>
                        ) : (
                          <span className="rounded-md bg-[#e3f1d8] px-1.5 py-[1px] text-[10px] font-bold text-[#3b7a24]">
                            免费必打
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 truncate typo-item-title text-[#1e293f]">
                        {dose.name} {dose.doseLabel}
                      </div>
                      {isActivated && recordedSummary ? (
                        <div className="mt-0.5 truncate typo-badge text-[#6d6254]">
                          {recordedSummary}
                        </div>
                      ) : dose.selectionHint ? (
                        <div className="mt-0.5 truncate text-[10.5px] text-[#8a7d6d]">
                          {dose.selectionHint}
                        </div>
                      ) : null}
                    </div>

                    {/* 右侧手绘状态标签 */}
                    <div className="shrink-0">
                      {isActivated ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#b7dc9f] bg-[#d8edc9] px-2.5 py-1 typo-badge text-[#3b7a24]">
                          <span>已完成</span>
                          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#5cb844] text-white">
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </span>
                        </span>
                      ) : isNext ? (
                        <span className="relative inline-flex items-center gap-1 rounded-full bg-gradient-to-b from-[#ffe25e] to-[#f4b21d] px-2.5 py-1 typo-badge font-semibold text-[#2a1f07] shadow-[0_2px_8px_rgba(244,178,29,0.45)]">
                          <span>下一针</span>
                          <img
                            src="./assets/extracted/health_star_small.png"
                            alt=""
                            aria-hidden="true"
                            className="h-3.5 w-3.5 object-contain"
                          />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#e3ddd2] px-2.5 py-1 typo-badge text-[#847b70]">
                          <span>待解锁</span>
                          <Lock className="h-3 w-3 opacity-80" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 展开 / 收起全部计划 + 门诊温馨提示 */}
            <div className="mt-1 flex flex-col items-center gap-1.5 border-t border-dashed border-[#dfd2ba] pt-2">
              {vaccineFilter === 'all' && visibleVaccines.length > 5 && (
                <button
                  type="button"
                  onClick={() => setShowAllVaccines((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11.5px] font-semibold text-[#6e6050] transition-colors hover:bg-[#efe3cb]"
                >
                  <span>
                    {showAllVaccines
                      ? '收起，仅聚焦近期计划'
                      : `查看全部 ${visibleVaccines.length} 剂疫苗计划（含自费可选）`}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      showAllVaccines ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowClinicTips((v) => !v)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-[#8a7964] transition-colors hover:bg-[#efe3cb]/70"
              >
                <Info className="h-3 w-3" />
                <span>{showClinicTips ? '收起接种门诊温馨提示' : '查看接种门诊温馨提示'}</span>
              </button>

              {showClinicTips && (
                <div className="mt-0.5 w-full rounded-2xl border border-[#e5d8bf] bg-[#f7f0e2] px-3 py-2.5 text-left">
                  <div className="mb-1 text-[11.5px] font-bold text-[#3f3428]">
                    预防接种门诊温馨提示
                  </div>
                  <ul className="space-y-1 text-[11px] leading-relaxed text-[#6b5d4e]">
                    {CLINIC_VACCINE_TIPS.map((tip, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="shrink-0 font-bold text-[#c78b18]">{i + 1}.</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

            </div>
          </div>

          {/* 底部主按钮严格置于首屏之下：下滑后完整可见，首屏绝不局部露头 */}
          <div className="relative z-10 mt-4 flex justify-center px-4 pb-3">
            <button
              type="button"
              onClick={() => openVaccineForm(defaultNextDose)}
              className="flex min-h-[48px] w-[78%] items-center justify-center gap-2 rounded-full border-2 border-[#fff0a6]/85 bg-gradient-to-b from-[#ffe25e] via-[#facc34] to-[#f1a819] px-6 typo-cta text-[#241b09] shadow-[0_8px_22px_rgba(244,179,30,0.45),inset_0_2px_2px_rgba(255,255,255,0.65)] transition-transform hover:brightness-105 active:scale-[0.97]"
            >
              <img
                src="./assets/extracted/health_icon_calendar.png"
                alt=""
                aria-hidden="true"
                className="h-4.5 w-4.5 object-contain"
              />
              <span>疫苗打卡</span>
            </button>
          </div>
        </>
      )}

      {/* =================================================================
          5.2 确认接种信息页（统一二级顶栏）
         ================================================================= */}
      {mode === 'vaccine_sheet' && (
        <>
          <CosmicSubHeader
            title="确认接种记录"
            onBack={handleBackClick}
            backLabel="返回疫苗护盾"
          />
          <form
            onSubmit={handleSaveVaccineForm}
            className="relative z-10 flex w-full min-w-0 max-w-full flex-1 flex-col px-4 pb-safe"
          >
            {/* 顶部英雄插画（置于撕纸卡片后方，自然探出顶边） */}
            <div className="relative z-10 -mb-5 flex items-end justify-between px-1 pt-0.5">
              <div className="pb-6 pl-1">
                <div className="flex items-center gap-1.5">
                  <img
                    src="./assets/extracted/health_shield_gold.png"
                    alt=""
                    aria-hidden="true"
                    className="h-9 w-8 object-contain drop-shadow-[0_0_12px_rgba(253,224,71,0.65)]"
                  />
                  <span className="typo-section-title text-[#fff8e7] drop-shadow">
                    健康防御，
                  </span>
                </div>
                <div className="mt-0.5 pl-0.5 typo-section-title text-[#fff8e7] drop-shadow">
                  从每一针开始
                </div>
              <svg viewBox="0 0 132 10" className="mt-0.5 h-2.5 w-32 opacity-90" fill="none" aria-hidden="true">
                <path
                  d="M2 5 Q 18 2, 34 5 T 66 5 T 98 5 T 130 5"
                  stroke="#FACC15"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <img
              src="./assets/extracted/health_boy_pug_shield.png"
              alt="持盾小漫游者与巴哥犬"
              referrerPolicy="no-referrer"
              className="h-[112px] w-auto object-contain drop-shadow-[0_8px_16px_rgba(3,8,24,0.45)]"
            />
          </div>

          {/* 撕纸表单卡片 + 右上角双闪星 */}
          <div className="diary-paper-card relative z-20 px-2.5 py-3">
            <img
              src="./assets/extracted/health_star_big.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -right-2 -top-4 z-30 h-9 w-9 object-contain drop-shadow-[0_0_10px_rgba(253,224,71,0.85)]"
            />
            <img
              src="./assets/extracted/health_star_small.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-5 z-30 h-5 w-5 object-contain drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]"
            />

            {/* 表单标题头 */}
            <div className="flex items-center gap-2.5 pb-3">
              <img
                src="./assets/extracted/health_vial_blue.png"
                alt=""
                aria-hidden="true"
                className="h-10 w-10 shrink-0 object-contain"
              />
              <div>
                <h2 className="typo-section-title text-[#182746]">确认接种信息</h2>
                <p className="typo-meta text-[#7c7163]">请填写本次疫苗接种的详细信息</p>
              </div>
            </div>

            <div className="space-y-3.5">
              {/* 1. 疫苗选择（按免疫规划免费必打 / 非免疫规划自费可选分组） */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#25324e]">
                    <img
                      src="./assets/extracted/health_star_small.png"
                      alt=""
                      aria-hidden="true"
                      className="h-3.5 w-3.5 object-contain"
                    />
                    <span>疫苗选择</span>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                      activeDose.planCategory === 'optional'
                        ? 'bg-[#e5eff8] text-[#2b5e8a]'
                        : 'bg-[#e3f1d8] text-[#3b7a24]'
                    }`}
                  >
                    {activeDose.planCategory === 'optional'
                      ? '非免疫规划 · 自愿自费'
                      : '免疫规划 · 免费必打'}
                  </span>
                </div>
                <div className="relative flex items-center justify-between rounded-2xl border border-[#e3d5be] bg-[#faf4e8] px-3 py-2.5 shadow-[inset_0_1px_2px_rgba(120,96,60,0.06)]">
                  <div className="flex min-w-0 items-center gap-2">
                    <img
                      src={
                        activeDose.status === 'activated'
                          ? './assets/extracted/health_shield_green.png'
                          : './assets/extracted/health_shield_gold.png'
                      }
                      alt=""
                      aria-hidden="true"
                      className="h-6 w-6 shrink-0 object-contain"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-bold text-[#1e2c49]">
                        {activeDose.name}（{activeDose.doseLabel}）
                      </div>
                      <div className="truncate text-[11px] text-[#7c7163]">
                        推荐月龄：{activeDose.recommendedMonth}
                        {activeDose.selectionHint ? ` · ${activeDose.selectionHint}` : ''}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-4.5 w-4.5 shrink-0 text-[#867a6b]" />
                  <select
                    aria-label="选择接种疫苗"
                    value={activeDose.id}
                    onChange={(e) => handleSelectDoseInForm(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  >
                    <optgroup label="免疫规划疫苗（免费必打）">
                      {mandatoryVaccines.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.recommendedMonth} · {v.name}（{v.doseLabel}）
                          {v.status === 'activated' ? ' [已完成]' : v.status === 'next' ? ' [下一针]' : ''}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="非免疫规划疫苗（自愿自费）">
                      {optionalVaccines.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.recommendedMonth} · {v.name}（{v.doseLabel}）
                          {v.status === 'activated' ? ' [已完成]' : v.status === 'next' ? ' [下一针]' : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </div>

                {activeDose.clinicTip && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-xl border border-[#eed8a6] bg-[#fdf4df] px-2.5 py-2 text-[11px] leading-relaxed text-[#7c5617]">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#d08d16]" />
                    <span>{activeDose.clinicTip}</span>
                  </div>
                )}
              </div>

              {/* 1.5 具体方案选择（二选一 / 多选一 / 免费或自费替代升级） */}
              {activeDose.options && activeDose.options.length > 0 && (
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#25324e]">
                      <img
                        src="./assets/extracted/health_star_small.png"
                        alt=""
                        aria-hidden="true"
                        className="h-3.5 w-3.5 object-contain"
                      />
                      <span>具体方案选择</span>
                    </div>
                    <span className="text-[11px] text-[#8a7d6d]">
                      {activeDose.options.length === 1
                        ? '推荐方案'
                        : activeDose.options.some((o) => o.fundingType === '免费') &&
                          activeDose.options.some((o) => o.fundingType === '自费')
                        ? '免费必打 / 自费升级可选'
                        : activeDose.options.length === 2
                        ? '二选一，请勾选实际接种方案'
                        : `${activeDose.options.length}选一，请勾选实际接种方案`}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {activeDose.options.map((opt) => {
                      const isSelected = vacOptionId === opt.id;
                      const isFree = opt.fundingType === '免费';
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleSelectOptionInForm(opt)}
                          className={`w-full rounded-2xl border px-3 py-2.5 text-left transition-all active:scale-[0.99] ${
                            isSelected
                              ? 'border-[#e8b636] bg-[#fff7dc] shadow-[0_3px_10px_rgba(244,185,46,0.22)]'
                              : 'border-[#e5d8c2] bg-[#faf4e8] hover:bg-[#f4ebd8]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex min-w-0 items-start gap-2">
                              <span
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                  isSelected
                                    ? 'border-[#e0a216] bg-[#f4b626] text-white'
                                    : 'border-[#cbbca5] bg-white'
                                }`}
                              >
                                {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                              </span>
                              <div className="min-w-0">
                                <div className="text-[12.5px] font-bold leading-snug text-[#1e2c49]">
                                  {opt.label}
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                  <span
                                    className={`rounded-md px-1.5 py-[1px] text-[10px] font-bold ${
                                      isFree
                                        ? 'bg-[#dff0d4] text-[#35731f]'
                                        : 'bg-[#e6eff8] text-[#285985]'
                                    }`}
                                  >
                                    {opt.shortTag}
                                  </span>
                                  {opt.priceHint && (
                                    <span className="font-typewriter text-[10.5px] font-semibold text-[#8c6b2d]">
                                      {opt.priceHint}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          {isSelected && opt.detailNote && (
                            <div className="mt-1.5 border-t border-dashed border-[#ead9ae] pl-6 pt-1.5 text-[11px] leading-relaxed text-[#6b5d4c]">
                              {opt.detailNote}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. 接种方式（免费 / 自费） */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-[#25324e]">
                  <img
                    src="./assets/extracted/health_star_small.png"
                    alt=""
                    aria-hidden="true"
                    className="h-3.5 w-3.5 object-contain"
                  />
                  <span>接种方式</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 pr-12">
                  {FUNDING_OPTIONS.map((funding) => {
                    const selected = vacFunding === funding;
                    return (
                      <button
                        key={funding}
                        type="button"
                        onClick={() => {
                          setVacFunding(funding);
                          if (funding === '免费') setVacPricePaid('');
                        }}
                        className={`min-h-[38px] rounded-full text-[13px] font-bold transition-all active:scale-95 ${
                          selected
                            ? 'border border-[#f2c144] bg-gradient-to-b from-[#ffe469] to-[#f8c437] text-[#261c07] shadow-[0_3px_10px_rgba(248,196,55,0.35)]'
                            : 'border border-[#e3d6c1] bg-[#f7f1e5] text-[#4f463c] hover:bg-[#f2e8d6]'
                        }`}
                      >
                        {funding}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. 品牌产地（国产 / 进口 / 其他）+ 具体厂家与费用 */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-[#25324e]">
                  <img
                    src="./assets/extracted/health_star_small.png"
                    alt=""
                    aria-hidden="true"
                    className="h-3.5 w-3.5 object-contain"
                  />
                  <span>品牌信息</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {BRAND_OPTIONS.map((brand) => {
                    const selected = vacBrand === brand;
                    return (
                      <button
                        key={brand}
                        type="button"
                        onClick={() => setVacBrand(brand)}
                        className={`min-h-[38px] rounded-full text-[13px] font-bold transition-all active:scale-95 ${
                          selected
                            ? 'border border-[#f2c144] bg-gradient-to-b from-[#ffe469] to-[#f8c437] text-[#261c07] shadow-[0_3px_10px_rgba(248,196,55,0.35)]'
                            : 'border border-[#e3d6c1] bg-[#f7f1e5] text-[#4f463c] hover:bg-[#f2e8d6]'
                        }`}
                      >
                        {brand}
                      </button>
                    );
                  })}
                </div>

                <div className={`mt-2.5 grid gap-2 ${vacFunding === '自费' ? 'grid-cols-5' : 'grid-cols-1'}`}>
                  <input
                    type="text"
                    value={vacBrandName}
                    onChange={(e) => setVacBrandName(e.target.value)}
                    placeholder="品牌/厂家（如 辉瑞沛儿13、默沙东乐儿德）"
                    className={`${
                      vacFunding === '自费' ? 'col-span-3' : 'col-span-1'
                    } rounded-2xl border border-[#e3d5be] bg-[#faf4e8] px-3 py-2 text-[12.5px] text-[#242f46] placeholder:text-[#a69a8a] focus:border-[#f0bd3f] focus:outline-none`}
                  />
                  {vacFunding === '自费' && (
                    <div className="col-span-2 flex items-center rounded-2xl border border-[#e3d5be] bg-[#faf4e8] px-2.5 py-2 focus-within:border-[#f0bd3f]">
                      <span className="mr-1 font-typewriter text-[12px] font-bold text-[#8b7a62]">¥</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={vacPricePaid}
                        onChange={(e) => setVacPricePaid(e.target.value)}
                        placeholder="费用"
                        className="w-full min-w-0 bg-transparent font-typewriter text-[12.5px] font-semibold text-[#242f46] placeholder:text-[#a69a8a] focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* 4. 接种日期 */}
              <div className="flex items-center justify-between gap-2.5 pt-0.5">
                <div className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-bold text-[#25324e]">
                  <img
                    src="./assets/extracted/health_star_small.png"
                    alt=""
                    aria-hidden="true"
                    className="h-3.5 w-3.5 object-contain"
                  />
                  <span>接种日期</span>
                </div>
                <label className="relative flex flex-1 cursor-pointer items-center justify-between rounded-2xl border border-[#e3d5be] bg-[#faf4e8] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <img
                      src="./assets/extracted/health_icon_calendar.png"
                      alt=""
                      aria-hidden="true"
                      className="h-4.5 w-4.5 object-contain"
                    />
                    <span className="font-typewriter text-[13.5px] font-bold text-[#1e2c49] tabular-nums">
                      {vacDate.replace(/-/g, '.')}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#867a6b]" />
                  <input
                    type="date"
                    value={vacDate}
                    onChange={(e) => {
                      if (e.target.value) setVacDate(e.target.value);
                    }}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    required
                  />
                </label>
              </div>

              {/* 5. 接种后观察 */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-[#25324e]">
                  <img
                    src="./assets/extracted/health_thermometer.png"
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-3.5 object-contain"
                  />
                  <span>接种后观察</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={100}
                  value={vacNote}
                  onChange={(e) => setVacNote(e.target.value)}
                  placeholder="如有不适，请记录下..."
                  className="w-full resize-none rounded-2xl border border-[#e3d5be] bg-[#f8f1e4] px-3 py-2.5 text-[13px] leading-relaxed text-[#242f46] placeholder:text-[#a69a8a] focus:border-[#f0bd3f] focus:outline-none"
                />
                <div className="mt-1 flex items-center justify-between">
                  {activeDose.status === 'activated' ? (
                    <button
                      type="button"
                      onClick={() => {
                        onResetVaccine(activeDose.id);
                        onChangeMode('vaccine');
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>撤销该针打卡</span>
                    </button>
                  ) : (
                    <span />
                  )}
                  <span className="font-typewriter text-[11px] text-[#9b8f7f] tabular-nums">
                    {vacNote.length}/100
                  </span>
                </div>
              </div>

              {/* 底部操作按钮：取消 + 保存 */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onChangeMode('vaccine')}
                  className="min-h-[44px] rounded-full border border-[#dfd3be] bg-[#f5efe3] typo-item-title text-[#4a4238] shadow-xs transition-transform active:scale-95"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[#fff0a6] bg-gradient-to-b from-[#ffe25e] via-[#facc34] to-[#f1a819] typo-cta text-[#241b09] shadow-[0_6px_16px_rgba(244,179,30,0.42),inset_0_1.5px_1.5px_rgba(255,255,255,0.65)] transition-transform active:scale-95"
                >
                  <img
                    src="./assets/extracted/health_star_small.png"
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4 object-contain"
                  />
                  <span>保存</span>
                </button>
              </div>
            </div>
          </div>
          </form>
        </>
      )}

      {/* =================================================================
          5.3 生病记录与病历列表页（首屏严格锁定 var(--app-viewport-h)，新建按钮下滑完整显现）
         ================================================================= */}
      {mode === 'illness' && (
        <>
          <div
            style={{ minHeight: 'var(--app-viewport-h)' }}
            className="relative z-10 flex w-full min-w-0 max-w-full flex-col"
          >
            <CosmicModuleHeader
              title="治愈工坊"
              subtitle="健康守护"
              onBack={handleBackClick}
              onCalendarClick={() => setShowHeaderPanel((v) => !v)}
              calendarActive={showHeaderPanel}
              calendarLabel="按日期筛选生病记录"
            />

            {showHeaderPanel && (
              <div className="relative z-20 mx-4 mb-2.5 flex items-center justify-between gap-2 rounded-[22px] border border-white/15 bg-[#122350]/88 px-3.5 py-2.5 shadow-[0_10px_24px_rgba(3,8,24,0.42)] backdrop-blur-md">
                <span className="typo-meta text-indigo-100">按日期查看</span>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={careDateFilter}
                    onChange={(e) => setCareDateFilter(e.target.value)}
                    className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 font-typewriter typo-meta text-amber-100"
                  />
                  {careDateFilter && (
                    <button
                      type="button"
                      onClick={() => setCareDateFilter('')}
                      className="rounded-lg bg-amber-300/20 px-2 py-1 typo-badge text-amber-200"
                    >
                      全部
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="relative z-10 flex w-full min-w-0 max-w-full flex-1 flex-col px-4 pb-3">
              {/* 顶部二级模式切换胶囊：与疫苗页统一居中排布 */}
              <div className="mb-1 flex justify-center">
                <div className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-[#152550]/80 p-0.5 backdrop-blur-md shadow-[0_4px_12px_rgba(3,8,24,0.4)]">
                  <button
                    type="button"
                    onClick={() => onChangeMode('vaccine')}
                    className="rounded-full px-4 py-1 typo-tab text-indigo-100/80 transition-colors hover:text-white"
                  >
                    疫苗护盾
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeMode('illness')}
                    className="rounded-full bg-gradient-to-b from-[#ffe25f] via-[#facc34] to-[#f2ab1a] px-4 py-1 typo-tab-active text-[#1f190d] shadow-[0_2px_8px_rgba(250,204,52,0.4)]"
                  >
                    生病记录
                  </button>
                </div>
              </div>

              {/* 英雄插画区：暖心提示下移贴近熟睡的小朋友与小橘猫（置于撕纸卡片后方） */}
              <div className="relative z-10 -mb-6 flex flex-col items-center pt-2">
                <p className="relative z-20 -mb-2 text-center typo-meta text-[#fff8e7]/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.65)]">
                  照顾生病的小宝贝，也要记得好好休息呀～
                </p>
                <AssetSlot slotName="health_sleeping_baby_cat" showSlotTag={showSlotTag}>
                  <img
                    src="./assets/extracted/health_sleeping_baby_cat.png"
                    alt="被窝里熟睡的小宝贝与橘猫"
                    referrerPolicy="no-referrer"
                    className="h-[154px] w-auto max-w-full object-contain drop-shadow-[0_8px_18px_rgba(3,8,24,0.45)]"
                  />
                </AssetSlot>
              </div>

          {/* 撕纸生病记录与病历主卡片 */}
          <div className="diary-paper-card relative z-20 min-w-0 px-1.5 pb-2.5 pt-2">
            {/* 疾病分类与病历筛选行 */}
            <div className="mb-2.5 flex min-w-0 items-center justify-between gap-1.5 px-0.5">
              <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
                {(
                  [
                    { id: 'all', label: '全部' },
                    { id: 'fever', label: '发烧' },
                    { id: 'respiratory', label: '感冒' },
                    { id: 'skin_other', label: '皮疹' },
                    { id: 'with_case', label: '病历' },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setIllnessFilter(chip.id)}
                    className={`shrink-0 rounded-full px-2.5 py-0.5 typo-badge transition-colors ${
                      illnessFilter === chip.id
                        ? 'bg-[#21345e] text-amber-100'
                        : 'bg-[#eee4d1] text-[#6d6153] hover:bg-[#e5d8c0]'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <span className="shrink-0 font-typewriter typo-badge text-[#8c7f6f] tabular-nums">
                {filteredIllnesses.length} 条
              </span>
            </div>

            {filteredIllnesses.length === 0 ? (
              <div className="rounded-[20px] bg-[#f7f0e2] px-4 py-8 text-center">
                <div className="font-display text-2xl text-[#24324e]">星球运行平稳</div>
                <p className="mt-1 typo-meta text-[#786b5c]">
                  暂无对应的生病与病历记录，向下滑动点击按钮随时记录
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredIllnesses.map((rec) => {
                  const diseaseLabel = getDiseaseLabel(rec);
                  const isOverheat =
                    typeof rec.temperatureC === 'number' && rec.temperatureC >= 38.5;
                  const isExpanded = expandedIllnessId === rec.id;
                  const withCase = hasMedicalCase(rec);
                  const iconSrc = getDiseaseIconSrc(rec);

                  const timeText = `${rec.date.replace(/-/g, '.')} ${rec.time}`;
                  const metaLine =
                    typeof rec.temperatureC === 'number'
                      ? `${rec.temperatureC.toFixed(1)}°C · ${timeText}`
                      : timeText;
                  const shortHospital = rec.hospital
                    ? rec.hospital.split('·')[0].trim()
                    : '';

                  return (
                    <div
                      key={rec.id}
                      className={`min-w-0 overflow-hidden rounded-[20px] border shadow-[0_4px_12px_rgba(68,52,28,0.06)] transition-all ${
                        isOverheat && !rec.handled
                          ? 'border-[#ebb5a8] bg-gradient-to-r from-[#f8d0c8] to-[#fbe4de]'
                          : isOverheat
                          ? 'border-[#eec3b8] bg-[#fcf0ec]'
                          : 'border-[#e6dac3] bg-[#faf4e8]/95'
                      }`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          setExpandedIllnessId((prev) => (prev === rec.id ? null : rec.id))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setExpandedIllnessId((prev) => (prev === rec.id ? null : rec.id));
                          }
                        }}
                        className="flex w-full min-w-0 cursor-pointer items-center justify-between gap-2 px-2.5 py-2.5 text-left"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <img
                            src={iconSrc}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-8 w-8 shrink-0 object-contain drop-shadow-xs"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1">
                              <span
                                className={`truncate typo-item-title ${
                                  isOverheat ? 'text-[#c93524]' : 'text-[#1c2b48]'
                                }`}
                              >
                                {diseaseLabel}
                              </span>
                              {isOverheat && (
                                <span className="shrink-0 rounded-full bg-[#e05240]/15 px-1.5 py-0.5 typo-badge text-[#c93524]">
                                  体温过载
                                </span>
                              )}
                              {withCase && (
                                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[#dde8fb] px-1.5 py-0.5 typo-badge text-[#2b5298]">
                                  <FileText className="h-2.5 w-2.5" />
                                  <span>病历</span>
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 truncate typo-meta text-[#6f6357] tabular-nums">
                              {metaLine}
                            </div>
                            {shortHospital && (
                              <div className="mt-0.5 truncate typo-badge text-[#4a6594]">
                                就诊：{shortHospital}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleIllnessHandled(rec.id);
                            }}
                            className={`rounded-full px-2.5 py-1 typo-badge transition-transform active:scale-95 ${
                              rec.handled
                                ? 'bg-[#d8edc9] text-[#3b7a24]'
                                : isOverheat
                                ? 'bg-[#d94330] text-white shadow-xs'
                                : 'bg-[#f6deb0] text-[#8a5514]'
                            }`}
                          >
                            {rec.handled ? '已康复' : '观察中'}
                          </button>
                          <ChevronRight
                            className={`h-4 w-4 text-[#8a7d6d] transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        </div>
                      </div>

                      {/* 点击展开：症状、用药、完整病历档案与照片 */}
                      {isExpanded && (
                        <div className="space-y-2.5 border-t border-black/5 bg-white/55 px-3.5 py-3 text-[12px] text-[#453c33]">
                          {rec.symptoms.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-[#7b6e60]">症状：</span>
                              {rec.symptoms.map((sym) => (
                                <span
                                  key={sym}
                                  className="rounded-full bg-[#efe3cb] px-2 py-0.5 text-[10.5px] font-bold text-[#4a3e31]"
                                >
                                  {sym}
                                </span>
                              ))}
                            </div>
                          )}

                          {rec.medication && (
                            <div className="rounded-xl bg-[#f7efe0] px-2.5 py-2 leading-relaxed text-[#2d2620]">
                              <span className="font-bold text-[#5a4c3e]">用药与护理：</span>
                              {rec.medication}
                            </div>
                          )}

                          {/* 病历档案区块 */}
                          {withCase && (
                            <div className="rounded-xl border border-[#d6e0f2] bg-[#f1f6ff]/90 p-2.5 space-y-1.5">
                              <div className="flex items-center gap-1.5 typo-meta font-semibold text-[#23437a]">
                                <FileText className="h-3.5 w-3.5" />
                                <span>就诊病历档案</span>
                              </div>
                              {rec.hospital && (
                                <div className="text-[11.5px] text-[#334669]">
                                  <span className="font-semibold">就诊医院：</span>
                                  {rec.hospital}
                                </div>
                              )}
                              {rec.diagnosis && (
                                <div className="text-[11.5px] leading-relaxed text-[#2c3c5a]">
                                  <span className="font-semibold">医生诊断：</span>
                                  {rec.diagnosis}
                                </div>
                              )}
                              {rec.casePhotos && rec.casePhotos.length > 0 && (
                                <div className="pt-1">
                                  <div className="mb-1 text-[10.5px] font-semibold text-[#54688c]">
                                    病历 / 化验单照片（点击查看大图）
                                  </div>
                                  <div className="grid grid-cols-4 gap-1.5">
                                    {rec.casePhotos.map((src, idx) => (
                                      <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setLightboxPhoto(src)}
                                        className="aspect-square overflow-hidden rounded-lg border border-[#c8d6ee] bg-white shadow-xs transition-transform active:scale-95"
                                      >
                                        <img
                                          src={src}
                                          alt={`病历照片 ${idx + 1}`}
                                          className="h-full w-full object-cover"
                                        />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-0.5 text-[11px] text-[#837668]">
                            <span>记录人：{rec.recorder}</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditIllnessForm(rec)}
                                className="inline-flex items-center gap-1 rounded-lg bg-[#efe3cb] px-2.5 py-1 font-bold text-[#2b3f6b] hover:bg-[#e5d5b6]"
                              >
                                <Pencil className="h-3 w-3" />
                                <span>{withCase ? '编辑病历' : '补充病历'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteIllness(rec.id)}
                                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-rose-600 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>删除</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

            </div>
          </div>

          {/* 底部暖金色主按钮严格置于首屏之下：下滑后完整可见，首屏绝不露出一丁点 */}
          <div className="relative z-10 mt-4 flex justify-center px-4 pb-3">
            <button
              type="button"
              onClick={() => openCreateIllnessForm('发烧')}
              className="flex min-h-[48px] w-[78%] items-center justify-center gap-1.5 rounded-full border-2 border-[#fff0a6]/85 bg-gradient-to-b from-[#ffe25e] via-[#facc34] to-[#f1a819] px-6 typo-cta text-[#241b09] shadow-[0_8px_22px_rgba(244,179,30,0.45),inset_0_2px_2px_rgba(255,255,255,0.65)] transition-transform hover:brightness-105 active:scale-[0.97]"
            >
              <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
              <span>新建生病记录</span>
            </button>
          </div>
        </>
      )}

      {/* =================================================================
          5.4 新建 / 编辑生病记录与病历录入页（统一二级顶栏）
         ================================================================= */}
      {mode === 'illness_form' && (
        <>
          <CosmicSubHeader
            title={editingIllnessId ? '编辑生病与病历' : '新建生病记录'}
            onBack={handleBackClick}
            backLabel="返回生病记录"
            rightSlot={
              <button
                type="button"
                onClick={() => setShowFormTimeRow((v) => !v)}
                className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform active:scale-90 ${
                  showFormTimeRow
                    ? 'bg-amber-300/20 text-amber-200'
                    : 'text-[#c5cdfa] hover:bg-white/10'
                }`}
                aria-label="修改日期与时间"
              >
                <HandDrawnCalendarIcon />
              </button>
            }
          />
          <form
            onSubmit={handleSaveIllnessForm}
            className="relative z-10 flex w-full min-w-0 max-w-full flex-1 flex-col px-4 pb-safe"
          >
          {/* 顶部英雄区：医药箱标语 + 持盾小男孩与巴哥犬（置于撕纸卡片后方） */}
          <div className="relative z-10 -mb-5 flex items-end justify-between px-1 pt-0.5">
            <div className="pb-6 pl-1">
              <div className="flex items-center gap-1.5">
                <img
                  src="./assets/extracted/health_firstaid_kit.png"
                  alt=""
                  aria-hidden="true"
                  className="h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.45)]"
                />
                <span className="text-[14.5px] font-bold tracking-wide text-[#fff8e7] drop-shadow">
                  健康防御，
                </span>
              </div>
              <div className="mt-0.5 pl-0.5 text-[15px] font-bold tracking-wider text-[#fff8e7] drop-shadow">
                从每一针开始
              </div>
              <svg viewBox="0 0 132 10" className="mt-0.5 h-2.5 w-32 opacity-90" fill="none" aria-hidden="true">
                <path
                  d="M2 5 Q 18 2, 34 5 T 66 5 T 98 5 T 130 5"
                  stroke="#FACC15"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            <img
              src="./assets/extracted/health_boy_pug_shield.png"
              alt="守护小漫游者与巴哥犬"
              referrerPolicy="no-referrer"
              className="h-[112px] w-auto object-contain drop-shadow-[0_8px_16px_rgba(3,8,24,0.45)]"
            />
          </div>

          {/* 撕纸新建生病记录与病历表单卡片 + 右上角双闪星 */}
          <div className="diary-paper-card relative z-20 px-2.5 py-3">
            <img
              src="./assets/extracted/health_star_big.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -right-2 -top-4 z-30 h-9 w-9 object-contain drop-shadow-[0_0_10px_rgba(253,224,71,0.85)]"
            />
            <img
              src="./assets/extracted/health_star_small.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-5 z-30 h-5 w-5 object-contain drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]"
            />

            {/* 卡片标题头 */}
            <div className="flex items-center gap-2.5 pb-3">
              <img
                src={
                  selectedDiseaseTag === '发烧' || selectedDiseaseTag === '体温异常'
                    ? './assets/extracted/health_thermometer.png'
                    : selectedDiseaseTag === '感冒' ||
                      selectedDiseaseTag === '咳嗽' ||
                      selectedDiseaseTag === '腹泻'
                    ? './assets/extracted/health_medicine_bottle.png'
                    : './assets/extracted/health_firstaid_kit.png'
                }
                alt=""
                aria-hidden="true"
                className="h-10 w-9 shrink-0 object-contain"
              />
              <div>
                <h2 className="typo-section-title text-[#182746]">
                  {editingIllnessId ? '编辑生病记录与病历' : '新建生病记录'}
                </h2>
                <p className="typo-meta text-[#7c7163]">记录疾病情况、用药与就诊病历~</p>
              </div>
            </div>

            {/* 可折叠时间选择行（点击右上日历图标或底部时间戳微调） */}
            {showFormTimeRow && (
              <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border border-[#e3d5be] bg-[#faf4e8] p-2">
                <label className="block">
                  <span className="text-[10.5px] font-semibold text-[#7b6f61]">记录日期</span>
                  <input
                    type="date"
                    value={illDate}
                    onChange={(e) => setIllDate(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-[#dfd2bc] bg-white px-2 py-1 font-typewriter text-xs text-[#242f46]"
                  />
                </label>
                <label className="block">
                  <span className="text-[10.5px] font-semibold text-[#7b6f61]">记录时间</span>
                  <input
                    type="time"
                    value={illTime}
                    onChange={(e) => setIllTime(e.target.value)}
                    className="mt-0.5 w-full rounded-lg border border-[#dfd2bc] bg-white px-2 py-1 font-typewriter text-xs text-[#242f46]"
                  />
                </label>
              </div>
            )}

            <div className="space-y-3.5">
              {/* 1. 疾病类型（常见预设 + 自定义疾病名称输入） */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#25324e]">
                    <img
                      src="./assets/extracted/health_star_small.png"
                      alt=""
                      aria-hidden="true"
                      className="h-3.5 w-3.5 object-contain"
                    />
                    <span>生病类型</span>
                  </div>
                  <div className="inline-flex rounded-full bg-[#efe4ce] p-0.5 text-[10.5px] font-bold">
                    <button
                      type="button"
                      onClick={() => setIllHandled(false)}
                      className={`rounded-full px-2 py-0.5 ${
                        !illHandled ? 'bg-[#d94330] text-white' : 'text-[#6c6052]'
                      }`}
                    >
                      观察中
                    </button>
                    <button
                      type="button"
                      onClick={() => setIllHandled(true)}
                      className={`rounded-full px-2 py-0.5 ${
                        illHandled ? 'bg-[#4f9438] text-white' : 'text-[#6c6052]'
                      }`}
                    >
                      已康复
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {DISEASE_PRESETS.map((preset) => {
                    const active = selectedDiseaseTag === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleSelectDiseasePreset(preset)}
                        className={`min-h-[33px] rounded-full px-3 text-[12px] font-bold transition-all active:scale-95 ${
                          active
                            ? 'border border-[#f2c144] bg-gradient-to-b from-[#ffe469] to-[#f8c437] text-[#261c07] shadow-[0_3px_8px_rgba(248,196,55,0.35)]'
                            : 'border border-[#e4d7c1] bg-[#f7f1e5] text-[#4e453b] hover:bg-[#f0e5d1]'
                        }`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>

                {/* 自定义疾病输入框（选“自定义”必填，其他类型也可补充具体病名如“幼儿急疹”） */}
                <input
                  type="text"
                  value={customDiseaseName}
                  onChange={(e) => setCustomDiseaseName(e.target.value)}
                  placeholder={
                    selectedDiseaseTag === '自定义'
                      ? '请输入具体疾病名称（如：幼儿急疹、中耳炎、鹅口疮…）'
                      : `补充或自定义具体名称（留空则记为“${selectedDiseaseTag}”）`
                  }
                  required={selectedDiseaseTag === '自定义'}
                  className="mt-2 w-full rounded-2xl border border-[#e3d5be] bg-[#f8f1e4] px-3 py-2 text-[12.5px] font-semibold text-[#1e2c49] placeholder:font-normal placeholder:text-[#a69a8a] focus:border-[#f0bd3f] focus:outline-none"
                />
              </div>

              {/* 2. 实测体温（选填，≥38.5°C 触发体温过载提示） */}
              <div>
                <div className="flex items-center justify-between gap-2.5">
                  <div className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-[#25324e]">
                    <img
                      src="./assets/extracted/health_thermometer.png"
                      alt=""
                      aria-hidden="true"
                      className="h-5 w-4 object-contain"
                    />
                    <span>体温（选填）</span>
                  </div>

                  <div
                    className={`flex flex-1 overflow-hidden rounded-2xl border transition-all ${
                      isFormOverheat
                        ? 'border-[#e68475] bg-[#fdf2ef] ring-2 ring-[#f6cbc2]'
                        : 'border-[#e3d5be] bg-[#f8f1e4]'
                    }`}
                  >
                    <input
                      type="number"
                      step="0.1"
                      min="34"
                      max="43"
                      value={tempStr}
                      onChange={(e) => setTempStr(e.target.value)}
                      placeholder="未测量可留空"
                      className="w-full bg-transparent px-3 py-2 font-typewriter text-[17px] font-bold text-[#1e2c49] placeholder:font-sans placeholder:text-[12px] placeholder:font-normal placeholder:text-[#a69a8a] focus:outline-none tabular-nums"
                    />
                    <span className="flex items-center border-l border-[#e3d5be] bg-[#efe5d2]/75 px-3 text-[13px] font-bold text-[#4e463d]">
                      °C
                    </span>
                  </div>
                </div>

                {isFormOverheat && (
                  <div className="mt-1 flex items-center justify-end text-[11px] font-bold text-[#c93524]">
                    ⚠ 体温过载预警（≥38.5°C），建议及时降温并密切观察
                  </div>
                )}
              </div>

              {/* 3. 伴随症状多选胶囊 */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-[#25324e]">
                  <img
                    src="./assets/extracted/health_star_small.png"
                    alt=""
                    aria-hidden="true"
                    className="h-3.5 w-3.5 object-contain"
                  />
                  <span>伴随症状</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SYMPTOM_OPTIONS.map((sym) => {
                    const active = selectedSymptoms.includes(sym);
                    return (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => toggleSymptom(sym)}
                        className={`min-h-[32px] rounded-full px-3 text-[12px] font-bold transition-all active:scale-95 ${
                          active
                            ? 'border border-[#f2c144] bg-gradient-to-b from-[#ffe469] to-[#f8c437] text-[#261c07] shadow-[0_2px_6px_rgba(248,196,55,0.35)]'
                            : 'border border-[#e4d7c1] bg-[#f7f1e5] text-[#4e453b] hover:bg-[#f0e5d1]'
                        }`}
                      >
                        {sym}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. 用药记录 */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#25324e]">
                    <img
                      src="./assets/extracted/health_icon_capsule.png"
                      alt=""
                      aria-hidden="true"
                      className="h-4 w-4 object-contain"
                    />
                    <span>用药与护理</span>
                  </div>
                  <select
                    aria-label="选择记录人"
                    value={recorder}
                    onChange={(e) => setRecorder(e.target.value)}
                    className="rounded-full border border-[#e3d5be] bg-[#f7f1e5] px-2.5 py-0.5 text-[11px] font-semibold text-[#64584a]"
                  >
                    {state.profile.recorders.map((rec) => (
                      <option key={rec} value={rec}>
                        记录人：{rec}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  rows={2}
                  maxLength={150}
                  value={medication}
                  onChange={(e) => setMedication(e.target.value)}
                  placeholder="请输入用药名称、剂量或物理降温等护理方式..."
                  className="w-full resize-none rounded-2xl border border-[#e3d5be] bg-[#f8f1e4] px-3 py-2 text-[12.5px] leading-relaxed text-[#242f46] placeholder:text-[#a69a8a] focus:border-[#f0bd3f] focus:outline-none"
                />
              </div>

              {/* 5. 录入病历区块（就诊医院 / 医生诊断 / 病历与化验单照片） */}
              <div className="rounded-[20px] border border-[#d6e0f2] bg-[#f2f6ff]/85 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 typo-body font-semibold text-[#1e3c72]">
                    <img
                      src="./assets/extracted/health_firstaid_kit.png"
                      alt=""
                      aria-hidden="true"
                      className="h-5 w-5 object-contain"
                    />
                    <span>录入病历（选填）</span>
                  </div>
                  <span className="text-[10.5px] font-medium text-[#5c7299]">
                    可记录医院、诊断与处方拍照
                  </span>
                </div>

                <input
                  type="text"
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                  placeholder="就诊医院 / 科室（如：市儿童医院 · 儿科）"
                  className="w-full rounded-xl border border-[#d0dcf0] bg-white px-3 py-2 text-[12.5px] text-[#1e2c49] placeholder:text-[#98a6bf] focus:border-[#6388cc] focus:outline-none"
                />

                <textarea
                  rows={2}
                  maxLength={200}
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="医生诊断结论、化验结果或复诊医嘱..."
                  className="w-full resize-none rounded-xl border border-[#d0dcf0] bg-white px-3 py-2 text-[12.5px] leading-relaxed text-[#1e2c49] placeholder:text-[#98a6bf] focus:border-[#6388cc] focus:outline-none"
                />

                {/* 病历 / 化验单照片上传 */}
                <div>
                  <input
                    ref={casePhotoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleUploadCasePhotos}
                    className="hidden"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    {casePhotos.map((src, idx) => (
                      <div
                        key={idx}
                        className="relative h-14 w-14 overflow-hidden rounded-xl border border-[#c7d6ee] bg-white shadow-xs"
                      >
                        <img
                          src={src}
                          alt={`病历附件 ${idx + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCasePhotos((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label="移除照片"
                          className="absolute right-0.5 top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-black/60 text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}

                    {casePhotos.length < 4 && (
                      <button
                        type="button"
                        onClick={() => casePhotoInputRef.current?.click()}
                        className="flex h-14 items-center gap-1.5 rounded-xl border border-dashed border-[#9fb6dd] bg-white/90 px-3 text-[11.5px] font-bold text-[#2b5298] transition-colors hover:bg-[#e9f1ff] active:scale-95"
                      >
                        <Camera className="h-4 w-4" />
                        <span>
                          {casePhotos.length === 0
                            ? '上传病历/化验单照片'
                            : `继续添加 (${casePhotos.length}/4)`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 记录时间快捷微调行 */}
              <div className="flex items-center justify-between px-0.5 text-[11px] text-[#8d8172]">
                <button
                  type="button"
                  onClick={() => setShowFormTimeRow((v) => !v)}
                  className="font-typewriter underline decoration-dotted underline-offset-2"
                >
                  记录时间：{illDate.replace(/-/g, '.')} {illTime}（点此修改）
                </button>
                <span className="font-typewriter tabular-nums">{medication.length}/150</span>
              </div>

              {/* 底部操作按钮：取消 + 保存 */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onChangeMode('illness')}
                  className="min-h-[44px] rounded-full border border-[#dfd3be] bg-[#f5efe3] typo-item-title text-[#4a4238] shadow-xs transition-transform active:scale-95"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[#fff0a6] bg-gradient-to-b from-[#ffe25e] via-[#facc34] to-[#f1a819] typo-cta text-[#241b09] shadow-[0_6px_16px_rgba(244,179,30,0.42),inset_0_1.5px_1.5px_rgba(255,255,255,0.65)] transition-transform active:scale-95"
                >
                  <img
                    src="./assets/extracted/health_star_small.png"
                    alt=""
                    aria-hidden="true"
                    className="h-4 w-4 object-contain"
                  />
                  <span>保存记录</span>
                </button>
              </div>
            </div>
          </div>
          </form>
        </>
      )}

      {/* 病历照片全屏大图灯箱 */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
          onClick={() => setLightboxPhoto(null)}
          role="dialog"
          aria-modal="true"
          aria-label="病历照片大图预览"
        >
          <button
            type="button"
            onClick={() => setLightboxPhoto(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white"
            aria-label="关闭大图"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxPhoto}
            alt="病历照片大图"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[82dvh] max-w-full rounded-[22px] object-contain shadow-[0_20px_48px_rgba(0,0,0,0.65)]"
          />
        </div>
      )}
    </div>
  );
};
