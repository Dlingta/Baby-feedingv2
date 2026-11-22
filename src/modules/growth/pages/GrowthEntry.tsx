import React from 'react';
import { GrowthBabyProfile, GrowthMeasurement } from '../types/growth';
import { MeasurementForm } from '../components/MeasurementForm';
import { CosmicSubHeader } from '../../../components/CosmicModuleHeader';

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
          backgroundImage: 'url(./assets/aistudio/____f8d9ecf9.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          WebkitMaskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
        }}
      />

      {/* 统一二级手绘导航栏 */}
      <CosmicSubHeader
        title={editingMeasurement ? '编辑成长坐标' : '记录新的成长坐标'}
        onBack={onCancel}
        backLabel="返回观测坐标"
      />

      <div className="relative z-10 flex w-full min-w-0 max-w-full flex-1 flex-col px-4 pb-6">
        {/* 顶部暖心副标题 + 透明抠图小漫游者与巴哥犬探头插画（置于撕纸卡片后方，无矩形边框） */}
        <div className="relative z-10 -mb-6 flex items-end justify-between gap-2 px-1 pt-1">
          <div className="pb-7">
            <p className="typo-item-title text-[#fff8e7] drop-shadow">
              把每一次长大，都好好收藏。
            </p>
            <p className="mt-0.5 typo-meta text-indigo-200/85">
              保存后自动计算 WHO Z-score 与百分位数
            </p>
          </div>

          <div className="pointer-events-none relative flex shrink-0 items-end">
            <img
              src="./assets/extracted/pug.png"
              alt="仰望小主人的巴哥犬"
              referrerPolicy="no-referrer"
              className="-mr-4 mb-1 h-[62px] w-auto object-contain drop-shadow-[0_6px_12px_rgba(3,8,24,0.45)]"
            />
            <img
              src="./assets/extracted/boy_wanderer.png"
              alt="黄色星星帽小漫游者"
              referrerPolicy="no-referrer"
              className="h-[88px] w-auto object-contain drop-shadow-[0_8px_16px_rgba(3,8,24,0.48)]"
            />
          </div>
        </div>

        {/* 奶油色手撕纸录入表单卡片 */}
        <div className="diary-paper-card relative z-20 min-w-0 px-2.5 py-3">
          <img
            src="./assets/extracted/health_star_big.png"
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
