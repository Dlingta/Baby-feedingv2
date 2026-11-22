import React, { useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Delete,
  HelpCircle,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { FeedingRecord, FeedingType, PlanetAppState } from '../types/planet';
import { getCurrentTimeStr, getTodayDateStr } from '../data/initialData';
import { AssetSlot } from '../components/Illustrations';

export type FeedingViewMode = 'timeline' | 'empty' | 'form';
type RangeOption = 7 | 30 | 90;
type FormTabKey = 'source' | 'energy' | 'dew';

interface FeedingScreenProps {
  state: PlanetAppState;
  mode: FeedingViewMode;
  showSlotTag?: boolean;
  onChangeMode: (mode: FeedingViewMode) => void;
  onBackHome: () => void;
  onAddFeeding: (record: FeedingRecord) => void;
  onDeleteFeeding: (id: string) => void;
}

const shiftDate = (dateStr: string, deltaDays: number): string => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export const FeedingScreen: React.FC<FeedingScreenProps> = ({
  state,
  mode,
  showSlotTag = false,
  onChangeMode,
  onBackHome,
  onAddFeeding,
  onDeleteFeeding,
}) => {
  const todayStr = getTodayDateStr();
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateStr());
  const [rangeDays, setRangeDays] = useState<RangeOption>(7);
  const [showDateBar, setShowDateBar] = useState(false);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [showFormHelp, setShowFormHelp] = useState(false);

  // 3.3 新建表单状态（源泉 / 能量瓶 / 晨露）
  const [activeFormTab, setActiveFormTab] = useState<FormTabKey>('source');
  const [mlStr, setMlStr] = useState('120');
  const [breastUnit, setBreastUnit] = useState<'ml' | 'min'>('ml');
  const [breastSide, setBreastSide] = useState<'left' | 'right' | 'both'>('both');
  const [breastValStr, setBreastValStr] = useState('80');
  const [dewSubType, setDewSubType] = useState<'solids' | 'supplement'>('solids');
  const [foodName, setFoodName] = useState('菠菜泥');
  const [foodQtyStr, setFoodQtyStr] = useState('30');
  const [formTime, setFormTime] = useState(() => getCurrentTimeStr());
  const [formNote, setFormNote] = useState('');

  // OCR 识图反馈状态
  const [ocrStatus, setOcrStatus] = useState<'ready' | 'scanning' | 'done'>('done');
  const [ocrResultText, setOcrResultText] = useState('已识别：配方奶 120ml');
  const ocrCycleRef = useRef(0);
  const ocrFileRef = useRef<HTMLInputElement>(null);

  const isEmptyView = mode === 'empty';

  // 构建 7天 / 30天 / 90天 双 Y 轴趋势点（固定 7 个均衡节点，便于移动端阅读）
  const chartSeries = useMemo(() => {
    const step = rangeDays === 7 ? 1 : rangeDays === 30 ? 5 : 15;
    const points: { date: string; short: string; totalMl: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const endDate = shiftDate(selectedDate, -i * step);
      const startDate = shiftDate(endDate, -(step - 1));
      const matching = isEmptyView
        ? []
        : state.feedings.filter((f) => f.date >= startDate && f.date <= endDate);

      const rawMl = matching.reduce((sum, r) => sum + (r.amountMl || 0), 0);
      const avgMl = step === 1 ? rawMl : Math.round(rawMl / step);
      const avgCount = step === 1 ? matching.length : Number((matching.length / step).toFixed(1));

      points.push({
        date: endDate,
        short: endDate.slice(5).replace('-', '/'),
        totalMl: avgMl,
        count: avgCount,
      });
    }
    return points;
  }, [state.feedings, selectedDate, rangeDays, isEmptyView]);

  const dayFeedings = useMemo(() => {
    if (isEmptyView) return [];
    const list = showAllRecords
      ? state.feedings
      : state.feedings.filter((f) => f.date === selectedDate);
    return [...list].sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      return dateCmp !== 0 ? dateCmp : b.time.localeCompare(a.time);
    });
  }, [state.feedings, selectedDate, isEmptyView, showAllRecords]);

  const triggerOcrSimulation = () => {
    const samples = [
      { type: 'source' as FormTabKey, ml: '120', time: '19:30', text: '已识别：配方奶 120ml' },
      { type: 'source' as FormTabKey, ml: '150', time: '15:20', text: '已识别：配方奶 150ml · 15:20' },
      { type: 'energy' as FormTabKey, ml: '90', time: '09:10', text: '已识别：母乳瓶喂 90ml · 09:10' },
    ];
    const nextSample = samples[ocrCycleRef.current % samples.length];
    ocrCycleRef.current += 1;

    setOcrStatus('scanning');
    setOcrResultText('正在识别奶瓶刻度与时间…');
    setTimeout(() => {
      setOcrStatus('done');
      setActiveFormTab(nextSample.type);
      if (nextSample.type === 'source') {
        setMlStr(nextSample.ml);
      } else {
        setBreastUnit('ml');
        setBreastValStr(nextSample.ml);
      }
      setFormTime(nextSample.time);
      setOcrResultText(nextSample.text);
    }, 550);
  };

  const handleKeypadPress = (key: string) => {
    const setter =
      activeFormTab === 'source'
        ? setMlStr
        : activeFormTab === 'energy'
        ? setBreastValStr
        : setFoodQtyStr;

    setter((prev) => {
      if (key === 'back') {
        return prev.length <= 1 ? '0' : prev.slice(0, -1);
      }
      if (key === '.') {
        return prev.includes('.') ? prev : `${prev}.`;
      }
      const next = prev === '0' ? key : `${prev}${key}`;
      return next.length > 5 ? prev : next;
    });
  };

  const handleSubmitForm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    let type: FeedingType = 'formula';
    let extra: Partial<FeedingRecord> = {};

    if (activeFormTab === 'source') {
      type = 'formula';
      extra = { amountMl: Math.max(5, Math.round(parseFloat(mlStr || '120') || 120)) };
    } else if (activeFormTab === 'energy') {
      type = 'breast';
      const numVal = Math.max(1, Math.round(parseFloat(breastValStr || '80') || 80));
      extra =
        breastUnit === 'ml'
          ? { breastSide, amountMl: numVal }
          : { breastSide, durationMin: numVal };
    } else {
      type = dewSubType;
      const unit = dewSubType === 'supplement' ? '粒' : 'g';
      extra = {
        foodName: foodName.trim() || (dewSubType === 'supplement' ? '维生素AD' : '菠菜泥'),
        foodAmount: `${foodQtyStr || '1'}${unit}`,
      };
    }

    const record: FeedingRecord = {
      id: `feed-${Date.now()}`,
      date: selectedDate,
      time: formTime || getCurrentTimeStr(),
      type,
      note: formNote.trim() || undefined,
      recorder: state.profile.recorders[0] || '妈妈',
      ...extra,
    };

    onAddFeeding(record);
    setFormNote('');
    onChangeMode('timeline');
  };

  // 双 Y 轴折线图坐标计算
  const maxMlRaw = Math.max(180, ...chartSeries.map((d) => d.totalMl));
  const maxMl = Math.ceil(maxMlRaw / 60) * 60;
  const maxCount = Math.max(4, Math.ceil(Math.max(...chartSeries.map((d) => d.count), 4)));

  const svgW = 328;
  const svgH = 148;
  const padL = 32;
  const padR = 24;
  const padT = 16;
  const padB = 26;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const mlPoints = chartSeries.map((d, idx) => {
    const x = padL + (idx / Math.max(1, chartSeries.length - 1)) * plotW;
    const y = padT + plotH - (d.totalMl / maxMl) * plotH;
    return { x, y, ...d };
  });

  const countPoints = chartSeries.map((d, idx) => {
    const x = padL + (idx / Math.max(1, chartSeries.length - 1)) * plotW;
    const y = padT + plotH - (d.count / maxCount) * plotH;
    return { x, y, ...d };
  });

  const mlPath = buildSmoothPath(mlPoints);
  const countPath = buildSmoothPath(countPoints);

  const renderFeedingIcon = (type: FeedingType) => {
    if (type === 'formula') {
      return (
        <img
          src="/assets/extracted/feed_icon_bottle.png"
          alt="配方奶"
          referrerPolicy="no-referrer"
          className="h-7 w-7 shrink-0 object-contain"
        />
      );
    }
    if (type === 'solids') {
      return (
        <img
          src="/assets/extracted/feed_icon_solids.png"
          alt="辅食"
          referrerPolicy="no-referrer"
          className="h-6 w-7 shrink-0 object-contain"
        />
      );
    }
    if (type === 'breast') {
      return (
        <img
          src="/assets/extracted/feed_icon_breast.png"
          alt="母乳"
          referrerPolicy="no-referrer"
          className="h-6.5 w-6.5 shrink-0 object-contain"
        />
      );
    }
    // 营养品 (维生素/益生菌等)
    return (
      <img
        src="/assets/extracted/icon_sprout.png"
        alt="营养品"
        referrerPolicy="no-referrer"
        className="h-6.5 w-6.5 shrink-0 object-contain"
      />
    );
  };

  const formatRecordSummary = (item: FeedingRecord): string => {
    if (item.type === 'formula') {
      return `配方奶 ${item.amountMl ?? 120}ml`;
    }
    if (item.type === 'solids') {
      return `辅食 ${item.foodName || '米粉'} ${item.foodAmount || ''}`.trim();
    }
    if (item.type === 'supplement') {
      return `营养品 ${item.foodName || '维生素AD'} ${item.foodAmount || ''}`.trim();
    }
    if (item.amountMl) {
      return `母乳 ${item.amountMl}ml`;
    }
    const sideLabel =
      item.breastSide === 'left' ? '左侧' : item.breastSide === 'right' ? '右侧' : '双侧';
    return `母乳 ${sideLabel} ${item.durationMin ?? 15}分`;
  };

  const renderRangePills = () => (
    <div className="mx-auto mt-1 flex w-[236px] items-center rounded-full border border-white/12 bg-[#162754]/75 p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-md">
      {([7, 30, 90] as RangeOption[]).map((r, idx) => {
        const active = rangeDays === r;
        return (
          <React.Fragment key={r}>
            <button
              type="button"
              onClick={() => setRangeDays(r)}
              className={`relative flex-1 rounded-full py-1.5 text-[13px] transition-all ${
                active
                  ? 'bg-gradient-to-b from-[#fde074] to-[#f2b932] font-bold text-[#182848] shadow-[0_2px_12px_rgba(249,207,76,0.55)]'
                  : 'font-medium text-indigo-100/85 hover:text-white'
              }`}
            >
              {r}天
            </button>
            {idx < 2 && !active && rangeDays !== ([7, 30, 90][idx + 1] as RangeOption) && (
              <span className="h-3.5 w-[1px] bg-white/15" aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="relative flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-clip">
      {/* 宇宙星空底层背景 */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-top opacity-80"
        style={{ backgroundImage: "url('/assets/aistudio/____f8d9ecf9.png')" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#071230]/40 via-[#0a193f]/55 to-[#060f29]/85"
        aria-hidden="true"
      />

      {/* =================================================================
          顶部手绘星空导航栏
         ================================================================= */}
      <header className="relative z-20 flex min-h-[54px] items-center justify-between px-4 pt-safe pb-1">
        <button
          type="button"
          onClick={mode === 'form' ? () => onChangeMode('timeline') : onBackHome}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/8 text-indigo-100 backdrop-blur-sm transition-transform hover:bg-white/15 active:scale-90"
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-1.5">
          {mode !== 'form' && (
            <span className="text-[12px] text-[#fde047] drop-shadow-[0_0_6px_rgba(253,224,71,0.9)]" aria-hidden="true">
              ✦
            </span>
          )}
          <h1 className="text-[18px] font-semibold tracking-[0.12em] text-[#fffaf0] drop-shadow-[0_2px_8px_rgba(4,10,30,0.8)]">
            {mode === 'form' ? '记录喂养' : '喂养'}
          </h1>
          <span className="text-[12px] text-[#fde047] drop-shadow-[0_0_6px_rgba(253,224,71,0.9)]" aria-hidden="true">
            ✦
          </span>
        </div>

        {mode === 'form' ? (
          <button
            type="button"
            onClick={() => setShowFormHelp((v) => !v)}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/8 text-indigo-100 backdrop-blur-sm transition-transform hover:bg-white/15 active:scale-90"
            aria-label="录入说明"
          >
            <HelpCircle className="h-4.5 w-4.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowDateBar((v) => !v)}
            className={`flex h-9 w-9 items-center justify-center rounded-xl transition-transform active:scale-90 ${
              showDateBar ? 'bg-amber-300/20 text-amber-200' : 'text-indigo-100 hover:bg-white/10'
            }`}
            aria-label="切换日期"
          >
            <svg viewBox="0 0 28 28" className="h-6 w-6" fill="none" aria-hidden="true">
              <rect x="4" y="6.5" width="20" height="17" rx="4" stroke="currentColor" strokeWidth="1.9" />
              <path d="M9 4V8.5M19 4V8.5M4.5 11.5H23.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              <circle cx="10" cy="16" r="1.2" fill="currentColor" />
              <circle cx="14" cy="16" r="1.2" fill="currentColor" />
              <circle cx="18" cy="16" r="1.2" fill="currentColor" />
              <circle cx="10" cy="20" r="1.2" fill="currentColor" />
              <circle cx="14" cy="20" r="1.2" fill="currentColor" />
            </svg>
          </button>
        )}
      </header>

      {/* 3.3 帮助提示气泡 */}
      {mode === 'form' && showFormHelp && (
        <div className="relative z-20 mx-4 mb-2 rounded-[20px] border border-amber-200/30 bg-[#132552]/92 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-amber-100/95 shadow-[0_10px_24px_rgba(3,8,24,0.4)] backdrop-blur-md">
          <strong>源泉</strong>用于记录配方奶量，<strong>能量瓶</strong>用于母乳（支持瓶喂 ml 或亲喂时长），<strong>晨露</strong>用于辅食与维生素等营养品；点击上方「拍照识别」可快速填入刻度。
        </div>
      )}

      {/* 3.1 / 3.2 日期切换条 (点击右上角日历展开) */}
      {mode !== 'form' && showDateBar && (
        <div className="relative z-20 mx-4 mb-2.5 flex items-center justify-between rounded-[20px] border border-white/15 bg-[#122350]/88 px-3 py-1.5 shadow-[0_10px_24px_rgba(3,8,24,0.4)] backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-100 hover:bg-white/10"
            aria-label="前一天"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>

          <label className="relative cursor-pointer px-2 font-typewriter text-[13px] font-semibold text-amber-100 tabular-nums">
            <span>
              {selectedDate.replace(/-/g, '.')}
              {selectedDate === todayStr ? ' · 今日' : ''}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
          </label>

          <button
            type="button"
            onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-amber-100 hover:bg-white/10"
            aria-label="后一天"
          >
            <ChevronRight className="h-4.5 w-4.5" />
          </button>
        </div>
      )}

      {/* =================================================================
          3.3 喂养·新建录入表单 (1:1 还原设计图第三屏)
         ================================================================= */}
      {mode === 'form' && (
        <form
          onSubmit={handleSubmitForm}
          className="relative z-10 flex flex-1 flex-col justify-between gap-3.5 px-4 pb-safe pt-1"
        >
          <input
            ref={ocrFileRef}
            type="file"
            accept="image/*"
            onChange={triggerOcrSimulation}
            className="hidden"
          />

          {/* 1. 顶部 OCR 拍照识别卡片 + 识别结果绿色反馈条 */}
          <div className="space-y-2">
            <div className="relative">
              {/* 左上角点缀发光小黄星 */}
              <img
                src="/assets/extracted/feed_glow_star.png"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -top-3 left-5 z-20 h-7 w-7 object-contain drop-shadow-[0_0_8px_rgba(253,224,71,0.85)]"
              />
              <button
                type="button"
                onClick={triggerOcrSimulation}
                className="diary-paper-card flex w-full items-center justify-between gap-3 px-2 py-0.5 text-left transition-transform active:scale-[0.99]"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <AssetSlot slotName="feed_ocr_camera" showSlotTag={showSlotTag} className="shrink-0">
                    <img
                      src="/assets/extracted/feed_icon_camera.png"
                      alt="拍照识别"
                      referrerPolicy="no-referrer"
                      className="h-10 w-11 object-contain"
                    />
                  </AssetSlot>
                  <div className="min-w-0">
                    <div className="text-[15.5px] font-bold leading-snug text-[#182848]">
                      拍照识别
                    </div>
                    <div className="truncate text-[11.5px] text-[#6d6256]">
                      快速识别奶瓶量、时间
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#5b534a]" />
              </button>
            </div>

            {/* 绿色识别结果反馈条 */}
            <div className="relative">
              <button
                type="button"
                onClick={() => ocrFileRef.current?.click()}
                className={`flex w-full items-center justify-between rounded-[20px] border px-3.5 py-2.5 text-left shadow-[0_6px_16px_rgba(3,8,24,0.28)] transition-colors ${
                  ocrStatus === 'scanning'
                    ? 'border-amber-200 bg-amber-100/95 text-amber-950 animate-pulse'
                    : 'border-[#d8eab1] bg-gradient-to-r from-[#b9d98c] to-[#cce3a2] text-[#1c3917]'
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3f8f33] text-white shadow-2xs">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                  <span className="truncate text-[13px] font-semibold">
                    {ocrResultText}
                  </span>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#49693d]" />
              </button>
              <img
                src="/assets/extracted/feed_glow_star.png"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-2.5 -right-1 z-20 h-7 w-7 object-contain drop-shadow-[0_0_8px_rgba(253,224,71,0.85)]"
              />
            </div>
          </div>

          {/* 2. 三段式文件夹 Tab（源泉 / 能量瓶 / 晨露）+ 米白撕纸录入卡片 */}
          <div>
            {/* 文件夹标签行 */}
            <div className="grid grid-cols-3 items-end px-1">
              {[
                {
                  key: 'source' as FormTabKey,
                  label: '源泉',
                  icon: '/assets/extracted/feed_icon_bottle.png',
                },
                {
                  key: 'energy' as FormTabKey,
                  label: '能量瓶',
                  icon: '/assets/extracted/feed_tab_energy.png',
                },
                {
                  key: 'dew' as FormTabKey,
                  label: '晨露',
                  icon: '/assets/extracted/feed_tab_dew.png',
                },
              ].map((tab) => {
                const active = activeFormTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveFormTab(tab.key)}
                    className={`relative flex flex-col items-center justify-center rounded-t-[20px] px-2 pb-2 pt-2 transition-all ${
                      active
                        ? 'z-10 -mb-2.5 bg-gradient-to-b from-[#fde073] to-[#f5c038] pb-3.5 text-[#182848] shadow-[0_-2px_12px_rgba(249,207,76,0.45)]'
                        : 'mb-0 border-x border-t border-white/12 bg-[#132550]/82 text-indigo-100/85 hover:bg-[#193065]/90'
                    }`}
                  >
                    <img
                      src={tab.icon}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-6 w-6 object-contain"
                    />
                    <span className="mt-0.5 text-[12.5px] font-bold leading-tight">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 录入内容撕纸面板 */}
            <div className="diary-paper-card relative z-20 space-y-2.5 px-1.5 py-1.5">
              {/* Tab 1: 源泉（配方奶 ml） */}
              {activeFormTab === 'source' && (
                <div className="flex items-center gap-2.5">
                  <span className="w-16 shrink-0 text-[13.5px] font-bold text-[#182848]">奶量</span>
                  <div className="flex flex-1 items-center rounded-xl border border-[#e5d8be] bg-[#faf2e1] px-3 py-2">
                    <span className="font-typewriter text-[17px] font-bold text-[#182848] tabular-nums">
                      {mlStr}
                    </span>
                    <span className="ml-0.5 inline-block h-4 w-[1.5px] bg-[#6b7ca3] animate-pulse" />
                  </div>
                  <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f0e4cd] text-[13px] font-bold text-[#4e463e]">
                    ml
                  </span>
                </div>
              )}

              {/* Tab 2: 能量瓶（母乳左右侧 + ml/分钟） */}
              {activeFormTab === 'energy' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1">
                      {[
                        { id: 'left' as const, label: '左侧' },
                        { id: 'both' as const, label: '双侧' },
                        { id: 'right' as const, label: '右侧' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setBreastSide(s.id)}
                          className={`rounded-lg px-2.5 py-1 text-[11.5px] font-bold transition-colors ${
                            breastSide === s.id
                              ? 'bg-[#f8cc4b] text-[#182848]'
                              : 'bg-[#efe4ce] text-[#6d6256]'
                          }`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex rounded-lg bg-[#efe4ce] p-0.5 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setBreastUnit('ml')}
                        className={`rounded-md px-2 py-0.5 ${
                          breastUnit === 'ml' ? 'bg-white text-[#182848] shadow-2xs' : 'text-[#6d6256]'
                        }`}
                      >
                        ml
                      </button>
                      <button
                        type="button"
                        onClick={() => setBreastUnit('min')}
                        className={`rounded-md px-2 py-0.5 ${
                          breastUnit === 'min' ? 'bg-white text-[#182848] shadow-2xs' : 'text-[#6d6256]'
                        }`}
                      >
                        分钟
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="w-16 shrink-0 text-[13.5px] font-bold text-[#182848]">
                      {breastUnit === 'ml' ? '母乳量' : '时长'}
                    </span>
                    <div className="flex flex-1 items-center rounded-xl border border-[#e5d8be] bg-[#faf2e1] px-3 py-1.5">
                      <span className="font-typewriter text-[17px] font-bold text-[#182848] tabular-nums">
                        {breastValStr}
                      </span>
                      <span className="ml-0.5 inline-block h-4 w-[1.5px] bg-[#6b7ca3] animate-pulse" />
                    </div>
                    <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f0e4cd] text-[12.5px] font-bold text-[#4e463e]">
                      {breastUnit === 'ml' ? 'ml' : '分'}
                    </span>
                  </div>
                </div>
              )}

              {/* Tab 3: 晨露（辅食 / 营养品） */}
              {activeFormTab === 'dew' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDewSubType('solids');
                        setFoodName('菠菜泥');
                        setFoodQtyStr('30');
                      }}
                      className={`rounded-lg px-2.5 py-1 text-[11.5px] font-bold ${
                        dewSubType === 'solids'
                          ? 'bg-[#f8cc4b] text-[#182848]'
                          : 'bg-[#efe4ce] text-[#6d6256]'
                      }`}
                    >
                      辅食
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDewSubType('supplement');
                        setFoodName('维生素AD');
                        setFoodQtyStr('1');
                      }}
                      className={`rounded-lg px-2.5 py-1 text-[11.5px] font-bold ${
                        dewSubType === 'supplement'
                          ? 'bg-[#f8cc4b] text-[#182848]'
                          : 'bg-[#efe4ce] text-[#6d6256]'
                      }`}
                    >
                      营养品
                    </button>
                    <div className="flex flex-1 gap-1 overflow-x-auto no-scrollbar">
                      {(dewSubType === 'solids'
                        ? ['菠菜泥', '米粉', '南瓜泥']
                        : ['维生素AD', '维生素D3', '益生菌']
                      ).map((chip) => (
                        <button
                          key={chip}
                          type="button"
                          onClick={() => setFoodName(chip)}
                          className={`shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                            foodName === chip
                              ? 'border-amber-500 bg-amber-100 text-[#182848]'
                              : 'border-[#e0d2b8] bg-white/70 text-[#6d6256]'
                          }`}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={foodName}
                      onChange={(e) => setFoodName(e.target.value)}
                      placeholder={dewSubType === 'solids' ? '辅食名称' : '营养品名称'}
                      className="min-w-0 flex-1 rounded-xl border border-[#e5d8be] bg-[#faf2e1] px-2.5 py-1.5 text-[13.5px] font-semibold text-[#182848] focus:outline-none"
                    />
                    <div className="flex w-20 items-center justify-between rounded-xl border border-[#e5d8be] bg-[#faf2e1] px-2.5 py-1.5">
                      <span className="font-typewriter text-[15px] font-bold text-[#182848] tabular-nums">
                        {foodQtyStr}
                      </span>
                      <span className="text-[11.5px] font-semibold text-[#6d6256]">
                        {dewSubType === 'supplement' ? '粒' : 'g'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 喂养时间行 */}
              <div className="flex items-center gap-2.5">
                <span className="w-16 shrink-0 text-[13.5px] font-bold text-[#182848]">
                  喂养时间
                </span>
                <label className="relative flex flex-1 cursor-pointer items-center justify-between rounded-xl border border-[#e5d8be] bg-[#faf2e1] px-3 py-2">
                  <span className="flex items-center gap-1.5 font-typewriter text-[15px] font-semibold text-[#182848] tabular-nums">
                    <Clock className="h-4 w-4 text-[#6d6256]" />
                    <span>{formTime}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-[#8c7f70]" />
                  <input
                    type="time"
                    value={formTime}
                    onChange={(e) => setFormTime(e.target.value)}
                    required
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>

              {/* 备注（可选） */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[12.5px] font-bold text-[#182848]">备注（可选）</span>
                  <Pencil className="h-3.5 w-3.5 text-[#a89a88]" />
                </div>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="记录一下宝宝的状态吧..."
                  className="w-full rounded-xl border border-[#e5d8be] bg-[#f7eedb] px-3 py-2 text-[12.5px] text-[#182848] placeholder:text-[#a89a88] focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 3. 底部手绘数字键盘 + 右侧跨四行暖金 ⭐ 保存 按钮 */}
          <div className="grid grid-cols-[1fr_1fr_1fr_1.06fr] grid-rows-4 gap-2 pt-0.5">
            {['1', '2', '3'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeypadPress(k)}
                className="flex h-[46px] items-center justify-center rounded-[14px] border border-[#e8d9bc] bg-[#fbf3e2] font-typewriter text-[19px] font-bold text-[#182848] shadow-[0_3px_8px_rgba(3,9,26,0.35),inset_0_1px_0_rgba(255,255,255,0.8)] transition-transform active:scale-95"
              >
                {k}
              </button>
            ))}

            {/* 右侧大号跨 4 行 ⭐ 保存 按钮 */}
            <button
              type="submit"
              className="row-span-4 flex flex-col items-center justify-center gap-1.5 rounded-[20px] border-2 border-[#fff2b8]/80 bg-gradient-to-b from-[#fde073] via-[#f9ca44] to-[#f1b429] text-[#182848] shadow-[0_8px_20px_rgba(249,207,76,0.45)] transition-transform hover:brightness-105 active:scale-95"
            >
              <svg viewBox="0 0 36 36" className="h-8 w-8 drop-shadow-xs" fill="none" aria-hidden="true">
                <path
                  d="M18 4L21.8 12.6L31 13.4L24 19.6L26.2 28.8L18 23.8L9.8 28.8L12 19.6L5 13.4L14.2 12.6L18 4Z"
                  stroke="#fffef5"
                  strokeWidth="2.2"
                  fill="#fde68a"
                  fillOpacity="0.45"
                  strokeLinejoin="round"
                />
                <path d="M18 11V21M14 16H22" stroke="#fffef5" strokeWidth="1.3" strokeLinecap="round" opacity="0.7" />
              </svg>
              <span className="text-[16px] font-extrabold tracking-widest">保存</span>
            </button>

            {['4', '5', '6', '7', '8', '9', '.', '0', 'back'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeypadPress(k)}
                className="flex h-[46px] items-center justify-center rounded-[14px] border border-[#e8d9bc] bg-[#fbf3e2] font-typewriter text-[19px] font-bold text-[#182848] shadow-[0_3px_8px_rgba(3,9,26,0.35),inset_0_1px_0_rgba(255,255,255,0.8)] transition-transform active:scale-95"
              >
                {k === 'back' ? (
                  <Delete className="h-5 w-5 text-[#5a5046]" />
                ) : k === '.' ? (
                  '·'
                ) : (
                  k
                )}
              </button>
            ))}
          </div>
        </form>
      )}

      {/* =================================================================
          3.2 喂养·空状态 (1:1 还原设计图第二屏)
         ================================================================= */}
      {mode !== 'form' && (isEmptyView || (!showAllRecords && dayFeedings.length === 0)) && (
        <div
          style={{ minHeight: 'calc(var(--app-viewport-h) - 54px - var(--safe-top))' }}
          className="relative z-10 flex flex-1 flex-col justify-between px-4 pb-3 pt-1"
        >
          <div>
            {renderRangePills()}

            {/* 空状态折线图玻璃卡片 */}
            <div className="relative mt-4 rounded-[22px] border border-white/12 bg-[#122452]/62 px-4 pb-6 pt-3.5 shadow-[0_12px_28px_rgba(3,9,28,0.46)] backdrop-blur-md">
              <div className="flex items-center gap-4 text-[12px] font-medium text-indigo-100/90">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#5cbcff] shadow-[0_0_6px_#5cbcff]" />
                  奶量 (ml)
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#f8cb46] shadow-[0_0_6px_#f8cb46]" />
                  顿数 (次)
                </span>
              </div>

              <div className="mt-5 flex flex-col items-center text-center">
                <img
                  src="/assets/extracted/feed_ringed_planet.png"
                  alt="休眠中的小星球"
                  referrerPolicy="no-referrer"
                  className="h-14 w-auto animate-float-slow object-contain opacity-90"
                />
                <p className="mt-3 text-[13.5px] font-medium leading-relaxed text-indigo-100/90">
                  还没有喂养记录哦～
                  <br />
                  快来记录宝宝的第一次吧！
                </p>
              </div>

              <img
                src="/assets/extracted/feed_glow_star.png"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute bottom-5 right-4 h-6 w-6 object-contain drop-shadow-[0_0_8px_rgba(253,224,71,0.8)]"
              />
            </div>
          </div>

          {/* 巨大空玻璃奶瓶 + 熟睡小男孩与巴哥犬 + 底部暖金 CTA */}
          <div className="relative -mx-4 mt-3 flex flex-col items-center">
            <AssetSlot slotName="empty_feeding_bottle" showSlotTag={showSlotTag} className="w-full">
              <img
                src="/assets/extracted/feed_empty_bottle.png"
                alt="巨大空玻璃奶瓶与小男孩和巴哥犬"
                referrerPolicy="no-referrer"
                className="mx-auto w-[96%] max-w-[376px] object-contain"
              />
            </AssetSlot>

            <button
              type="button"
              onClick={() => onChangeMode('form')}
              className="absolute bottom-4 flex min-h-[46px] items-center justify-center gap-2 rounded-full border-2 border-[#fff3bd]/80 bg-gradient-to-b from-[#fde074] to-[#f2b830] px-7 py-2.5 text-[14.5px] font-extrabold text-[#182848] shadow-[0_8px_22px_rgba(249,207,76,0.5)] transition-transform hover:brightness-105 active:scale-95"
            >
              <Camera className="h-4.5 w-4.5 stroke-[2.4]" />
              <span>去记录第一条喂养</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================
          3.1 喂养·数据与时间线 (1:1 还原设计图第一屏)
         ================================================================= */}
      {mode === 'timeline' && !isEmptyView && (showAllRecords || dayFeedings.length > 0) && (
        <div
          style={{ minHeight: 'calc(var(--app-viewport-h) - 54px - var(--safe-top))' }}
          className="relative z-10 flex flex-1 flex-col justify-between px-4 pt-1"
        >
          <div className="space-y-4">
            {renderRangePills()}

            {/* 深蓝磨砂双 Y 轴折线图卡片 */}
            <div className="relative rounded-[22px] border border-white/12 bg-[#122452]/65 px-3.5 pb-2.5 pt-3 shadow-[0_12px_28px_rgba(3,9,28,0.46)] backdrop-blur-md">
              {/* 右上角点缀发光大星星 */}
              <img
                src="/assets/extracted/feed_glow_star.png"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -right-1.5 -top-3.5 h-9 w-9 object-contain drop-shadow-[0_0_10px_rgba(253,224,71,0.9)]"
              />

              {/* 图例 */}
              <div className="mb-1 flex items-center justify-between pr-6 text-[11.5px] font-medium text-indigo-100/90">
                <div className="flex items-center gap-3.5">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#5cbcff] shadow-[0_0_6px_#5cbcff]" />
                    奶量 (ml)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#f8cb46] shadow-[0_0_6px_#f8cb46]" />
                    顿数 (次)
                  </span>
                </div>
                <span className="font-typewriter text-[11px] text-amber-200/85 tabular-nums">
                  {selectedDate.slice(5).replace('-', '/')}
                </span>
              </div>

              {/* 双 Y 轴平滑曲线 SVG */}
              <svg
                viewBox={`0 0 ${svgW} ${svgH}`}
                className="h-[144px] w-full select-none"
                role="img"
                aria-label="奶量与顿数双Y轴折线图"
              >
                {/* 横向柔和网格线 + 左右双刻度 */}
                {[0, 1 / 3, 2 / 3, 1].map((ratio, idx) => {
                  const y = padT + plotH * (1 - ratio);
                  const mlTick = Math.round(maxMl * ratio);
                  const cntTick = Math.round(1 + (maxCount - 1) * ratio);
                  return (
                    <g key={idx}>
                      <line
                        x1={padL}
                        y1={y}
                        x2={svgW - padR}
                        y2={y}
                        stroke="rgba(255,255,255,0.14)"
                        strokeWidth="0.8"
                      />
                      <text
                        x={padL - 6}
                        y={y + 3.5}
                        textAnchor="end"
                        fontSize="10"
                        fill="rgba(235,242,255,0.85)"
                      >
                        {mlTick}
                      </text>
                      <text
                        x={svgW - padR + 7}
                        y={y + 3.5}
                        textAnchor="start"
                        fontSize="10"
                        fill="rgba(255,243,205,0.85)"
                      >
                        {idx === 0 ? 1 : cntTick}
                      </text>
                    </g>
                  );
                })}

                {/* 蓝色平滑曲线（奶量） */}
                <path
                  d={mlPath}
                  fill="none"
                  stroke="#5cbcff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* 暖金色平滑曲线（顿数） */}
                <path
                  d={countPath}
                  fill="none"
                  stroke="#f8cb46"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* 数据节点与 X 轴日期（点击切换当日记录） */}
                {mlPoints.map((pt, idx) => {
                  const cPt = countPoints[idx];
                  const isActive = pt.date === selectedDate;
                  return (
                    <g
                      key={pt.date}
                      onClick={() => {
                        setSelectedDate(pt.date);
                        setShowAllRecords(false);
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isActive ? 4.5 : 3.2}
                        fill="#7dd3fc"
                        stroke="#ffffff"
                        strokeWidth="1.2"
                      />
                      {/* 金色小星芒节点 */}
                      <circle
                        cx={cPt.x}
                        cy={cPt.y}
                        r={isActive ? 4.5 : 3.2}
                        fill="#fde047"
                        stroke="#fffbeb"
                        strokeWidth="1"
                      />
                      <text
                        x={pt.x}
                        y={svgH - 6}
                        textAnchor="middle"
                        fontSize="9.5"
                        fontWeight={isActive ? '700' : '500'}
                        fill={isActive ? '#fde047' : 'rgba(226,232,240,0.75)'}
                      >
                        {pt.short}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* 米白撕纸「⭐ 喂养记录」时间线卡片 */}
            <section aria-label="喂养记录时间线" className="diary-paper-card px-1.5 py-1">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <img
                    src="/assets/extracted/feed_glow_star.png"
                    alt=""
                    aria-hidden="true"
                    className="h-6 w-6 object-contain"
                  />
                  <h2 className="text-[15px] font-bold tracking-wide text-[#182848]">
                    喂养记录
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeMode('form')}
                    className="inline-flex items-center gap-0.5 rounded-full bg-[#f9cf4c] px-2.5 py-1 text-[11.5px] font-bold text-[#182848] shadow-2xs transition-transform active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[2.8]" />
                    <span>记一顿</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAllRecords((v) => !v)}
                    className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-[#6a5d4f] hover:text-[#182848]"
                  >
                    <span>{showAllRecords ? '仅当日' : '全部'}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* 竖向虚线时间轴记录列表 */}
              <div className="relative pl-4">
                {/* 左侧贯通金色虚线时间轴 */}
                {dayFeedings.length > 1 && (
                  <div
                    className="pointer-events-none absolute bottom-5 left-[5px] top-4 border-l border-dashed border-[#d4be92]"
                    aria-hidden="true"
                  />
                )}

                <div className="space-y-2.5">
                  {dayFeedings.map((item) => (
                    <div
                      key={item.id}
                      className="group relative flex items-center justify-between gap-2 py-0.5"
                    >
                      {/* 金色时间轴节点圆点 */}
                      <span
                        className="absolute -left-[15px] h-2.5 w-2.5 rounded-full bg-[#f6be34] ring-2 ring-[#fbf3e1]"
                        aria-hidden="true"
                      />

                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <span className="w-[42px] shrink-0 font-typewriter text-[13.5px] font-semibold text-[#1c2d50] tabular-nums">
                          {item.time}
                        </span>

                        {renderFeedingIcon(item.type)}

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13.5px] font-semibold text-[#182848]">
                            {formatRecordSummary(item)}
                          </div>
                          {item.note && (
                            <div className="truncate text-[11px] text-[#7a6f62]">{item.note}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <span className="rounded-full bg-[#efe4ce] px-2.5 py-0.5 text-[11px] font-semibold text-[#6d5f4e] tabular-nums">
                          1次
                        </span>
                        <button
                          type="button"
                          onClick={() => onDeleteFeeding(item.id)}
                          aria-label="删除喂养记录"
                          className="flex h-6 w-6 items-center justify-center rounded-md text-[#b2a18c] opacity-65 transition-colors hover:bg-rose-50 hover:text-rose-600 hover:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* 底部趴星球托腮小男孩与巴哥犬插画 (自然融入星空底色) */}
          <div className="pointer-events-none relative -mx-4 mt-3 overflow-hidden">
            <img
              src="/assets/extracted/feed_boy_pug_planet.png"
              alt="趴在星球上的小男孩与巴哥犬"
              referrerPolicy="no-referrer"
              style={{
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 100%)',
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 100%)',
              }}
              className="w-full h-auto object-cover"
            />
          </div>
        </div>
      )}
    </div>
  );
};
