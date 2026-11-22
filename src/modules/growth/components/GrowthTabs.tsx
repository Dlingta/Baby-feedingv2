import React from 'react';
import { GrowthMetricKey } from '../types/growth';

interface GrowthTabsProps {
  activeMetric: GrowthMetricKey;
  onChangeMetric: (metric: GrowthMetricKey) => void;
}

const TAB_ITEMS: {
  key: GrowthMetricKey;
  label: string;
  unit: string;
  iconSrc: string;
}[] = [
  {
    key: 'heightCm',
    label: '身高',
    unit: 'cm',
    iconSrc: './assets/extracted/icon_star.png',
  },
  {
    key: 'weightKg',
    label: '体重',
    unit: 'kg',
    iconSrc: './assets/extracted/icon_bottle.png',
  },
  {
    key: 'headCm',
    label: '头围',
    unit: 'cm',
    iconSrc: './assets/extracted/growth_icon_tape.png',
  },
];

export const GrowthTabs: React.FC<GrowthTabsProps> = ({
  activeMetric,
  onChangeMetric,
}) => {
  return (
    <div
      role="tablist"
      aria-label="成长指标切换"
      className="grid w-full min-w-0 grid-cols-3 gap-1.5 rounded-full border border-white/15 bg-[#122452]/80 p-1 backdrop-blur-md shadow-[0_6px_18px_rgba(3,8,24,0.45)]"
    >
      {TAB_ITEMS.map((tab) => {
        const isActive = activeMetric === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChangeMetric(tab.key)}
            className={`relative flex min-h-[42px] items-center justify-center gap-1.5 rounded-full px-2.5 whitespace-nowrap transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
              isActive
                ? 'bg-gradient-to-b from-[#fff5d6] to-[#f8e6b4] typo-tab-active text-[#22293e] shadow-[0_3px_12px_rgba(250,204,52,0.4),inset_0_1px_0_rgba(255,255,255,0.9)]'
                : 'typo-tab text-indigo-100/85 hover:bg-white/10 hover:text-white'
            }`}
          >
            <img
              src={tab.iconSrc}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              className={`h-5 w-5 shrink-0 object-contain ${
                isActive ? 'drop-shadow-[0_0_6px_rgba(245,180,35,0.65)]' : 'opacity-90'
              }`}
            />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};
