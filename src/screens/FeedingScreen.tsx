import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Delete,
  Droplets,
  Image as ImageIcon,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { FeedingRecord, FeedingType, PlanetAppState } from '../types/planet';
import { getCurrentTimeStr, getTodayDateStr } from '../data/initialData';
import { AssetSlot } from '../components/Illustrations';
import {
  CosmicModuleHeader,
  CosmicSubHeader,
  HandDrawnInfoIcon,
} from '../components/CosmicModuleHeader';
import {
  PaperLogScanSheet,
  PaperScanSheetStatus,
} from '../components/PaperLogScanSheet';
import {
  processFeedingPhotoFile,
  recognizeFeedingPhotoViaApi,
} from '../utils/feedingPhoto';
import { PaperLogDraft } from '../utils/paperLogParser';
import { hapticSuccess } from '../native/iosBridge';

export type FeedingViewMode = 'timeline' | 'empty' | 'form';
type RangeOption = 'day' | 7 | 30 | 90;
type FormTabKey = 'source' | 'energy' | 'dew';

interface FeedingScreenProps {
  state: PlanetAppState;
  currentRecorder: string;
  mode: FeedingViewMode;
  showSlotTag?: boolean;
  onChangeMode: (mode: FeedingViewMode) => void;
  onBackHome: () => void;
  onAddFeeding: (record: FeedingRecord) => void;
  onAddFeedings?: (records: FeedingRecord[]) => void;
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
  currentRecorder,
  mode,
  showSlotTag = false,
  onChangeMode,
  onBackHome,
  onAddFeeding,
  onAddFeedings,
  onDeleteFeeding,
}) => {
  const todayStr = getTodayDateStr();
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateStr());
  const [rangeDays, setRangeDays] = useState<RangeOption>('day');
  const [selectedDayFeedId, setSelectedDayFeedId] = useState<string | null>(null);
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
  const [formRecorder, setFormRecorder] = useState(
    currentRecorder || state.profile.recorders[0] || '妈妈'
  );

  useEffect(() => {
    setFormRecorder(currentRecorder || state.profile.recorders[0] || '妈妈');
  }, [currentRecorder, state.profile.recorders]);

  // 拍照识别纸质记录本（一键拍照 -> Canvas 压缩 -> /api/recognize -> 可编辑核对卡片）
  const [isPaperScanOpen, setIsPaperScanOpen] = useState(false);
  const [paperScanStatus, setPaperScanStatus] = useState<PaperScanSheetStatus>('recognizing');
  const [paperScanPhotoUrl, setPaperScanPhotoUrl] = useState<string | null>(null);
  const [paperScanDrafts, setPaperScanDrafts] = useState<PaperLogDraft[]>([]);
  const [paperScanDetectedDate, setPaperScanDetectedDate] = useState<string | null>(null);
  const [paperScanError, setPaperScanError] = useState<string | null>(null);
  const [importToast, setImportToast] = useState<string | null>(null);
  const [lightboxPhotoUrl, setLightboxPhotoUrl] = useState<string | null>(null);
  const aiScanCameraInputRef = useRef<HTMLInputElement>(null);
  const aiScanAlbumInputRef = useRef<HTMLInputElement>(null);
  const aiScanRequestIdRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = (msg: string) => {
    setImportToast(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setImportToast(null);
    }, 2800);
  };

  const isEmptyView = mode === 'empty';

  // 当天每顿奶量记录（按时间从早到晚排序，用于「当天」每顿奶量对比折线图）
  const dayMilkFeeds = useMemo(() => {
    if (isEmptyView) return [];
    return state.feedings
      .filter(
        (f) => f.date === selectedDate && typeof f.amountMl === 'number' && f.amountMl > 0
      )
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((f, idx) => ({
        ...f,
        feedIndex: idx + 1,
        amountMl: f.amountMl as number,
      }));
  }, [state.feedings, selectedDate, isEmptyView]);

  const dayTotalMilkMl = useMemo(
    () => dayMilkFeeds.reduce((sum, item) => sum + item.amountMl, 0),
    [dayMilkFeeds]
  );

  const dayAvgMilkMl = useMemo(
    () => (dayMilkFeeds.length > 0 ? Math.round(dayTotalMilkMl / dayMilkFeeds.length) : 0),
    [dayMilkFeeds.length, dayTotalMilkMl]
  );

  // 构建 7天 / 30天 / 90天 总奶量与总顿数对比趋势点（固定 7 个均衡节点，便于移动端阅读）
  const chartSeries = useMemo(() => {
    const numericRange = rangeDays === 'day' ? 7 : rangeDays;
    const step = numericRange === 7 ? 1 : numericRange === 30 ? 5 : 15;
    const points: { date: string; short: string; totalMl: number; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const endDate = shiftDate(selectedDate, -i * step);
      const startDate = shiftDate(endDate, -(step - 1));
      const matching = isEmptyView
        ? []
        : state.feedings.filter(
            (f) =>
              f.date >= startDate &&
              f.date <= endDate &&
              f.type !== 'poop' &&
              f.type !== 'pee'
          );

      const totalMl = matching.reduce((sum, r) => sum + (r.amountMl || 0), 0);
      const totalCount = matching.length;

      points.push({
        date: endDate,
        short: endDate.slice(5).replace('-', '/'),
        totalMl,
        count: totalCount,
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

  const dayDiaperSummary = useMemo(() => {
    if (isEmptyView) return { poop: 0, pee: 0 };
    return state.feedings
      .filter((f) => f.date === selectedDate)
      .reduce(
        (acc, item) => {
          if (item.type === 'poop') acc.poop += item.count ?? 1;
          if (item.type === 'pee') acc.pee += item.count ?? 1;
          return acc;
        },
        { poop: 0, pee: 0 }
      );
  }, [state.feedings, selectedDate, isEmptyView]);

  const triggerAiScanCamera = () => {
    aiScanCameraInputRef.current?.click();
  };

  const triggerAiScanAlbum = () => {
    aiScanAlbumInputRef.current?.click();
  };

  const handleClosePaperScan = () => {
    // 递增请求序号，确保已关闭后旧的异步识别响应不会重新覆盖状态
    aiScanRequestIdRef.current += 1;
    setIsPaperScanOpen(false);
  };

  const handleAiScanFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const requestId = ++aiScanRequestIdRef.current;
    setIsPaperScanOpen(true);
    setPaperScanStatus('recognizing');
    setPaperScanError(null);
    setPaperScanDrafts([]);
    setPaperScanDetectedDate(null);
    setPaperScanPhotoUrl(null);

    try {
      const processed = await processFeedingPhotoFile(file);
      if (requestId !== aiScanRequestIdRef.current) return;

      setPaperScanPhotoUrl(processed.previewDataUrl);

      const result = await recognizeFeedingPhotoViaApi(
        processed.recognizeDataUrl,
        processed.exifTime || getCurrentTimeStr(),
        getTodayDateStr()
      );
      if (requestId !== aiScanRequestIdRef.current) return;

      setPaperScanDrafts(result.drafts);
      setPaperScanDetectedDate(result.detectedDate);
      setPaperScanStatus('review');
    } catch (err) {
      if (requestId !== aiScanRequestIdRef.current) return;
      setPaperScanError(
        err instanceof Error ? err.message : '识别纸质记录失败，请重新拍照或检查网络'
      );
      setPaperScanStatus('error');
    }
  };

  const handleConfirmPaperImport = (records: FeedingRecord[], targetDate: string) => {
    if (records.length === 0) return;
    if (onAddFeedings) {
      onAddFeedings(records);
    } else {
      records.forEach((rec) => onAddFeeding(rec));
    }
    setIsPaperScanOpen(false);
    setPaperScanPhotoUrl(null);
    setPaperScanDrafts([]);
    setPaperScanDetectedDate(null);
    setPaperScanError(null);
    if (/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
      setSelectedDate(targetDate);
      setShowAllRecords(false);
    }
    void hapticSuccess();
    onChangeMode('timeline');
    const shortDate = /^\d{4}-\d{2}-\d{2}$/.test(targetDate)
      ? `${targetDate.slice(5).replace('-', '.')} 的 `
      : '';
    showToast(`已成功存入 ${shortDate}${records.length} 条纸质记录`);
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
      recorder: formRecorder || currentRecorder || state.profile.recorders[0] || '妈妈',
      updatedAt: new Date().toISOString(),
      ...extra,
    };

    onAddFeeding(record);
    setFormNote('');
    onChangeMode('timeline');
  };

  // 折线图画布尺寸
  const svgW = 328;
  const svgH = 152;
  const padL = 34;
  const padR = 26;
  const padT = 20;
  const padB = 26;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  // 1) 当天每顿奶量对比折线图坐标
  const maxDayMlRaw = Math.max(150, ...dayMilkFeeds.map((d) => d.amountMl));
  const maxDayMl = Math.ceil(maxDayMlRaw / 30) * 30;
  const dayPlotPadX = dayMilkFeeds.length <= 2 ? 42 : 16;
  const dayUsableW = Math.max(20, plotW - dayPlotPadX * 2);

  const dayFeedPoints = dayMilkFeeds.map((item, idx) => {
    const x =
      dayMilkFeeds.length === 1
        ? padL + plotW / 2
        : padL + dayPlotPadX + (idx / (dayMilkFeeds.length - 1)) * dayUsableW;
    const y = padT + plotH - (item.amountMl / maxDayMl) * plotH;
    return { x, y, ...item };
  });

  const dayFeedPath = buildSmoothPath(dayFeedPoints);
  const dayAreaPath =
    dayFeedPoints.length >= 2
      ? `${dayFeedPath} L ${dayFeedPoints[dayFeedPoints.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${dayFeedPoints[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : '';
  const dayAvgY = padT + plotH - (dayAvgMilkMl / maxDayMl) * plotH;
  const activeDayFeed =
    dayFeedPoints.find((p) => p.id === selectedDayFeedId) ||
    dayFeedPoints[dayFeedPoints.length - 1] ||
    null;

  // 2) 7天 / 30天 / 90天 总奶量与总顿数双 Y 轴折线图坐标
  const maxMlRaw = Math.max(180, ...chartSeries.map((d) => d.totalMl));
  const maxMl = Math.ceil(maxMlRaw / 60) * 60;
  const maxCount = Math.max(3, Math.ceil(Math.max(...chartSeries.map((d) => d.count), 3) / 3) * 3);

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
          src="./assets/extracted/feed_icon_bottle.png"
          alt="配方奶"
          referrerPolicy="no-referrer"
          className="h-7 w-7 shrink-0 object-contain"
        />
      );
    }
    if (type === 'solids') {
      return (
        <img
          src="./assets/extracted/feed_icon_solids.png"
          alt="辅食"
          referrerPolicy="no-referrer"
          className="h-6 w-7 shrink-0 object-contain"
        />
      );
    }
    if (type === 'breast') {
      return (
        <img
          src="./assets/extracted/feed_icon_breast.png"
          alt="母乳"
          referrerPolicy="no-referrer"
          className="h-6.5 w-6.5 shrink-0 object-contain"
        />
      );
    }
    if (type === 'poop') {
      return (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#d7b68a] bg-[#f3e1c3] text-[12px] font-bold text-[#7c3f0e]"
          aria-label="大便"
        >
          便
        </span>
      );
    }
    if (type === 'pee') {
      return (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#9fdaf0] bg-[#ddf4fc] text-[#0b7296]"
          aria-label="小便"
        >
          <Droplets className="h-3.5 w-3.5" />
        </span>
      );
    }
    // 营养品 (维生素/益生菌等)
    return (
      <img
        src="./assets/extracted/icon_sprout.png"
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
    if (item.type === 'poop') {
      return `大便 ${item.count ?? 1}次`;
    }
    if (item.type === 'pee') {
      return `小便 ${item.count ?? 1}次`;
    }
    if (item.amountMl) {
      return `母乳 ${item.amountMl}ml`;
    }
    const sideLabel =
      item.breastSide === 'left' ? '左侧' : item.breastSide === 'right' ? '右侧' : '双侧';
    return `亲喂 ${sideLabel} ${item.durationMin ?? 15}分`;
  };

  const rangeOptions: { key: RangeOption; label: string }[] = [
    { key: 'day', label: '当天' },
    { key: 7, label: '7天' },
    { key: 30, label: '30天' },
    { key: 90, label: '90天' },
  ];

  const renderRangePills = () => (
    <div className="mx-auto mt-1 flex w-full max-w-[296px] items-center rounded-full border border-white/12 bg-[#162754]/75 p-1 shadow-[inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-md">
      {rangeOptions.map((opt, idx) => {
        const active = rangeDays === opt.key;
        const nextOpt = rangeOptions[idx + 1];
        return (
          <React.Fragment key={String(opt.key)}>
            <button
              type="button"
              onClick={() => setRangeDays(opt.key)}
              className={`relative flex-1 rounded-full py-1.5 transition-all ${
                active
                  ? 'bg-gradient-to-b from-[#fde074] to-[#f2b932] typo-tab-active text-[#182848] shadow-[0_2px_12px_rgba(249,207,76,0.55)]'
                  : 'typo-tab text-indigo-100/85 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
            {nextOpt && !active && rangeDays !== nextOpt.key && (
              <span className="h-3.5 w-[1px] bg-white/15" aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const showFullEmptyState =
    isEmptyView || (rangeDays === 'day' && !showAllRecords && dayFeedings.length === 0);

  return (
    <div className="relative flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-clip">
      {/* 顶层隐藏文件输入：确保在任意视图直接调起 iPhone 原生相机 / 相册拍照识别，绝不放在弹窗内 */}
      <input
        ref={aiScanCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleAiScanFileChange}
        className="hidden"
        aria-hidden="true"
      />
      <input
        ref={aiScanAlbumInputRef}
        type="file"
        accept="image/*"
        onChange={handleAiScanFileChange}
        className="hidden"
        aria-hidden="true"
      />

      {/* 宇宙星空底层背景 */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-top opacity-80"
        style={{ backgroundImage: "url('./assets/aistudio/____f8d9ecf9.png')" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#071230]/40 via-[#0a193f]/55 to-[#060f29]/85"
        aria-hidden="true"
      />

      {/* =================================================================
          顶部统一手绘星空导航栏（与「星光碎片」完全一致的视觉风格）
         ================================================================= */}
      {mode === 'form' ? (
        <CosmicSubHeader
          title="记录喂养"
          onBack={() => onChangeMode('timeline')}
          backLabel="返回喂养"
          rightSlot={
            <button
              type="button"
              onClick={() => setShowFormHelp((v) => !v)}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform active:scale-90 ${
                showFormHelp
                  ? 'bg-amber-300/20 text-amber-200'
                  : 'text-[#c5cdfa] hover:bg-white/10'
              }`}
              aria-label="录入说明"
            >
              <HandDrawnInfoIcon />
            </button>
          }
        />
      ) : (
        <CosmicModuleHeader
          title="能量喂养"
          subtitle="奶量与辅食"
          onBack={onBackHome}
          onCalendarClick={() => setShowDateBar((v) => !v)}
          calendarActive={showDateBar}
          calendarLabel="切换日期"
        />
      )}

      {/* 3.3 帮助提示气泡 */}
      {mode === 'form' && showFormHelp && (
        <div className="relative z-20 mx-4 mb-2 rounded-[20px] border border-amber-200/30 bg-[#132552]/92 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-amber-100/95 shadow-[0_10px_24px_rgba(3,8,24,0.4)] backdrop-blur-md">
          <strong>源泉</strong>用于记录配方奶量，<strong>能量瓶</strong>用于母乳（支持瓶喂 ml 或亲喂时长），<strong>晨露</strong>用于辅食与维生素等营养品；点击上方「拍照识别记录本」可直接拍摄保姆手写本，自动识别多条喂奶与大小便记录。
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
          {/* 1. 顶部「拍照识别记录本」快捷卡片 */}
          <div className="space-y-2">
            <div className="relative">
              {/* 左上角点缀发光小黄星 */}
              <img
                src="./assets/extracted/feed_glow_star.png"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -top-3 left-5 z-20 h-7 w-7 object-contain drop-shadow-[0_0_8px_rgba(253,224,71,0.85)]"
              />
              <div className="diary-paper-card flex w-full items-center justify-between gap-2 px-2.5 py-1.5">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <button
                    type="button"
                    onClick={triggerAiScanCamera}
                    className="shrink-0 transition-transform active:scale-95"
                    aria-label="拍照识别纸质记录本"
                  >
                    <AssetSlot slotName="feed_ocr_camera" showSlotTag={showSlotTag} className="shrink-0">
                      <img
                        src="./assets/extracted/feed_icon_camera.png"
                        alt="拍照识别记录本"
                        referrerPolicy="no-referrer"
                        className="h-10 w-11 object-contain"
                      />
                    </AssetSlot>
                  </button>

                  <div
                    onClick={triggerAiScanCamera}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="text-[14.5px] font-bold leading-snug text-[#182848]">
                      拍照识别记录本
                    </div>
                    <div className="truncate text-[11px] text-[#6d6256]">
                      一键拍保姆手写本，自动识别喂奶与大小便
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={triggerAiScanCamera}
                    className="inline-flex items-center gap-1 rounded-full bg-gradient-to-b from-[#fde074] to-[#f4bd36] px-2.5 py-1.5 text-[12px] font-bold text-[#182848] shadow-[0_2px_8px_rgba(244,189,54,0.35)] transition-transform active:scale-95"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>拍照识别</span>
                  </button>
                  <button
                    type="button"
                    onClick={triggerAiScanAlbum}
                    title="从相册选择纸质记录照片识别"
                    aria-label="从相册选择记录本照片识别"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#dfd1b5] bg-[#f7eedc] text-[#4e463e] transition-transform active:scale-95"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
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
                  icon: './assets/extracted/feed_icon_bottle.png',
                },
                {
                  key: 'energy' as FormTabKey,
                  label: '能量瓶',
                  icon: './assets/extracted/feed_tab_energy.png',
                },
                {
                  key: 'dew' as FormTabKey,
                  label: '晨露',
                  icon: './assets/extracted/feed_tab_dew.png',
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

              {/* 喂养人选择行（家庭共同喂养标识） */}
              <div className="flex items-center gap-2.5">
                <span className="w-16 shrink-0 text-[13.5px] font-bold text-[#182848]">
                  喂养人
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {state.profile.recorders.map((rec) => {
                    const active = formRecorder === rec;
                    return (
                      <button
                        key={rec}
                        type="button"
                        onClick={() => setFormRecorder(rec)}
                        className={`shrink-0 rounded-full border px-3 py-1 text-[12px] font-semibold transition-all active:scale-95 ${
                          active
                            ? 'border-[#e0a82e] bg-[#fde074] text-[#182848] shadow-2xs'
                            : 'border-[#e0d2b8] bg-[#faf2e1] text-[#6d6256]'
                        }`}
                      >
                        {rec}
                      </button>
                    );
                  })}
                </div>
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
              <span className="typo-cta tracking-widest">保存</span>
            </button>

            {['4', '5', '6', '7', '8', '9', '.', '0', 'back'].map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => handleKeypadPress(k)}
                className="flex h-[46px] items-center justify-center rounded-[14px] border border-[#e8d9bc] bg-[#fbf3e2] font-typewriter text-[19px] font-semibold text-[#182848] shadow-[0_3px_8px_rgba(3,9,26,0.35),inset_0_1px_0_rgba(255,255,255,0.8)] transition-transform active:scale-95"
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
      {mode !== 'form' && showFullEmptyState && (
        <div
          style={{ minHeight: 'calc(var(--app-viewport-h) - 68px - var(--safe-top))' }}
          className="relative z-10 flex flex-1 flex-col justify-between px-4 pb-3 pt-1"
        >
          <div>
            {renderRangePills()}

            {/* 空状态折线图玻璃卡片 */}
            <div className="relative mt-4 rounded-[22px] border border-white/12 bg-[#122452]/62 px-4 pb-6 pt-3.5 shadow-[0_12px_28px_rgba(3,9,28,0.46)] backdrop-blur-md">
              <div className="flex items-center gap-4 text-[12px] font-medium text-indigo-100/90">
                {rangeDays === 'day' ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#5cbcff] shadow-[0_0_6px_#5cbcff]" />
                    每顿奶量 (ml)
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#5cbcff] shadow-[0_0_6px_#5cbcff]" />
                      总奶量 (ml)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#f8cb46] shadow-[0_0_6px_#f8cb46]" />
                      总顿数 (次)
                    </span>
                  </>
                )}
              </div>

              <div className="mt-5 flex flex-col items-center text-center">
                <img
                  src="./assets/extracted/feed_ringed_planet.png"
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
                src="./assets/extracted/feed_glow_star.png"
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
                src="./assets/extracted/feed_empty_bottle.png"
                alt="巨大空玻璃奶瓶与小男孩和巴哥犬"
                referrerPolicy="no-referrer"
                className="mx-auto w-[96%] max-w-[376px] object-contain"
              />
            </AssetSlot>

            <div className="absolute bottom-4 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => onChangeMode('form')}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border-2 border-[#fff3bd]/80 bg-gradient-to-b from-[#fde074] to-[#f2b830] px-5 py-2.5 typo-cta text-[#182848] shadow-[0_8px_22px_rgba(249,207,76,0.5)] transition-transform hover:brightness-105 active:scale-95"
              >
                <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
                <span>记一顿</span>
              </button>
              <button
                type="button"
                onClick={triggerAiScanCamera}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-amber-200/60 bg-[#142758]/90 px-4 py-2.5 text-[13.5px] font-bold text-amber-100 shadow-[0_8px_22px_rgba(3,9,28,0.5)] backdrop-blur-md transition-transform active:scale-95"
              >
                <Camera className="h-4 w-4 text-amber-300" />
                <span>拍照识别记录本</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          3.1 喂养·数据与时间线（默认优先展示「当天」每顿奶量对比，可切换 7/30/90 天总奶量与总顿数对比）
         ================================================================= */}
      {mode === 'timeline' && !showFullEmptyState && (
        <div
          style={{ minHeight: 'calc(var(--app-viewport-h) - 68px - var(--safe-top))' }}
          className="relative z-10 flex flex-1 flex-col justify-between px-4 pt-1"
        >
          <div className="space-y-4">
            {renderRangePills()}

            {/* 深蓝磨砂折线图卡片 */}
            <div className="relative rounded-[22px] border border-white/12 bg-[#122452]/65 px-3.5 pb-2.5 pt-3 shadow-[0_12px_28px_rgba(3,9,28,0.46)] backdrop-blur-md">
              {/* 右上角点缀发光大星星 */}
              <img
                src="./assets/extracted/feed_glow_star.png"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute -right-1.5 -top-3.5 h-9 w-9 object-contain drop-shadow-[0_0_10px_rgba(253,224,71,0.9)]"
              />

              {rangeDays === 'day' ? (
                <>
                  {/* 当天模式图例：每顿奶量对比 + 当日汇总 */}
                  <div className="mb-1 flex items-center justify-between gap-2 pr-6 text-[11.5px] font-medium text-indigo-100/90">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="inline-flex shrink-0 items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#5cbcff] shadow-[0_0_6px_#5cbcff]" />
                        每顿奶量 (ml)
                      </span>
                      {dayMilkFeeds.length > 0 && (
                        <span className="truncate font-typewriter text-[11px] text-amber-200/90 tabular-nums">
                          共{dayMilkFeeds.length}顿 · {dayTotalMilkMl}ml
                        </span>
                      )}
                    </div>
                    <span className="shrink-0 font-typewriter text-[11px] text-amber-200/85 tabular-nums">
                      {selectedDate.slice(5).replace('-', '/')}
                    </span>
                  </div>

                  {dayFeedPoints.length === 0 ? (
                    <div className="flex h-[144px] flex-col items-center justify-center text-center">
                      <p className="typo-meta text-indigo-100/85">
                        当天暂无带毫升数 (ml) 的奶量记录
                      </p>
                      <p className="mt-1 typo-badge text-indigo-200/70">
                        记一顿配方奶或瓶喂母乳后，将自动展示每顿奶量对比曲线
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* 当天每顿奶量平滑曲线 SVG */}
                      <svg
                        viewBox={`0 0 ${svgW} ${svgH}`}
                        className="h-[148px] w-full select-none"
                        role="img"
                        aria-label="当天每顿奶量对比折线图"
                      >
                        <defs>
                          <linearGradient id="dayMilkAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#5cbcff" stopOpacity="0.34" />
                            <stop offset="100%" stopColor="#5cbcff" stopOpacity="0.02" />
                          </linearGradient>
                        </defs>

                        {/* 横向柔和网格线 + 左侧奶量刻度 */}
                        {[0, 1 / 3, 2 / 3, 1].map((ratio, idx) => {
                          const y = padT + plotH * (1 - ratio);
                          const mlTick = Math.round(maxDayMl * ratio);
                          return (
                            <g key={idx}>
                              <line
                                x1={padL}
                                y1={y}
                                x2={svgW - 14}
                                y2={y}
                                stroke="rgba(255,255,255,0.13)"
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
                            </g>
                          );
                        })}

                        {/* 多顿均值参考虚线 */}
                        {dayFeedPoints.length >= 2 && (
                          <g>
                            <line
                              x1={padL}
                              y1={dayAvgY}
                              x2={svgW - 14}
                              y2={dayAvgY}
                              stroke="rgba(253,224,71,0.45)"
                              strokeWidth="1"
                              strokeDasharray="3 3"
                            />
                            <text
                              x={svgW - 15}
                              y={Math.max(padT + 9, dayAvgY - 4)}
                              textAnchor="end"
                              fontSize="9"
                              fill="rgba(254,240,138,0.88)"
                            >
                              均 {dayAvgMilkMl}ml
                            </text>
                          </g>
                        )}

                        {/* 渐变面积填充 */}
                        {dayAreaPath && <path d={dayAreaPath} fill="url(#dayMilkAreaGrad)" />}

                        {/* 蓝色平滑奶量折线 */}
                        {dayFeedPoints.length >= 2 && (
                          <path
                            d={dayFeedPath}
                            fill="none"
                            stroke="#5cbcff"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}

                        {/* 每一顿数据节点 + 上方毫升数 + 下方时间轴 */}
                        {dayFeedPoints.map((pt) => {
                          const isActive = activeDayFeed?.id === pt.id;
                          return (
                            <g
                              key={pt.id}
                              onClick={() => setSelectedDayFeedId(pt.id)}
                              className="cursor-pointer"
                            >
                              {isActive && (
                                <circle
                                  cx={pt.x}
                                  cy={pt.y}
                                  r={8}
                                  fill="rgba(253,224,71,0.22)"
                                />
                              )}
                              <circle
                                cx={pt.x}
                                cy={pt.y}
                                r={isActive ? 4.8 : 3.6}
                                fill={isActive ? '#fde047' : '#7dd3fc'}
                                stroke="#ffffff"
                                strokeWidth="1.4"
                              />
                              <text
                                x={pt.x}
                                y={Math.max(11, pt.y - 8)}
                                textAnchor="middle"
                                fontSize="9.5"
                                fontWeight={isActive ? '600' : '500'}
                                fill={isActive ? '#fde047' : '#e0f2fe'}
                              >
                                {pt.amountMl}
                              </text>
                              <text
                                x={pt.x}
                                y={svgH - 6}
                                textAnchor="middle"
                                fontSize="9.5"
                                fontWeight={isActive ? '600' : '400'}
                                fill={isActive ? '#fde047' : 'rgba(226,232,240,0.78)'}
                              >
                                {pt.time}
                              </text>
                            </g>
                          );
                        })}
                      </svg>

                      {/* 当前选中顿次读数摘要条 */}
                      {activeDayFeed && (
                        <div className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-2.5 py-1.5 typo-badge text-indigo-100/90">
                          <span className="truncate">
                            第 {activeDayFeed.feedIndex} 顿 · {activeDayFeed.time} ·{' '}
                            {activeDayFeed.type === 'formula' ? '配方奶' : '母乳瓶喂'}
                          </span>
                          <span className="shrink-0 font-typewriter typo-num text-amber-200">
                            {activeDayFeed.amountMl} ml
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <>
                  {/* 7天 / 30天 / 90天 图例：总奶量与总顿数对比 */}
                  <div className="mb-1 flex items-center justify-between pr-6 text-[11.5px] font-medium text-indigo-100/90">
                    <div className="flex items-center gap-3.5">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#5cbcff] shadow-[0_0_6px_#5cbcff]" />
                        总奶量 (ml)
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#f8cb46] shadow-[0_0_6px_#f8cb46]" />
                        总顿数 (次)
                      </span>
                    </div>
                    <span className="font-typewriter text-[11px] text-amber-200/85 tabular-nums">
                      近{rangeDays}天
                    </span>
                  </div>

                  {/* 双 Y 轴平滑曲线 SVG */}
                  <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="h-[148px] w-full select-none"
                    role="img"
                    aria-label="总奶量与总顿数双Y轴折线图"
                  >
                    {/* 横向柔和网格线 + 左右双刻度 */}
                    {[0, 1 / 3, 2 / 3, 1].map((ratio, idx) => {
                      const y = padT + plotH * (1 - ratio);
                      const mlTick = Math.round(maxMl * ratio);
                      const cntTick = Math.round(maxCount * ratio);
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
                            {cntTick}
                          </text>
                        </g>
                      );
                    })}

                    {/* 蓝色平滑曲线（总奶量） */}
                    <path
                      d={mlPath}
                      fill="none"
                      stroke="#5cbcff"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* 暖金色平滑曲线（总顿数） */}
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
                            fontWeight={isActive ? '600' : '400'}
                            fill={isActive ? '#fde047' : 'rgba(226,232,240,0.75)'}
                          >
                            {pt.short}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </>
              )}
            </div>

            {/* 米白撕纸「⭐ 喂养记录」时间线卡片 */}
            <section aria-label="喂养记录时间线" className="diary-paper-card px-1.5 py-1">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <img
                    src="./assets/extracted/feed_glow_star.png"
                    alt=""
                    aria-hidden="true"
                    className="h-6 w-6 object-contain"
                  />
                  <h2 className="typo-section-title text-[#182848]">
                    喂养记录
                  </h2>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={triggerAiScanCamera}
                    className="inline-flex items-center gap-1 rounded-full border border-[#decba7] bg-[#fffaf0] px-2.5 py-1 typo-badge font-semibold text-[#182848] shadow-2xs transition-transform active:scale-95"
                  >
                    <Camera className="h-3.5 w-3.5 text-[#d97706]" />
                    <span>拍照识别记录本</span>
                  </button>
                  <button
                    type="button"
                    onClick={triggerAiScanAlbum}
                    title="从相册选图识别"
                    aria-label="从相册选择记录本照片识别"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#decba7] bg-[#fffaf0] text-[#7a5b28] shadow-2xs transition-transform active:scale-95"
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeMode('form')}
                    className="inline-flex items-center gap-0.5 rounded-full bg-[#f9cf4c] px-2.5 py-1 typo-badge font-semibold text-[#182848] shadow-2xs transition-transform active:scale-95"
                  >
                    <Plus className="h-3.5 w-3.5 stroke-[2.4]" />
                    <span>记一顿</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAllRecords((v) => !v)}
                    className="inline-flex items-center gap-0.5 pl-0.5 typo-meta font-medium text-[#6a5d4f] hover:text-[#182848]"
                  >
                    <span>{showAllRecords ? '仅当日' : '全部'}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* 当日大小便统计摘要（有记录时展示） */}
              {(dayDiaperSummary.poop > 0 || dayDiaperSummary.pee > 0) && !showAllRecords && (
                <div className="mb-2.5 flex flex-wrap items-center gap-1.5 px-1">
                  {dayDiaperSummary.poop > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#dfc39a] bg-[#f7ead4] px-2.5 py-0.5 text-[11px] font-semibold text-[#7c3f0e]">
                      大便 {dayDiaperSummary.poop} 次
                    </span>
                  )}
                  {dayDiaperSummary.pee > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#a9dcf0] bg-[#e2f5fc] px-2.5 py-0.5 text-[11px] font-semibold text-[#0b7296]">
                      小便 {dayDiaperSummary.pee} 次
                    </span>
                  )}
                </div>
              )}

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
                        <span className="w-[42px] shrink-0 font-typewriter typo-item-title text-[#1c2d50] tabular-nums">
                          {item.time}
                        </span>

                        {renderFeedingIcon(item.type)}

                        <div className="min-w-0 flex-1">
                          <div className="truncate typo-item-title text-[#182848]">
                            {formatRecordSummary(item)}
                          </div>
                          {item.note && (
                            <div className="truncate typo-meta text-[#7a6f62]">{item.note}</div>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        {item.photoUrl && (
                          <button
                            type="button"
                            onClick={() => setLightboxPhotoUrl(item.photoUrl || null)}
                            aria-label="查看喂养记录照片"
                            className="h-7 w-7 overflow-hidden rounded-lg border border-[#dcc9a4] bg-[#f4ead5] shadow-2xs transition-transform active:scale-95"
                          >
                            <img
                              src={item.photoUrl}
                              alt="喂养照片"
                              className="h-full w-full object-cover"
                            />
                          </button>
                        )}
                        <span className="rounded-full bg-[#efe4ce] px-2.5 py-0.5 typo-badge text-[#6d5f4e]">
                          {item.recorder || '妈妈'}
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
              src="./assets/extracted/feed_boy_pug_planet.png"
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

      {/* 拍照识别纸质记录本：加载状态 & 可编辑核对卡片底部抽屉 */}
      <PaperLogScanSheet
        open={isPaperScanOpen}
        status={paperScanStatus}
        selectedDate={selectedDate}
        detectedDate={paperScanDetectedDate}
        recorder={formRecorder || currentRecorder || state.profile.recorders[0] || '妈妈'}
        photoDataUrl={paperScanPhotoUrl}
        initialDrafts={paperScanDrafts}
        errorMessage={paperScanError}
        onClose={handleClosePaperScan}
        onRetakeCamera={triggerAiScanCamera}
        onPickAlbum={triggerAiScanAlbum}
        onSwitchToReview={() => setPaperScanStatus('review')}
        onConfirmImport={handleConfirmPaperImport}
      />

      {/* 存入成功轻提示 Toast */}
      {importToast && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-4 top-[calc(var(--header-top-pad,20px)+12px)] z-[60] flex justify-center"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-[#152855]/95 px-4 py-2 text-[13px] font-semibold text-amber-100 shadow-[0_10px_28px_rgba(3,8,24,0.55)] backdrop-blur-md">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#6ca651] text-white">
              <Check className="h-3.5 w-3.5 stroke-[3]" />
            </span>
            <span>{importToast}</span>
          </div>
        </div>
      )}

      {/* 拍摄/已附照片全屏放大预览 */}
      {lightboxPhotoUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/82 p-4 backdrop-blur-xs"
          onClick={() => setLightboxPhotoUrl(null)}
        >
          <button
            type="button"
            onClick={() => setLightboxPhotoUrl(null)}
            aria-label="关闭照片预览"
            className="absolute right-4 top-[var(--header-top-pad,calc(env(safe-area-inset-top,0px)+20px))] flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md transition-transform active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightboxPhotoUrl}
            alt="喂养记录照片原图预览"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[82vh] max-w-full rounded-2xl border border-white/15 object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
