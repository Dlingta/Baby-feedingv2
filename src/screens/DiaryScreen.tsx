import React, { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  ChevronRight,
  Loader2,
  Mic,
  Pencil,
  RotateCcw,
  Sparkles,
  Square,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { DiaryEntry, DiaryMood, DiaryWeather, PlanetAppState } from '../types/planet';
import { calculatePlanetAge, getTodayDateStr } from '../data/initialData';
import { AssetSlot, IconStar } from '../components/Illustrations';
import { CosmicModuleHeader, CosmicSubHeader } from '../components/CosmicModuleHeader';
import { hapticSuccess, hapticTap, speechBridge } from '../native/iosBridge';
import { applyBabyGenderPronoun, polishDiaryTextViaApi } from '../utils/diaryPolish';

export type DiaryViewMode = 'list' | 'detail' | 'empty' | 'form';

interface DiaryScreenProps {
  state: PlanetAppState;
  currentRecorder: string;
  mode: DiaryViewMode;
  showSlotTag?: boolean;
  onChangeMode: (mode: DiaryViewMode) => void;
  onBackHome: () => void;
  onSaveDiary: (entry: DiaryEntry) => void;
  onDeleteDiary: (id: string) => void;
}

const MOOD_OPTIONS: { id: DiaryMood; label: string; sub: string; iconSrc: string }[] = [
  { id: 'glowing', label: '发光', sub: '(开心)', iconSrc: './assets/extracted/diary_mood_1.png' },
  { id: 'floating', label: '漂浮', sub: '(安静)', iconSrc: './assets/extracted/diary_mood_2.png' },
  { id: 'soft', label: '潜水', sub: '(熟睡)', iconSrc: './assets/extracted/diary_mood_3.png' },
  { id: 'exploring', label: '起风了', sub: '(闹腾)', iconSrc: './assets/extracted/diary_mood_4.png' },
  { id: 'full', label: '下雨了', sub: '(哭闹)', iconSrc: './assets/extracted/diary_mood_5.png' },
];

const WEATHER_OPTIONS: { id: DiaryWeather; label: string; iconSrc: string }[] = [
  { id: 'sunny', label: '晴朗', iconSrc: './assets/extracted/diary_weather_sun.png' },
  { id: 'cloudy', label: '多云', iconSrc: './assets/extracted/diary_weather_cloud.png' },
  { id: 'rainy', label: '小雨', iconSrc: './assets/extracted/diary_weather_rain.png' },
  { id: 'starry', label: '星夜', iconSrc: './assets/extracted/icon_star.png' },
];

interface BrowserSpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function getWeatherSrc(weather: DiaryWeather): string {
  return (
    WEATHER_OPTIONS.find((w) => w.id === weather)?.iconSrc ??
    './assets/extracted/diary_weather_sun.png'
  );
}

function getMoodOption(mood: DiaryMood) {
  return MOOD_OPTIONS.find((m) => m.id === mood) ?? MOOD_OPTIONS[0];
}

export const DiaryScreen: React.FC<DiaryScreenProps> = ({
  state,
  currentRecorder,
  mode,
  showSlotTag = false,
  onChangeMode,
  onBackHome,
  onSaveDiary,
  onDeleteDiary,
}) => {
  const [selectedId, setSelectedId] = useState<string>(state.diaries[0]?.id ?? '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [returnToDetailAfterForm, setReturnToDetailAfterForm] = useState(false);
  const [filterDate, setFilterDate] = useState<string>('');
  const [showDateFilter, setShowDateFilter] = useState(false);

  // 详情页照片大图灯箱预览
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // 表单状态 (2.3)
  const [formDate, setFormDate] = useState(() => getTodayDateStr());
  const [formMood, setFormMood] = useState<DiaryMood>('glowing');
  const [formWeather, setFormWeather] = useState<DiaryWeather>('sunny');
  const [formRecorder, setFormRecorder] = useState(currentRecorder || state.profile.recorders[0] || '妈妈');
  const [formContent, setFormContent] = useState('');
  const [formReflection, setFormReflection] = useState('');
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isPolishing, setIsPolishing] = useState(false);
  const [prePolishText, setPrePolishText] = useState<string | null>(null);
  const [voiceNotice, setVoiceNotice] = useState<{
    tone: 'info' | 'success' | 'error';
    text: string;
  } | null>(null);
  const stopVoiceRef = useRef<(() => Promise<void> | void) | null>(null);
  const voiceBaseTextRef = useRef<string>('');
  const latestContentRef = useRef<string>('');
  const polishRequestIdRef = useRef<number>(0);
  const intentionalStopRef = useRef<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    latestContentRef.current = formContent;
  }, [formContent]);

  useEffect(() => {
    return () => {
      polishRequestIdRef.current += 1;
      const stopFn = stopVoiceRef.current;
      stopVoiceRef.current = null;
      if (stopFn) {
        void stopFn();
      }
    };
  }, []);

  const updateFormContent = (nextText: string) => {
    latestContentRef.current = nextText;
    setFormContent(nextText);
  };

  const stopVoiceDictation = async () => {
    intentionalStopRef.current = true;
    const stopFn = stopVoiceRef.current;
    stopVoiceRef.current = null;
    setIsRecordingVoice(false);
    if (stopFn) {
      await stopFn();
    }
  };

  const runPolishText = async (sourceText: string) => {
    const trimmed = sourceText.trim();
    if (!trimmed) {
      setVoiceNotice({
        tone: 'info',
        text: '请先说出或输入一些日记内容，再点击整理语气词哦～',
      });
      return;
    }

    const reqId = ++polishRequestIdRef.current;
    setIsPolishing(true);
    setVoiceNotice({ tone: 'info', text: '正在整理语气词…' });

    try {
      const polished = await polishDiaryTextViaApi(trimmed, state.profile.gender);
      if (reqId !== polishRequestIdRef.current) return;

      if (polished && polished !== trimmed) {
        setPrePolishText(sourceText);
        updateFormContent(polished);
        void hapticSuccess();
        setVoiceNotice({
          tone: 'success',
          text: '已帮你去除语气词并补全标点，不满意可点下方「撤销整理」还原',
        });
      } else {
        setVoiceNotice({
          tone: 'success',
          text: '这段日记已经很自然通顺啦，无需改动～',
        });
      }
    } catch (err) {
      if (reqId !== polishRequestIdRef.current) return;
      setVoiceNotice({
        tone: 'error',
        text: err instanceof Error ? err.message : '整理语气词失败，已保留原口述内容',
      });
    } finally {
      if (reqId === polishRequestIdRef.current) {
        setIsPolishing(false);
      }
    }
  };

  const openCreateForm = () => {
    polishRequestIdRef.current += 1;
    void stopVoiceDictation();
    setEditingId(null);
    setReturnToDetailAfterForm(false);
    setFormDate(getTodayDateStr());
    setFormMood('glowing');
    setFormWeather('sunny');
    setFormRecorder(currentRecorder || state.profile.recorders[0] || '妈妈');
    updateFormContent('');
    setFormReflection('');
    setFormPhotos([]);
    setIsPolishing(false);
    setPrePolishText(null);
    setVoiceNotice(null);
    onChangeMode('form');
  };

  const openEditForm = (entry: DiaryEntry, fromDetail = false) => {
    polishRequestIdRef.current += 1;
    void stopVoiceDictation();
    setEditingId(entry.id);
    setReturnToDetailAfterForm(fromDetail);
    setFormDate(entry.date);
    setFormMood(entry.mood);
    setFormWeather(entry.weather);
    setFormRecorder(entry.recorder);
    updateFormContent(entry.content);
    setFormReflection(entry.reflection || '');
    setFormPhotos(entry.photos);
    setIsPolishing(false);
    setPrePolishText(null);
    setVoiceNotice(null);
    onChangeMode('form');
  };

  const openDetailPage = (entryId: string) => {
    setSelectedId(entryId);
    setLightboxIndex(null);
    onChangeMode('detail');
  };

  const handleToggleVoice = async () => {
    if (isPolishing) return;
    hapticTap();

    // 正在录音 -> 点击「说完了，自动整理」：停止录音并自动发送至 /api/polish
    if (isRecordingVoice) {
      await stopVoiceDictation();
      // 给浏览器语音识别 220ms 缓冲，确保最后一句临时识别结果也写入输入框
      await new Promise((resolve) => window.setTimeout(resolve, 220));
      const spokenText = latestContentRef.current.trim();
      if (!spokenText) {
        setVoiceNotice({
          tone: 'info',
          text: '刚才没有识别到语音内容，可以再试一次或直接用键盘输入哦',
        });
        return;
      }
      await runPolishText(latestContentRef.current);
      return;
    }

    setVoiceNotice(null);
    setPrePolishText(null);
    intentionalStopRef.current = false;
    voiceBaseTextRef.current = latestContentRef.current.trim();

    // 1. 原生 iOS App：调用苹果端侧 Speech 框架离线中文语音转文字
    if (speechBridge.isNativeAvailable()) {
      try {
        setIsRecordingVoice(true);
        const stopNative = await speechBridge.startNative((text, isFinal) => {
          const cleaned = applyBabyGenderPronoun(text.trim(), state.profile.gender);
          if (cleaned) {
            const prefix = voiceBaseTextRef.current;
            updateFormContent(prefix ? `${prefix}\n${cleaned}` : cleaned);
          }
          if (isFinal) {
            setIsRecordingVoice(false);
            stopVoiceRef.current = null;
          }
        });
        stopVoiceRef.current = stopNative;
        return;
      } catch (err) {
        setIsRecordingVoice(false);
        setVoiceNotice({
          tone: 'error',
          text: err instanceof Error ? err.message : '请在 iPhone 设置中允许语音识别与麦克风权限',
        });
        return;
      }
    }

    // 2. 浏览器原生 Web Speech API (zh-CN, continuous, interimResults)
    const speechWindow = window as unknown as {
      SpeechRecognition?: new () => BrowserSpeechRecognitionLike;
      webkitSpeechRecognition?: new () => BrowserSpeechRecognitionLike;
    };
    const SpeechCtor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechCtor) {
      setVoiceNotice({
        tone: 'info',
        text: '可直接点击 iPhone 键盘右下角的麦克风图标进行听写，说完后点「✨ 整理语气词」即可',
      });
      textareaRef.current?.focus();
      return;
    }

    try {
      const recognition = new SpeechCtor();
      recognition.lang = 'zh-CN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        let spoken = '';
        for (let i = 0; i < event.results.length; i++) {
          spoken += event.results[i][0]?.transcript || '';
        }
        const cleaned = applyBabyGenderPronoun(spoken.trim(), state.profile.gender);
        if (cleaned) {
          const prefix = voiceBaseTextRef.current;
          updateFormContent(prefix ? `${prefix}\n${cleaned}` : cleaned);
        }
      };
      recognition.onerror = (event) => {
        if (intentionalStopRef.current && event?.error === 'aborted') {
          return;
        }
        setIsRecordingVoice(false);
        stopVoiceRef.current = null;
        if (event?.error === 'not-allowed' || event?.error === 'service-not-allowed') {
          setVoiceNotice({
            tone: 'error',
            text: '未开启麦克风权限，也可以直接点 iPhone 键盘右下角的麦克风图标听写，再用「✨ 整理语气词」',
          });
        } else {
          setVoiceNotice({
            tone: 'info',
            text: '未能持续识别声音，可重试或点 iPhone 键盘右下角麦克风听写后使用「✨ 整理语气词」',
          });
        }
      };
      recognition.onend = () => {
        setIsRecordingVoice(false);
        stopVoiceRef.current = null;
      };
      recognition.start();
      setIsRecordingVoice(true);
      stopVoiceRef.current = () => {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      };
    } catch {
      setIsRecordingVoice(false);
      setVoiceNotice({
        tone: 'info',
        text: '可直接点击 iPhone 键盘右下角的麦克风图标进行听写，说完后点「✨ 整理语气词」即可',
      });
      textareaRef.current?.focus();
    }
  };

  const handleManualPolish = async () => {
    if (isPolishing) return;
    hapticTap();
    if (isRecordingVoice) {
      await stopVoiceDictation();
      await new Promise((resolve) => window.setTimeout(resolve, 180));
    }
    await runPolishText(latestContentRef.current);
  };

  const handleUndoPolish = () => {
    if (prePolishText === null) return;
    hapticTap();
    updateFormContent(prePolishText);
    setPrePolishText(null);
    setVoiceNotice({
      tone: 'info',
      text: '已恢复原始口述稿',
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setFormPhotos((prev) => (prev.length < 9 ? [...prev, reader.result as string] : prev));
        }
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleSaveEntry = () => {
    if (!formContent.trim()) return;
    void stopVoiceDictation();
    polishRequestIdRef.current += 1;
    setIsPolishing(false);
    setPrePolishText(null);
    const entry: DiaryEntry = {
      id: editingId || `diary-${Date.now()}`,
      date: formDate,
      content: formContent.trim(),
      reflection: formReflection.trim() || undefined,
      mood: formMood,
      weather: formWeather,
      recorder: formRecorder,
      photos: formPhotos,
      updatedAt: new Date().toISOString(),
    };
    onSaveDiary(entry);
    setSelectedId(entry.id);
    onChangeMode(returnToDetailAfterForm ? 'detail' : 'list');
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    handleSaveEntry();
  };

  const handleDeleteEntry = (id: string) => {
    onDeleteDiary(id);
    setLightboxIndex(null);
    if (mode === 'detail') {
      onChangeMode('list');
    }
  };

  const filteredDiaries = filterDate
    ? state.diaries.filter((d) => d.date === filterDate)
    : state.diaries;

  const activeIndex = Math.max(
    0,
    filteredDiaries.findIndex((d) => d.id === selectedId)
  );
  const activeDetail = filteredDiaries[activeIndex] || filteredDiaries[0] || null;
  const isEmptyView =
    mode === 'empty' ||
    ((mode === 'list' || mode === 'detail') && state.diaries.length === 0);

  const scrollThumbPercent =
    filteredDiaries.length > 1 ? (activeIndex / (filteredDiaries.length - 1)) * 62 : 0;

  return (
    <div className="relative flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-clip pb-6">
      {/* 宇宙星空背景层 */}
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-top opacity-75"
        style={{ backgroundImage: "url('./assets/aistudio/____f8d9ecf9.png')" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#071230]/35 via-[#09183e]/55 to-[#07112b]/85"
        aria-hidden="true"
      />

      {/* =================================================================
          顶部导航栏：统一手绘星空顶栏
         ================================================================= */}
      {mode === 'detail' && activeDetail && !isEmptyView ? (
        <CosmicSubHeader
          title="日记详情"
          onBack={() => onChangeMode('list')}
          backLabel="返回日记列表"
          rightSlot={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => openEditForm(activeDetail, true)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-[#d7defd] transition-colors hover:bg-white/10 active:scale-90"
                aria-label="编辑日记"
              >
                <Pencil className="h-[18px] w-[18px]" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteEntry(activeDetail.id)}
                className="flex h-9 items-center gap-0.5 rounded-xl px-1.5 text-rose-400 transition-colors hover:bg-rose-500/15 active:scale-90"
                aria-label="删除日记"
              >
                <Trash2 className="h-[18px] w-[18px]" />
                <span className="typo-badge text-indigo-100/85">删</span>
              </button>
            </div>
          }
        />
      ) : mode === 'form' ? (
        <CosmicSubHeader
          title={editingId ? '编辑今日的星光' : '写下今日的星光'}
          onBack={() => {
            polishRequestIdRef.current += 1;
            setIsPolishing(false);
            void stopVoiceDictation();
            onChangeMode(returnToDetailAfterForm ? 'detail' : 'list');
          }}
          backLabel="返回"
          rightSlot={
            <button
              type="button"
              onClick={handleSaveEntry}
              disabled={!formContent.trim()}
              className="min-h-[32px] rounded-full bg-[#f9cf4c] px-4 py-1 typo-tab-active text-[#182848] shadow-[0_2px_10px_rgba(249,207,76,0.45)] transition-transform active:scale-95 disabled:opacity-50"
            >
              保存
            </button>
          }
        />
      ) : (
        <CosmicModuleHeader
          title="星光碎片"
          subtitle="成长日记"
          onBack={onBackHome}
          onCalendarClick={() => setShowDateFilter((v) => !v)}
          calendarActive={Boolean(filterDate || showDateFilter)}
          calendarLabel="按日期筛选日记"
        />
      )}

      {/* 日期检索展开条 (仅一级列表页显示) */}
      {showDateFilter && mode === 'list' && (
        <div className="relative z-20 mx-4 mb-2.5 flex items-center justify-between gap-2 rounded-[20px] border border-white/15 bg-[#10204a]/88 px-3.5 py-2.5 text-xs shadow-[0_10px_24px_rgba(3,8,24,0.4)] backdrop-blur-md">
          <span className="text-indigo-100">按日期检索：</span>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="rounded-lg border border-white/15 bg-[#0a1636] px-2 py-1 text-xs text-amber-100"
            />
            {filterDate && (
              <button
                type="button"
                onClick={() => setFilterDate('')}
                className="text-amber-300 underline"
              >
                全部
              </button>
            )}
          </div>
        </div>
      )}

      {/* =================================================================
          独立「日记详情页」(1:1 还原设计图第二屏)
         ================================================================= */}
      {mode === 'detail' && activeDetail && !isEmptyView && (
        <div className="relative z-10 flex flex-1 flex-col px-4 pt-1 pb-safe">
          <article className="diary-paper-card relative flex flex-1 flex-col justify-between px-2.5 pt-2">
            <div>
              {/* 顶部元信息行：日期 + 登陆第 N 天 | 右侧大天气图标 */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 text-[14px] font-medium text-[#1b2b4e] tabular-nums">
                  <span className="font-typewriter text-[15px] font-semibold tracking-tight">
                    {activeDetail.date.replace(/-/g, '.')}
                  </span>
                  <span>
                    {calculatePlanetAge(state.profile.birthDate, activeDetail.date)
                      ? `登陆第 ${calculatePlanetAge(state.profile.birthDate, activeDetail.date)!.days} 天`
                      : '星光手记'}
                  </span>
                </div>
                <img
                  src={getWeatherSrc(activeDetail.weather)}
                  alt="当日天气"
                  referrerPolicy="no-referrer"
                  className="-mr-1 -mt-1 h-11 w-11 shrink-0 object-contain"
                />
              </div>

              {/* 日记正文 + 尾行金色星轨装饰 */}
              <div className="mt-2.5">
                <p className="whitespace-pre-line text-[16px] font-medium leading-[1.82] tracking-wide text-[#17284a]">
                  {activeDetail.content}
                </p>
                <div className="mt-0.5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[#7a6f62]">
                    <img
                      src={getMoodOption(activeDetail.mood).iconSrc}
                      alt={getMoodOption(activeDetail.mood).label}
                      referrerPolicy="no-referrer"
                      className="h-4.5 w-4.5 object-contain"
                    />
                    <span>
                      {getMoodOption(activeDetail.mood).label} · 记录人：{activeDetail.recorder}
                    </span>
                  </span>
                  <svg viewBox="0 0 88 18" className="h-4 w-20 opacity-85" fill="none" aria-hidden="true">
                    <path
                      d="M4 11 Q 36 12, 66 8"
                      stroke="#d7bc8a"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                    />
                    <path
                      d="M77 3L78.6 7L83 7.3L79.6 10L80.6 14.2L77 12L73.4 14.2L74.4 10L71 7.3L75.4 7L77 3Z"
                      stroke="#EAB308"
                      strokeWidth="1.4"
                      fill="#FEF08A"
                    />
                  </svg>
                </div>
              </div>

              {/* 大尺寸照片拼图 (1 大 + 2 小，点击进入大图灯箱) */}
              {activeDetail.photos.length > 0 && (
                <div className="mt-4">
                  {activeDetail.photos.length >= 3 ? (
                    <div className="grid grid-cols-[2.05fr_1fr] grid-rows-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(0)}
                        className="row-span-2 aspect-square overflow-hidden rounded-[14px] bg-[#efe2c6] shadow-xs transition-transform active:scale-[0.98]"
                      >
                        <img
                          src={activeDetail.photos[0]}
                          alt="日记主图"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(1)}
                        className="aspect-square overflow-hidden rounded-[12px] bg-[#efe2c6] shadow-xs transition-transform active:scale-[0.98]"
                      >
                        <img
                          src={activeDetail.photos[1]}
                          alt="日记配图 2"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLightboxIndex(2)}
                        className="relative aspect-square overflow-hidden rounded-[12px] bg-[#efe2c6] shadow-xs transition-transform active:scale-[0.98]"
                      >
                        <img
                          src={activeDetail.photos[2]}
                          alt="日记配图 3"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                        {activeDetail.photos.length > 3 && (
                          <span className="absolute inset-0 flex items-center justify-center bg-slate-900/45 text-sm font-bold text-white">
                            +{activeDetail.photos.length - 3}
                          </span>
                        )}
                      </button>
                    </div>
                  ) : activeDetail.photos.length === 2 ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      {activeDetail.photos.map((src, i) => (
                        <button
                          key={`${src}-${i}`}
                          type="button"
                          onClick={() => setLightboxIndex(i)}
                          className="aspect-square overflow-hidden rounded-[14px] bg-[#efe2c6] shadow-xs transition-transform active:scale-[0.98]"
                        >
                          <img
                            src={src}
                            alt={`日记配图 ${i + 1}`}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(0)}
                      className="block aspect-[4/3] w-full overflow-hidden rounded-[14px] bg-[#efe2c6] shadow-xs transition-transform active:scale-[0.99]"
                    >
                      <img
                        src={activeDetail.photos[0]}
                        alt="日记照片"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  )}
                </div>
              )}

              {/* ⭐ 小小感想 */}
              <div className="mt-5">
                <div className="flex items-center gap-1.5">
                  <IconStar className="h-5 w-5" />
                  <h2 className="text-[15.5px] font-bold tracking-wide text-[#182848]">
                    小小感想
                  </h2>
                </div>
                <div className="mt-1.5 flex items-end justify-between gap-2">
                  <p className="whitespace-pre-line text-[14px] font-medium leading-[1.78] text-[#223458]">
                    {activeDetail.reflection || '今天也是被温柔星光包围的一天呀～\n希望明天也有星星陪伴～'}
                  </p>
                </div>
                <svg viewBox="0 0 140 16" className="mt-0.5 h-4 w-32 opacity-80" fill="none" aria-hidden="true">
                  <path
                    d="M14 11 C 2 14, 24 15, 118 5"
                    stroke="#8e8274"
                    strokeWidth="1.15"
                    strokeLinecap="round"
                  />
                  <path
                    d="M128 2L129.6 5.6L133.6 6L130.6 8.5L131.5 12.2L128 10.2L124.5 12.2L125.4 8.5L122.4 6L126.4 5.6L128 2Z"
                    fill="#FDE047"
                    stroke="#EAB308"
                    strokeWidth="0.9"
                  />
                </svg>
              </div>
            </div>

            {/* 底部落草小男孩与巴哥犬手绘插画 (紧贴纸卡下沿) */}
            <div className="pointer-events-none -mx-2 -mb-[14px] mt-2 flex justify-center">
              <img
                src="./assets/extracted/diary_hero_net.png"
                alt="小男孩与巴哥犬"
                referrerPolicy="no-referrer"
                className="w-[88%] max-w-[290px] object-contain"
              />
            </div>
          </article>
        </div>
      )}

      {/* =================================================================
          2.3 写下今日的星光 (1:1 还原设计图第三屏)
         ================================================================= */}
      {mode === 'form' && (
        <form onSubmit={handleSubmitForm} className="relative z-10 flex flex-1 flex-col px-4 pt-1 pb-safe">
          <div className="diary-paper-card flex flex-1 flex-col justify-between px-2 py-1.5">
            <div className="space-y-3">
              {/* 日期 & 记录人 列表行 */}
              <div className="divide-y divide-[#e8dcc6]">
                <label className="relative flex min-h-[42px] cursor-pointer items-center justify-between py-1.5">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-[#182848]">
                    <Calendar className="h-4 w-4 text-[#a39481]" />
                    <span>日期</span>
                  </span>
                  <div className="relative flex items-center gap-1 text-[14px] font-medium text-[#182848] font-typewriter">
                    <span>{formDate.replace(/-/g, '.')}</span>
                    <ChevronRight className="h-4 w-4 text-[#a39481]" />
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      required
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </div>
                </label>

                <label className="relative flex min-h-[42px] cursor-pointer items-center justify-between py-1.5">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-[#182848]">
                    <User className="h-4 w-4 text-[#a39481]" />
                    <span>记录人</span>
                  </span>
                  <div className="relative flex items-center gap-1 text-[14px] font-medium text-[#182848]">
                    <span>{formRecorder}</span>
                    <ChevronRight className="h-4 w-4 text-[#a39481]" />
                    <select
                      value={formRecorder}
                      onChange={(e) => setFormRecorder(e.target.value)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    >
                      {state.profile.recorders.map((rec) => (
                        <option key={rec} value={rec}>
                          {rec}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
              </div>

              {/* ⭐ 情绪标签 (5 个上传手绘圆脸 + 双行文案 + 暖黄竖胶囊选中态) */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-[#182848]">
                  <IconStar className="h-4.5 w-4.5" />
                  <span>情绪标签</span>
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {MOOD_OPTIONS.map((m) => {
                    const active = formMood === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setFormMood(m.id)}
                        className={`flex flex-col items-center justify-center rounded-2xl px-0.5 py-2 transition-all ${
                          active
                            ? 'bg-[#fae498]/85 ring-1 ring-[#f2c144] shadow-xs'
                            : 'bg-transparent opacity-85 hover:bg-[#f2e7d2]/60 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={m.iconSrc}
                          alt={m.label}
                          referrerPolicy="no-referrer"
                          className="h-9 w-9 object-contain"
                        />
                        <span className="mt-1 text-[11.5px] font-bold leading-tight text-[#182848] whitespace-nowrap">
                          {m.label}
                        </span>
                        <span className="text-[10px] leading-tight text-[#5a6378] whitespace-nowrap">
                          {m.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ⭐ 天气（可选） */}
              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[14px] font-bold text-[#182848]">
                  <IconStar className="h-4.5 w-4.5" />
                  <span>天气</span>
                  <span className="text-[11.5px] font-normal text-[#7a6f62]">（可选）</span>
                </div>
                <div className="flex items-center gap-3.5">
                  {WEATHER_OPTIONS.map((w) => {
                    const active = formWeather === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setFormWeather(w.id)}
                        aria-label={w.label}
                        className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
                          active
                            ? 'bg-[#fae392]/75 ring-1 ring-[#f2c144] scale-105 shadow-xs'
                            : 'opacity-80 hover:bg-[#f2e7d2]/60 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={w.iconSrc}
                          alt={w.label}
                          referrerPolicy="no-referrer"
                          className="h-8 w-8 object-contain"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ☆ 记录内容 + 语音记日记 & 自动去除语气词 */}
              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-[14px] font-bold text-[#182848]">
                    <IconStar className="h-4.5 w-4.5" />
                    <span>记录内容</span>
                  </div>

                  {isRecordingVoice && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100/95 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                      <span>正在聆听你的声音…</span>
                    </span>
                  )}

                  {!isRecordingVoice && isPolishing && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-200/90 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>正在整理语气词…</span>
                    </span>
                  )}
                </div>

                <div
                  className={`relative rounded-2xl p-3 transition-all ${
                    isRecordingVoice
                      ? 'bg-[#fff7e2] ring-2 ring-[#f4bd36]/85 shadow-[0_0_16px_rgba(249,207,76,0.28)]'
                      : 'bg-[#f1e7d2]/85'
                  }`}
                >
                  <textarea
                    ref={textareaRef}
                    rows={5}
                    value={formContent}
                    onChange={(e) => updateFormContent(e.target.value)}
                    placeholder={'今天发生了什么呢？\n可以直接点下方「语音记日记」开口说，说完自动帮你去掉语气词～'}
                    className="w-full resize-none bg-transparent text-[13.5px] leading-relaxed text-[#182848] placeholder:text-[#9c8e7c] focus:outline-none"
                    required
                  />
                </div>

                {/* 语音记日记主按钮 + 辅助「✨ 整理语气词」按钮 */}
                <div className="mt-2.5 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isPolishing}
                    onClick={handleToggleVoice}
                    className={`flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition-all active:scale-[0.98] disabled:opacity-55 ${
                      isRecordingVoice
                        ? 'border border-rose-300 bg-gradient-to-b from-[#ff886b] to-[#e95d46] text-white shadow-[0_5px_14px_rgba(233,93,70,0.35)]'
                        : 'border border-[#f1c44d] bg-gradient-to-b from-[#fde382] to-[#f4c03c] text-[#182848] shadow-[0_4px_12px_rgba(244,192,60,0.32)]'
                    }`}
                  >
                    {isRecordingVoice ? (
                      <>
                        <Square className="h-3.5 w-3.5 fill-current" />
                        <span>说完了，自动整理</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4 stroke-[2.2]" />
                        <span>语音记日记</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={isPolishing || isRecordingVoice || !formContent.trim()}
                    onClick={handleManualPolish}
                    className="flex min-h-[42px] shrink-0 items-center justify-center gap-1 rounded-full border border-[#dcc8a0] bg-[#fffaf0] px-3.5 py-2 text-[12.5px] font-bold text-[#5d441f] shadow-2xs transition-all hover:bg-[#fbf1dc] active:scale-95 disabled:opacity-45"
                  >
                    {isPolishing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[#d97706]" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5 text-[#d97706]" />
                    )}
                    <span>{isPolishing ? '整理中…' : '整理语气词'}</span>
                  </button>
                </div>

                {/* 撤销整理按钮：整理完成后一键还原原始口述稿 */}
                {prePolishText !== null && !isRecordingVoice && !isPolishing && (
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-[#e5d5b4] bg-[#faf2e0] px-2.5 py-1.5">
                    <span className="text-[11.5px] text-[#6d5f4d]">
                      更喜欢刚才的原话吗？可一键还原
                    </span>
                    <button
                      type="button"
                      onClick={handleUndoPolish}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d9c49b] bg-white px-2.5 py-1 text-[11.5px] font-bold text-[#182848] shadow-2xs transition-transform active:scale-95"
                    >
                      <RotateCcw className="h-3 w-3 text-[#8c6426]" />
                      <span>撤销整理</span>
                    </button>
                  </div>
                )}

                {/* 轻提示区域（录音状态 / 正在整理语气词 / iPhone 键盘听写兼容提示 / 错误兜底） */}
                {voiceNotice && (
                  <p
                    role="status"
                    aria-live="polite"
                    className={`mt-2 rounded-xl px-3 py-2 text-[11.5px] leading-relaxed ${
                      voiceNotice.tone === 'error'
                        ? 'border border-rose-200 bg-rose-50 text-rose-800'
                        : voiceNotice.tone === 'success'
                        ? 'border border-emerald-200 bg-emerald-50/90 text-emerald-900'
                        : 'border border-amber-200/80 bg-amber-100/75 text-amber-950'
                    }`}
                  >
                    {voiceNotice.text}
                  </p>
                )}

                {/* 小小感想选填框 */}
                <input
                  type="text"
                  value={formReflection}
                  onChange={(e) => setFormReflection(e.target.value)}
                  placeholder="补一句小小感想（选填，将展示在日记详情底部）"
                  className="mt-2.5 w-full rounded-xl bg-[#f1e7d2]/60 px-3 py-2 text-[12.5px] text-[#182848] placeholder:text-[#9c8e7c] focus:bg-[#f1e7d2]/90 focus:outline-none"
                />
              </div>

              {/* 添加照片（最多9张） */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[13.5px] font-bold text-[#182848]">
                    添加照片
                    <span className="ml-1 text-[11.5px] font-normal text-[#7a6f62]">（最多9张）</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFormPhotos((prev) =>
                        prev.length < 9 ? [...prev, './assets/extracted/diary_photo_cat.png'] : prev
                      )
                    }
                    className="text-[11px] font-semibold text-amber-800 underline underline-offset-2"
                  >
                    + 示例图
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />

                <div className="grid grid-cols-4 gap-2">
                  {formPhotos.length < 9 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="relative aspect-square overflow-hidden rounded-xl transition-transform hover:scale-[1.02] active:scale-95"
                      aria-label="添加图片"
                    >
                      <img
                        src="./assets/extracted/diary_photo_add.png"
                        alt="添加图片"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-contain"
                      />
                    </button>
                  )}

                  {formPhotos.map((src, idx) => (
                    <div
                      key={`${src}-${idx}`}
                      className="relative aspect-square rounded-xl border border-[#ebdcb9] bg-[#fdf6e7] p-0.5"
                    >
                      <img
                        src={src}
                        alt={`已选照片 ${idx + 1}`}
                        referrerPolicy="no-referrer"
                        className="h-full w-full rounded-[10px] object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormPhotos((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#e3cfa2] text-[#5e4d30] shadow-xs hover:bg-rose-500 hover:text-white"
                        aria-label="删除照片"
                      >
                        <X className="h-3 w-3 stroke-[2.8]" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 底部大号暖金 ⭐ 保存 胶囊按钮 */}
            <button
              type="submit"
              className="mt-5 flex min-h-[46px] w-full items-center justify-center gap-1.5 rounded-full bg-[#f9cf4c] py-2.5 text-[15.5px] font-bold tracking-wider text-[#182848] shadow-[0_6px_16px_rgba(249,207,76,0.4)] transition-transform hover:bg-[#fad665] active:scale-[0.98]"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#fffdf5" aria-hidden="true">
                <path d="M12 2.5L14.6 8.3L21 8.8L16.1 13L17.6 19.2L12 15.8L6.4 19.2L7.9 13L3 8.8L9.4 8.3L12 2.5Z" />
              </svg>
              <span>保存</span>
            </button>
          </div>
        </form>
      )}

      {/* =================================================================
          2.2 日记·空状态 (还原设计图底部居中空状态卡)
         ================================================================= */}
      {mode !== 'form' && isEmptyView && (
        <div
          style={{ minHeight: 'calc(var(--app-viewport-h) - 72px - var(--safe-top))' }}
          className="relative z-10 flex flex-col items-center justify-center px-5 py-6 text-center"
        >
          <div className="diary-paper-card flex w-full max-w-[310px] flex-col items-center px-4 py-6">
            <AssetSlot slotName="empty_diary_net" showSlotTag={showSlotTag}>
              <img
                src="./assets/extracted/diary_hero_net.png"
                alt="小男孩拿捕虫网网星星与巴哥犬"
                referrerPolicy="no-referrer"
                className="h-44 w-auto object-contain"
              />
            </AssetSlot>
            <p className="mt-3 text-[15px] font-semibold leading-[1.7] text-[#182848]">
              这里是一片荒野，
              <br />
              种下第一颗星星吧 ☆
            </p>
            <button
              type="button"
              onClick={openCreateForm}
              className="mt-5 flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full bg-[#f9cf4c] px-6 py-2.5 text-[14.5px] font-bold text-[#182848] shadow-[0_5px_14px_rgba(249,207,76,0.45)] transition-transform active:scale-95"
            >
              <span>去写第一篇日记</span>
              <span aria-hidden="true">✦</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================
          2.1 日记·一级页面 (点击任意列表项即可进入独立「日记详情页」)
         ================================================================= */}
      {mode === 'list' && !isEmptyView && (
        <div className="relative z-10 flex flex-col gap-4 px-4 pt-1">
          {/* 1. 顶部破形荒野插画横幅卡 */}
          <div className="relative mt-2 pt-3">
            <button
              type="button"
              onClick={openCreateForm}
              aria-label="写一篇新日记：这里是一片荒野，种下第一颗星星吧"
              className="diary-paper-card group relative flex min-h-[110px] w-full items-center text-left transition-transform active:scale-[0.99]"
            >
              <AssetSlot
                slotName="diary_banner_net"
                showSlotTag={showSlotTag}
                className="pointer-events-none absolute -bottom-[15px] -left-[4px] z-10 w-[56%] max-w-[205px]"
              >
                <img
                  src="./assets/extracted/diary_hero_net.png"
                  alt="手拿捕星网的小男孩与巴哥犬"
                  referrerPolicy="no-referrer"
                  className="w-full h-auto drop-shadow-[0_4px_10px_rgba(32,20,6,0.18)] transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </AssetSlot>

              <div className="ml-auto flex w-[47%] flex-col items-start justify-center py-1 pl-1 pr-0.5">
                <p className="text-[14.5px] font-semibold leading-[1.6] tracking-wide text-[#1a2b4c]">
                  这里是一片荒野，
                  <br />
                  <span className="inline-flex items-center gap-1">
                    <span>种下第一颗星星吧</span>
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0" fill="none" aria-hidden="true">
                      <path
                        d="M10 2L11.8 7.1L17.2 7.4L13 10.7L14.4 16L10 13L5.6 16L7 10.7L2.8 7.4L8.2 7.1L10 2Z"
                        stroke="#F5B82E"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </p>

                <svg viewBox="0 0 116 18" className="mt-1 h-4 w-28 self-center opacity-80" fill="none" aria-hidden="true">
                  <path
                    d="M12 12 C 4 15, 22 16, 98 6"
                    stroke="#6b6257"
                    strokeWidth="1.15"
                    strokeLinecap="round"
                  />
                  <path
                    d="M106 3L107.4 6.2L111 6.5L108.3 8.8L109.1 12.2L106 10.4L102.9 12.2L103.7 8.8L101 6.5L104.6 6.2L106 3Z"
                    fill="#FDE047"
                    stroke="#EAB308"
                    strokeWidth="0.9"
                  />
                </svg>
              </div>
            </button>
          </div>

          {/* 2. 中部日记卡片列表 + 右侧金色星光滚动指示条 */}
          <div className="relative pr-2.5">
            <div className="flex flex-col gap-3.5">
              {filteredDiaries.map((entry) => {
                const age = calculatePlanetAge(state.profile.birthDate, entry.date);
                const isSelected = activeDetail?.id === entry.id;
                const thumb = entry.photos[0] || './assets/extracted/diary_photo_cat.png';
                const previewText = entry.content.replace(/\n/g, '');

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => openDetailPage(entry.id)}
                    className={`diary-paper-card flex w-full items-center gap-2.5 text-left transition-all active:scale-[0.985] ${
                      isSelected
                        ? 'drop-shadow-[0_0_12px_rgba(253,224,71,0.38)]'
                        : 'opacity-[0.96] hover:opacity-100'
                    }`}
                  >
                    <div className="relative h-[64px] w-[64px] shrink-0 overflow-hidden rounded-[12px] bg-[#efe2c6] shadow-xs">
                      <img
                        src={thumb}
                        alt="日记缩略图"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                      {entry.photos.length > 0 && (
                        <span className="absolute bottom-1 right-1 rounded-[6px] bg-[#232b3c]/78 px-1.5 py-[1px] text-[10px] font-semibold leading-tight text-white tabular-nums">
                          {entry.photos.length}+
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 py-0.5">
                      <div className="flex items-center gap-2.5 text-[11.5px] font-medium text-[#2b3c5e] tabular-nums">
                        <span className="font-typewriter tracking-tight">
                          {entry.date.replace(/-/g, '.')}
                        </span>
                        <span>{age ? `登陆第 ${age.days} 天` : '星光记录'}</span>
                      </div>

                      <p className="mt-1 line-clamp-2 text-[14px] font-semibold leading-[1.35] text-[#152547]">
                        {previewText}
                      </p>

                      <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[#7b7063]">
                        <User className="h-3 w-3 stroke-[2] text-[#a39481]" />
                        <span>{entry.recorder}</span>
                      </div>
                    </div>

                    <div className="shrink-0 self-start pt-0.5">
                      <img
                        src={getWeatherSrc(entry.weather)}
                        alt="今日天气"
                        referrerPolicy="no-referrer"
                        className="h-9 w-9 object-contain"
                      />
                    </div>
                  </button>
                );
              })}
            </div>

            {filteredDiaries.length > 1 && (
              <div
                className="pointer-events-none absolute bottom-3 right-0 top-3 w-[3px] rounded-full bg-white/15"
                aria-hidden="true"
              >
                <div
                  className="w-full rounded-full bg-[#f5cc53] shadow-[0_0_8px_rgba(245,204,83,0.8)] transition-all duration-300"
                  style={{
                    height: '26%',
                    marginTop: `${scrollThumbPercent}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================
          图片大图预览浮层 (还原设计图右下角看图组件)
         ================================================================= */}
      {lightboxIndex !== null && activeDetail && activeDetail.photos[lightboxIndex] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="照片大图预览"
          onClick={() => setLightboxIndex(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#060e26]/85 p-5 backdrop-blur-md"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-[356px] overflow-hidden rounded-[24px] border border-white/15 bg-[#0e1b3f] shadow-[0_22px_52px_rgba(3,8,24,0.7)]"
          >
            {/* 顶部缩略图切换条 + 关闭按钮 */}
            <div className="flex items-center justify-between gap-2 p-3">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {activeDetail.photos.map((src, idx) => (
                  <button
                    key={`${src}-${idx}`}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className={`h-12 w-12 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${
                      idx === lightboxIndex
                        ? 'border-[#f9cf4c] scale-105 shadow-[0_0_10px_rgba(249,207,76,0.6)]'
                        : 'border-white/25 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={src}
                      alt={`缩略图 ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                aria-label="关闭大图预览"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f5ecd9] text-[#182848] shadow-md transition-transform active:scale-90"
              >
                <X className="h-5 w-5 stroke-[2.5]" />
              </button>
            </div>

            {/* 当前放大图片 */}
            <div className="px-3 pb-3">
              <div className="overflow-hidden rounded-[16px] bg-black/25">
                <img
                  src={activeDetail.photos[lightboxIndex]}
                  alt={`日记照片 ${lightboxIndex + 1}`}
                  referrerPolicy="no-referrer"
                  className="max-h-[58vh] w-full object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
