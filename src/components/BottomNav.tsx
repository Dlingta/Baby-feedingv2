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
    label: '星球首页',
    slotName: 'tab_planet',
    iconSrc: '/assets/extracted/nav_planet.png',
    iconClass: 'h-10 w-auto',
  },
  {
    tab: 'diary',
    label: '日记本',
    slotName: 'tab_diary',
    iconSrc: '/assets/extracted/nav_diary.png',
    iconClass: 'h-9 w-auto',
  },
  {
    tab: 'feeding',
    label: '喂养',
    slotName: 'tab_feeding',
    iconSrc: '/assets/extracted/nav_feeding.png',
    iconClass: 'h-9 w-auto',
  },
  {
    tab: 'growth',
    label: '观测坐标',
    slotName: 'tab_growth',
    iconSrc: '/assets/extracted/icon_sprout.png',
    iconClass: 'h-9 w-auto',
  },
  {
    tab: 'health',
    label: '治愈工坊',
    slotName: 'tab_health',
    iconSrc: '/assets/extracted/nav_health.png',
    iconClass: 'h-9 w-auto',
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
      className="relative z-40 w-full shrink-0 border-t border-white/[0.08] bg-gradient-to-t from-[#060d23] via-[#091432]/96 to-[#091432]/86 px-2.5 pt-2 pb-[max(10px,env(safe-area-inset-bottom,0px))] backdrop-blur-md shadow-[0_-10px_28px_rgba(3,8,22,0.58)]"
    >
      {/* 连接 5 个手绘按钮的星尘波浪细线 + 4 颗小黄星 */}
      <div className="pointer-events-none absolute inset-x-3 top-[29px] h-5" aria-hidden="true">
        <svg viewBox="0 0 360 20" className="h-full w-full opacity-70" fill="none" preserveAspectRatio="none">
          <path
            d="M28 10 Q 72 15, 108 10 T 180 10 T 252 10 T 332 10"
            stroke="#F5EFE0"
            strokeOpacity="0.45"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>

        {['left-[20%]', 'left-[40%]', 'left-[60%]', 'left-[80%]'].map((pos) => (
          <img
            key={pos}
            src="/assets/extracted/nav_mid_star.png"
            alt=""
            className={`absolute ${pos} top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_0_5px_rgba(253,224,71,0.75)]`}
          />
        ))}
      </div>

      <div className="relative grid grid-cols-5 items-center">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.tab === activeTab ||
            (item.tab === 'home' && activeTab === 'settings');

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
                className={`relative flex h-11 items-center justify-center transition-all duration-200 ${
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
                <span className="absolute -top-1 right-0.5 rounded bg-amber-300 px-1 text-[8.5px] font-mono text-slate-900">
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
