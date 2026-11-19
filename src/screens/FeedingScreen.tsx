import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Baby,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Delete,
  Droplets,
  Milk,
  Plus,
  Trash2,
  Utensils,
} from 'lucide-react';
import { FeedingRecord, FeedingType, PlanetAppState } from '../types/planet';
import { REFERENCE_TODAY } from '../data/initialData';
import { AssetSlot, EmptyGlassBottleIllustration, IconBottle } from '../components/Illustrations';

export type FeedingViewMode = 'timeline' | 'empty' | 'form';

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

export const FeedingScreen: React.FC<FeedingScreenProps> = ({
  state,
  mode,
  showSlotTag = false,
  onChangeMode,
  onBackHome,
  onAddFeeding,
  onDeleteFeeding,
}) => {
  const [selectedDate, setSelectedDate] = useState(REFERENCE_TODAY);
  const [activeChartDay, setActiveChartDay] = useState<string>(REFERENCE_TODAY);

  // 3.3 新建表单状态
  const [feedType, setFeedType] = useState<FeedingType>('formula');
  const [formTime, setFormTime] = useState('16:30');
  const [formRecorder, setFormRecorder] = useState(state.profile.recorders[0] || '妈妈');
  const [mlStr, setMlStr] = useState('150');
  const [breastSide, setBreastSide] = useState<'left' | 'right' | 'both'>('both');
  const [durationMin, setDurationMin] = useState('18');
  const [foodName, setFoodName] = useState('强化铁米粉糊');
  const [foodAmount, setFoodAmount] = useState('30g');

  // OCR 识图反馈状态
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'scanning' | 'done'>('idle');
  const [ocrResultText, setOcrResultText] = useState('');
  const ocrFileRef = useRef<HTMLInputElement>(null);

  const isEmptyView = mode === 'empty';

  // 近 7 天双 Y 轴趋势数据
  const chartSeries = useMemo(() => {
    const days: { date: string; short: string; totalMl: number; count: number }[] = [];
    for (let i = -6; i <= 0; i++) {
      const dStr = shiftDate(selectedDate, i);
      const dayRecords = isEmptyView ? [] : state.feedings.filter((f) => f.date === dStr);
      const totalMl = dayRecords.reduce((sum, r) => sum + (r.amountMl || 0), 0);
      days.push({
        date: dStr,
        short: dStr.slice(5).replace('-', '/'),
        totalMl,
        count: dayRecords.length,
      });
    }
    return days;
  }, [state.feedings, selectedDate, isEmptyView]);

  const dayFeedings = useMemo(() => {
    if (isEmptyView) return [];
    return state.feedings
      .filter((f) => f.date === selectedDate)
      .sort((a, b) => b.time.localeCompare(a.time));
  }, [state.feedings, selectedDate, isEmptyView]);

  const todayStats = useMemo(() => {
    const totalMl = dayFeedings.reduce((s, r) => s + (r.amountMl || 0), 0);
    const totalCount = dayFeedings.length;
    return { totalMl, totalCount };
  }, [dayFeedings]);

  const triggerOcrSimulation = () => {
    setOcrStatus('scanning');
    setTimeout(() => {
      setOcrStatus('done');
      setFeedType('formula');
      setMlStr('160');
      setFormTime('16:20');
      setOcrResultText('已识别奶瓶刻度与水单：能量瓶（配方奶）160 ml · 16:20');
    }, 650);
  };

  const handleKeypadPress = (key: string) => {
    const setter = feedType === 'formula' ? setMlStr : setDurationMin;
    setter((prev) => {
      if (key === 'clear') return '0';
      if (key === 'back') return prev.length <= 1 ? '0' : prev.slice(0, -1);
      const next = prev === '0' ? key : `${prev}${key}`;
      return next.length > 3 ? prev : next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const record: FeedingRecord = {
      id: `feed-${Date.now()}`,
      date: selectedDate,
      time: formTime,
      type: feedType,
      recorder: formRecorder,
      ...(feedType === 'breast'
        ? { breastSide, durationMin: Math.max(1, parseInt(durationMin || '15', 10)) }
        : {}),
      ...(feedType === 'formula'
        ? { amountMl: Math.max(10, parseInt(mlStr || '120', 10)) }
        : {}),
      ...(feedType === 'solids'
        ? { foodName: foodName.trim() || '营养辅食', foodAmount: foodAmount.trim() || '1 勺' }
        : {}),
    };
    onAddFeeding(record);
    setOcrStatus('idle');
    onChangeMode('timeline');
  };

  // 双 Y 轴折线图绘制坐标计算
  const maxMl = Math.max(700, ...chartSeries.map((d) => d.totalMl + 100));
  const maxCount = Math.max(8, ...chartSeries.map((d) => d.count + 2));
  const svgW = 320;
  const svgH = 140;
  const padL = 34;
  const padR = 28;
  const padT = 18;
  const padB = 26;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const mlPoints = chartSeries.map((d, idx) => {
    const x = padL + (idx / (chartSeries.length - 1)) * plotW;
    const y = padT + plotH - (d.totalMl / maxMl) * plotH;
    return { x, y, ...d };
  });

  const countPoints = chartSeries.map((d, idx) => {
    const x = padL + (idx / (chartSeries.length - 1)) * plotW;
    const y = padT + plotH - (d.count / maxCount) * plotH;
    return { x, y, ...d };
  });

  const mlPath = mlPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const countPath = countPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

  const renderTypeBadge = (type: FeedingType) => {
    if (type === 'breast') {
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 border border-amber-200">
          <Droplets className="h-5 w-5" />
        </div>
      );
    }
    if (type === 'formula') {
      return (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700 border border-sky-200">
          <Milk className="h-5 w-5" />
        </div>
      );
    }
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200">
        <Utensils className="h-5 w-5" />
      </div>
    );
  };

  return (
    <div className="flex min-h-full flex-col pb-6">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-20 flex h-[56px] items-center justify-between bg-[#09132e]/85 px-4 backdrop-blur-md">
        <button
          type="button"
          onClick={mode === 'form' ? () => onChangeMode('timeline') : onBackHome}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-indigo-100 hover:bg-white/10 active:scale-95"
          aria-label="返回"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 font-display text-xl tracking-wide text-amber-100">
            <IconBottle className="h-5 w-5" />
            <span>能量补给</span>
          </div>
          <div className="text-[11px] text-indigo-200/75">
            {mode === 'form' ? '新建能量记录' : '喂养趋势与时间线'}
          </div>
        </div>

        {mode !== 'form' ? (
          <button
            type="button"
            onClick={() => onChangeMode('form')}
            className="flex min-h-[40px] items-center gap-1 rounded-xl bg-amber-300 px-3 text-xs font-bold text-slate-900 shadow-sm active:scale-95 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>记一顿</span>
          </button>
        ) : (
          <div className="w-[44px]" />
        )}
      </header>

      {/* 3.3 新建录入表单 */}
      {mode === 'form' && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 px-4 pt-2">
          {/* 顶部 OCR 拍照按钮与识别结果反馈条 */}
          <div className="paper-card p-3.5">
            <input
              ref={ocrFileRef}
              type="file"
              accept="image/*"
              onChange={triggerOcrSimulation}
              className="hidden"
            />
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#2d251e]">OCR 拍照识图录入</div>
                <div className="text-[11px] text-[#6e6052]">对准奶瓶刻度或手写纸条自动识别</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={triggerOcrSimulation}
                  className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#1b336b] px-3 text-xs font-semibold text-amber-100 active:scale-95 whitespace-nowrap"
                >
                  <Camera className="h-4 w-4" />
                  <span>{ocrStatus === 'scanning' ? '识别中…' : '拍照识别'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => ocrFileRef.current?.click()}
                  className="min-h-[40px] rounded-xl border border-[#d6c4a9] bg-white px-2.5 text-xs font-semibold text-[#5a4c3e]"
                >
                  传图
                </button>
              </div>
            </div>

            {/* 识别结果反馈条 */}
            {ocrStatus !== 'idle' && (
              <div
                className={`mt-2.5 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium ${
                  ocrStatus === 'scanning'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-emerald-100 text-emerald-900'
                }`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  {ocrStatus === 'scanning'
                    ? '正在解析图像中的刻度与时间信息…'
                    : ocrResultText}
                </span>
              </div>
            )}
          </div>

          {/* 源泉 / 能量瓶 / 晨露 三段式切换 Tab */}
          <div className="paper-card p-3.5 space-y-4">
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[#eadcc3] p-1">
              {[
                { id: 'breast' as FeedingType, title: '源泉', sub: '母乳' },
                { id: 'formula' as FeedingType, title: '能量瓶', sub: '配方奶' },
                { id: 'solids' as FeedingType, title: '晨露', sub: '辅食' },
              ].map((tab) => {
                const active = feedType === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setFeedType(tab.id)}
                    className={`flex min-h-[44px] flex-col items-center justify-center rounded-xl py-1.5 transition-all ${
                      active
                        ? 'bg-[#2d251e] text-amber-100 shadow-sm'
                        : 'text-[#6e6052] hover:bg-white/40'
                    }`}
                  >
                    <span className="text-xs font-bold">{tab.title}</span>
                    <span className="text-[10px] opacity-80">{tab.sub}</span>
                  </button>
                );
              })}
            </div>

            {/* 时间与记录人 */}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-[#6e6052]">补给时间</span>
                <input
                  type="time"
                  value={formTime}
                  onChange={(e) => setFormTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#dccbb0] bg-white px-3 py-2 text-sm text-[#2d251e] font-typewriter"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[#6e6052]">记录人</span>
                <select
                  value={formRecorder}
                  onChange={(e) => setFormRecorder(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#dccbb0] bg-white px-3 py-2 text-sm text-[#2d251e]"
                >
                  {state.profile.recorders.map((rec) => (
                    <option key={rec} value={rec}>
                      {rec}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Tab 1: 源泉 (母乳) */}
            {feedType === 'breast' && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'left' as const, label: '左侧' },
                    { id: 'both' as const, label: '双侧' },
                    { id: 'right' as const, label: '右侧' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setBreastSide(s.id)}
                      className={`min-h-[40px] rounded-xl border text-xs font-bold ${
                        breastSide === s.id
                          ? 'border-amber-500 bg-amber-100 text-amber-950'
                          : 'border-[#dccbb0] bg-white/70 text-[#6e6052]'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="rounded-2xl bg-white/90 border border-[#dccbb0] p-3 text-center">
                  <div className="text-xs text-[#6e6052]">亲喂时长</div>
                  <div className="mt-0.5 font-typewriter text-3xl font-bold text-[#2d251e] tabular-nums">
                    {durationMin} <span className="text-sm font-normal">分钟</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: 能量瓶 (配方奶) */}
            {feedType === 'formula' && (
              <div className="space-y-3">
                <div className="rounded-2xl bg-white/90 border border-[#dccbb0] p-3 text-center">
                  <div className="text-xs text-[#6e6052]">能量瓶容量</div>
                  <div className="mt-0.5 font-typewriter text-4xl font-bold text-[#1b336b] tabular-nums">
                    {mlStr} <span className="text-base font-normal text-[#6e6052]">ml</span>
                  </div>
                </div>

                {/* 快捷容量 */}
                <div className="grid grid-cols-4 gap-2">
                  {['90', '120', '150', '180'].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMlStr(val)}
                      className={`min-h-[36px] rounded-xl border text-xs font-bold tabular-nums ${
                        mlStr === val
                          ? 'border-sky-500 bg-sky-100 text-sky-900'
                          : 'border-[#dccbb0] bg-white text-[#5a4c3e]'
                      }`}
                    >
                      {val}ml
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: 晨露 (辅食) */}
            {feedType === 'solids' && (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs font-semibold text-[#6e6052]">辅食名称</span>
                  <input
                    type="text"
                    value={foodName}
                    onChange={(e) => setFoodName(e.target.value)}
                    placeholder="例如：强化铁米粉糊"
                    className="mt-1 w-full rounded-xl border border-[#dccbb0] bg-white px-3 py-2.5 text-sm text-[#2d251e]"
                  />
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['强化铁米粉糊', '南瓜泥', '苹果泥', '猪肝粉'].map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFoodName(item)}
                      className="rounded-lg border border-[#d6c4a9] bg-white/80 px-2.5 py-1 text-xs text-[#5a4c3e] hover:bg-amber-50"
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <label className="block">
                  <span className="text-xs font-semibold text-[#6e6052]">食用分量</span>
                  <input
                    type="text"
                    value={foodAmount}
                    onChange={(e) => setFoodAmount(e.target.value)}
                    placeholder="例如：30g / 2 勺"
                    className="mt-1 w-full rounded-xl border border-[#dccbb0] bg-white px-3 py-2.5 text-sm text-[#2d251e]"
                  />
                </label>
              </div>
            )}

            {/* 展开的数字输入键盘 (用于源泉时长与能量瓶 ml) */}
            {(feedType === 'formula' || feedType === 'breast') && (
              <div className="grid grid-cols-3 gap-2 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleKeypadPress(k)}
                    className="flex min-h-[44px] items-center justify-center rounded-xl border border-[#dccbb0] bg-white/90 text-base font-bold text-[#2d251e] shadow-2xs active:scale-95 tabular-nums"
                  >
                    {k === 'clear' ? (
                      <span className="text-xs text-[#7c6e5f]">清零</span>
                    ) : k === 'back' ? (
                      <Delete className="h-4 w-4 text-[#7c6e5f]" />
                    ) : (
                      k
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onChangeMode('timeline')}
              className="flex-1 min-h-[48px] rounded-2xl border border-white/20 bg-white/10 text-sm font-semibold text-indigo-100 active:scale-95"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-[2] min-h-[48px] rounded-2xl bg-amber-300 text-sm font-bold text-slate-900 shadow-lg active:scale-95"
            >
              确认注入能量
            </button>
          </div>
        </form>
      )}

      {/* 3.1 与 3.2 数据与时间线 / 空状态 */}
      {mode !== 'form' && (
        <div className="flex flex-col gap-3.5 px-4 pt-2">
          {/* 顶部双 Y 轴折线图 */}
          <div className="paper-card p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-[#2d251e]">7 日双轴能量趋势</h2>
                <div className="mt-0.5 flex items-center gap-3 text-[11px] text-[#6e6052]">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-sky-600" />
                    左轴：奶量 (ml)
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    右轴：顿数 (次)
                  </span>
                </div>
              </div>
              {!isEmptyView && (
                <div className="text-right tabular-nums">
                  <div className="text-xs font-bold text-sky-800">{todayStats.totalMl} ml</div>
                  <div className="text-[11px] text-[#6e6052]">{todayStats.totalCount} 顿</div>
                </div>
              )}
            </div>

            <div className="relative rounded-xl bg-white/75 p-2 border border-[#e3d3b8]">
              {isEmptyView ? (
                <div className="flex h-[136px] flex-col items-center justify-center text-center">
                  <span className="text-xs font-semibold text-[#7d6e5e]">双 Y 轴趋势图暂无数据</span>
                  <span className="mt-1 text-[11px] text-[#9b8c7b]">录入能量后将自动绘制奶量与顿数曲线</span>
                </div>
              ) : (
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-[138px]" role="img" aria-label="奶量与顿数双Y轴折线图">
                  {/* 横向网格线 */}
                  {[0, 0.5, 1].map((ratio, idx) => {
                    const y = padT + plotH * (1 - ratio);
                    return (
                      <g key={idx}>
                        <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#e7dcc8" strokeDasharray="3 3" />
                        <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#0369a1">
                          {Math.round(maxMl * ratio)}
                        </text>
                        <text x={svgW - padR + 4} y={y + 3} textAnchor="start" fontSize="9" fill="#b45309">
                          {Math.round(maxCount * ratio)}
                        </text>
                      </g>
                    );
                  })}

                  {/* 奶量折线 */}
                  <path d={mlPath} fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  {/* 顿数折线 */}
                  <path d={countPath} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4 3" strokeLinecap="round" />

                  {/* 数据节点与X轴日期 */}
                  {mlPoints.map((pt, idx) => {
                    const cPt = countPoints[idx];
                    const isActive = pt.date === activeChartDay;
                    return (
                      <g
                        key={pt.date}
                        onClick={() => {
                          setActiveChartDay(pt.date);
                          setSelectedDate(pt.date);
                        }}
                        className="cursor-pointer"
                      >
                        <circle cx={pt.x} cy={pt.y} r={isActive ? 5 : 3.5} fill="#0284c7" stroke="#fff" strokeWidth="1.5" />
                        <circle cx={cPt.x} cy={cPt.y} r={isActive ? 4.5 : 3} fill="#f59e0b" stroke="#fff" strokeWidth="1.5" />
                        <text
                          x={pt.x}
                          y={svgH - 6}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight={isActive ? 'bold' : 'normal'}
                          fill={isActive ? '#1e293b' : '#78716c'}
                        >
                          {pt.short}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>

          {/* 日期切换器 */}
          <div className="flex items-center justify-between rounded-2xl border border-white/15 bg-white/10 px-3 py-2 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftDate(d, -1))}
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl text-amber-100 hover:bg-white/10"
              aria-label="前一天"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="text-center">
              <div className="font-typewriter text-sm font-bold text-amber-100 tabular-nums">
                {selectedDate.replace(/-/g, '.')}
                {selectedDate === REFERENCE_TODAY ? ' · 今日' : ''}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftDate(d, 1))}
              className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-xl text-amber-100 hover:bg-white/10"
              aria-label="后一天"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* 3.2 空状态 OR 3.1 时间线 */}
          {isEmptyView || dayFeedings.length === 0 ? (
            <div className="paper-card flex flex-col items-center px-5 py-7 text-center">
              <AssetSlot slotName="empty_feeding_bottle" showSlotTag={showSlotTag}>
                <EmptyGlassBottleIllustration className="h-44 w-44" />
              </AssetSlot>
              <h3 className="mt-2 font-display text-2xl text-[#2d251e]">能量仓还是空的</h3>
              <p className="mt-1 text-xs text-[#6e6052]">
                {selectedDate.replace(/-/g, '.')} 暂无喂养记录，点击下方按钮注入第一份能量
              </p>
              <button
                type="button"
                onClick={() => onChangeMode('form')}
                className="mt-5 flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-[#1b336b] px-6 py-2.5 text-xs font-bold text-amber-100 active:scale-95"
              >
                <Plus className="h-4 w-4" />
                <span>立即记录喂养</span>
              </button>
            </div>
          ) : (
            <div className="paper-card divide-y divide-[#e4d5bc] px-4 py-2">
              {dayFeedings.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {renderTypeBadge(item.type)}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-typewriter text-sm font-bold text-[#2d251e] tabular-nums">
                          {item.time}
                        </span>
                        <span className="text-xs font-semibold text-[#5e5042]">
                          {item.type === 'breast'
                            ? '源泉（母乳）'
                            : item.type === 'formula'
                            ? '能量瓶（配方奶）'
                            : '晨露（辅食）'}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-[#6e6052] truncate tabular-nums">
                        {item.type === 'breast' &&
                          `${
                            item.breastSide === 'left'
                              ? '左侧'
                              : item.breastSide === 'right'
                              ? '右侧'
                              : '双侧'
                          } · ${item.durationMin} 分钟`}
                        {item.type === 'formula' && `奶量 ${item.amountMl} ml`}
                        {item.type === 'solids' && `${item.foodName} · ${item.foodAmount}`}
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span>{item.recorder}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteFeeding(item.id)}
                    className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-[#9b8c7b] hover:bg-rose-50 hover:text-rose-700"
                    aria-label="删除此条喂养记录"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
