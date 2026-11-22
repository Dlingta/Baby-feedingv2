import React, { useRef } from 'react';
import {
  Baby,
  BookHeart,
  ChevronRight,
  HeartPulse,
  Milk,
  Settings,
  Sparkles,
  Sprout,
  X,
} from 'lucide-react';
import { ModuleTab, PlanetAppState } from '../types/planet';
import { calculatePlanetAge, getTodayDateStr } from '../data/initialData';

interface HomeSettingsDrawerProps {
  open: boolean;
  state: PlanetAppState;
  onClose: () => void;
  onNavigate: (tab: ModuleTab) => void;
}

export const HomeSettingsDrawer: React.FC<HomeSettingsDrawerProps> = ({
  open,
  state,
  onClose,
  onNavigate,
}) => {
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const babyName = state.profile.name.trim();
  const ageInfo = calculatePlanetAge(state.profile.birthDate, getTodayDateStr());
  const sexLabel =
    state.profile.gender === 'boy'
      ? '男宝'
      : state.profile.gender === 'girl'
      ? '女宝'
      : '小星尘';

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    dragStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // 向右滑动收起抽屉
    if (dx > 44 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      onClose();
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (e.pointerType === 'touch') return;
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (dx > 44 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      onClose();
    }
  };

  const handleGo = (tab: ModuleTab) => {
    onClose();
    onNavigate(tab);
  };

  return (
    <div
      aria-hidden={!open}
      className={`absolute inset-0 z-50 overflow-hidden transition-opacity duration-300 ${
        open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      {/* 半透明星空遮罩 */}
      <button
        type="button"
        tabIndex={open ? 0 : -1}
        aria-label="关闭设置抽屉"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-[#04091c]/62 backdrop-blur-[2px]"
      />

      {/* 右侧滑出星际设置抽屉 */}
      <aside
        role="dialog"
        aria-label="星球设置侧栏"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        className={`absolute inset-y-0 right-0 flex w-[80%] max-w-[308px] flex-col justify-between rounded-l-[24px] border-l border-white/15 bg-gradient-to-b from-[#112250] via-[#0c183c] to-[#08112b] px-4 pt-safe pb-safe shadow-[-16px_0_42px_rgba(2,6,20,0.75)] transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto no-scrollbar pt-2 pb-4">
          {/* 抽屉顶栏 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <h2 className="text-[16px] font-extrabold tracking-wide text-[#fffaf0]">
                星际设置
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="收起侧栏"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-indigo-100 transition-colors hover:bg-white/20 active:scale-90"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 宝宝档案速览卡 */}
          <div className="paper-card-soft px-4 py-3.5 text-[#2d251e]">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[20px] bg-amber-100 text-amber-700 shadow-inner">
                <Baby className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-extrabold text-[#1d2b4f]">
                  {babyName || '未知漫游者'}
                </div>
                <div className="mt-0.5 text-[11.5px] text-[#786858]">
                  {state.profile.birthDate
                    ? `${sexLabel} · 已登陆第 ${ageInfo?.days ?? 1} 天`
                    : '尚未完善宝宝档案'}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleGo('settings')}
              className="mt-3.5 flex min-h-[44px] w-full items-center justify-between rounded-[20px] bg-gradient-to-b from-[#ffe25e] via-[#facc34] to-[#f1a819] px-4 py-2.5 text-[13.5px] font-extrabold text-[#241b09] shadow-[0_6px_16px_rgba(244,179,30,0.36)] transition-transform hover:brightness-105 active:scale-[0.98]"
            >
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>宝宝档案与系统设置</span>
              </span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* 快捷直达区 */}
          <div className="flex flex-col gap-2.5">
            <div className="px-1 text-[11.5px] font-semibold tracking-wider text-indigo-200/75">
              星球快捷入口
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleGo('diary')}
                className="flex flex-col items-start gap-1.5 rounded-[20px] border border-white/12 bg-[#16295c]/65 p-3 text-left shadow-[0_6px_16px_rgba(3,8,24,0.3)] transition-colors hover:bg-[#1c3470]/75 active:scale-95"
              >
                <BookHeart className="h-5 w-5 text-amber-300" />
                <span className="text-[13px] font-bold text-[#fffaf0]">星光日记</span>
                <span className="text-[11px] text-indigo-200/75">
                  已记 {state.diaries.length} 篇
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleGo('feeding')}
                className="flex flex-col items-start gap-1.5 rounded-[20px] border border-white/12 bg-[#16295c]/65 p-3 text-left shadow-[0_6px_16px_rgba(3,8,24,0.3)] transition-colors hover:bg-[#1c3470]/75 active:scale-95"
              >
                <Milk className="h-5 w-5 text-sky-300" />
                <span className="text-[13px] font-bold text-[#fffaf0]">能量喂养</span>
                <span className="text-[11px] text-indigo-200/75">
                  共 {state.feedings.length} 条
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleGo('growth')}
                className="flex flex-col items-start gap-1.5 rounded-[20px] border border-white/12 bg-[#16295c]/65 p-3 text-left shadow-[0_6px_16px_rgba(3,8,24,0.3)] transition-colors hover:bg-[#1c3470]/75 active:scale-95"
              >
                <Sprout className="h-5 w-5 text-emerald-300" />
                <span className="text-[13px] font-bold text-[#fffaf0]">观测坐标</span>
                <span className="text-[11px] text-indigo-200/75">
                  共 {state.growths.length} 次测量
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleGo('health')}
                className="flex flex-col items-start gap-1.5 rounded-[20px] border border-white/12 bg-[#16295c]/65 p-3 text-left shadow-[0_6px_16px_rgba(3,8,24,0.3)] transition-colors hover:bg-[#1c3470]/75 active:scale-95"
              >
                <HeartPulse className="h-5 w-5 text-rose-300" />
                <span className="text-[13px] font-bold text-[#fffaf0]">治愈工坊</span>
                <span className="text-[11px] text-indigo-200/75">
                  疫苗与生病记录
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* 底部手势提示 */}
        <div className="pt-2 text-center text-[11px] text-indigo-200/60">
          向右滑动或点击空白处返回星球首页
        </div>
      </aside>
    </div>
  );
};
