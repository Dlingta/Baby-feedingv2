import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  ClipboardPaste,
  Clock,
  Eraser,
  FileText,
  Image as ImageIcon,
  Loader2,
  Minus,
  Plus,
  ScanText,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import { FeedingRecord } from '../types/planet';
import { getCurrentTimeStr } from '../data/initialData';
import {
  convertPaperDraftsToFeedingRecords,
  PAPER_LOG_TYPE_LIST,
  PAPER_LOG_TYPE_MAP,
  PaperLogDraft,
  PaperLogItemType,
  parsePaperLogText,
  SAMPLE_PAPER_LOG_TEXT,
} from '../utils/paperLogParser';
import { processFeedingPhotoFile } from '../utils/feedingPhoto';
import { isNativeIOSApp, visionOcrBridge } from '../native/iosBridge';

interface PaperLogScanSheetProps {
  open: boolean;
  selectedDate: string;
  recorder: string;
  onClose: () => void;
  onConfirmImport: (records: FeedingRecord[]) => void;
}

export const PaperLogScanSheet: React.FC<PaperLogScanSheetProps> = ({
  open,
  selectedDate,
  recorder,
  onClose,
  onConfirmImport,
}) => {
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [rawText, setRawText] = useState('');
  const [drafts, setDrafts] = useState<PaperLogDraft[]>([]);
  const [hintMsg, setHintMsg] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoNotice, setPhotoNotice] = useState<string | null>(null);
  const [isHandlingPhoto, setIsHandlingPhoto] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const albumInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setStep('input');
      setHintMsg(null);
      setZoomPhoto(false);
    }
  }, [open]);

  if (!open) return null;

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsHandlingPhoto(true);
    setHintMsg(null);
    setPhotoNotice(null);

    try {
      const processed = await processFeedingPhotoFile(file);
      setPhotoDataUrl(processed.previewDataUrl);

      // 若运行在打包后的原生 iOS App 内，自动调用苹果本地 Vision 框架识字
      if (isNativeIOSApp()) {
        const visionRes = await visionOcrBridge.recognizeText(processed.previewDataUrl);
        if (visionRes && visionRes.text.trim()) {
          const text = visionRes.text.trim();
          setRawText(text);
          const parsed = parsePaperLogText(text, processed.exifTime || getCurrentTimeStr());
          if (parsed.length > 0) {
            setDrafts(parsed);
            setStep('review');
            setPhotoNotice('已通过 Apple Vision 本地识字并完成解析');
            return;
          }
          setPhotoNotice('已识别出纸面文字，可核对微调后点「开始解析」');
          return;
        }
      }

      // 网页 / Safari 模式：直接展示纸质照片（支持 iOS Safari 长按照片实况文本复制 + 随记录留档）
      setPhotoNotice(
        '照片已拍摄并留档：可直接长按上方照片里的文字选择拷贝，或轻点下方输入框用 iOS「自动填充 → 扫描文本」直接扫字'
      );
    } catch (err) {
      setHintMsg(err instanceof Error ? err.message : '读取照片失败，请重新拍照尝试');
    } finally {
      setIsHandlingPhoto(false);
    }
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.readText === 'function') {
        const clip = await navigator.clipboard.readText();
        if (clip && clip.trim()) {
          setRawText((prev) => (prev.trim() ? `${prev.trim()}\n${clip.trim()}` : clip.trim()));
          setHintMsg(null);
          return;
        }
      }
      setHintMsg('请轻点下方输入框，在系统弹窗中点「粘贴」即可');
      textareaRef.current?.focus();
    } catch {
      setHintMsg('请轻点下方输入框，在系统弹窗中点「粘贴」即可');
      textareaRef.current?.focus();
    }
  };

  const handleClear = () => {
    setRawText('');
    setHintMsg(null);
    textareaRef.current?.focus();
  };

  const handleFillSample = () => {
    setRawText(SAMPLE_PAPER_LOG_TEXT);
    setHintMsg(null);
  };

  const handleParse = () => {
    if (!rawText.trim()) {
      setHintMsg('请先通过上方拍照长按取字、iOS「扫描文本」输入，或点「填入示例文本」体验');
      textareaRef.current?.focus();
      return;
    }

    const parsed = parsePaperLogText(rawText, getCurrentTimeStr());
    if (parsed.length === 0) {
      setHintMsg('暂未匹配到明确的奶量、亲喂或大小便关键词，可调整文字格式或直接手动补录');
      return;
    }

    setHintMsg(null);
    setDrafts(parsed);
    setStep('review');
  };

  const handleUpdateDraft = (id: string, patch: Partial<PaperLogDraft>) => {
    setDrafts((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const nextType = patch.type ?? item.type;
        let nextValue = patch.value ?? item.value;

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
      time: lastTime,
      type: 'formula',
      value: 120,
    };
    setDrafts((prev) => [...prev, newDraft]);
  };

  const handleConfirmSave = () => {
    if (drafts.length === 0) return;
    const records = convertPaperDraftsToFeedingRecords(
      drafts,
      selectedDate,
      recorder,
      photoDataUrl
    );
    onConfirmImport(records);
    setRawText('');
    setDrafts([]);
    setPhotoDataUrl(null);
    setPhotoNotice(null);
    setStep('input');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#040a1d]/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="扫描纸质本导入"
      onClick={onClose}
    >
      {/* 真实系统后置相机拍照 & 相册选择输入 */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handlePhotoSelect}
        className="hidden"
      />
      <input
        ref={albumInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoSelect}
        className="hidden"
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[28px] border-t-2 border-amber-200/50 bg-[#fbf4e4] text-[#182848] shadow-[0_-18px_50px_rgba(3,8,24,0.65)]"
      >
        {/* 顶部星空手绘风抽屉标题栏 */}
        <div className="relative shrink-0 bg-gradient-to-b from-[#11234f] to-[#1a3166] px-4 pb-3.5 pt-2.5 text-amber-50">
          <div className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-white/30" aria-hidden="true" />
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {step === 'review' ? (
                <button
                  type="button"
                  onClick={() => setStep('input')}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/12 text-amber-100 transition-transform active:scale-90"
                  aria-label="返回修改原文"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-300/20 text-amber-200">
                  <ScanText className="h-4.5 w-4.5" />
                </span>
              )}
              <div className="min-w-0">
                <h2 className="truncate text-[16px] font-bold tracking-wide text-[#fff8e7]">
                  {step === 'input' ? '拍照 / 扫描纸质本' : `核对解析结果（${drafts.length}条）`}
                </h2>
                <p className="truncate text-[11px] text-indigo-100/80">
                  {step === 'input'
                    ? `导入至 ${selectedDate.replace(/-/g, '.')} · 纯本地解析，零外部 API`
                    : '点击卡片可直接修改时间、类型或数值'}
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

        {/* 内容滚动区 */}
        {step === 'input' ? (
          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom,16px),20px)] pt-3.5">
            {/* 1. 真实拍照 / 相册入口卡片 */}
            <div className="rounded-[20px] border border-[#e4d2ae] bg-[#fffaf0] p-3 shadow-[0_3px_10px_rgba(120,90,40,0.06)]">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isHandlingPhoto}
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-[15px] bg-gradient-to-b from-[#fde074] to-[#f4bd36] px-3 py-2 text-[13.5px] font-bold text-[#182848] shadow-[0_3px_10px_rgba(244,189,54,0.35)] transition-transform active:scale-95 disabled:opacity-60"
                >
                  {isHandlingPhoto ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  <span>{photoDataUrl ? '重拍纸质本' : '拍照拍纸质本'}</span>
                </button>
                <button
                  type="button"
                  disabled={isHandlingPhoto}
                  onClick={() => albumInputRef.current?.click()}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-[15px] border border-[#decba7] bg-[#f4ead4] px-3 py-2 text-[13.5px] font-semibold text-[#182848] transition-transform active:scale-95 disabled:opacity-60"
                >
                  <ImageIcon className="h-4 w-4 text-[#8c6426]" />
                  <span>从相册选图</span>
                </button>
              </div>

              {/* 拍摄后的纸质本照片预览（不禁用长按，iOS Safari 可直接长按图片触发原生实况文本取字） */}
              {photoDataUrl && (
                <div className="mt-2.5 space-y-2">
                  <div className="relative overflow-hidden rounded-[14px] border border-[#dfd0b1] bg-[#f4ead4]">
                    <img
                      src={photoDataUrl}
                      alt="已拍摄的纸质喂养记录本"
                      className="max-h-44 w-full object-contain"
                    />
                    <div className="absolute right-2 top-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setZoomPhoto(true)}
                        aria-label="放大查看纸质照片"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#182848]/80 text-white backdrop-blur-xs active:scale-90"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoDataUrl(null);
                          setPhotoNotice(null);
                        }}
                        aria-label="移除照片"
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-[#182848]/80 text-white backdrop-blur-xs active:scale-90"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {photoNotice && (
                    <p className="text-[11.5px] leading-relaxed text-[#6b4f1d]">{photoNotice}</p>
                  )}
                </div>
              )}
            </div>

            {/* 2. iOS 系统原生「实况文本 / 扫描文本」操作提示 */}
            <div className="flex items-start gap-2 rounded-[16px] border border-[#e7d3a7] bg-[#fff7e0] px-3 py-2 text-[12px] leading-relaxed text-[#5c4218]">
              <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[#f9cf4c] text-[#182848]">
                <Sparkles className="h-2.5 w-2.5" />
              </span>
              <p className="font-medium">
                iOS 直接扫字：轻点下方输入框 → 轻点光标呼出系统菜单「自动填充 → 扫描文本」→ 对准纸质本即可自动上屏
              </p>
            </div>

            {/* 3. 标准可编辑 textarea：严禁 readonly/disabled，16px 防 iOS Safari 自动缩放 */}
            <div className="rounded-[20px] border-2 border-[#e3d2b1] bg-[#fffdf7] p-3 shadow-[inset_0_2px_6px_rgba(120,90,40,0.06)] focus-within:border-[#f2b830]">
              <textarea
                ref={textareaRef}
                value={rawText}
                onChange={(e) => {
                  setRawText(e.target.value);
                  if (hintMsg) setHintMsg(null);
                }}
                rows={5}
                inputMode="text"
                autoCorrect="off"
                spellCheck={false}
                placeholder={
                  '轻点此处呼出 iOS「扫描文本」或粘贴从照片拷贝的文字，每行一条：\n8:30 配方120ml 尿1\n11:15 亲喂15分钟 大便1次\n14:00 母乳100 嘘嘘'
                }
                className="w-full resize-none bg-transparent text-[16px] leading-relaxed text-[#182848] placeholder:text-[13.5px] placeholder:text-[#a69783] focus:outline-none"
              />
            </div>

            {/* 辅助提示 */}
            {hintMsg && (
              <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-[#7c4d0d]">
                <span>{hintMsg}</span>
                <button
                  type="button"
                  onClick={() => {
                    setDrafts([
                      {
                        id: `paper-manual-${Date.now()}`,
                        time: getCurrentTimeStr(),
                        type: 'formula',
                        value: 120,
                      },
                    ]);
                    setStep('review');
                  }}
                  className="shrink-0 rounded-full bg-[#182848] px-2.5 py-1 text-[11px] font-semibold text-amber-100"
                >
                  手动补录
                </button>
              </div>
            )}

            {/* 辅助按钮 + 主按钮「开始解析」 */}
            <div className="space-y-2.5 pt-0.5">
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="flex min-h-[40px] items-center justify-center gap-1 rounded-[14px] border border-[#decba7] bg-[#f4ead4] px-2 py-2 text-[12.5px] font-semibold text-[#5a4e3f] transition-transform active:scale-95"
                >
                  <Eraser className="h-3.5 w-3.5" />
                  <span>清空</span>
                </button>
                <button
                  type="button"
                  onClick={handlePasteClipboard}
                  className="flex min-h-[40px] items-center justify-center gap-1 rounded-[14px] border border-[#decba7] bg-[#fffaf0] px-2 py-2 text-[12.5px] font-semibold text-[#182848] transition-transform active:scale-95"
                >
                  <ClipboardPaste className="h-3.5 w-3.5 text-[#0284c7]" />
                  <span>粘贴文字</span>
                </button>
                <button
                  type="button"
                  onClick={handleFillSample}
                  className="flex min-h-[40px] items-center justify-center gap-1 rounded-[14px] border border-[#decba7] bg-[#fffaf0] px-2 py-2 text-[12.5px] font-semibold text-[#182848] transition-transform active:scale-95"
                >
                  <FileText className="h-3.5 w-3.5 text-[#d97706]" />
                  <span>填入示例</span>
                </button>
              </div>

              <button
                type="button"
                onClick={handleParse}
                className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[18px] border-2 border-[#fff2b8] bg-gradient-to-b from-[#fde074] via-[#f9ca44] to-[#f1b429] px-5 py-3 text-[15.5px] font-bold text-[#182848] shadow-[0_8px_20px_rgba(244,189,54,0.4)] transition-transform hover:brightness-105 active:scale-[0.98]"
              >
                <Sparkles className="h-4.5 w-4.5" />
                <span>开始解析</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* 步骤三：人工核对卡片列表 */}
            <div className="flex-1 space-y-2.5 overflow-y-auto px-4 pb-3 pt-3">
              {photoDataUrl && (
                <button
                  type="button"
                  onClick={() => setZoomPhoto(true)}
                  className="flex w-full items-center justify-between gap-2.5 rounded-[16px] border border-[#e3d2b1] bg-[#fffaf0] px-3 py-2 text-left transition-transform active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={photoDataUrl}
                      alt="纸质本原图缩略图"
                      className="h-10 w-10 shrink-0 rounded-lg border border-[#dcc9a4] object-cover"
                    />
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-bold text-[#182848]">
                        已附带纸质记录原图
                      </div>
                      <div className="truncate text-[11px] text-[#7c6e5c]">
                        点击可放大对照核对，存入时将一并留档
                      </div>
                    </div>
                  </div>
                  <ZoomIn className="h-4 w-4 shrink-0 text-[#8c6426]" />
                </button>
              )}

              {drafts.length === 0 ? (
                <div className="rounded-[20px] border border-dashed border-[#d8c49f] bg-[#fffaf0] px-4 py-8 text-center">
                  <p className="text-[14px] font-semibold text-[#4e4234]">核对列表已清空</p>
                  <p className="mt-1 text-[12px] text-[#847563]">
                    可点击下方「+ 手动补录一条」，或返回重新扫描纸质记录
                  </p>
                </div>
              ) : (
                drafts.map((draft, idx) => {
                  const meta = PAPER_LOG_TYPE_MAP[draft.type];
                  return (
                    <div
                      key={draft.id}
                      className="rounded-[20px] border border-[#e3d2b1] bg-[#fffdf7] p-3 shadow-[0_4px_12px_rgba(120,90,40,0.08)]"
                    >
                      <div className="mb-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-[#182848] font-typewriter text-[11px] font-bold text-amber-200">
                            {idx + 1}
                          </span>
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
                          aria-label="删除这条核对记录"
                          className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11.5px] font-semibold text-rose-600 transition-transform active:scale-95"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>删除</span>
                        </button>
                      </div>

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

                      {draft.rawLine && (
                        <div className="mt-1.5 truncate px-0.5 text-[11px] text-[#8d7d69]">
                          原文：{draft.rawLine}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="shrink-0 space-y-2 border-t border-[#e7d8bc] bg-[#f8efe0] px-4 pb-[max(env(safe-area-inset-bottom,16px),18px)] pt-3">
              <button
                type="button"
                onClick={handleAddManualDraft}
                className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-[15px] border border-dashed border-[#c7b089] bg-[#fffaf0] px-3 py-2 text-[13px] font-semibold text-[#182848] transition-transform active:scale-98"
              >
                <Plus className="h-4 w-4 text-[#d97706]" />
                <span>手动补录一条</span>
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

      {/* 全屏放大查看已拍纸质记录本（在 iOS Safari 中长按照片即可直接实况文本划选复制） */}
      {zoomPhoto && photoDataUrl && (
        <div
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/88 p-4 backdrop-blur-xs"
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
            className="max-h-[78vh] max-w-full rounded-2xl border border-white/15 object-contain shadow-2xl"
          />
          <p className="mt-3 text-center text-[12px] text-amber-100/90">
            iPhone 长按照片上的文字即可直接选择并拷贝，回到输入框点「粘贴文字」解析
          </p>
        </div>
      )}
    </div>
  );
};
