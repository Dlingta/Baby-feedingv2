import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import {
  GrowthAssessmentResult,
  GrowthBabyProfile,
  GrowthMeasurement,
  GrowthMetricKey,
  ReferenceCurvePoint,
} from '../types/growth';
import {
  buildWhoReferenceCurveSeries,
  normalizeHeightForWhoStandard,
} from '../calculations/lmsCalculator';
import { calculateGrowthAge } from '../calculations/ageCalculator';
import { ReferenceLoadMode } from '../data/whoGrowthStandards';

interface GrowthChartProps {
  metric: GrowthMetricKey;
  profile: GrowthBabyProfile;
  measurements: GrowthMeasurement[];
  assessments: Record<string, GrowthAssessmentResult>;
  selectedMeasurementId: string | null;
  referenceMode: ReferenceLoadMode;
  onSelectMeasurement: (id: string) => void;
  onOpenSettings: () => void;
  onRetryLoadReference?: () => void;
}

const METRIC_META: Record<
  GrowthMetricKey,
  { label: string; fullLabel: string; unit: string; defaultMin: number; defaultMax: number }
> = {
  heightCm: {
    label: '身长/身高',
    fullLabel: '身长 / 身高 (cm)',
    unit: 'cm',
    defaultMin: 45,
    defaultMax: 105,
  },
  weightKg: {
    label: '体重',
    fullLabel: '体重 (kg)',
    unit: 'kg',
    defaultMin: 2,
    defaultMax: 19,
  },
  headCm: {
    label: '头围',
    fullLabel: '头围 (cm)',
    unit: 'cm',
    defaultMin: 31,
    defaultMax: 53,
  },
};

const FULL_MONTH_TICKS = [0, 3, 6, 9, 12, 18, 24, 30, 36];

function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  if (pts.length === 2) {
    return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;
  }

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function starPolygonPoints(cx: number, cy: number, outerR: number, innerR: number): string {
  const coords: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    coords.push(`${(cx + Math.cos(angle) * r).toFixed(1)},${(cy + Math.sin(angle) * r).toFixed(1)}`);
  }
  return coords.join(' ');
}

export const GrowthChart: React.FC<GrowthChartProps> = ({
  metric,
  profile,
  measurements,
  assessments,
  selectedMeasurementId,
  referenceMode,
  onSelectMeasurement,
  onOpenSettings,
  onRetryLoadReference,
}) => {
  const meta = METRIC_META[metric];

  // 视口缩放与平移状态（0～36 月龄窗口，支持触摸左右滑动和缩放按钮）
  const [viewRange, setViewRange] = useState<{ start: number; end: number }>({
    start: 0,
    end: 36,
  });
  const [bubbleVisible, setBubbleVisible] = useState(true);
  const dragStartRef = useRef<{ clientX: number; startMonth: number; span: number } | null>(null);

  const referenceCurve: ReferenceCurvePoint[] = useMemo(
    () => buildWhoReferenceCurveSeries(metric, profile.sex, referenceMode),
    [metric, profile.sex, referenceMode]
  );

  // 将测量记录转换为真实月龄 + 实际测量值节点
  const babyPoints = useMemo(() => {
    if (!profile.birthDate) return [];
    const list: {
      measurement: GrowthMeasurement;
      month: number;
      ageDays: number;
      displayAge: string;
      rawValue: number;
      plotValue: number;
      conversionNote?: string;
      zScore: number | null;
      percentileLabel: string;
      statusLabel: string;
      referenceSummary: string;
    }[] = [];

    for (const m of measurements) {
      const rawVal = m[metric];
      if (typeof rawVal !== 'number' || !Number.isFinite(rawVal)) continue;

      const age = calculateGrowthAge(profile.birthDate, m.date, {
        isPreterm: profile.isPreterm,
        gestationalAgeWeeks: profile.gestationalAgeWeeks,
        expectedDueDate: profile.expectedDueDate,
      });
      if (!age || !age.isValid) continue;

      let plotValue = rawVal;
      let conversionNote: string | undefined;
      if (metric === 'heightCm') {
        const norm = normalizeHeightForWhoStandard(rawVal, age.ageDays, m.measurementMethod);
        plotValue = norm.standardHeightCm;
        conversionNote = norm.conversionNote;
      }

      const assessment = assessments[m.id];
      let zScore: number | null = null;
      let percentileLabel = '待计算';
      let statusLabel = '待计算';
      let referenceSummary = '需完善性别与有效参考数据';

      if (assessment) {
        if (metric === 'heightCm') {
          zScore = assessment.indicators.LAZ.zScore;
          percentileLabel = assessment.indicators.LAZ.percentileLabel;
          statusLabel = assessment.indicators.LAZ.statusLabel;
          referenceSummary = assessment.indicators.LAZ.referenceStandard;
        } else if (metric === 'weightKg') {
          zScore = assessment.indicators.WAZ.zScore;
          percentileLabel = assessment.indicators.WAZ.percentileLabel;
          statusLabel = assessment.indicators.WAZ.statusLabel;
          referenceSummary = assessment.indicators.WAZ.referenceStandard;
        } else {
          zScore = assessment.headCircumference.zScore;
          percentileLabel = assessment.headCircumference.percentileLabel;
          statusLabel = assessment.headCircumference.statusLabel;
          referenceSummary = assessment.headCircumference.referenceStandard;
        }
      }

      list.push({
        measurement: m,
        month: Math.min(36, Math.max(0, age.exactMonths)),
        ageDays: age.ageDays,
        displayAge: age.displayAge,
        rawValue: rawVal,
        plotValue,
        conversionNote,
        zScore,
        percentileLabel,
        statusLabel,
        referenceSummary,
      });
    }

    return list.sort((a, b) => a.ageDays - b.ageDays);
  }, [measurements, metric, profile, assessments]);

  const activeNode = useMemo(() => {
    if (babyPoints.length === 0) return null;
    return (
      babyPoints.find((p) => p.measurement.id === selectedMeasurementId) ||
      babyPoints[babyPoints.length - 1]
    );
  }, [babyPoints, selectedMeasurementId]);

  // 缩放 / 聚焦操作
  const span = viewRange.end - viewRange.start;
  const isZoomed = span < 35.9;

  const handleZoomIn = () => {
    const center = activeNode ? activeNode.month : (viewRange.start + viewRange.end) / 2;
    const nextSpan = Math.max(4, Math.round(span * 0.6));
    let start = Math.max(0, center - nextSpan / 2);
    let end = start + nextSpan;
    if (end > 36) {
      end = 36;
      start = Math.max(0, 36 - nextSpan);
    }
    setViewRange({ start: Number(start.toFixed(1)), end: Number(end.toFixed(1)) });
  };

  const handleZoomOut = () => {
    const center = (viewRange.start + viewRange.end) / 2;
    const nextSpan = Math.min(36, Math.round(span * 1.6));
    let start = Math.max(0, center - nextSpan / 2);
    let end = start + nextSpan;
    if (end > 36) {
      end = 36;
      start = Math.max(0, 36 - nextSpan);
    }
    setViewRange({ start: Number(start.toFixed(1)), end: Number(end.toFixed(1)) });
  };

  const handleResetView = () => {
    setViewRange({ start: 0, end: 36 });
  };

  const handleFocusBabyRange = () => {
    if (babyPoints.length === 0) {
      handleResetView();
      return;
    }
    const maxM = Math.max(...babyPoints.map((p) => p.month));
    const minM = Math.min(...babyPoints.map((p) => p.month));
    const pad = Math.max(2, (maxM - minM) * 0.4);
    const start = Math.max(0, Math.floor(minM - pad));
    const end = Math.min(36, Math.max(start + 6, Math.ceil(maxM + pad)));
    setViewRange({ start, end });
  };

  // 触摸 / 指针横向平移（在缩放后可顺滑左右滑动查看历史）
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isZoomed) return;
    dragStartRef.current = {
      clientX: e.clientX,
      startMonth: viewRange.start,
      span,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const deltaMonths = (-dx / rect.width) * dragStartRef.current.span;
    const nextStart = Math.max(
      0,
      Math.min(36 - dragStartRef.current.span, dragStartRef.current.startMonth + deltaMonths)
    );
    setViewRange({
      start: Number(nextStart.toFixed(2)),
      end: Number((nextStart + dragStartRef.current.span).toFixed(2)),
    });
  };

  const handlePointerUp = () => {
    dragStartRef.current = null;
  };

  // SVG 坐标系参数
  const svgW = 344;
  const svgH = 224;
  const padL = 34;
  const padR = 44; // 右侧留足空间给 +2SD / +1SD / 中位数 / -1SD / -2SD 标签
  const padT = 22;
  const padB = 30;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const visibleRefPoints = useMemo(
    () =>
      referenceCurve.filter(
        (pt) => pt.month >= viewRange.start - 0.5 && pt.month <= viewRange.end + 0.5
      ),
    [referenceCurve, viewRange]
  );

  // 动态计算纵轴范围
  const { yMin, yMax, yTicks } = useMemo(() => {
    const vals: number[] = [];
    for (const pt of visibleRefPoints) {
      vals.push(pt.sdNeg2, pt.sdPos2);
    }
    for (const bp of babyPoints) {
      if (bp.month >= viewRange.start - 0.5 && bp.month <= viewRange.end + 0.5) {
        vals.push(bp.plotValue);
      }
    }

    const rawMin = vals.length ? Math.min(...vals) : meta.defaultMin;
    const rawMax = vals.length ? Math.max(...vals) : meta.defaultMax;
    const step = metric === 'weightKg' ? (rawMax - rawMin > 8 ? 3 : 2) : rawMax - rawMin > 28 ? 10 : 5;
    const minRounded = Math.max(0, Math.floor((rawMin - step * 0.4) / step) * step);
    const maxRounded = Math.ceil((rawMax + step * 0.5) / step) * step;

    const ticks: number[] = [];
    for (let v = minRounded; v <= maxRounded + 0.001; v += step) {
      ticks.push(Number(v.toFixed(1)));
    }
    return {
      yMin: minRounded,
      yMax: Math.max(minRounded + step, maxRounded),
      yTicks: ticks,
    };
  }, [visibleRefPoints, babyPoints, viewRange, metric, meta]);

  const xScale = (month: number) =>
    padL + ((month - viewRange.start) / Math.max(0.5, viewRange.end - viewRange.start)) * plotW;

  const yScale = (val: number) =>
    padT + plotH - ((val - yMin) / Math.max(0.5, yMax - yMin)) * plotH;

  const xTicks = useMemo(() => {
    if (!isZoomed) return FULL_MONTH_TICKS;
    const step = span <= 8 ? 1 : span <= 16 ? 2 : 3;
    const first = Math.ceil(viewRange.start / step) * step;
    const list: number[] = [];
    for (let m = first; m <= viewRange.end + 0.01; m += step) {
      list.push(m);
    }
    return list;
  }, [isZoomed, span, viewRange]);

  // 组装 WHO 参考曲线路径与半透明区间带
  const refPaths = useMemo(() => {
    if (visibleRefPoints.length < 2) return null;
    const mapCurve = (picker: (p: ReferenceCurvePoint) => number) =>
      visibleRefPoints.map((p) => ({ x: xScale(p.month), y: yScale(picker(p)) }));

    const pPos2 = mapCurve((p) => p.sdPos2);
    const pPos1 = mapCurve((p) => p.sdPos1);
    const pMed = mapCurve((p) => p.median);
    const pNeg1 = mapCurve((p) => p.sdNeg1);
    const pNeg2 = mapCurve((p) => p.sdNeg2);

    const bandOuter =
      buildSmoothPath(pPos2) +
      ' ' +
      pNeg2
        .slice()
        .reverse()
        .map((pt) => `L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
        .join(' ') +
      ' Z';

    const bandInner =
      buildSmoothPath(pPos1) +
      ' ' +
      pNeg1
        .slice()
        .reverse()
        .map((pt) => `L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
        .join(' ') +
      ' Z';

    const last = visibleRefPoints[visibleRefPoints.length - 1];
    return {
      bandOuter,
      bandInner,
      pos2: buildSmoothPath(pPos2),
      pos1: buildSmoothPath(pPos1),
      med: buildSmoothPath(pMed),
      neg1: buildSmoothPath(pNeg1),
      neg2: buildSmoothPath(pNeg2),
      endLabels: [
        { label: '+2SD', y: yScale(last.sdPos2), color: '#93c5fd' },
        { label: '+1SD', y: yScale(last.sdPos1), color: '#bfdbfe' },
        { label: '中位数', y: yScale(last.median), color: '#fef08a' },
        { label: '-1SD', y: yScale(last.sdNeg1), color: '#bfdbfe' },
        { label: '-2SD', y: yScale(last.sdNeg2), color: '#93c5fd' },
      ],
    };
  }, [visibleRefPoints, yMin, yMax, viewRange]);

  const plottedBabyNodes = useMemo(
    () =>
      babyPoints.map((bp) => ({
        ...bp,
        cx: xScale(bp.month),
        cy: yScale(bp.plotValue),
      })),
    [babyPoints, yMin, yMax, viewRange]
  );

  const babyLinePath = useMemo(
    () => buildSmoothPath(plottedBabyNodes.map((n) => ({ x: n.cx, y: n.cy }))),
    [plottedBabyNodes]
  );

  const sexLabel =
    profile.sex === 'male' ? '男宝 WHO 2006' : profile.sex === 'female' ? '女宝 WHO 2006' : '未设性别';

  return (
    <div className="w-full min-w-0 rounded-[22px] border border-[#5f84c7]/30 bg-gradient-to-b from-[#0f214f]/90 via-[#0d1c45]/95 to-[#0b1739]/95 p-3 shadow-[0_12px_28px_rgba(3,8,24,0.55)] backdrop-blur-md">
      {/* 顶部图表标题 + 缩放工具栏 */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#fff8e7]">
            <span>{meta.fullLabel}</span>
            <span className="text-[10.5px] font-medium text-sky-200/80">· {sexLabel}</span>
          </div>
          <div className="text-[10.5px] text-indigo-200/75">
            {isZoomed ? '可左右拖动图表浏览历史月龄' : '点击金色星星节点查看精确 Z-score 与百分位'}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleFocusBabyRange}
            className="flex h-7 items-center rounded-lg border border-white/15 bg-white/10 px-2 text-[10.5px] font-semibold text-amber-100 hover:bg-white/15 active:scale-95"
            title="聚焦已记录月龄"
          >
            聚焦
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="放大图表"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-indigo-100 hover:bg-white/15 active:scale-95"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={!isZoomed}
            aria-label="缩小图表"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-indigo-100 hover:bg-white/15 active:scale-95 disabled:opacity-40"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          {isZoomed && (
            <button
              type="button"
              onClick={handleResetView}
              aria-label="重置 0-36 月龄全览"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-300/35 bg-amber-300/15 text-amber-200 active:scale-95"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 参考数据未加载或未设性别提示条 */}
      {referenceMode === 'unloaded' && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-rose-300/35 bg-rose-500/15 px-2.5 py-2 text-[11px] text-rose-100">
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-300" />
            <span>WHO 参考数据未加载，暂不显示标准曲线与评价。</span>
          </div>
          {onRetryLoadReference && (
            <button
              type="button"
              onClick={onRetryLoadReference}
              className="shrink-0 rounded-lg bg-amber-300 px-2 py-1 text-[10.5px] font-bold text-slate-900"
            >
              重新加载
            </button>
          )}
        </div>
      )}

      {referenceMode !== 'unloaded' && !profile.sex && (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-amber-300/35 bg-amber-400/15 px-2.5 py-2 text-[11px] text-amber-100">
          <span className="min-w-0">尚未选择宝宝生理性别，暂无法匹配 WHO 男女参考曲线。</span>
          <button
            type="button"
            onClick={onOpenSettings}
            className="shrink-0 rounded-lg bg-amber-300 px-2 py-1 text-[10.5px] font-bold text-slate-900"
          >
            去完善
          </button>
        </div>
      )}

      {/* 核心 SVG 生长曲线画布 */}
      <div className="relative w-full overflow-hidden rounded-[20px] border border-white/10 bg-[#0a1637]/75">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className={`block h-auto w-full select-none ${isZoomed ? 'cursor-grab active:cursor-grabbing touch-none' : ''}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          role="img"
          aria-label={`${meta.label} 0至36月龄生长曲线图`}
        >
          <defs>
            <clipPath id={`growth-plot-clip-${metric}`}>
              <rect x={padL} y={padT - 8} width={plotW} height={plotH + 14} />
            </clipPath>
            <linearGradient id={`who-band-grad-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.22" />
              <stop offset="50%" stopColor="#93c5fd" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.22" />
            </linearGradient>
            <filter id={`star-glow-${metric}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 纵轴网格与刻度 */}
          {yTicks.map((v) => {
            const y = yScale(v);
            if (y < padT - 4 || y > padT + plotH + 4) return null;
            return (
              <g key={v}>
                <line
                  x1={padL}
                  y1={y}
                  x2={padL + plotW}
                  y2={y}
                  stroke="#93c5fd"
                  strokeOpacity="0.14"
                  strokeWidth="0.9"
                />
                <text
                  x={padL - 5}
                  y={y + 3}
                  textAnchor="end"
                  fontSize="9"
                  fill="#cbd5e1"
                  className="font-typewriter"
                >
                  {v}
                </text>
              </g>
            );
          })}

          {/* 横轴刻度（0, 3, 6, 9, 12, 18, 24, 30, 36 月龄） */}
          {xTicks.map((m) => {
            const x = xScale(m);
            return (
              <g key={m}>
                <line
                  x1={x}
                  y1={padT}
                  x2={x}
                  y2={padT + plotH}
                  stroke="#93c5fd"
                  strokeOpacity="0.1"
                  strokeWidth="0.8"
                />
                <line
                  x1={x}
                  y1={padT + plotH}
                  x2={x}
                  y2={padT + plotH + 4}
                  stroke="#93c5fd"
                  strokeOpacity="0.45"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={padT + plotH + 15}
                  textAnchor="middle"
                  fontSize="8.5"
                  fill="#cbd5e1"
                  className="font-typewriter"
                >
                  {m}
                </text>
              </g>
            );
          })}

          {/* 坐标轴线与单位 */}
          <line
            x1={padL}
            y1={padT - 4}
            x2={padL}
            y2={padT + plotH}
            stroke="#bfdbfe"
            strokeOpacity="0.55"
            strokeWidth="1.1"
          />
          <line
            x1={padL}
            y1={padT + plotH}
            x2={padL + plotW}
            y2={padT + plotH}
            stroke="#bfdbfe"
            strokeOpacity="0.55"
            strokeWidth="1.1"
          />
          <text x={padL - 4} y={padT - 9} textAnchor="middle" fontSize="8.5" fill="#93c5fd">
            {meta.unit}
          </text>
          <text
            x={padL + plotW + 22}
            y={padT + plotH + 15}
            textAnchor="middle"
            fontSize="8.5"
            fill="#93c5fd"
          >
            月龄
          </text>

          {/* WHO 参考区间带与 5 条标准曲线 */}
          {refPaths && (
            <g clipPath={`url(#growth-plot-clip-${metric})`}>
              <path d={refPaths.bandOuter} fill={`url(#who-band-grad-${metric})`} />
              <path d={refPaths.bandInner} fill="#93c5fd" fillOpacity="0.12" />

              <path
                d={refPaths.pos2}
                fill="none"
                stroke="#7dd3fc"
                strokeOpacity="0.65"
                strokeWidth="1"
                strokeDasharray="3.5 2.5"
              />
              <path
                d={refPaths.pos1}
                fill="none"
                stroke="#93c5fd"
                strokeOpacity="0.55"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <path
                d={refPaths.med}
                fill="none"
                stroke="#e0f2fe"
                strokeOpacity="0.82"
                strokeWidth="1.25"
                strokeDasharray="4 2.5"
              />
              <path
                d={refPaths.neg1}
                fill="none"
                stroke="#93c5fd"
                strokeOpacity="0.55"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <path
                d={refPaths.neg2}
                fill="none"
                stroke="#7dd3fc"
                strokeOpacity="0.65"
                strokeWidth="1"
                strokeDasharray="3.5 2.5"
              />
            </g>
          )}

          {/* 右侧 SD 参考标签 */}
          {refPaths &&
            refPaths.endLabels.map((item) => {
              const clampedY = Math.max(padT + 4, Math.min(padT + plotH - 2, item.y));
              return (
                <text
                  key={item.label}
                  x={padL + plotW + 4}
                  y={clampedY + 3}
                  fontSize="8"
                  fontWeight={item.label === '中位数' ? '700' : '500'}
                  fill={item.color}
                >
                  {item.label}
                </text>
              );
            })}

          {/* 宝宝实际测量曲线（醒目金黄色实线 + 星星节点） */}
          <g clipPath={`url(#growth-plot-clip-${metric})`}>
            {plottedBabyNodes.length > 1 && (
              <>
                <path
                  d={babyLinePath}
                  fill="none"
                  stroke="#fbbf24"
                  strokeOpacity="0.35"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <path
                  d={babyLinePath}
                  fill="none"
                  stroke="#fde047"
                  strokeWidth="2.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </>
            )}

            {plottedBabyNodes.map((pt) => {
              const isSelected = activeNode?.measurement.id === pt.measurement.id;
              return (
                <g
                  key={pt.measurement.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectMeasurement(pt.measurement.id);
                    setBubbleVisible(true);
                  }}
                  className="cursor-pointer"
                >
                  {/* 扩大触摸点击热区 */}
                  <circle cx={pt.cx} cy={pt.cy} r="14" fill="transparent" />
                  {isSelected && (
                    <>
                      <line
                        x1={pt.cx}
                        y1={pt.cy}
                        x2={pt.cx}
                        y2={padT + plotH}
                        stroke="#fde047"
                        strokeOpacity="0.4"
                        strokeWidth="1"
                        strokeDasharray="2.5 2.5"
                      />
                      <circle cx={pt.cx} cy={pt.cy} r="10.5" fill="#fde047" fillOpacity="0.24" />
                    </>
                  )}
                  <polygon
                    points={starPolygonPoints(pt.cx, pt.cy, isSelected ? 7.2 : 5.2, isSelected ? 3.2 : 2.3)}
                    fill={isSelected ? '#fef08a' : '#facc15'}
                    stroke="#b45309"
                    strokeWidth="0.7"
                    filter={`url(#star-glow-${metric})`}
                  />
                </g>
              );
            })}
          </g>

          {/* 无记录提示 */}
          {plottedBabyNodes.length === 0 && (
            <text
              x={padL + plotW / 2}
              y={padT + plotH / 2}
              textAnchor="middle"
              fontSize="11"
              fill="#e2e8f0"
            >
              暂无该指标的测量记录，点击下方新增坐标
            </text>
          )}
        </svg>
      </div>

      {/* 图例栏 */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[10.5px] text-indigo-100/85">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <img
              src="/assets/extracted/health_star_small.png"
              alt=""
              aria-hidden="true"
              className="h-3.5 w-3.5 object-contain"
            />
            <span>宝宝记录 ({babyPoints.length})</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-sky-300" />
            <span>WHO 参考曲线 (-2SD～+2SD)</span>
          </span>
        </div>
        {activeNode && (
          <button
            type="button"
            onClick={() => setBubbleVisible((v) => !v)}
            className="text-[10.5px] font-semibold text-amber-200 underline decoration-dotted underline-offset-2"
          >
            {bubbleVisible ? '收起读数气泡' : '展开读数气泡'}
          </button>
        )}
      </div>

      {/* 选中节点弹出的奶油色读数气泡 */}
      {activeNode && bubbleVisible && (
        <div className="mt-2.5 rounded-[20px] border border-[#f2dcad] bg-[#fbf4e4] p-3 text-[#222b42] shadow-[0_8px_22px_rgba(3,8,24,0.38)]">
          <div className="flex items-center justify-between gap-2 border-b border-dashed border-[#e2d3b8] pb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <img
                src="/assets/extracted/health_star_small.png"
                alt=""
                aria-hidden="true"
                className="h-4 w-4 shrink-0 object-contain"
              />
              <span className="font-typewriter text-[12px] font-bold text-[#1f2c4a] tabular-nums">
                {activeNode.measurement.date.replace(/-/g, '.')}
              </span>
              <span className="text-[11px] font-semibold text-[#7b6e5f]">
                · {activeNode.displayAge}（{activeNode.month.toFixed(1)}月龄）
              </span>
            </div>
            <span className="shrink-0 font-typewriter text-[15px] font-extrabold text-[#b45309] tabular-nums">
              {activeNode.rawValue} {meta.unit}
            </span>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-[#f3e9d4] px-2 py-1.5">
              <div className="text-[10px] text-[#7a6d5e]">Z-score</div>
              <div className="mt-0.5 font-typewriter text-[12.5px] font-extrabold text-[#1e2c4a] tabular-nums">
                {activeNode.zScore !== null
                  ? `${activeNode.zScore >= 0 ? '+' : ''}${activeNode.zScore.toFixed(2)}`
                  : '待计算'}
              </div>
            </div>
            <div className="rounded-xl bg-[#f3e9d4] px-2 py-1.5">
              <div className="text-[10px] text-[#7a6d5e]">百分位数</div>
              <div className="mt-0.5 font-typewriter text-[12.5px] font-extrabold text-[#1e2c4a] tabular-nums">
                {activeNode.percentileLabel}
              </div>
            </div>
            <div className="rounded-xl bg-[#f3e9d4] px-2 py-1.5">
              <div className="text-[10px] text-[#7a6d5e]">参考评价</div>
              <div className="mt-0.5 truncate text-[11.5px] font-extrabold text-[#2e6b2a]">
                {activeNode.statusLabel}
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10.5px] text-[#756858]">
            <span>参考标准：{activeNode.referenceSummary}</span>
            {activeNode.conversionNote && (
              <span className="text-[#8a5514]">{activeNode.conversionNote}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
