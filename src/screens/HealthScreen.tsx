import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import {
  IllnessCareCategory,
  IllnessRecord,
  PlanetAppState,
  VaccineBrandOrigin,
  VaccineDose,
  VaccineFundingType,
} from '../types/planet';
import { getCurrentTimeStr, getTodayDateStr, shiftDateStr } from '../data/initialData';
import { AssetSlot } from '../components/Illustrations';

export type HealthViewMode = 'vaccine' | 'vaccine_sheet' | 'illness' | 'illness_form';

interface HealthScreenProps {
  state: PlanetAppState;
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
    fundingType?: VaccineFundingType
  ) => void;
  onResetVaccine: (doseId: string) => void;
  onAddIllness: (record: IllnessRecord) => void;
  onToggleIllnessHandled: (id: string) => void;
  onDeleteIllness: (id: string) => void;
}

const BRAND_OPTIONS: VaccineBrandOrigin[] = ['国产', '进口', '其他'];
const FUNDING_OPTIONS: VaccineFundingType[] = ['免费', '自费'];

const SYMPTOM_OPTIONS = [
  '发热',
  '咳嗽',
  '流鼻涕',
  '呕吐',
  '腹泻',
  '食欲不振',
  '其他',
];

const MEDICINE_PRESETS = ['退烧药', '物理降温', '益生菌', '海盐水洗鼻'];
const WATER_PRESETS = [60, 100, 120, 150];

/** 根据宝宝出生日期估算推荐接种日期（如“2 月龄” -> 出生后约 60 天） */
function estimateDoseDate(birthDate: string, recommendedMonth: string): string {
  if (!birthDate) return recommendedMonth;
  if (recommendedMonth.includes('出生')) {
    return birthDate.replace(/-/g, '.');
  }
  const monthMatch = recommendedMonth.match(/(\d+)\s*月龄/);
  if (monthMatch) {
    const months = parseInt(monthMatch[1], 10);
    return shiftDateStr(birthDate, months * 30).replace(/-/g, '.');
  }
  const yearMatch = recommendedMonth.match(/(\d+)\s*周岁/);
  if (yearMatch) {
    const years = parseInt(yearMatch[1], 10);
    return shiftDateStr(birthDate, years * 365).replace(/-/g, '.');
  }
  return recommendedMonth;
}

function getRecordCategory(rec: IllnessRecord): IllnessCareCategory {
  if (rec.careCategory) return rec.careCategory;
  if (rec.amountMl && rec.amountMl > 0) return 'hydration';
  return 'temperature';
}

export const HealthScreen: React.FC<HealthScreenProps> = ({
  state,
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
  const defaultNextDose =
    state.vaccines.find((v) => v.status === 'next') || state.vaccines[3] || state.vaccines[0];

  // 5.1 疫苗列表交互状态
  const [vaccineFilter, setVaccineFilter] = useState<'all' | 'activated' | 'pending'>('all');
  const [showAllVaccines, setShowAllVaccines] = useState(false);
  const [showHeaderPanel, setShowHeaderPanel] = useState(false);

  // 5.2 确认接种信息表单状态
  const [selectedDoseId, setSelectedDoseId] = useState<string>(
    activeSheetDoseId || defaultNextDose.id
  );
  const [vacBrand, setVacBrand] = useState<VaccineBrandOrigin>('国产');
  const [vacFunding, setVacFunding] = useState<VaccineFundingType>('免费');
  const [vacDate, setVacDate] = useState<string>(() => getTodayDateStr());
  const [vacNote, setVacNote] = useState<string>('');

  // 5.3 生病护理列表状态
  const [careFilter, setCareFilter] = useState<'all' | IllnessCareCategory>('all');
  const [careDateFilter, setCareDateFilter] = useState<string>('');
  const [expandedIllnessId, setExpandedIllnessId] = useState<string | null>(null);

  // 5.4 新建护理记录表单状态
  const [careCategory, setCareCategory] = useState<IllnessCareCategory>('temperature');
  const [illDate, setIllDate] = useState<string>(() => getTodayDateStr());
  const [illTime, setIllTime] = useState<string>(() => getCurrentTimeStr());
  const [showFormTimeRow, setShowFormTimeRow] = useState(false);
  const [tempStr, setTempStr] = useState('38.5');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['发热']);
  const [medicineTitle, setMedicineTitle] = useState('退烧药');
  const [medicineDose, setMedicineDose] = useState('1次');
  const [waterMlStr, setWaterMlStr] = useState('120');
  const [medication, setMedication] = useState('');
  const [recorder, setRecorder] = useState(state.profile.recorders[0] || '妈妈');

  // 当从首页“去打卡”或侧栏直达 5.2 时，同步预填选中疫苗信息
  useEffect(() => {
    if (mode === 'vaccine_sheet') {
      const targetId = activeSheetDoseId || defaultNextDose.id;
      const target = state.vaccines.find((v) => v.id === targetId) || defaultNextDose;
      setSelectedDoseId(target.id);
      setVacBrand(target.brandOrigin || '国产');
      setVacFunding(target.fundingType || '免费');
      setVacDate(target.inoculatedDate || getTodayDateStr());
      setVacNote(target.note || '');
    }
  }, [mode, activeSheetDoseId]);

  const activeDose =
    state.vaccines.find((v) => v.id === selectedDoseId) || defaultNextDose;

  const activatedCount = state.vaccines.filter((v) => v.status === 'activated').length;
  const isIllnessView = mode === 'illness' || mode === 'illness_form';

  const openVaccineForm = (dose: VaccineDose) => {
    setSelectedDoseId(dose.id);
    setVacBrand(dose.brandOrigin || '国产');
    setVacFunding(dose.fundingType || '免费');
    setVacDate(dose.inoculatedDate || getTodayDateStr());
    setVacNote(dose.note || '');
    setShowHeaderPanel(false);
    onChangeMode('vaccine_sheet');
  };

  const handleSelectDoseInForm = (doseId: string) => {
    const found = state.vaccines.find((v) => v.id === doseId);
    setSelectedDoseId(doseId);
    if (found) {
      setVacBrand(found.brandOrigin || '国产');
      setVacFunding(found.fundingType || '免费');
      setVacDate(found.inoculatedDate || getTodayDateStr());
      setVacNote(found.note || '');
    }
  };

  const handleSaveVaccineForm = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmVaccine(
      activeDose.id,
      vacDate || getTodayDateStr(),
      vacNote.trim() || '按计划顺利接种，留观 30 分钟无异常',
      vacBrand,
      vacFunding
    );
    onChangeMode('vaccine');
  };

  const openIllnessForm = (defaultCat: IllnessCareCategory = 'temperature') => {
    setCareCategory(defaultCat);
    setIllDate(getTodayDateStr());
    setIllTime(getCurrentTimeStr());
    setTempStr('38.5');
    setSelectedSymptoms(['发热']);
    setMedicineTitle('退烧药');
    setMedicineDose('1次');
    setWaterMlStr('120');
    setMedication('');
    setShowFormTimeRow(false);
    setShowHeaderPanel(false);
    onChangeMode('illness_form');
  };

  const toggleSymptom = (sym: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleSaveIllnessForm = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedT = parseFloat(tempStr);
    const safeTemp = Number.isFinite(parsedT) ? parsedT : 37.0;
    const isHighFever = safeTemp >= 38.5;

    let record: IllnessRecord;
    if (careCategory === 'medicine') {
      record = {
        id: `ill-${Date.now()}`,
        date: illDate || getTodayDateStr(),
        time: illTime || getCurrentTimeStr(),
        careCategory: 'medicine',
        title: medicineTitle.trim() || '退烧药',
        summary: medicineDose.trim() || '1次',
        handled: true,
        temperatureC: safeTemp,
        symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : ['用药护理'],
        medication:
          medication.trim() ||
          `${medicineTitle.trim() || '退烧药'} ${medicineDose.trim() || '1次'}，按医嘱记录观察`,
        recorder,
      };
    } else if (careCategory === 'hydration') {
      const ml = Math.max(10, Math.round(parseFloat(waterMlStr) || 120));
      record = {
        id: `ill-${Date.now()}`,
        date: illDate || getTodayDateStr(),
        time: illTime || getCurrentTimeStr(),
        careCategory: 'hydration',
        title: '多喝水',
        summary: `${ml}ml`,
        amountMl: ml,
        handled: true,
        temperatureC: 37.0,
        symptoms: ['补水护理'],
        medication: medication.trim() || `少量多次补充温开水 ${ml}ml`,
        recorder,
      };
    } else {
      record = {
        id: `ill-${Date.now()}`,
        date: illDate || getTodayDateStr(),
        time: illTime || getCurrentTimeStr(),
        careCategory: 'temperature',
        title: isHighFever ? '体温过载' : '体温记录',
        handled: false,
        temperatureC: safeTemp,
        symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : ['观察中'],
        medication: medication.trim() || (isHighFever ? '温水物理降温，密切监测体温变化' : '持续观察精神与饮水情况'),
        recorder,
      };
    }

    onAddIllness(record);
    onChangeMode('illness');
  };

  // 5.1 过滤后的疫苗列表（默认展示最近已完成 + 下一针 + 后续 2 针，支持一键展开全部 19 剂）
  const filteredVaccines = useMemo(() => {
    const base = state.vaccines.filter((dose) => {
      if (vaccineFilter === 'activated') return dose.status === 'activated';
      if (vaccineFilter === 'pending') return dose.status !== 'activated';
      return true;
    });

    if (showAllVaccines || vaccineFilter !== 'all') {
      return base;
    }

    // 聚焦展示：最后 1 针已完成 + 下一针 + 紧随其后的 2 针待解锁，完整还原设计图清爽 4 行视觉密度
    const nextIdx = base.findIndex((v) => v.status === 'next');
    if (nextIdx === -1) return base.slice(0, 5);
    const start = Math.max(0, nextIdx - 1);
    return base.slice(start, Math.min(base.length, start + 4));
  }, [state.vaccines, vaccineFilter, showAllVaccines]);

  // 5.3 过滤后的护理记录列表
  const filteredIllnesses = useMemo(() => {
    return state.illnesses.filter((rec) => {
      if (careFilter !== 'all' && getRecordCategory(rec) !== careFilter) {
        return false;
      }
      if (careDateFilter && rec.date !== careDateFilter) {
        return false;
      }
      return true;
    });
  }, [state.illnesses, careFilter, careDateFilter]);

  const parsedFormTemp = parseFloat(tempStr) || 0;
  const isFormOverheat = careCategory === 'temperature' && parsedFormTemp >= 38.5;

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
    <div className="relative flex min-h-full flex-col overflow-x-hidden pb-6">
      {/* 顶部微星光晕染背景 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-45"
        style={{
          backgroundImage: 'url(/assets/aistudio/____f8d9ecf9.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          WebkitMaskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
        }}
      />

      {/* 底部左右花草星球装饰边 */}
      <img
        src="/assets/extracted/health_footer_flowers.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 right-0 z-0 w-36 opacity-85 lg:absolute"
      />
      <img
        src="/assets/extracted/health_footer_flowers.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 left-0 z-0 w-36 -scale-x-100 opacity-85 lg:absolute"
      />

      {/* =================================================================
          顶部统一导航栏：返回 | 治愈工坊 ✦ | 日历筛选/时间
         ================================================================= */}
      <header className="relative z-20 flex h-[54px] items-center justify-between px-3.5 pt-1">
        <button
          type="button"
          onClick={handleBackClick}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#132550]/65 text-indigo-100 backdrop-blur-sm transition-transform hover:bg-white/15 active:scale-90"
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-1.5">
          <h1 className="text-[18px] font-semibold tracking-[0.12em] text-[#fffaf0] drop-shadow-[0_2px_8px_rgba(4,10,30,0.85)]">
            治愈工坊
          </h1>
          <span
            className="text-[12px] text-[#fde047] drop-shadow-[0_0_6px_rgba(253,224,71,0.9)]"
            aria-hidden="true"
          >
            ✦
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (mode === 'illness_form') {
              setShowFormTimeRow((v) => !v);
            } else {
              setShowHeaderPanel((v) => !v);
            }
          }}
          className={`flex h-9 w-9 items-center justify-center rounded-xl transition-transform active:scale-90 ${
            (mode === 'illness_form' ? showFormTimeRow : showHeaderPanel)
              ? 'bg-amber-300/20 text-amber-200'
              : 'text-indigo-100 hover:bg-white/10'
          }`}
          aria-label="日历与筛选"
        >
          <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
            <rect
              x="4"
              y="6.5"
              width="20"
              height="17"
              rx="4"
              stroke="currentColor"
              strokeWidth="1.9"
            />
            <path
              d="M9 4V8.5M19 4V8.5M4.5 11.5H23.5"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
            <circle cx="10" cy="16" r="1.2" fill="currentColor" />
            <circle cx="14" cy="16" r="1.2" fill="currentColor" />
            <circle cx="18" cy="16" r="1.2" fill="currentColor" />
            <circle cx="10" cy="20" r="1.2" fill="currentColor" />
            <circle cx="14" cy="20" r="1.2" fill="currentColor" />
          </svg>
        </button>
      </header>

      {/* 顶部日历展开面板（5.1 疫苗进度筛选 / 5.3 护理按日筛选） */}
      {showHeaderPanel && mode === 'vaccine' && (
        <div className="relative z-20 mx-3.5 mb-2 rounded-2xl border border-white/15 bg-[#122350]/85 px-3 py-2.5 backdrop-blur-md">
          <div className="flex items-center justify-between text-[11.5px]">
            <span className="font-semibold text-amber-100">防御护盾进度</span>
            <span className="font-typewriter font-bold text-amber-300 tabular-nums">
              已接种 {activatedCount} / {state.vaccines.length} 剂
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#85d965] to-[#fde047] transition-all duration-300"
              style={{ width: `${Math.round((activatedCount / state.vaccines.length) * 100)}%` }}
            />
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'all', label: `全部 (${state.vaccines.length})` },
                { id: 'activated', label: `已完成 (${activatedCount})` },
                { id: 'pending', label: `待接种 (${state.vaccines.length - activatedCount})` },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setVaccineFilter(opt.id);
                  if (opt.id !== 'all') setShowAllVaccines(true);
                }}
                className={`rounded-full py-1 text-[11px] font-semibold transition-all ${
                  vaccineFilter === opt.id
                    ? 'bg-gradient-to-b from-[#ffe260] to-[#f4b324] text-[#1f1809]'
                    : 'bg-white/10 text-indigo-100/80 hover:bg-white/15'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showHeaderPanel && mode === 'illness' && (
        <div className="relative z-20 mx-3.5 mb-2 flex items-center justify-between gap-2 rounded-2xl border border-white/15 bg-[#122350]/85 px-3 py-2 backdrop-blur-md">
          <span className="text-[11.5px] font-medium text-indigo-100">按日期查看</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={careDateFilter}
              onChange={(e) => setCareDateFilter(e.target.value)}
              className="rounded-lg border border-white/15 bg-white/10 px-2 py-1 font-typewriter text-xs text-amber-100"
            />
            {careDateFilter && (
              <button
                type="button"
                onClick={() => setCareDateFilter('')}
                className="rounded-lg bg-amber-300/20 px-2 py-1 text-[11px] font-semibold text-amber-200"
              >
                全部
              </button>
            )}
          </div>
        </div>
      )}

      {/* =================================================================
          5.1 疫苗护盾列表页（1:1 还原图二左上 + 完整 19 剂交互优化）
         ================================================================= */}
      {mode === 'vaccine' && (
        <div className="relative z-10 flex flex-1 flex-col px-3.5">
          {/* 顶部二级模式切换胶囊：疫苗护盾 | 生病护理 */}
          <div className="mb-1 flex justify-center">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-[#152550]/75 p-0.5 backdrop-blur-md shadow-[0_4px_14px_rgba(3,8,24,0.38)]">
              <button
                type="button"
                onClick={() => onChangeMode('vaccine')}
                className="rounded-full bg-gradient-to-b from-[#ffe25f] via-[#facc34] to-[#f2ab1a] px-4 py-1 text-[12px] font-bold text-[#1f190d] shadow-[0_2px_10px_rgba(250,204,52,0.45)]"
              >
                疫苗护盾
              </button>
              <button
                type="button"
                onClick={() => onChangeMode('illness')}
                className="rounded-full px-4 py-1 text-[12px] font-medium text-indigo-100/80 transition-colors hover:text-white"
              >
                生病护理
              </button>
            </div>
          </div>

          {/* 英雄插画区：左侧金盾标语 + 右侧持盾小男孩与巴哥犬（置于撕纸卡片后方） */}
          <div className="relative z-10 -mb-5 flex items-end justify-between px-1 pt-1">
            <div className="pb-6 pl-1">
              <div className="flex items-center gap-1.5">
                <img
                  src="/assets/extracted/health_shield_gold.png"
                  alt=""
                  aria-hidden="true"
                  className="h-9 w-8 object-contain drop-shadow-[0_0_12px_rgba(253,224,71,0.65)]"
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
              <div className="mt-1 text-[11px] font-medium text-amber-200/85 tabular-nums">
                护盾已激活 {activatedCount} / {state.vaccines.length} 剂
              </div>
            </div>

            <AssetSlot slotName="health_boy_pug_shield" showSlotTag={showSlotTag} className="shrink-0">
              <img
                src="/assets/extracted/health_boy_pug_shield.png"
                alt="手持护盾的小漫游者与巴哥犬"
                referrerPolicy="no-referrer"
                className="h-[118px] w-auto object-contain drop-shadow-[0_8px_16px_rgba(3,8,24,0.45)]"
              />
            </AssetSlot>
          </div>

          {/* 撕纸疫苗时间轴主卡片 */}
          <div className="diary-paper-card relative z-20 px-1.5 py-2">
            <div className="relative space-y-1">
              {filteredVaccines.map((dose, idx) => {
                const isActivated = dose.status === 'activated';
                const isNext = dose.status === 'next';
                const isLast = idx === filteredVaccines.length - 1;
                const displayDate = dose.inoculatedDate
                  ? dose.inoculatedDate.replace(/-/g, '.')
                  : estimateDoseDate(state.profile.birthDate, dose.recommendedMonth);

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
                            ? '/assets/extracted/health_shield_green.png'
                            : isNext
                            ? '/assets/extracted/health_vial_blue.png'
                            : '/assets/extracted/health_vial_locked.png'
                        }
                        alt=""
                        referrerPolicy="no-referrer"
                        className={`h-8 w-8 object-contain ${
                          !isActivated && !isNext ? 'opacity-75' : ''
                        }`}
                      />
                    </div>

                    {/* 日期 + 疫苗名称与剂次 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#5b5349] tabular-nums">
                        <span className="font-typewriter">{displayDate}</span>
                        <span className="text-[10.5px] font-medium text-[#8b7f70]">
                          · {dose.recommendedMonth}
                        </span>
                      </div>
                      <div className="mt-0.5 truncate text-[13.5px] font-bold text-[#1e293f]">
                        {dose.name} {dose.doseLabel}
                      </div>
                      {isActivated && (dose.brandOrigin || dose.fundingType) && (
                        <div className="mt-0.5 text-[10.5px] text-[#7a6f62]">
                          {[dose.brandOrigin, dose.fundingType].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>

                    {/* 右侧手绘状态标签 */}
                    <div className="shrink-0">
                      {isActivated ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#b7dc9f] bg-[#d8edc9] px-2.5 py-1 text-[11.5px] font-bold text-[#3b7a24]">
                          <span>已完成</span>
                          <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#5cb844] text-white">
                            <Check className="h-2.5 w-2.5 stroke-[3]" />
                          </span>
                        </span>
                      ) : isNext ? (
                        <span className="relative inline-flex items-center gap-1 rounded-full bg-gradient-to-b from-[#ffe25e] to-[#f4b21d] px-2.5 py-1 text-[11.5px] font-extrabold text-[#2a1f07] shadow-[0_2px_8px_rgba(244,178,29,0.45)]">
                          <span>下一针</span>
                          <img
                            src="/assets/extracted/health_star_small.png"
                            alt=""
                            aria-hidden="true"
                            className="h-3.5 w-3.5 object-contain"
                          />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#e3ddd2] px-2.5 py-1 text-[11.5px] font-semibold text-[#847b70]">
                          <span>待解锁</span>
                          <Lock className="h-3 w-3 opacity-80" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 展开 / 收起全部 19 剂入口 */}
            {vaccineFilter === 'all' && state.vaccines.length > 4 && (
              <div className="mt-1 border-t border-dashed border-[#dfd2ba] pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowAllVaccines((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11.5px] font-semibold text-[#6e6050] transition-colors hover:bg-[#efe3cb]"
                >
                  <span>
                    {showAllVaccines
                      ? '收起，仅聚焦近期计划'
                      : `查看全部 ${state.vaccines.length} 剂疫苗计划`}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${
                      showAllVaccines ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>
            )}
          </div>

          {/* 底部主按钮：暖金色「疫苗打卡」 */}
          <div className="relative z-10 mt-4 flex justify-center pb-2">
            <button
              type="button"
              onClick={() => openVaccineForm(defaultNextDose)}
              className="flex min-h-[48px] w-[78%] items-center justify-center gap-2 rounded-full border-2 border-[#fff0a6]/85 bg-gradient-to-b from-[#ffe25e] via-[#facc34] to-[#f1a819] px-6 text-[15px] font-bold tracking-wide text-[#241b09] shadow-[0_8px_22px_rgba(244,179,30,0.45),inset_0_2px_2px_rgba(255,255,255,0.65)] transition-transform hover:brightness-105 active:scale-[0.97]"
            >
              <img
                src="/assets/extracted/health_icon_calendar.png"
                alt=""
                aria-hidden="true"
                className="h-4.5 w-4.5 object-contain"
              />
              <span>疫苗打卡</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================
          5.2 确认接种信息页（1:1 还原图三左 + 完整 19 剂自由选择）
         ================================================================= */}
      {mode === 'vaccine_sheet' && (
        <form
          onSubmit={handleSaveVaccineForm}
          className="relative z-10 flex flex-1 flex-col px-3.5 pb-4"
        >
          {/* 顶部英雄插画（置于撕纸卡片后方，自然探出顶边） */}
          <div className="relative z-10 -mb-5 flex items-end justify-between px-1 pt-0.5">
            <div className="pb-6 pl-1">
              <div className="flex items-center gap-1.5">
                <img
                  src="/assets/extracted/health_shield_gold.png"
                  alt=""
                  aria-hidden="true"
                  className="h-9 w-8 object-contain drop-shadow-[0_0_12px_rgba(253,224,71,0.65)]"
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
              src="/assets/extracted/health_boy_pug_shield.png"
              alt="持盾小漫游者与巴哥犬"
              referrerPolicy="no-referrer"
              className="h-[112px] w-auto object-contain drop-shadow-[0_8px_16px_rgba(3,8,24,0.45)]"
            />
          </div>

          {/* 撕纸表单卡片 + 右上角双闪星 */}
          <div className="diary-paper-card relative z-20 px-2.5 py-3">
            <img
              src="/assets/extracted/health_star_big.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -right-2 -top-4 z-30 h-9 w-9 object-contain drop-shadow-[0_0_10px_rgba(253,224,71,0.85)]"
            />
            <img
              src="/assets/extracted/health_star_small.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-5 z-30 h-5 w-5 object-contain drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]"
            />

            {/* 表单标题头 */}
            <div className="flex items-center gap-2.5 pb-3">
              <img
                src="/assets/extracted/health_vial_blue.png"
                alt=""
                aria-hidden="true"
                className="h-10 w-10 shrink-0 object-contain"
              />
              <div>
                <h2 className="text-[16px] font-extrabold text-[#182746]">确认接种信息</h2>
                <p className="text-[11.5px] text-[#7c7163]">请填写本次疫苗接种的详细信息</p>
              </div>
            </div>

            <div className="space-y-3.5">
              {/* 1. 疫苗选择 */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-[#25324e]">
                  <img
                    src="/assets/extracted/health_star_small.png"
                    alt=""
                    aria-hidden="true"
                    className="h-3.5 w-3.5 object-contain"
                  />
                  <span>疫苗选择</span>
                </div>
                <div className="relative flex items-center justify-between rounded-2xl border border-[#e3d5be] bg-[#faf4e8] px-3 py-2.5 shadow-[inset_0_1px_2px_rgba(120,96,60,0.06)]">
                  <div className="flex min-w-0 items-center gap-2">
                    <img
                      src={
                        activeDose.status === 'activated'
                          ? '/assets/extracted/health_shield_green.png'
                          : '/assets/extracted/health_shield_gold.png'
                      }
                      alt=""
                      aria-hidden="true"
                      className="h-6 w-6 shrink-0 object-contain"
                    />
                    <span className="truncate text-[13.5px] font-bold text-[#1e2c49]">
                      {activeDose.name}（{activeDose.doseLabel}）
                    </span>
                  </div>
                  <ChevronRight className="h-4.5 w-4.5 shrink-0 text-[#867a6b]" />
                  <select
                    aria-label="选择接种疫苗"
                    value={activeDose.id}
                    onChange={(e) => handleSelectDoseInForm(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  >
                    {state.vaccines.map((v) => (
                      <option key={v.id} value={v.id}>
                        {String(v.order).padStart(2, '0')}. {v.name}（{v.doseLabel}）
                        {v.status === 'activated' ? ' [已完成]' : v.status === 'next' ? ' [下一针]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 2. 品牌信息（国产 / 进口 / 其他） */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-[#25324e]">
                  <img
                    src="/assets/extracted/health_star_small.png"
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
              </div>

              {/* 3. 接种方式（免费 / 自费） */}
              <div>
                <div className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-bold text-[#25324e]">
                  <img
                    src="/assets/extracted/health_star_small.png"
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
                        onClick={() => setVacFunding(funding)}
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

              {/* 4. 接种日期 */}
              <div className="flex items-center justify-between gap-2.5 pt-0.5">
                <div className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-bold text-[#25324e]">
                  <img
                    src="/assets/extracted/health_star_small.png"
                    alt=""
                    aria-hidden="true"
                    className="h-3.5 w-3.5 object-contain"
                  />
                  <span>接种日期</span>
                </div>
                <label className="relative flex flex-1 cursor-pointer items-center justify-between rounded-2xl border border-[#e3d5be] bg-[#faf4e8] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <img
                      src="/assets/extracted/health_icon_calendar.png"
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
                    src="/assets/extracted/health_thermometer.png"
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
                  className="min-h-[44px] rounded-full border border-[#dfd3be] bg-[#f5efe3] text-[14px] font-bold text-[#4a4238] shadow-xs transition-transform active:scale-95"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[#fff0a6] bg-gradient-to-b from-[#ffe25e] via-[#facc34] to-[#f1a819] text-[14px] font-extrabold text-[#241b09] shadow-[0_6px_16px_rgba(244,179,30,0.42),inset_0_1.5px_1.5px_rgba(255,255,255,0.65)] transition-transform active:scale-95"
                >
                  <img
                    src="/assets/extracted/health_star_small.png"
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
      )}

      {/* =================================================================
          5.3 生病护理列表页（1:1 还原图二左下 + 熟睡宝宝与橘猫大图）
         ================================================================= */}
      {mode === 'illness' && (
        <div className="relative z-10 flex flex-1 flex-col px-3.5">
          {/* 顶部暖心文案 + 右侧双态切换胶囊（贴合设计图二左下构图） */}
          <div className="mb-1 flex items-start justify-between gap-2 px-1 pt-1">
            <p className="text-[12.5px] font-medium leading-[1.45] text-[#fff8e7]/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
              照顾生病的小宝贝，
              <br />
              也要记得好好休息呀～
            </p>

            <div className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-[#152550]/80 p-0.5 backdrop-blur-md shadow-[0_4px_12px_rgba(3,8,24,0.4)]">
              <button
                type="button"
                onClick={() => onChangeMode('illness')}
                className="rounded-full bg-gradient-to-b from-[#ffe25f] via-[#facc34] to-[#f2ab1a] px-3 py-1 text-[11.5px] font-bold text-[#1f190d] shadow-[0_2px_8px_rgba(250,204,52,0.4)]"
              >
                生病护理
              </button>
              <button
                type="button"
                onClick={() => onChangeMode('vaccine')}
                className="rounded-full px-3 py-1 text-[11.5px] font-medium text-indigo-100/80 transition-colors hover:text-white"
              >
                疫苗护盾
              </button>
            </div>
          </div>

          {/* 英雄插画：星空被窝里熟睡的黄衣小宝宝与橘猫（置于撕纸卡片后方） */}
          <div className="relative z-10 -mb-6 flex justify-center">
            <AssetSlot slotName="health_sleeping_baby_cat" showSlotTag={showSlotTag}>
              <img
                src="/assets/extracted/health_sleeping_baby_cat.png"
                alt="被窝里熟睡的小宝贝与橘猫"
                referrerPolicy="no-referrer"
                className="h-[160px] w-auto object-contain drop-shadow-[0_8px_18px_rgba(3,8,24,0.45)]"
              />
            </AssetSlot>
          </div>

          {/* 撕纸护理记录卡片 */}
          <div className="diary-paper-card relative z-20 px-2 pb-2.5 pt-2.5">
            {/* 轻量分类筛选行 */}
            <div className="mb-2.5 flex items-center justify-between gap-1 px-0.5">
              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'all', label: '全部' },
                    { id: 'temperature', label: '体温' },
                    { id: 'medicine', label: '用药' },
                    { id: 'hydration', label: '补水' },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setCareFilter(chip.id)}
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
                      careFilter === chip.id
                        ? 'bg-[#21345e] text-amber-100'
                        : 'bg-[#eee4d1] text-[#6d6153] hover:bg-[#e5d8c0]'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
              <span className="font-typewriter text-[11px] font-semibold text-[#8c7f6f] tabular-nums">
                {filteredIllnesses.length} 条
              </span>
            </div>

            {filteredIllnesses.length === 0 ? (
              <div className="rounded-2xl bg-[#f7f0e2] px-4 py-8 text-center">
                <div className="font-display text-2xl text-[#24324e]">星球运行平稳</div>
                <p className="mt-1 text-[12px] text-[#786b5c]">
                  暂无对应的护理记录，点击下方按钮随时记录宝宝状态
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredIllnesses.map((rec) => {
                  const category = getRecordCategory(rec);
                  const isOverheat = category === 'temperature' && rec.temperatureC >= 38.5;
                  const isExpanded = expandedIllnessId === rec.id;

                  const iconSrc =
                    category === 'medicine'
                      ? '/assets/extracted/health_medicine_bottle.png'
                      : category === 'hydration'
                      ? '/assets/extracted/health_water_drop.png'
                      : '/assets/extracted/health_thermometer.png';

                  const cardTitle =
                    rec.title ||
                    (isOverheat
                      ? '体温过载'
                      : category === 'medicine'
                      ? '退烧药'
                      : category === 'hydration'
                      ? '多喝水'
                      : '体温记录');

                  const subtitleLeft =
                    category === 'temperature'
                      ? `${rec.temperatureC.toFixed(1)}°C`
                      : rec.summary || (rec.amountMl ? `${rec.amountMl}ml` : '护理记录');

                  return (
                    <div
                      key={rec.id}
                      className={`overflow-hidden rounded-2xl border transition-all ${
                        isOverheat
                          ? 'border-[#ebb5a8] bg-gradient-to-r from-[#f8d0c8] to-[#fbe4de]'
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
                        className="flex w-full cursor-pointer items-center justify-between gap-2.5 px-3 py-3 text-left"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <img
                            src={iconSrc}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="h-9 w-8 shrink-0 object-contain drop-shadow-xs"
                          />
                          <div className="min-w-0">
                            <div
                              className={`truncate text-[14.5px] font-extrabold ${
                                isOverheat ? 'text-[#c93524]' : 'text-[#1c2b48]'
                              }`}
                            >
                              {cardTitle}
                            </div>
                            <div className="mt-0.5 truncate text-[11.5px] font-medium text-[#6f6357] tabular-nums">
                              {subtitleLeft} · {rec.date.replace(/-/g, '.')} {rec.time}
                            </div>
                          </div>
                        </div>

                        {isOverheat ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleIllnessHandled(rec.id);
                            }}
                            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition-transform active:scale-95 ${
                              rec.handled
                                ? 'bg-[#efb6ac]/85 text-[#9c2f22]'
                                : 'bg-[#d94330] text-white shadow-xs'
                            }`}
                          >
                            {rec.handled ? '已处理' : '待处理'}
                          </button>
                        ) : (
                          <ChevronRight
                            className={`h-4.5 w-4.5 shrink-0 text-[#8a7d6d] transition-transform ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                          />
                        )}
                      </div>

                      {/* 点击卡片展开详细护理说明与删除操作 */}
                      {isExpanded && (
                        <div className="border-t border-black/5 bg-white/45 px-3.5 py-2.5 text-[12px] text-[#453c33]">
                          {rec.symptoms.length > 0 && (
                            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] font-semibold text-[#7b6e60]">标签：</span>
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
                          <p className="leading-relaxed text-[#2d2620]">{rec.medication}</p>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-[#837668]">
                            <span>记录人：{rec.recorder}</span>
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
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 底部暖金色主按钮：+ 新建护理记录 */}
          <div className="relative z-10 mt-4 flex justify-center pb-2">
            <button
              type="button"
              onClick={() => openIllnessForm('temperature')}
              className="flex min-h-[48px] w-[78%] items-center justify-center gap-1.5 rounded-full border-2 border-[#fff0a6]/85 bg-gradient-to-b from-[#ffe25e] via-[#facc34] to-[#f1a819] px-6 text-[15px] font-bold tracking-wide text-[#241b09] shadow-[0_8px_22px_rgba(244,179,30,0.45),inset_0_2px_2px_rgba(255,255,255,0.65)] transition-transform hover:brightness-105 active:scale-[0.97]"
            >
              <Plus className="h-4.5 w-4.5 stroke-[2.8]" />
              <span>新建护理记录</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================
          5.4 新建护理记录页（1:1 还原图三右 + 支持体温/用药/补水三类记录）
         ================================================================= */}
      {mode === 'illness_form' && (
        <form
          onSubmit={handleSaveIllnessForm}
          className="relative z-10 flex flex-1 flex-col px-3.5 pb-4"
        >
          {/* 顶部英雄区：医药箱标语 + 持盾小男孩与巴哥犬（置于撕纸卡片后方） */}
          <div className="relative z-10 -mb-5 flex items-end justify-between px-1 pt-0.5">
            <div className="pb-6 pl-1">
              <div className="flex items-center gap-1.5">
                <img
                  src="/assets/extracted/health_firstaid_kit.png"
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
              src="/assets/extracted/health_boy_pug_shield.png"
              alt="守护小漫游者与巴哥犬"
              referrerPolicy="no-referrer"
              className="h-[112px] w-auto object-contain drop-shadow-[0_8px_16px_rgba(3,8,24,0.45)]"
            />
          </div>

          {/* 撕纸新建护理表单卡片 + 右上角双闪星 */}
          <div className="diary-paper-card relative z-20 px-2.5 py-3">
            <img
              src="/assets/extracted/health_star_big.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -right-2 -top-4 z-30 h-9 w-9 object-contain drop-shadow-[0_0_10px_rgba(253,224,71,0.85)]"
            />
            <img
              src="/assets/extracted/health_star_small.png"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute right-2 top-5 z-30 h-5 w-5 object-contain drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]"
            />

            {/* 卡片标题头 */}
            <div className="flex items-center justify-between gap-2 pb-3">
              <div className="flex items-center gap-2.5">
                <img
                  src={
                    careCategory === 'medicine'
                      ? '/assets/extracted/health_medicine_bottle.png'
                      : careCategory === 'hydration'
                      ? '/assets/extracted/health_water_drop.png'
                      : '/assets/extracted/health_thermometer.png'
                  }
                  alt=""
                  aria-hidden="true"
                  className="h-10 w-9 shrink-0 object-contain"
                />
                <div>
                  <h2 className="text-[16px] font-extrabold text-[#182746]">新建护理记录</h2>
                  <p className="text-[11.5px] text-[#7c7163]">记录宝宝的身体状况吧~</p>
                </div>
              </div>
            </div>

            {/* 护理类型三选一优化条（默认“体温护理”与图三右一致，并可一键记用药或补水） */}
            <div className="mb-3.5 grid grid-cols-3 gap-1.5 rounded-full bg-[#efe4ce] p-1">
              {(
                [
                  { id: 'temperature', label: '体温护理' },
                  { id: 'medicine', label: '用药记录' },
                  { id: 'hydration', label: '多喝水' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCareCategory(tab.id)}
                  className={`rounded-full py-1.5 text-[12px] font-bold transition-all ${
                    careCategory === tab.id
                      ? 'bg-gradient-to-b from-[#ffe469] to-[#f8c437] text-[#241b09] shadow-xs'
                      : 'text-[#6c6052] hover:text-[#2a231c]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 可折叠时间选择行（点击右上日历图标可微调日期与时刻） */}
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

            <div className="space-y-4">
              {/* 模式 A：体温护理（1:1 图三右布局） */}
              {careCategory === 'temperature' && (
                <>
                  <div>
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-[#25324e]">
                        <img
                          src="/assets/extracted/health_thermometer.png"
                          alt=""
                          aria-hidden="true"
                          className="h-5 w-4 object-contain"
                        />
                        <span>体温</span>
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
                          className="w-full bg-transparent px-3.5 py-2.5 font-typewriter text-[19px] font-bold text-[#1e2c49] focus:outline-none tabular-nums"
                          required
                        />
                        <span className="flex items-center border-l border-[#e3d5be] bg-[#efe5d2]/75 px-3.5 text-[13.5px] font-bold text-[#4e463d]">
                          °C
                        </span>
                      </div>
                    </div>

                    {isFormOverheat && (
                      <div className="mt-1.5 flex items-center justify-end gap-1 text-[11px] font-bold text-[#c93524]">
                        <span>⚠ 体温过载预警（≥38.5°C），建议及时降温并密切观察</span>
                      </div>
                    )}
                  </div>

                  {/* 症状多选胶囊 */}
                  <div>
                    <div className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-[#25324e]">
                      <img
                        src="/assets/extracted/health_star_small.png"
                        alt=""
                        aria-hidden="true"
                        className="h-4 w-4 object-contain"
                      />
                      <span>症状</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {SYMPTOM_OPTIONS.map((sym) => {
                        const active = selectedSymptoms.includes(sym);
                        return (
                          <button
                            key={sym}
                            type="button"
                            onClick={() => toggleSymptom(sym)}
                            className={`min-h-[34px] rounded-full px-3.5 text-[12.5px] font-bold transition-all active:scale-95 ${
                              active
                                ? 'border border-[#f2c144] bg-gradient-to-b from-[#ffe469] to-[#f8c437] text-[#261c07] shadow-[0_3px_8px_rgba(248,196,55,0.35)]'
                                : 'border border-[#e4d7c1] bg-[#f7f1e5] text-[#4e453b] hover:bg-[#f0e5d1]'
                            }`}
                          >
                            {sym}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* 模式 B：用药记录快捷录入 */}
              {careCategory === 'medicine' && (
                <>
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-bold text-[#25324e]">
                      <img
                        src="/assets/extracted/health_icon_capsule.png"
                        alt=""
                        aria-hidden="true"
                        className="h-4 w-4 object-contain"
                      />
                      <span>药物或护理名称</span>
                    </div>
                    <input
                      type="text"
                      value={medicineTitle}
                      onChange={(e) => setMedicineTitle(e.target.value)}
                      placeholder="例如：退烧药、布洛芬"
                      className="w-full rounded-2xl border border-[#e3d5be] bg-[#f8f1e4] px-3.5 py-2.5 text-[13.5px] font-bold text-[#1e2c49] focus:border-[#f0bd3f] focus:outline-none"
                      required
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {MEDICINE_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setMedicineTitle(preset)}
                          className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${
                            medicineTitle === preset
                              ? 'bg-gradient-to-b from-[#ffe469] to-[#f8c437] text-[#261c07]'
                              : 'border border-[#e4d7c1] bg-[#f7f1e5] text-[#5a5045]'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="shrink-0 text-[13px] font-bold text-[#25324e]">服用剂量</span>
                    <input
                      type="text"
                      value={medicineDose}
                      onChange={(e) => setMedicineDose(e.target.value)}
                      placeholder="例如：1次 / 2.5ml"
                      className="flex-1 rounded-2xl border border-[#e3d5be] bg-[#f8f1e4] px-3 py-2 text-[13.5px] font-bold text-[#1e2c49] focus:outline-none"
                    />
                  </div>
                </>
              )}

              {/* 模式 C：多喝水补水记录 */}
              {careCategory === 'hydration' && (
                <div>
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold text-[#25324e]">
                      <img
                        src="/assets/extracted/health_water_drop.png"
                        alt=""
                        aria-hidden="true"
                        className="h-5 w-4 object-contain"
                      />
                      <span>补水量</span>
                    </div>
                    <div className="flex flex-1 overflow-hidden rounded-2xl border border-[#e3d5be] bg-[#f8f1e4]">
                      <input
                        type="number"
                        min="10"
                        max="1000"
                        value={waterMlStr}
                        onChange={(e) => setWaterMlStr(e.target.value)}
                        className="w-full bg-transparent px-3.5 py-2.5 font-typewriter text-[19px] font-bold text-[#1e2c49] focus:outline-none tabular-nums"
                        required
                      />
                      <span className="flex items-center border-l border-[#e3d5be] bg-[#efe5d2]/75 px-3.5 text-[13.5px] font-bold text-[#4e463d]">
                        ml
                      </span>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {WATER_PRESETS.map((ml) => (
                      <button
                        key={ml}
                        type="button"
                        onClick={() => setWaterMlStr(String(ml))}
                        className={`rounded-full px-3.5 py-1 text-[12px] font-bold tabular-nums ${
                          waterMlStr === String(ml)
                            ? 'bg-gradient-to-b from-[#ffe469] to-[#f8c437] text-[#261c07]'
                            : 'border border-[#e4d7c1] bg-[#f7f1e5] text-[#5a5045]'
                        }`}
                      >
                        {ml}ml
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 用药记录 / 护理备注（始终显示，贴合图三右） */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[13px] font-bold text-[#25324e]">
                    <img
                      src="/assets/extracted/health_icon_capsule.png"
                      alt=""
                      aria-hidden="true"
                      className="h-4 w-4 object-contain"
                    />
                    <span>{careCategory === 'hydration' ? '补水备注（可选）' : '用药记录'}</span>
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
                  rows={3}
                  maxLength={100}
                  value={medication}
                  onChange={(e) => setMedication(e.target.value)}
                  placeholder="请输入用药名称、剂量等信息..."
                  className="w-full resize-none rounded-2xl border border-[#e3d5be] bg-[#f8f1e4] px-3 py-2.5 text-[13px] leading-relaxed text-[#242f46] placeholder:text-[#a69a8a] focus:border-[#f0bd3f] focus:outline-none"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-[#9b8f7f]">
                  <button
                    type="button"
                    onClick={() => setShowFormTimeRow((v) => !v)}
                    className="font-typewriter text-[#7b6e60] underline decoration-dotted underline-offset-2"
                  >
                    {illDate.replace(/-/g, '.')} {illTime}
                  </button>
                  <span className="font-typewriter tabular-nums">{medication.length}/100</span>
                </div>
              </div>

              {/* 底部操作按钮：取消 + 保存 */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onChangeMode('illness')}
                  className="min-h-[44px] rounded-full border border-[#dfd3be] bg-[#f5efe3] text-[14px] font-bold text-[#4a4238] shadow-xs transition-transform active:scale-95"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-[#fff0a6] bg-gradient-to-b from-[#ffe25e] via-[#facc34] to-[#f1a819] text-[14px] font-extrabold text-[#241b09] shadow-[0_6px_16px_rgba(244,179,30,0.42),inset_0_1.5px_1.5px_rgba(255,255,255,0.65)] transition-transform active:scale-95"
                >
                  <img
                    src="/assets/extracted/health_star_small.png"
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
      )}
    </div>
  );
};
