import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Image as ImageIcon,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import { FeedingRecord } from '../types/planet';
import { getCurrentTimeStr, getTodayDateStr } from '../data/initialData';
import {
  convertPaperDraftsToFeedingRecords,
  PAPER_LOG_TYPE_LIST,
  PAPER_LOG_TYPE_MAP,
  PaperLogDraft,
  PaperLogItemType,
} from '../utils/paperLogParser';

function shiftYmd(dateStr: string, deltaDays: number): string {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : getTodayDateStr();
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type PaperScanSheetStatus = 'recognizing' | 'review' | 'error';

interface PaperLogScanSheetProps {
  open: boolean;
  status: PaperScanSheetStatus;
  selectedDate: string;
  detectedDate?: string | null;
  recorder: string;
  photoDataUrl: string | null;
  initialDrafts: PaperLogDraft[];
  errorMessage: string | null;
  onClose: () => void;
  onRetakeCamera: () => void;
  onPickAlbum: () => void;
  onSwitchToReview?: () => void;
  onConfirmImport: (records: FeedingRecord[], targetDate: string) => void;
}

export const PaperLogScanSheet: React.FC<PaperLogScanSheetProps> = ({
  open,
  status,
  selectedDate,
  detectedDate = null,
  recorder,
  photoDataUrl,
  initialDrafts,
  errorMessage,
  onClose,
  onRetakeCamera,
  onPickAlbum,
  onSwitchToReview,
  onConfirmImport,
}) => {
  const [drafts, setDrafts] = useState<PaperLogDraft[]>(initialDrafts);
  const [importDate, setImportDate] = useState<string>(detectedDate || selectedDate);
  const [zoomPhoto, setZoomPhoto] = useState(false);

  useEffect(() => {
    setDrafts(initialDrafts);
  }, [initialDrafts]);

  useEffect(() => {
    if (open) {
      setImportDate(detectedDate || selectedDate);
    } else {
      setZoomPhoto(false);
    }
  }, [open, detectedDate, selectedDate]);

  const todayStr = getTodayDateStr();
  const yesterdayStr = useMemo(() => shiftYmd(todayStr, -1), [todayStr]);
  const dayBeforeYesterdayStr = useMemo(() => shiftYmd(todayStr, -2), [todayStr]);

  const hasMultipleDates = useMemo(() => {
    const distinct = new Set(drafts.map((d) => d.date || importDate));
    return distinct.size > 1;
  }, [drafts, importDate]);

  if (!open) return null;

  const handleChangeImportDate = (nextDate: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
    setImportDate(nextDate);
    setDrafts((prev) => prev.map((item) => ({ ...item, date: nextDate })));
  };

  const handleUpdateDraft = (id: string, patch: Partial<PaperLogDraft>) => {
    setDrafts((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextType = patch.type ?? item.type;
        let nextValue = patch.value ?? item.value;

        // 跨单位切换类型时自动切换到该类型合理默认值
        if (patch.type && patch.type !== item.type) {
          const prevUnit = PAPER_LOG_TYPE_MAP[item.type].unit;
          const nextMeta = PAPER_LOG_TYPE_MAP[patch.type];
          if (prevUnit !== nextMeta.unit) {
            nextValue = nextMeta.defaultValue;
          }
        }

        return {
          ...item,
          ...patch,
          type: nextType,
          value: nextValue,
        };
      })
    );
  };

  const handleStepValue = (draft: PaperLogDraft, delta: number) => {
    const meta = PAPER_LOG_TYPE_MAP[draft.type];
    const next = Math.min(meta.max, Math.max(meta.min, (draft.value || 0) + delta * meta.step));
    handleUpdateDraft(draft.id, { value: next });
  };

  const handleDeleteDraft = (id: string) => {
    setDrafts((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddManualDraft = () => {
    const lastTime = drafts.length > 0 ? drafts[drafts.length - 1].time : getCurrentTimeStr();
    const newDraft: PaperLogDraft = {
      id: `paper-manual-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      date: importDate,
      time: lastTime,
      type: 'formula',
      value: 120,
      note: '',
    };
    setDrafts((prev) => [...prev, newDraft]);
    if (status === 'error' && onSwitchToReview) {
      onSwitchToReview();
    }
  };

  const handleConfirmSave = () => {
    if (drafts.length === 0) return;
    const records = convertPaperDraftsToFeedingRecords(
      drafts,
      importDate,
      recorder,
      photoDataUrl
    );
    onConfirmImport(records, importDate);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#040a1d]/76 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="拍照识别纸质记录本"
      onClick={(e) => {
        if (e.target === e.currentTarget && status !== 'recognizing') {
          onClose();
        }
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[28px] border-t-2 border-amber-200/50 bg-[#fbf4e4] text-[#182848] shadow-[0_-18px_50px_rgba(3,8,24,0.65)]"
      >
        {/* 顶部星空手绘风抽屉标题栏 */}
        <div className="relative shrink-0 bg-gradient-to-b from-[#11234f] to-[#1a3166] px-4 pb-3.5 pt-2.5 text-amber-50">
          <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-white/30" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-300/20 text-amber-200">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-[16px] font-bold tracking-wide text-[#fff8e7]">
                  {status === 'recognizing'
                    ? '正在识别纸质记录本'
                    : status === 'error'
                    ? '识别遇到一点小状况'
                    : `核对识别结果（${drafts.length} 条）`}
                </h2>
                <p className="truncate text-[11px] text-indigo-100/80">
                  {status === 'recognizing'
                    ? 'AI 正在逐行辨认纸面上的日期、奶量与大小便'
                    : status === 'error'
                    ? '可重新拍照、换相册照片或直接手动补录'
                    : `将导入至 ${importDate.replace(/-/g, '.')} · 点击日期或卡片即可调整`}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="关闭弹窗"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/12 text-amber-100 transition-transform hover:bg-white/20 active:scale-90"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        {/* 状态一：温馨识别加载中 */}
        {status === 'recognizing' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 pb-[max(env(safe-area-inset-bottom,24px),28px)] pt-6 text-center">
            {photoDataUrl && (
              <div className="relative w-full max-w-[240px] overflow-hidden rounded-[20px] border-2 border-[#e5d2ab] bg-[#f4ead4] shadow-md">
                <img
                  src={photoDataUrl}
                  alt="正在识别的纸质喂养记录"
                  className="max-h-48 w-full object-cover opacity-90"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-[#12234d]/28 backdrop-blur-[1px]">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#fde074] text-[#182848] shadow-[0_0_20px_rgba(253,224,116,0.75)]">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-[16px] font-bold text-[#182848]">
                {!photoDataUrl && <Loader2 className="h-4.5 w-4.5 animate-spin text-[#d97706]" />}
                <span>正在努力辨认纸质记录中…</span>
              </div>
              <p className="text-[12.5px] leading-relaxed text-[#726352]">
                已自动压缩图片加快识别速度，马上为你整理好每条喂奶与大小便卡片
              </p>
            </div>
          </div>
        )}

        {/* 状态二：识别失败 / 友好兜底重试 */}
        {status === 'error' && (
          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom,18px),22px)] pt-4">
            {photoDataUrl && (
              <div className="relative overflow-hidden rounded-[18px] border border-[#dfd0b1] bg-[#f4ead4]">
                <img
                  src={photoDataUrl}
                  alt="已拍摄的纸质喂养记录"
                  className="max-h-44 w-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => setZoomPhoto(true)}
                  className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-[#182848]/80 px-2.5 py-1 text-[11px] font-semibold text-white"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                  <span>放大</span>
                </button>
              </div>
            )}

            <div className="flex items-start gap-2.5 rounded-[18px] border border-rose-200 bg-rose-50 px-3.5 py-3 text-[13px] leading-relaxed text-rose-800">
              <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-rose-500" />
              <span>{errorMessage || '没能看清纸面上的字迹，建议光线充足、平拍再试一次。'}</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={onRetakeCamera}
                className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-[16px] bg-gradient-to-b from-[#fde074] to-[#f4bd36] px-4 py-2.5 text-[14px] font-bold text-[#182848] shadow-[0_6px_16px_rgba(244,189,54,0.35)] active:scale-95"
              >
                <Camera className="h-4 w-4" />
                <span>重新拍照</span>
              </button>
              <button
                type="button"
                onClick={onPickAlbum}
                className="flex min-h-[46px] items-center justify-center gap-1.5 rounded-[16px] border border-[#decba7] bg-[#fffaf0] px-4 py-2.5 text-[14px] font-semibold text-[#182848] active:scale-95"
              >
                <ImageIcon className="h-4 w-4 text-[#8c6426]" />
                <span>相册选图</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddManualDraft}
              className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-[15px] border border-dashed border-[#c7b089] bg-[#fffaf0] px-3 py-2 text-[13px] font-semibold text-[#5b4d3e] active:scale-98"
            >
              <Plus className="h-4 w-4 text-[#d97706]" />
              <span>直接手动补录一条</span>
            </button>
          </div>
        )}

        {/* 状态三：可编辑核对卡片列表 */}
        {status === 'review' && (
          <>
            <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-3 pt-3">
              {/* 归属日期选择器：默认自动回填纸面日期，支持一键选前天/昨天/今天或任意日历日期 */}
              <div className="rounded-[18px] border border-[#e3d2b1] bg-[#fffdf7] px-3 py-2.5 shadow-[0_3px_10px_rgba(120,90,40,0.06)]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#182848]">
                    <Calendar className="h-3.5 w-3.5 text-[#d97706]" />
                    <span>记录归属日期</span>
                  </div>
                  {detectedDate && importDate === detectedDate ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800">
                      <Sparkles className="h-3 w-3" />
                      <span>已识别纸面日期</span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-[#847563]">可切换补录哪一天</span>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 rounded-xl border border-[#e2d2b4] bg-[#f7eedc] px-1 py-0.5">
                    <button
                      type="button"
                      onClick={() => handleChangeImportDate(shiftYmd(importDate, -1))}
                      aria-label="前一天"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#5b4d3e] hover:bg-white/60 active:scale-90"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <label className="relative cursor-pointer px-1.5 font-typewriter text-[13.5px] font-bold text-[#182848] tabular-nums">
                      <span>{importDate.replace(/-/g, '.')}</span>
                      <input
                        type="date"
                        value={importDate}
                        onChange={(e) => {
                          if (e.target.value) {
                            handleChangeImportDate(e.target.value);
                          }
                        }}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => handleChangeImportDate(shiftYmd(importDate, 1))}
                      aria-label="后一天"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[#5b4d3e] hover:bg-white/60 active:scale-90"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {[
                      { label: '前天', value: dayBeforeYesterdayStr },
                      { label: '昨天', value: yesterdayStr },
                      { label: '今天', value: todayStr },
                    ].map((opt) => {
                      const active = importDate === opt.value;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => handleChangeImportDate(opt.value)}
                          className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition-all active:scale-95 ${
                            active
                              ? 'border-[#e8a81c] bg-gradient-to-b from-[#fde074] to-[#f4bd36] text-[#182848] shadow-2xs'
                              : 'border-[#e2d2b4] bg-[#fffaf0] text-[#6d5f4d]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 顶部原图缩略对照条 + 重拍/相册入口 */}
              {photoDataUrl && (
                <div className="flex items-center justify-between gap-2 rounded-[16px] border border-[#e3d2b1] bg-[#fffaf0] px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setZoomPhoto(true)}
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left active:scale-[0.99]"
                  >
                    <img
                      src={photoDataUrl}
                      alt="纸质本原图缩略图"
                      className="h-10 w-10 shrink-0 rounded-lg border border-[#dcc9a4] object-cover"
                    />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold text-[#182848]">
                        对照纸质原图核对
                      </div>
                      <div className="truncate text-[11px] text-[#7c6e5c]">
                        轻点可放大查看，存入时将一并留档
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={onRetakeCamera}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#decba7] bg-[#f4ead4] px-2.5 py-1 text-[11.5px] font-semibold text-[#182848] active:scale-95"
                  >
                    <Camera className="h-3.5 w-3.5 text-[#8c6426]" />
                    <span>重拍</span>
                  </button>
                </div>
              )}

              {drafts.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#d8c49f] bg-[#fffaf0] px-4 py-8 text-center">
                  <p className="text-[14px] font-semibold text-[#4e4234]">
                    暂未识别到明确的喂养或大小便记录
                  </p>
                  <p className="mt-1 text-[12px] text-[#847563]">
                    可点击下方「+ 手动补录」，或重新拍一张光线更清晰的纸质记录
                  </p>
                  <div className="mt-3 flex justify-center gap-2">
                    <button
                      type="button"
                      onClick={onRetakeCamera}
                      className="inline-flex items-center gap-1 rounded-full bg-[#f9cf4c] px-3.5 py-1.5 text-[12.5px] font-bold text-[#182848]"
                    >
                      <Camera className="h-3.5 w-3.5" />
                      <span>重新拍照</span>
                    </button>
                    <button
                      type="button"
                      onClick={onPickAlbum}
                      className="inline-flex items-center gap-1 rounded-full border border-[#decba7] bg-[#f4ead4] px-3.5 py-1.5 text-[12.5px] font-semibold text-[#182848]"
                    >
                      <ImageIcon className="h-3.5 w-3.5" />
                      <span>相册选图</span>
                    </button>
                  </div>
                </div>
              ) : (
                drafts.map((draft, idx) => {
                  const meta = PAPER_LOG_TYPE_MAP[draft.type];
                  const draftDate = draft.date || importDate;
                  return (
                    <div
                      key={draft.id}
                      className="rounded-[20px] border border-[#e3d2b1] bg-[#fffdf7] p-3 shadow-[0_4px_12px_rgba(120,90,40,0.08)]"
                    >
                      {/* 第 1 行：序号 + (跨天时显示单条日期) + 时间选择 + 删除 */}
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-[#182848] font-typewriter text-[11px] font-bold text-amber-200">
                            {idx + 1}
                          </span>
                          {hasMultipleDates && (
                            <label className="relative inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#e2d2b4] bg-[#fff5df] px-2 py-1 font-typewriter text-[12px] font-bold text-[#7c5318] tabular-nums">
                              <span>{draftDate.slice(5).replace('-', '.')}</span>
                              <input
                                type="date"
                                value={draftDate}
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleUpdateDraft(draft.id, { date: e.target.value });
                                  }
                                }}
                                className="absolute inset-0 cursor-pointer opacity-0"
                              />
                            </label>
                          )}
                          <label className="inline-flex items-center gap-1.5 rounded-xl border border-[#e2d2b4] bg-[#f7eedc] px-2.5 py-1 text-[13px] font-bold text-[#182848]">
                            <Clock className="h-3.5 w-3.5 text-[#7a6953]" />
                            <input
                              type="time"
                              value={draft.time}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleUpdateDraft(draft.id, { time: e.target.value });
                                }
                              }}
                              className="bg-transparent font-typewriter text-[14px] font-bold text-[#182848] tabular-nums focus:outline-none"
                            />
                          </label>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteDraft(draft.id)}
                          aria-label="删除这条记录"
                          className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11.5px] font-semibold text-rose-600 transition-transform active:scale-95"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>删除</span>
                        </button>
                      </div>

                      {/* 第 2 行：5 种类型切换胶囊 */}
                      <div className="mb-2.5 flex flex-wrap gap-1.5">
                        {PAPER_LOG_TYPE_LIST.map((opt) => {
                          const isActive = draft.type === opt.type;
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() =>
                                handleUpdateDraft(draft.id, { type: opt.type as PaperLogItemType })
                              }
                              className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-all active:scale-95 ${
                                isActive
                                  ? `${opt.activeChipClass} shadow-xs`
                                  : 'border-[#e3d3b4] bg-[#f8f1e2] text-[#5e5142] hover:bg-[#f2e6cf]'
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* 第 3 行：对应数值（奶量 ml / 亲喂分钟 / 大小便次数） */}
                      <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#ece0c7] bg-[#faf3e3] px-3 py-2">
                        <span className="text-[12.5px] font-semibold text-[#5b4d3e]">
                          {draft.type === 'breast_direct'
                            ? '亲喂时长'
                            : draft.type === 'poop' || draft.type === 'pee'
                            ? '记录次数'
                            : '本次奶量'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStepValue(draft, -1)}
                            aria-label="减少数值"
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#dcc9a4] bg-white text-[#182848] shadow-2xs active:scale-90"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>

                          <input
                            type="number"
                            inputMode="numeric"
                            min={meta.min}
                            max={meta.max}
                            value={draft.value === 0 ? '' : draft.value}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === '') {
                                handleUpdateDraft(draft.id, { value: 0 });
                                return;
                              }
                              const parsed = parseInt(raw, 10);
                              if (Number.isFinite(parsed) && parsed >= 0) {
                                handleUpdateDraft(draft.id, { value: Math.min(meta.max, parsed) });
                              }
                            }}
                            onBlur={() => {
                              if (!draft.value || draft.value < meta.min) {
                                handleUpdateDraft(draft.id, { value: meta.defaultValue });
                              }
                            }}
                            className="w-[62px] rounded-xl border border-[#dfd0b1] bg-white px-2 py-1 text-center font-typewriter text-[16px] font-bold text-[#182848] tabular-nums focus:border-[#f2b830] focus:outline-none"
                          />

                          <span className="min-w-[30px] text-[12.5px] font-bold text-[#6e5f4d]">
                            {meta.unit}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleStepValue(draft, 1)}
                            aria-label="增加数值"
                            className="flex h-7 w-7 items-center justify-center rounded-full border border-[#dcc9a4] bg-white text-[#182848] shadow-2xs active:scale-90"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* 第 4 行：备注输入（如“吐奶”“偏稀”） */}
                      <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-[#ece0c7] bg-[#fffaf0] px-2.5 py-1.5">
                        <Pencil className="h-3.5 w-3.5 shrink-0 text-[#9c8a72]" />
                        <input
                          type="text"
                          value={draft.note ?? ''}
                          onChange={(e) => handleUpdateDraft(draft.id, { note: e.target.value })}
                          placeholder="备注（可选，如吐奶、偏稀）"
                          className="w-full bg-transparent text-[13px] text-[#182848] placeholder:text-[#a89a88] focus:outline-none"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* 底部固定按钮栏：+ 手动补录 + 确认全部存入 */}
            <div className="shrink-0 space-y-2 border-t border-[#e7d8bc] bg-[#f8efe0] px-4 pb-[max(env(safe-area-inset-bottom,16px),18px)] pt-3">
              <button
                type="button"
                onClick={handleAddManualDraft}
                className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-[15px] border border-dashed border-[#c7b089] bg-[#fffaf0] px-3 py-2 text-[13px] font-semibold text-[#182848] transition-transform active:scale-98"
              >
                <Plus className="h-4 w-4 text-[#d97706]" />
                <span>手动补录</span>
              </button>

              <button
                type="button"
                disabled={drafts.length === 0}
                onClick={handleConfirmSave}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[18px] border-2 border-[#fff2b8] bg-gradient-to-b from-[#fde074] via-[#f9ca44] to-[#f1b429] px-5 py-3 text-[15.5px] font-bold text-[#182848] shadow-[0_8px_20px_rgba(244,189,54,0.4)] transition-transform hover:brightness-105 active:scale-[0.98] disabled:opacity-45"
              >
                <Check className="h-4.5 w-4.5 stroke-[2.8]" />
                <span>确认全部存入（{drafts.length} 条）</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* 全屏放大查看原图 */}
      {zoomPhoto && photoDataUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/88 p-4 backdrop-blur-xs"
          onClick={(e) => {
            e.stopPropagation();
            setZoomPhoto(false);
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomPhoto(false);
            }}
            aria-label="关闭原图预览"
            className="absolute right-4 top-[var(--header-top-pad,calc(env(safe-area-inset-top,0px)+20px))] flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md active:scale-90"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={photoDataUrl}
            alt="纸质喂养本原图"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[82vh] max-w-full rounded-2xl border border-white/15 object-contain shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
