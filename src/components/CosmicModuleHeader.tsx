import React from 'react';
import { IconStar } from './Illustrations';

/** 与「星光碎片」一致的手绘圆角返回箭头 */
export const HandDrawnBackIcon: React.FC = () => (
  <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" aria-hidden="true">
    <path
      d="M25 16H7.5M14.5 8.5L7 16L14.5 23.5"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** 与「星光碎片」一致的手绘圆角日历图标 */
export const HandDrawnCalendarIcon: React.FC = () => (
  <svg viewBox="0 0 36 36" className="h-8 w-8" fill="none" aria-hidden="true">
    <rect
      x="6"
      y="9"
      width="24"
      height="21"
      rx="5.5"
      stroke="currentColor"
      strokeWidth="2.4"
    />
    <path
      d="M12 6V11.5M24 6V11.5M6.5 15.5H29.5"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    <path
      d="M12.5 21.5C13.8 20 15.5 20.3 15.5 22C15.5 23.4 13.5 24 12.5 24.5H16M20.5 21.2C21.5 20.2 23.2 20.4 23.2 22C23.2 23.5 21.4 24.4 20.5 24.6H23.8"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** 同系列手绘圆角信息/帮助图标 */
export const HandDrawnInfoIcon: React.FC = () => (
  <svg viewBox="0 0 36 36" className="h-8 w-8" fill="none" aria-hidden="true">
    <circle cx="18" cy="18" r="11.5" stroke="currentColor" strokeWidth="2.4" />
    <path
      d="M18 16.5V23"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    />
    <circle cx="18" cy="12.2" r="1.4" fill="currentColor" />
  </svg>
);

interface CosmicModuleHeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
  backLabel?: string;
  rightAction?: React.ReactNode;
  onCalendarClick?: () => void;
  calendarActive?: boolean;
  calendarLabel?: string;
  sticky?: boolean;
}

/**
 * 全站一级模块统一手绘星空顶栏（与「星光碎片 · 成长日记」完全统一风格）
 * 左侧：手绘返回箭头 + 微斜手绘大标题 + 空心金星 + 副标题与弧线箭头
 * 中间：发光小星星点缀
 * 右侧：手绘日历或自定义同系列图标
 */
export const CosmicModuleHeader: React.FC<CosmicModuleHeaderProps> = ({
  title,
  subtitle,
  onBack,
  backLabel = '返回首页',
  rightAction,
  onCalendarClick,
  calendarActive = false,
  calendarLabel = '日历与筛选',
  sticky = false,
}) => {
  return (
    <header
      className={`${
        sticky ? 'sticky top-0 bg-[#09132e]/88 backdrop-blur-md' : 'relative'
      } z-30 flex min-h-[68px] items-start justify-between px-4 pb-1 pt-safe`}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          onClick={onBack}
          className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl text-[#c5cdfa] transition-transform hover:bg-white/10 active:scale-90"
          aria-label={backLabel}
        >
          <HandDrawnBackIcon />
        </button>

        <div className="pt-0.5 origin-left -rotate-[5deg] transform">
          <div className="flex items-center gap-1.5">
            <h1 className="typo-module-title text-[#fffaf0] drop-shadow-[0_2px_8px_rgba(4,10,30,0.85)]">
              {title}
            </h1>
            <svg
              viewBox="0 0 24 24"
              className="-mt-1 h-4.5 w-4.5 shrink-0"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 2.5L14.3 8.4L20.5 8.8L15.7 12.8L17.2 19L12 15.6L6.8 19L8.3 12.8L3.5 8.8L9.7 8.4L12 2.5Z"
                stroke="#FACC15"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="mt-1 flex flex-col items-center">
            <span className="typo-module-sub text-[#eef2ff]/95 drop-shadow">
              {subtitle}
            </span>
            <svg
              viewBox="0 0 110 10"
              className="-mt-0.5 h-2.5 w-24 opacity-90"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 7 Q 52 2, 102 6 M96 3 L103 6 L96 8.5"
                stroke="#FDE68A"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>

      <IconStar className="pointer-events-none mt-1.5 h-6 w-6 shrink-0 drop-shadow-[0_0_12px_rgba(253,224,71,0.95)]" />

      {rightAction ? (
        rightAction
      ) : onCalendarClick ? (
        <button
          type="button"
          onClick={onCalendarClick}
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform active:scale-90 ${
            calendarActive
              ? 'bg-amber-300/20 text-amber-200'
              : 'text-[#c5cdfa] hover:bg-white/10'
          }`}
          aria-label={calendarLabel}
        >
          <HandDrawnCalendarIcon />
        </button>
      ) : (
        <div className="h-11 w-11 shrink-0" />
      )}
    </header>
  );
};

interface CosmicSubHeaderProps {
  title: string;
  onBack: () => void;
  backLabel?: string;
  rightSlot?: React.ReactNode;
}

/** 全站二级页 / 表单页 / 详情页统一手绘导航栏 */
export const CosmicSubHeader: React.FC<CosmicSubHeaderProps> = ({
  title,
  onBack,
  backLabel = '返回',
  rightSlot,
}) => {
  return (
    <header className="relative z-20 flex min-h-[56px] items-center justify-between px-4 pt-safe pb-1">
      <button
        type="button"
        onClick={onBack}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-[#c5cdfa] transition-transform hover:bg-white/10 active:scale-90"
        aria-label={backLabel}
      >
        <HandDrawnBackIcon />
      </button>

      <div className="flex items-center gap-1.5">
        <h1 className="typo-nav-title text-[#fffaf0] drop-shadow-[0_2px_8px_rgba(4,10,30,0.85)]">
          {title}
        </h1>
        <span
          className="text-[12px] text-[#fde047] drop-shadow-[0_0_6px_rgba(253,224,71,0.9)]"
          aria-hidden="true"
        >
          ✦
        </span>
      </div>

      {rightSlot ? rightSlot : <div className="h-10 w-10 shrink-0" />}
    </header>
  );
};
