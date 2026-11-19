import React, { useMemo, useState } from 'react';
import { ArrowLeft, Plus, Ruler, Trash2 } from 'lucide-react';
import { GrowthRecord, PlanetAppState } from '../types/planet';
import { REFERENCE_TODAY } from '../data/initialData';
import { IconSprout } from '../components/Illustrations';

export type GrowthViewMode = 'chart' | 'form';
type GrowthMetric = 'heightCm' | 'weightKg' | 'headCm';

interface GrowthScreenProps {
  state: PlanetAppState;
  mode: GrowthViewMode;
  onChangeMode: (mode: GrowthViewMode) => void;
  onBackHome: () => void;
  onAddGrowth: (record: GrowthRecord) => void;
  onDeleteGrowth: (id: string) => void;
}

const METRIC_META: Record<GrowthMetric, { label: string; unit: string; color: string }> = {
  heightCm: { label: '身高', unit: 'cm', color: '#4d8b31' },
  weightKg: { label: '体重', unit: 'kg', color: '#0284c7' },
  headCm: { label: '头围', unit: 'cm', color: '#d97706' },
};

export const GrowthScreen: React.FC<GrowthScreenProps> = ({
  state,
  mode,
  onChangeMode,
  onBackHome,
  onAddGrowth,
  onDeleteGrowth,
}) => {
  const [metric, setMetric] = useState<GrowthMetric>('heightCm');
  const sortedGrowths = useMemo(
    () => [...state.growths].sort((a, b) => a.date.localeCompare(b.date)),
    [state.growths]
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string>(
    sortedGrowths[sortedGrowths.length - 1]?.id || ''
  );

  // 4.2 新建表单状态
  const [formDate, setFormDate] = useState(REFERENCE_TODAY);
  const [heightStr, setHeightStr] = useState('56.5');
  const [weightStr, setWeightStr] = useState('5.10');
  const [headStr, setHeadStr] = useState('37.1');
  const [note, setNote] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const record: GrowthRecord = {
      id: `grow-${Date.now()}`,
      date: formDate,
      heightCm: parseFloat(heightStr) || 55,
      weightKg: parseFloat(weightStr) || 4.8,
      headCm: parseFloat(headStr) || 36.5,
      note: note.trim() || '日常生长坐标测定',
    };
    onAddGrowth(record);
    setSelectedNodeId(record.id);
    onChangeMode('chart');
  };

  const meta = METRIC_META[metric];

  // SVG 坐标计算
  const svgW = 320;
  const svgH = 178;
  const padL = 36;
  const padR = 22;
  const padT = 42;
  const padB = 28;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const values = sortedGrowths.map((g) => g[metric]);
  const minVal = values.length ? Math.floor((Math.min(...values) - 1) * 10) / 10 : 0;
  const maxVal = values.length ? Math.ceil((Math.max(...values) + 1) * 10) / 10 : 100;
  const range = Math.max(1, maxVal - minVal);

  const points = sortedGrowths.map((g, idx) => {
    const x =
      sortedGrowths.length === 1
        ? padL + plotW / 2
        : padL + (idx / (sortedGrowths.length - 1)) * plotW;
    const y = padT + plotH - ((g[metric] - minVal) / range) * plotH;
    const prevVal = idx > 0 ? sortedGrowths[idx - 1][metric] : null;
    const delta = prevVal !== null ? +(g[metric] - prevVal).toFixed(2) : null;
    return { x, y, val: g[metric], delta, record: g };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const activePoint =
    points.find((p) => p.record.id === selectedNodeId) || points[points.length - 1] || null;

  return (
    <div className="flex min-h-full flex-col pb-6">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-20 flex h-[56px] items-center justify-between bg-[#09132e]/85 px-4 backdrop-blur-md">
        <button
          type="button"
          onClick={mode === 'form' ? () => onChangeMode('chart') : onBackHome}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-indigo-100 hover:bg-white/10 active:scale-95"
          aria-label="返回"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 font-display text-xl tracking-wide text-amber-100">
            <IconSprout className="h-5 w-5" />
            <span>观测坐标</span>
          </div>
          <div className="text-[11px] text-indigo-200/75">
            {mode === 'form' ? '新增生长坐标' : '身高 · 体重 · 头围趋势'}
          </div>
        </div>

        {mode === 'chart' ? (
          <button
            type="button"
            onClick={() => onChangeMode('form')}
            className="flex min-h-[40px] items-center gap-1 rounded-xl bg-amber-300 px-3 text-xs font-bold text-slate-900 shadow-sm active:scale-95 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>记坐标</span>
          </button>
        ) : (
          <div className="w-[44px]" />
        )}
      </header>

      {/* 4.2 成长·新建录入表单 */}
      {mode === 'form' && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-4 pt-2">
          <div className="paper-card p-4 space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-[#6e6052]">测量日期</span>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#dccbb0] bg-white px-3 py-2.5 text-sm font-typewriter text-[#2d251e]"
                required
              />
            </label>

            {/* 三个带有单位 (cm/kg) 的数值输入框 */}
            <div className="space-y-3">
              <label className="block">
                <span className="text-xs font-semibold text-[#6e6052]">身高</span>
                <div className="mt-1 flex items-center rounded-xl border border-[#dccbb0] bg-white px-3">
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="160"
                    value={heightStr}
                    onChange={(e) => setHeightStr(e.target.value)}
                    className="w-full py-2.5 text-base font-bold font-typewriter text-[#2d251e] focus:outline-none tabular-nums"
                    required
                  />
                  <span className="shrink-0 text-xs font-bold text-[#7c6e5f]">cm</span>
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#6e6052]">体重</span>
                <div className="mt-1 flex items-center rounded-xl border border-[#dccbb0] bg-white px-3">
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max="40"
                    value={weightStr}
                    onChange={(e) => setWeightStr(e.target.value)}
                    className="w-full py-2.5 text-base font-bold font-typewriter text-[#2d251e] focus:outline-none tabular-nums"
                    required
                  />
                  <span className="shrink-0 text-xs font-bold text-[#7c6e5f]">kg</span>
                </div>
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#6e6052]">头围</span>
                <div className="mt-1 flex items-center rounded-xl border border-[#dccbb0] bg-white px-3">
                  <input
                    type="number"
                    step="0.1"
                    min="20"
                    max="65"
                    value={headStr}
                    onChange={(e) => setHeadStr(e.target.value)}
                    className="w-full py-2.5 text-base font-bold font-typewriter text-[#2d251e] focus:outline-none tabular-nums"
                    required
                  />
                  <span className="shrink-0 text-xs font-bold text-[#7c6e5f]">cm</span>
                </div>
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-semibold text-[#6e6052]">测量备注</span>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：儿保中心体检、清晨空腹测量…"
                className="mt-1 w-full rounded-xl border border-[#dccbb0] bg-white px-3 py-2.5 text-sm text-[#2d251e]"
              />
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onChangeMode('chart')}
              className="flex-1 min-h-[48px] rounded-2xl border border-white/20 bg-white/10 text-sm font-semibold text-indigo-100 active:scale-95"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-[2] min-h-[48px] rounded-2xl bg-amber-300 text-sm font-bold text-slate-900 shadow-lg active:scale-95"
            >
              锚定生长坐标
            </button>
          </div>
        </form>
      )}

      {/* 4.1 成长·走势与历史 */}
      {mode === 'chart' && (
        <div className="flex flex-col gap-3.5 px-4 pt-2">
          {/* 顶部身高/体重/头围切换 Tab */}
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-white/15 bg-white/10 p-1 backdrop-blur-sm">
            {(['heightCm', 'weightKg', 'headCm'] as GrowthMetric[]).map((m) => {
              const active = metric === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMetric(m)}
                  className={`min-h-[40px] rounded-xl text-xs font-bold transition-all ${
                    active
                      ? 'bg-amber-300 text-slate-900 shadow-sm'
                      : 'text-indigo-100 hover:bg-white/10'
                  }`}
                >
                  {METRIC_META[m].label}（{METRIC_META[m].unit}）
                </button>
              );
            })}
          </div>

          {/* 连线图与点击节点弹出读数气泡 */}
          <div className="paper-card p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-bold text-[#2d251e]">
                {meta.label}星轨走势图
              </div>
              <span className="text-[11px] text-[#6e6052]">点击节点查看读数气泡</span>
            </div>

            <div className="relative rounded-xl border border-[#e3d3b8] bg-white/85 p-2">
              {points.length === 0 ? (
                <div className="flex h-[170px] items-center justify-center text-xs text-[#7d6e5e]">
                  暂无观测坐标，点击右上角新增测量记录
                </div>
              ) : (
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-[178px]">
                  {[0, 0.5, 1].map((r, idx) => {
                    const y = padT + plotH * (1 - r);
                    const labelVal = (minVal + range * r).toFixed(1);
                    return (
                      <g key={idx}>
                        <line x1={padL} y1={y} x2={svgW - padR} y2={y} stroke="#ebe0cd" strokeDasharray="3 3" />
                        <text x={padL - 5} y={y + 3} textAnchor="end" fontSize="9" fill="#7c6e5f">
                          {labelVal}
                        </text>
                      </g>
                    );
                  })}

                  {points.length > 1 && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke={meta.color}
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {points.map((pt) => {
                    const isActive = activePoint?.record.id === pt.record.id;
                    return (
                      <g
                        key={pt.record.id}
                        onClick={() => setSelectedNodeId(pt.record.id)}
                        className="cursor-pointer"
                      >
                        {isActive && (
                          <circle cx={pt.x} cy={pt.y} r="10" fill={meta.color} fillOpacity="0.18" />
                        )}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isActive ? 5.5 : 4}
                          fill={isActive ? meta.color : '#ffffff'}
                          stroke={meta.color}
                          strokeWidth="2.5"
                        />
                        <text
                          x={pt.x}
                          y={svgH - 7}
                          textAnchor="middle"
                          fontSize="9"
                          fontWeight={isActive ? 'bold' : 'normal'}
                          fill={isActive ? '#1e293b' : '#78716c'}
                        >
                          {pt.record.date.slice(5).replace('-', '/')}
                        </text>
                      </g>
                    );
                  })}

                  {/* 点击节点弹出的读数气泡 */}
                  {activePoint && (() => {
                    const bubbleW = 114;
                    const bubbleH = 30;
                    const clampedX = Math.min(
                      Math.max(activePoint.x - bubbleW / 2, padL - 6),
                      svgW - bubbleW - 6
                    );
                    const bubbleY = Math.max(4, activePoint.y - bubbleH - 12);
                    return (
                      <g>
                        <rect
                          x={clampedX}
                          y={bubbleY}
                          width={bubbleW}
                          height={bubbleH}
                          rx="8"
                          fill="#1e293b"
                        />
                        <polygon
                          points={`${activePoint.x - 4},${bubbleY + bubbleH} ${activePoint.x + 4},${bubbleY + bubbleH} ${activePoint.x},${bubbleY + bubbleH + 5}`}
                          fill="#1e293b"
                        />
                        <text
                          x={clampedX + bubbleW / 2}
                          y={bubbleY + 13}
                          textAnchor="middle"
                          fontSize="10"
                          fontWeight="bold"
                          fill="#fde68a"
                        >
                          {activePoint.val} {meta.unit}
                          {activePoint.delta !== null
                            ? ` (${activePoint.delta >= 0 ? '+' : ''}${activePoint.delta})`
                            : ''}
                        </text>
                        <text
                          x={clampedX + bubbleW / 2}
                          y={bubbleY + 24}
                          textAnchor="middle"
                          fontSize="8.5"
                          fill="#cbd5e1"
                        >
                          {activePoint.record.date.replace(/-/g, '.')}
                        </text>
                      </g>
                    );
                  })()}
                </svg>
              )}
            </div>
          </div>

          {/* 历史记录列表 */}
          <div className="paper-card px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#2d251e]">历史观测档案</h3>
              <span className="text-xs text-[#7c6e5f] tabular-nums">共 {sortedGrowths.length} 次</span>
            </div>

            <div className="divide-y divide-[#e4d5bc]">
              {[...sortedGrowths].reverse().map((g) => {
                const isSelected = activePoint?.record.id === g.id;
                return (
                  <div
                    key={g.id}
                    onClick={() => setSelectedNodeId(g.id)}
                    className={`flex items-center justify-between gap-2 py-3 cursor-pointer rounded-xl px-1.5 transition-colors ${
                      isSelected ? 'bg-amber-100/60' : 'hover:bg-[#f2e5cb]/40'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-[#6e6052]">
                        <Ruler className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                        <span className="font-typewriter font-bold text-[#2d251e] tabular-nums">
                          {g.date.replace(/-/g, '.')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{g.note}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs font-semibold text-[#2d251e] tabular-nums">
                        <span>身高 {g.heightCm} cm</span>
                        <span aria-hidden="true">/</span>
                        <span>体重 {g.weightKg} kg</span>
                        <span aria-hidden="true">/</span>
                        <span>头围 {g.headCm} cm</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteGrowth(g.id);
                      }}
                      className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-[#9b8c7b] hover:bg-rose-50 hover:text-rose-700"
                      aria-label="删除此条测量"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
