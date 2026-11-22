import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, ShieldAlert, Sparkles } from 'lucide-react';
import { ChecklistItem, ModuleTab, PlanetAppState, VaccineDose } from '../types/planet';
import { calculatePlanetAge, getTodayDateStr } from '../data/initialData';
import {
  AssetSlot,
  IconBottle,
  IconShield,
  IconSprout,
  IconStar,
  UnconnectedPlanetIllustration,
} from '../components/Illustrations';

interface HomeScreenProps {
  state: PlanetAppState;
  forceEmptyState?: boolean;
  showSlotTag?: boolean;
  onNavigate: (tab: ModuleTab, subMode?: string) => void;
  onToggleChecklist: (id: string) => void;
  onQuickOpenVaccine: (dose: VaccineDose) => void;
  onOpenSettingsDrawer: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  state,
  forceEmptyState = false,
  showSlotTag = false,
  onNavigate,
  onToggleChecklist,
  onQuickOpenVaccine,
  onOpenSettingsDrawer,
}) => {
  const [recentCheckedId, setRecentCheckedId] = useState<string | null>(null);
  const [todayDate, setTodayDate] = useState<string>(() => getTodayDateStr());
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleSwipeTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    swipeStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleSwipeTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // 左滑打开星际设置抽屉
    if (dx < -48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      onOpenSettingsDrawer();
    }
  };

  const handleSwipePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    swipeStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleSwipePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx < -48 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      onOpenSettingsDrawer();
    }
  };

  useEffect(() => {
    const syncDate = () => {
      const current = getTodayDateStr();
      setTodayDate((prev) => (prev === current ? prev : current));
    };
    const timer = window.setInterval(syncDate, 30000);
    document.addEventListener('visibilitychange', syncDate);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', syncDate);
    };
  }, []);

  const isInitialized = Boolean(state.profile.birthDate) && !forceEmptyState;
  const ageInfo = calculatePlanetAge(state.profile.birthDate, todayDate);
  const babyName = state.profile.name.trim();
  const titleOwnerLine = babyName ? `${babyName}的` : '未知漫游者的';
  const titleSizeClass =
    titleOwnerLine.length <= 6
      ? 'text-[31px]'
      : titleOwnerLine.length <= 8
      ? 'text-[27px]'
      : 'text-[23px]';

  const todayDiariesCount = state.diaries.length;
  const todayFeedingsCount = state.feedings.filter((f) => f.date === todayDate).length;
  const hasTodayGrowth = state.growths.some((g) => g.date === todayDate);
  const activatedCount = state.vaccines.filter((v) => v.status === 'activated').length;
  const nextVaccine =
    state.vaccines.find((v) => v.status === 'next') ||
    state.vaccines.find((v) => v.status === 'locked');

  const handleCheck = (item: ChecklistItem) => {
    if (!item.completed) {
      setRecentCheckedId(item.id);
      setTimeout(() => setRecentCheckedId((prev) => (prev === item.id ? null : prev)), 700);
    }
    onToggleChecklist(item.id);
  };

  if (!isInitialized) {
    return (
      <div
        style={{ minHeight: 'var(--app-viewport-h)' }}
        onTouchStart={handleSwipeTouchStart}
        onTouchEnd={handleSwipeTouchEnd}
        onPointerDown={handleSwipePointerDown}
        onPointerUp={handleSwipePointerUp}
        className="relative flex w-full min-w-0 flex-col justify-between px-4 pb-6 pt-safe"
      >
        <div className="my-auto flex flex-col items-center py-8 text-center">
          <AssetSlot slotName="empty_planet_signal" showSlotTag={showSlotTag} className="mb-4">
            <UnconnectedPlanetIllustration className="h-48 w-48 animate-float-slow" />
          </AssetSlot>

          <h1 className="font-display text-3xl tracking-wide text-amber-100 text-balance">
            等待建立星球连接…
          </h1>
          <p className="mt-3 max-w-[260px] text-sm leading-relaxed text-indigo-100/75">
            尚未检测到小漫游者的降落坐标。录入宝宝昵称与出生日期，点亮第一颗属于你们的星球。
          </p>

          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="mt-7 flex min-h-[48px] items-center justify-center gap-2 rounded-[22px] bg-amber-300 px-8 py-3 typo-cta text-slate-900 shadow-[0_10px_26px_rgba(252,211,77,0.42)] transition-transform hover:bg-amber-200 active:scale-[0.97]"
          >
            <Sparkles className="h-5 w-5" />
            <span>初始化档案</span>
          </button>
        </div>

        <div className="glass-card px-4 py-3.5 text-center text-xs text-indigo-100/75">
          初始化后即可解锁每日喂养追踪、成长曲线与 19 剂疫苗护盾
        </div>
      </div>
    );
  }

  return (
    <div
      onTouchStart={handleSwipeTouchStart}
      onTouchEnd={handleSwipeTouchEnd}
      onPointerDown={handleSwipePointerDown}
      onPointerUp={handleSwipePointerUp}
      className="relative flex w-full min-w-0 max-w-full flex-col overflow-x-clip pb-6"
    >
      {/* =================================================================
          首屏独立视口容器：严格锁定为 --app-viewport-h，确保下滑板块（早教清单）不局部露出
         ================================================================= */}
      <section
        style={{ minHeight: 'var(--app-viewport-h)' }}
        className="relative flex w-full min-w-0 flex-col justify-start overflow-hidden bg-[#091535] select-none"
        aria-label="星球主视觉"
      >
        <div className="relative w-full aspect-[941/1490] shrink-0 overflow-hidden select-none">
        {/* Layer 1: 宇宙星空背景 (顶部星星、左侧土星、右上发光大星星；渐隐原图底部地球防重影) */}
        <img
          src="./assets/aistudio/____f8d9ecf9.png"
          alt="宇宙星空"
          referrerPolicy="no-referrer"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 56%, transparent 72%)',
            maskImage: 'linear-gradient(to bottom, black 56%, transparent 72%)',
          }}
          className="pointer-events-none absolute -top-[4.3%] left-0 w-full h-auto"
        />

        {/* Layer 2: 地球地平线 + 大树 + 云朵 + 花草 */}
        <img
          src="./assets/aistudio/___19d5e708.png"
          alt="星球树木与地球花草"
          referrerPolicy="no-referrer"
          style={{
            WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 93%)',
            maskImage: 'linear-gradient(to bottom, black 80%, transparent 93%)',
          }}
          className="pointer-events-none absolute -top-[9.4%] left-0 z-10 w-[104.1%] max-w-none h-[98%] object-fill"
        />

        {/* Layer 3: 右上树枝上的狸花猫 (坐稳树枝，伸爪够向发光大星星) */}
        <AssetSlot
          slotName="tabby_cat"
          showSlotTag={showSlotTag}
          className="pointer-events-none absolute left-[71.8%] top-[19.5%] z-20 w-[24.7%]"
        >
          <img
            src="./assets/extracted/tabby_cat.png"
            alt="树上够星星的狸花猫"
            referrerPolicy="no-referrer"
            className="w-full h-auto drop-shadow-[0_6px_12px_rgba(0,0,0,0.35)]"
          />
        </AssetSlot>

        {/* Layer 4: 紧挨在一起的三主角——黄衣小漫游者 + 巴哥犬 + 熟睡橘猫 (齐落地球草地弧线) */}
        <AssetSlot
          slotName="boy_wanderer"
          showSlotTag={showSlotTag}
          className="pointer-events-none absolute left-[35.4%] top-[41.4%] z-20 w-[29.2%]"
        >
          <img
            src="./assets/extracted/boy_wanderer.png"
            alt="黄衣小漫游者"
            referrerPolicy="no-referrer"
            className="w-full h-auto drop-shadow-[0_8px_16px_rgba(0,0,0,0.38)]"
          />
        </AssetSlot>

        <AssetSlot
          slotName="pug_dog"
          showSlotTag={showSlotTag}
          className="pointer-events-none absolute left-[16.5%] top-[53.0%] z-30 w-[23.9%]"
        >
          <img
            src="./assets/extracted/pug.png"
            alt="仰望小主人的巴哥犬"
            referrerPolicy="no-referrer"
            className="w-full h-auto drop-shadow-[0_8px_14px_rgba(0,0,0,0.42)]"
          />
        </AssetSlot>

        <AssetSlot
          slotName="orange_cat"
          showSlotTag={showSlotTag}
          className="pointer-events-none absolute left-[55.8%] top-[59.3%] z-30 w-[26%]"
        >
          <img
            src="./assets/extracted/orange_cat.png"
            alt="熟睡的小橘猫"
            referrerPolicy="no-referrer"
            className="w-full h-auto drop-shadow-[0_8px_12px_rgba(0,0,0,0.4)]"
          />
        </AssetSlot>

        {/* 底部自然渐隐至星空底色 */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-[#091535] via-[#091535]/50 to-transparent" />

        {/* 右侧极轻星光边缘把手：左滑首页任意区域或轻触此微光把手均可呼出设置抽屉，不破坏主画面构图 */}
        <button
          type="button"
          onClick={onOpenSettingsDrawer}
          aria-label="左滑或点击打开设置抽屉"
          title="左滑打开设置"
          className="absolute right-0 top-[44%] z-40 flex h-14 w-5 items-center justify-center rounded-l-[14px] border border-r-0 border-amber-200/25 bg-[#12224d]/45 text-amber-100/75 backdrop-blur-sm shadow-[-4px_0_14px_rgba(3,8,24,0.35)] transition-all hover:w-6 hover:bg-[#1a3069]/75 hover:text-amber-200 active:scale-95"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {/* Layer 5: 顶部快捷状态栏 (无日期/设置图标干扰，紧贴顶部安全区下方舒展排布) */}
        <div className="absolute inset-x-3.5 top-[max(2.8%,var(--safe-top))] z-40">
          <AssetSlot slotName="home_quick_capsules" showSlotTag={showSlotTag}>
            <div className="grid grid-cols-4 items-center rounded-[24px] border border-white/15 bg-[#16254e]/55 px-1.5 backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.18),0_10px_24px_rgba(4,9,26,0.44)]">
              {/* 1. 日记 */}
              <button
                type="button"
                onClick={() => onNavigate('diary')}
                className="relative flex h-[52px] items-center justify-center gap-1 rounded-full px-1 transition-colors hover:bg-white/10 active:scale-95"
              >
                <IconStar className="h-8 w-8 shrink-0 drop-shadow-[0_0_8px_rgba(253,224,71,0.6)]" />
                <div className="min-w-0 text-left leading-[1.2]">
                  <div className="flex items-center gap-0.5 text-[11.5px] font-medium text-white/95 whitespace-nowrap">
                    <span>日记</span>
                    <span className="text-[8px] text-amber-200/80" aria-hidden="true">✦</span>
                  </div>
                  <div className="text-[11.5px] font-bold text-white tabular-nums whitespace-nowrap">
                    {todayDiariesCount} 篇
                  </div>
                </div>
              </button>

              {/* 2. 喂养 */}
              <button
                type="button"
                onClick={() => onNavigate('feeding')}
                className="relative flex h-[52px] items-center justify-center gap-1 rounded-full px-1 transition-colors hover:bg-white/10 active:scale-95"
              >
                <IconBottle className="h-8 w-8 shrink-0 drop-shadow-sm" />
                <div className="min-w-0 text-left leading-[1.2]">
                  <div className="flex items-center gap-0.5 text-[11.5px] font-medium text-white/95 whitespace-nowrap">
                    <span>喂养</span>
                    <span className="text-[8px] text-amber-200/80" aria-hidden="true">✦</span>
                  </div>
                  <div className="text-[11.5px] font-bold text-white tabular-nums whitespace-nowrap">
                    {todayFeedingsCount} 次
                  </div>
                </div>
              </button>

              {/* 3. 成长 */}
              <button
                type="button"
                onClick={() => onNavigate('growth')}
                className="relative flex h-[52px] items-center justify-center gap-1 rounded-full px-1 transition-colors hover:bg-white/10 active:scale-95"
              >
                <IconSprout className="h-8 w-8 shrink-0 drop-shadow-sm" />
                <div className="min-w-0 text-left leading-[1.2]">
                  <div className="flex items-center gap-0.5 text-[11.5px] font-medium text-white/95 whitespace-nowrap">
                    <span>成长</span>
                    <span className="text-[8px] text-amber-200/80" aria-hidden="true">✦</span>
                  </div>
                  <div className="text-[11.5px] font-bold text-white whitespace-nowrap">
                    {hasTodayGrowth ? '已记' : '待记'}
                  </div>
                </div>
                {!hasTodayGrowth && (
                  <span
                    className="absolute right-1.5 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white shadow-sm"
                    aria-label="成长待记"
                  >
                    1
                  </span>
                )}
              </button>

              {/* 4. 疫苗 */}
              <button
                type="button"
                onClick={() => onNavigate('health')}
                className="relative flex h-[52px] items-center justify-center gap-1 rounded-full px-1 transition-colors hover:bg-white/10 active:scale-95"
              >
                <IconShield className="h-7 w-7 shrink-0 drop-shadow-sm" />
                <div className="min-w-0 text-left leading-[1.2]">
                  <div className="flex items-center gap-0.5 text-[11.5px] font-medium text-white/95 whitespace-nowrap">
                    <span>疫苗</span>
                    <span className="text-[8px] text-amber-200/80" aria-hidden="true">✦</span>
                  </div>
                  <div className="text-[11.5px] font-bold text-white whitespace-nowrap">
                    {activatedCount > 0 ? '已接种' : '待接种'}
                  </div>
                </div>
              </button>
            </div>
          </AssetSlot>
        </div>

        {/* Layer 6: 手写标题与登陆天数 (未填写宝宝昵称时显示“未知漫游者的”，填写后显示“{宝宝名字}的”) */}
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          aria-label="编辑宝宝信息"
          className="absolute left-6 top-[calc(14.5%+var(--safe-top)*0.45)] z-30 max-w-[66%] origin-left -rotate-[3deg] transform text-left transition-transform active:scale-[0.98]"
        >
          <div className="inline-block">
            <h1
              className={`font-display ${titleSizeClass} leading-[1.12] tracking-wider text-[#fff9ea] drop-shadow-[0_3px_10px_rgba(4,10,28,0.8)]`}
            >
              <span className="block truncate">{titleOwnerLine}</span>
              <span className="inline-flex items-center gap-2">
                <span>登陆手帐</span>
                <svg viewBox="0 0 46 28" className="h-6 w-10 inline-block shrink-0" fill="none" aria-hidden="true">
                  <path
                    d="M6 17L9 14M9 17L6 14"
                    stroke="#FDE047"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M27 4L29.5 11L36.5 11.5L31 16L32.8 23L27 19L21.2 23L23 16L17.5 11.5L24.5 11L27 4Z"
                    stroke="#FACC15"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </h1>

            <svg viewBox="0 0 180 12" className="-mt-0.5 h-3 w-40 opacity-90" fill="none" aria-hidden="true">
              <path
                d="M4 7 Q 25 3, 46 6 T 90 6 T 134 5 T 174 6"
                stroke="#FACC15"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <p className="mt-1.5 text-[13.5px] font-medium tracking-wide text-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
            {ageInfo?.isFuture ? (
              <>
                距离登陆地球还有{' '}
                <span className="font-typewriter text-[19px] font-bold text-[#fde047] tabular-nums">
                  {ageInfo.daysUntil}
                </span>{' '}
                天
              </>
            ) : (
              <>
                登陆地球的第{' '}
                <span className="font-typewriter text-[19px] font-bold text-[#fde047] tabular-nums">
                  {ageInfo?.days ?? 1}
                </span>{' '}
                天 / 第{' '}
                <span className="font-typewriter text-[19px] font-bold text-[#fde047] tabular-nums">
                  {ageInfo?.weeks ?? 1}
                </span>{' '}
                周
              </>
            )}
          </p>
        </button>

        {/* Layer 7: 地球观测记录弧线文字 + 弯曲星星箭头 (适配 375/390/430px 无溢出) */}
        <div className="pointer-events-none absolute inset-x-4 top-[74.5%] z-30 flex items-center justify-center transform -rotate-[3.5deg]">
          <p className="max-w-full truncate text-[clamp(11px,3vw,13px)] font-medium tracking-wide text-[#fff8e7] drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)]">
            地球观测记录：发现植物，以及三只毛茸茸的原住民。
          </p>
        </div>
        <svg
          viewBox="0 0 160 28"
          className="pointer-events-none absolute right-6 top-[77%] z-30 h-5 w-32 opacity-90"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M36 16 C 12 22, 18 25, 132 10"
            stroke="#FFF8E7"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M144 4L146.5 9.5L152.5 10L148 14L149.5 19.5L144 16.5L138.5 19.5L140 14L135.5 10L141.5 9.5L144 4Z"
            fill="#FDE047"
            stroke="#F59E0B"
            strokeWidth="1"
          />
        </svg>

        {/* Layer 8: 底部米白色撕纸摘要卡片 (实装上传手绘底图 + 动态可点数据) */}
        <div className="absolute inset-x-3 bottom-[2.2%] z-30">
          <AssetSlot slotName="paper_summary_card" showSlotTag={showSlotTag}>
            <div className="relative w-full select-none">
              <img
                src="./assets/extracted/paper_summary_card_dynamic.png"
                alt="今日星光、喂养与坐标摘要卡片"
                referrerPolicy="no-referrer"
                className="pointer-events-none w-full h-auto drop-shadow-[0_10px_22px_rgba(3,8,24,0.45)]"
              />

              <div className="absolute inset-0 grid grid-cols-3">
                {/* 1. 收集星光 -> 日记 */}
                <button
                  type="button"
                  onClick={() => onNavigate('diary')}
                  aria-label={`收集星光 ${todayDiariesCount} 篇`}
                  className="flex h-full flex-col justify-end pb-[14%] pl-[22%] pr-[8%] transition-transform active:scale-95"
                >
                  <div className="flex items-baseline justify-center gap-0.5 tabular-nums text-[#0b1f4d]">
                    <span className="text-[22px] typo-num leading-none tracking-tight">
                      {todayDiariesCount}
                    </span>
                    <span className="typo-meta font-semibold">篇</span>
                    <ChevronRight className="ml-0.5 h-3.5 w-3.5 self-center stroke-[2.4] text-[#9b8265]" />
                  </div>
                </button>

                {/* 2. 注入能量 -> 喂养 */}
                <button
                  type="button"
                  onClick={() => onNavigate('feeding')}
                  aria-label={`注入能量 ${todayFeedingsCount} 次`}
                  className="flex h-full flex-col justify-end pb-[14%] pl-[16%] pr-[6%] transition-transform active:scale-95"
                >
                  <div className="flex items-baseline justify-center gap-0.5 tabular-nums text-[#0b1f4d]">
                    <span className="text-[22px] typo-num leading-none tracking-tight">
                      {todayFeedingsCount}
                    </span>
                    <span className="typo-meta font-semibold">次</span>
                    <ChevronRight className="ml-0.5 h-3.5 w-3.5 self-center stroke-[2.4] text-[#9b8265]" />
                  </div>
                </button>

                {/* 3. 坐标锚定 -> 成长 */}
                <button
                  type="button"
                  onClick={() => onNavigate('growth')}
                  aria-label={hasTodayGrowth ? '坐标锚定 已记' : '坐标锚定 去记录'}
                  className="flex h-full flex-col justify-end pb-[13%] pl-[4%] pr-[10%] transition-transform active:scale-95"
                >
                  <div className="flex items-center justify-center">
                    {hasTodayGrowth ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#d8e6aa]/90 px-3.5 py-1 text-[13px] font-bold text-[#4a7c22] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
                        已记 <Check className="h-3.5 w-3.5 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-[#f4dec0]/90 px-3 py-1 text-[12.5px] font-bold text-[#8b5218]">
                        待记 <ChevronRight className="h-3.5 w-3.5 stroke-[2.6]" />
                      </span>
                    )}
                  </div>
                </button>
              </div>
            </div>
          </AssetSlot>
        </div>
        </div>
      </section>

      {/* =================================================================
          第二屏下方扩展区：早教清单 + 疫苗提醒卡（统一使用全站不规则手绘撕纸底框 .diary-paper-card）
         ================================================================= */}
      <div className="mt-4 flex flex-col gap-4 px-4">
        <section aria-label="每日早教探索清单">
          <div className="diary-paper-card px-2 py-2">
            <div className="mb-2 flex items-center justify-between px-0.5">
              <h2 className="typo-section-title text-[#1e2c4a]">今日星球早教清单</h2>
              <span className="typo-meta text-[#756657] tabular-nums">
                已完成 {state.checklist.filter((c) => c.completed).length}/{state.checklist.length}
              </span>
            </div>

            <div className="divide-y divide-[#e6d8be]">
              {state.checklist.map((item) => {
                const isBursting = recentCheckedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleCheck(item)}
                    className="relative flex w-full min-h-[48px] items-center justify-between gap-3 rounded-xl px-1 py-2.5 text-left transition-colors hover:bg-[#f3e6cc]/50 active:scale-[0.99]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200 ${
                          item.completed
                            ? 'border-[#5c9442] bg-[#6ca651] text-white'
                            : 'border-[#b9a78e] bg-white/80 text-transparent'
                        }`}
                      >
                        <Check className="h-4 w-4 stroke-[3]" />
                        {isBursting && (
                          <span className="pointer-events-none absolute -right-2 -top-2 animate-star-pop">
                            <IconStar className="h-5 w-5" />
                          </span>
                        )}
                      </span>
                      <div className="min-w-0">
                        <div
                          className={`typo-item-title truncate transition-colors ${
                            item.completed ? 'text-[#87796b] line-through' : 'text-[#2d251e]'
                          }`}
                        >
                          {item.title}
                        </div>
                        <div className="typo-meta text-[#7c6e5f] truncate">{item.subtitle}</div>
                      </div>
                    </div>
                    {item.completed && (
                      <span className="shrink-0 typo-badge text-[#55843d]">★ 已点亮</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {nextVaccine && (
          <section aria-label="下一针疫苗提醒">
            <div className="diary-paper-card relative px-2 py-2">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 border border-sky-200">
                    <IconShield className="h-8 w-8" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 typo-meta font-medium text-amber-700">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">下一针防御护盾提醒 · {nextVaccine.recommendedMonth}</span>
                    </div>
                    <div className="mt-0.5 typo-item-title text-[#1e2c4a] truncate">
                      {nextVaccine.name}（{nextVaccine.doseLabel}）
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onQuickOpenVaccine(nextVaccine)}
                  className="shrink-0 min-h-[40px] rounded-2xl bg-[#1b336b] px-3.5 py-2 typo-tab-active text-amber-100 shadow-sm transition-transform hover:bg-[#234185] active:scale-95 whitespace-nowrap"
                >
                  去打卡
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
