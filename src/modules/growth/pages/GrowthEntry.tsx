import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { GrowthBabyProfile, GrowthMeasurement } from '../types/growth';
import { MeasurementForm } from '../components/MeasurementForm';

interface GrowthEntryProps {
  profile: GrowthBabyProfile;
  todayStr: string;
  editingMeasurement?: GrowthMeasurement | null;
  onSave: (measurement: GrowthMeasurement) => void;
  onCancel: () => void;
}

export const GrowthEntry: React.FC<GrowthEntryProps> = ({
  profile,
  todayStr,
  editingMeasurement,
  onSave,
  onCancel,
}) => {
  return (
    <div className="relative flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-clip pb-safe">
      {/* 顶部星空晕染 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-52 opacity-45"
        style={{
          backgroundImage: 'url(/assets/aistudio/____f8d9ecf9.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          WebkitMaskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
        }}
      />

      {/* 顶部导航栏 */}
      <header className="relative z-20 flex min-h-[54px] items-center justify-between px-4 pt-safe pb-1">
        <button
          type="button"
          onClick={onCancel}
          aria-label="返回观测坐标"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#132550]/65 text-indigo-100 backdrop-blur-sm transition-transform hover:bg-white/15 active:scale-90"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-1.5">
          <h1 className="text-[17.5px] font-bold tracking-[0.06em] text-[#fffaf0] drop-shadow-[0_2px_8px_rgba(4,10,30,0.85)]">
            {editingMeasurement ? '编辑成长坐标' : '记录新的成长坐标'}
          </h1>
          <span
            className="text-[12px] text-[#fde047] drop-shadow-[0_0_6px_rgba(253,224,71,0.9)]"
            aria-hidden="true"
          >
            ✦
          </span>
        </div>

        <div className="w-9" />
      </header>

      <div className="relative z-10 flex w-full min-w-0 max-w-full flex-1 flex-col px-4 pb-6">
        {/* 顶部暖心副标题 + 小宝宝与巴哥犬探头插画（置于撕纸卡片后方） */}
        <div className="relative z-10 -mb-5 flex items-end justify-between gap-2 px-1 pt-1">
          <div className="pb-6">
            <p className="text-[13px] font-semibold text-[#fff8e7] drop-shadow">
              把每一次长大，都好好收藏。
            </p>
            <p className="mt-0.5 text-[11px] text-indigo-200/85">
              保存后自动计算 WHO Z-score 与百分位数
            </p>
          </div>

          <img
            src="/assets/extracted/feed_boy_pug_planet.png"
            alt="小漫游者与巴哥犬"
            referrerPolicy="no-referrer"
            className="h-[92px] w-auto shrink-0 object-contain drop-shadow-[0_6px_14px_rgba(3,8,24,0.45)]"
          />
        </div>

        {/* 奶油色手撕纸录入表单卡片 */}
        <div className="diary-paper-card relative z-20 min-w-0 px-2.5 py-3">
          <img
            src="/assets/extracted/health_star_big.png"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -right-2 -top-4 z-30 h-8 w-8 object-contain drop-shadow-[0_0_10px_rgba(253,224,71,0.85)]"
          />
          <MeasurementForm
            profile={profile}
            todayStr={todayStr}
            initialMeasurement={editingMeasurement}
            onSubmit={onSave}
            onCancel={onCancel}
          />
        </div>
      </div>
    </div>
  );
};
