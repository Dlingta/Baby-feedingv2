import React from 'react';
import { ModuleTab } from '../types/planet';

interface BottomNavProps {
  activeTab: ModuleTab;
  onSelectTab: (tab: ModuleTab) => void;
  showSlotTag?: boolean;
}

interface NavItemConfig {
  tab: ModuleTab;
  label: string;
  slotName: string;
  iconSrc: string;
  iconClass: string;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    tab: 'home',
    label: '我的星球首页',
    slotName: 'tab_planet',
    iconSrc: '/assets/extracted/nav_planet.png',
    iconClass: 'h-11 w-auto',
  },
  {
    tab: 'diary',
    label: '星光碎片日记',
    slotName: 'tab_diary',
    iconSrc: '/assets/extracted/nav_diary.png',
    iconClass: 'h-10 w-auto',
  },
  {
    tab: 'feeding',
    label: '能量补给喂养',
    slotName: 'tab_feeding',
    iconSrc: '/assets/extracted/nav_feeding.png',
    iconClass: 'h-10 w-auto',
  },
  {
    tab: 'health',
    label: '疫苗与健康记录',
    slotName: 'tab_health',
    iconSrc: '/assets/extracted/nav_health.png',
    iconClass: 'h-10 w-auto',
  },
];

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  showSlotTag = false,
}) => {
  return (
    <nav
      aria-label="主导航栏"
      className="relative z-30 shrink-0 bg-gradient-to-t from-[#060d23] via-[#091432]/95 to-[#091432]/80 px-4 pb-3 pt-2 backdrop-blur-md"
    >
      {/* 连接 4 个手绘按钮的星尘波浪细线 + 3 颗小黄星 */}
      <div className="pointer-events-none absolute inset-x-4 top-[30px] h-5" aria-hidden="true">
        <svg viewBox="0 0 360 20" className="h-full w-full opacity-70" fill="none" preserveAspectRatio="none">
          <path
            d="M36 10 Q 90 15, 135 10 T 225 10 T 324 10"
            stroke="#F5EFE0"
            strokeOpacity="0.45"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>

        <img
          src="/assets/extracted/nav_mid_star.png"
          alt=""
          className="absolute left-1/4 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_0_5px_rgba(253,224,71,0.7)]"
        />
        <img
          src="/assets/extracted/nav_mid_star.png"
          alt=""
          className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_0_5px_rgba(253,224,71,0.7)]"
        />
        <img
          src="/assets/extracted/nav_mid_star.png"
          alt=""
          className="absolute left-3/4 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_0_5px_rgba(253,224,71,0.7)]"
        />
      </div>

      <div className="relative grid grid-cols-4 items-center">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.tab === activeTab ||
            (item.tab === 'home' && (activeTab === 'growth' || activeTab === 'settings'));

          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => onSelectTab(item.tab)}
              className="group relative flex min-h-[52px] flex-col items-center justify-center rounded-xl transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <div
                className={`flex h-12 items-center justify-center transition-all duration-200 ${
                  isActive
                    ? 'scale-110 drop-shadow-[0_0_14px_rgba(253,224,71,0.85)]'
                    : 'opacity-80 group-hover:opacity-100 group-hover:scale-105'
                }`}
              >
                <img
                  src={item.iconSrc}
                  alt=""
                  referrerPolicy="no-referrer"
                  className={`${item.iconClass} select-none object-contain`}
                />
              </div>

              {showSlotTag && (
                <span className="absolute -top-1 right-1 rounded bg-amber-300 px-1 text-[9px] font-mono text-slate-900">
                  {item.slotName}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
