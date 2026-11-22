import React from 'react';

interface SlotBadgeProps {
  slotName?: string;
  showSlotTag?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const AssetSlot: React.FC<SlotBadgeProps> = ({
  slotName,
  showSlotTag,
  children,
  className = '',
}) => {
  const hasPosition = /\b(absolute|fixed|sticky|relative)\b/.test(className);
  return (
    <div className={`${hasPosition ? '' : 'relative'} ${className}`.trim()}>
      {children}
      {showSlotTag && slotName && (
        <span className="pointer-events-none absolute -top-2 right-1 z-20 rounded bg-amber-300/95 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-900 shadow-sm">
          [{slotName}]
        </span>
      )}
    </div>
  );
};

export const IconStar: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <img
    src="./assets/extracted/icon_star.png"
    alt=""
    aria-hidden="true"
    referrerPolicy="no-referrer"
    className={`object-contain select-none ${className}`}
  />
);

export const IconBottle: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <img
    src="./assets/extracted/icon_bottle.png"
    alt=""
    aria-hidden="true"
    referrerPolicy="no-referrer"
    className={`object-contain select-none ${className}`}
  />
);

export const IconSprout: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <img
    src="./assets/extracted/icon_sprout.png"
    alt=""
    aria-hidden="true"
    referrerPolicy="no-referrer"
    className={`object-contain select-none ${className}`}
  />
);

export const IconShield: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <img
    src="./assets/extracted/icon_shield.png"
    alt=""
    aria-hidden="true"
    referrerPolicy="no-referrer"
    className={`object-contain select-none ${className}`}
  />
);

export const EmptyDiaryNetIllustration: React.FC<{ className?: string }> = ({ className = 'w-44 h-44' }) => (
  <svg viewBox="0 0 220 200" className={className} fill="none" aria-label="小男孩拿捕虫网网星星插画">
    <path d="M25 170Q110 148 195 170" stroke="#86EFAC" strokeWidth="6" strokeLinecap="round" opacity="0.65" />
    <line x1="120" y1="128" x2="72" y2="62" stroke="#A16207" strokeWidth="4.5" strokeLinecap="round" />
    <ellipse cx="58" cy="48" rx="28" ry="20" transform="rotate(-32 58 48)" fill="#FEF3C7" fillOpacity="0.45" stroke="#F59E0B" strokeWidth="3.5" />
    <path d="M40 42L68 58M48 32L60 64M38 56L72 42" stroke="#FCD34D" strokeWidth="1.5" opacity="0.7" />
    <path
      d="M54 38L57 44L64 45L59 50L60 57L54 53.5L48 57L49 50L44 45L51 44L54 38Z"
      fill="#FDE047"
      stroke="#D97706"
      strokeWidth="1.5"
    />
    <circle cx="132" cy="76" r="28" fill="#FDE047" stroke="#CA8A04" strokeWidth="2.5" />
    <circle cx="130" cy="79" r="20" fill="#FFE4D6" />
    <ellipse cx="120" cy="83" rx="4.5" ry="3" fill="#FCA5A5" />
    <ellipse cx="140" cy="83" rx="4.5" ry="3" fill="#FCA5A5" />
    <circle cx="123" cy="76" r="2.5" fill="#292524" />
    <circle cx="137" cy="76" r="2.5" fill="#292524" />
    <circle cx="130" cy="85" r="2.5" fill="#E11D48" opacity="0.65" />
    <path d="M114 103C114 96 146 96 146 103L150 148C150 154 110 154 110 148L114 103Z" fill="#FACC15" stroke="#CA8A04" strokeWidth="2.5" />
    <path d="M114 114L96 125" stroke="#FACC15" strokeWidth="10" strokeLinecap="round" />
    <circle cx="174" cy="48" r="3" fill="#FDE047" />
    <path d="M180 86L182 91L187 93L182 95L180 100L178 95L173 93L178 91L180 86Z" fill="#FDE047" />
  </svg>
);

export const EmptyGlassBottleIllustration: React.FC<{ className?: string }> = ({ className = 'w-44 h-44' }) => (
  <svg viewBox="0 0 200 220" className={className} fill="none" aria-label="巨大空玻璃奶瓶插画">
    <ellipse cx="100" cy="195" rx="48" ry="10" fill="#0F172A" opacity="0.25" />
    <path d="M84 36C84 22 91 16 100 16C109 16 116 22 116 36V52H84V36Z" fill="#F59E0B" fillOpacity="0.85" stroke="#D97706" strokeWidth="3" />
    <rect x="66" y="50" width="68" height="18" rx="8" fill="#93C5FD" stroke="#3B82F6" strokeWidth="3" />
    <rect x="56" y="68" width="88" height="120" rx="22" fill="#FFFFFF" fillOpacity="0.22" stroke="#BAE6FD" strokeWidth="3.5" />
    <path d="M68 86V168" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.55" />
    <line x1="112" y1="92" x2="130" y2="92" stroke="#E0F2FE" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="118" y1="112" x2="130" y2="112" stroke="#E0F2FE" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="112" y1="132" x2="130" y2="132" stroke="#E0F2FE" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="118" y1="152" x2="130" y2="152" stroke="#E0F2FE" strokeWidth="2.5" strokeLinecap="round" />
    <text x="86" y="138" fill="#E0F2FE" fontSize="14" fontFamily="monospace" opacity="0.8">0 ml</text>
    <path d="M40 94L42 99L47 101L42 103L40 108L38 103L33 101L38 99L40 94Z" fill="#FDE047" />
    <circle cx="164" cy="76" r="3" fill="#FDE047" opacity="0.8" />
  </svg>
);

export const UnconnectedPlanetIllustration: React.FC<{ className?: string }> = ({ className = 'w-48 h-48' }) => (
  <svg viewBox="0 0 220 220" className={className} fill="none" aria-label="等待建立星球连接插画">
    <circle cx="110" cy="110" r="82" stroke="#93C5FD" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.45" />
    <circle cx="110" cy="110" r="64" stroke="#FDE047" strokeWidth="1.5" strokeDasharray="4 6" opacity="0.5" />
    <circle cx="110" cy="110" r="44" fill="#3B6CB7" stroke="#93C5FD" strokeWidth="2.5" />
    <path d="M84 96Q108 82 132 98Q114 120 84 96Z" fill="#86EFAC" opacity="0.65" />
    <path d="M98 128Q120 124 134 138Q114 148 98 128Z" fill="#86EFAC" opacity="0.55" />
    <ellipse cx="110" cy="110" rx="70" ry="18" transform="rotate(-18 110 110)" stroke="#FDE047" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M162 56L164.5 62L171 63L166 67.5L167 74L162 70.5L157 74L158 67.5L153 63L159.5 62L162 56Z" fill="#FDE047" />
  </svg>
);
