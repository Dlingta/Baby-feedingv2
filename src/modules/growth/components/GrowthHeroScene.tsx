import React from 'react';

interface GrowthHeroSceneProps {
  activeTab: 'overview' | 'assessment';
  subtitle: string;
  onSelectOverview: () => void;
  onSelectAssessment: () => void;
}

/**
 * 观测坐标 / 营养评价 原版手绘全景插画区
 * 直接还原参考图中的原生水彩插画（紧密依偎的巴哥犬与黄色星星帽宝宝、繁茂花草弧形草地、左侧蓝色土星环），
 * 上方边缘与左上文字区做柔和透明羽化，无缝融入深蓝星空并与全站统一的「观测坐标」手绘顶栏自然衔接；
 * 「走势与历史 / 专业营养评价」切换胶囊位于草坡底缘、宝宝档案卡正上方，绝不遮挡角色脸部。
 */
export const GrowthHeroScene: React.FC<GrowthHeroSceneProps> = ({
  activeTab,
  subtitle,
  onSelectOverview,
  onSelectAssessment,
}) => {
  return (
    <div className="relative -mt-8 w-full select-none">
      {/* 原版手绘全景插画（紧靠依偎的主角 + 丰富花草草地 + 左侧土星环，自然羽化融入星空） */}
      <div className="relative w-full overflow-hidden">
        <img
          src="./assets/extracted/growth_hero_scene.png"
          alt="黄色星星帽小漫游者与仰望的巴哥犬坐在开满小花的星球草地上"
          referrerPolicy="no-referrer"
          className="pointer-events-none block w-full h-auto select-none"
        />

        {/* 左上星空留白区诗意副标（位于统一「观测坐标」标题正下方、小蓝星上方，不遮挡任何插画） */}
        <div className="pointer-events-none absolute left-4 top-[36px] z-20 max-w-[47%]">
          <p className="typo-meta leading-snug text-amber-100/90 drop-shadow-[0_2px_6px_rgba(4,10,28,0.9)]">
            {subtitle}
          </p>
        </div>

        {/* 副标与小蓝星、巴哥犬之间的星空留白点缀两颗暖金色手绘星星 */}
        <img
          src="./assets/extracted/feed_glow_star.png"
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="animate-float-slow pointer-events-none absolute left-[21%] top-[46%] z-10 h-7 w-7 -rotate-12 object-contain opacity-95 drop-shadow-[0_0_10px_rgba(253,224,71,0.88)]"
        />
        <img
          src="./assets/extracted/health_star_small.png"
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute left-[35%] top-[41%] z-10 h-4 w-4 rotate-12 object-contain opacity-90 drop-shadow-[0_0_8px_rgba(253,224,71,0.9)]"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-[30%] top-[60%] z-10 h-1.5 w-1.5 rounded-full bg-amber-100/85 shadow-[0_0_8px_rgba(254,240,138,0.95)]"
        />
      </div>

      {/* 视图切换胶囊：轻落于草地最底缘、宝宝档案卡正上方，完全不遮挡巴哥犬与宝宝的脸 */}
      <div className="relative z-20 -mt-3.5 mb-2 flex justify-center px-4">
        <div className="inline-flex items-center rounded-full border border-white/15 bg-[#152550]/88 p-0.5 shadow-[0_6px_16px_rgba(3,8,24,0.52)] backdrop-blur-md">
          <button
            type="button"
            onClick={onSelectOverview}
            className={`rounded-full px-3.5 py-1 transition-all ${
              activeTab === 'overview'
                ? 'bg-gradient-to-b from-[#ffe25f] via-[#facc34] to-[#f2ab1a] typo-tab-active text-[#1f190d] shadow-xs'
                : 'typo-tab text-indigo-100/85 hover:text-white'
            }`}
          >
            走势与历史
          </button>
          <button
            type="button"
            onClick={onSelectAssessment}
            className={`rounded-full px-3.5 py-1 transition-all ${
              activeTab === 'assessment'
                ? 'bg-gradient-to-b from-[#ffe25f] via-[#facc34] to-[#f2ab1a] typo-tab-active text-[#1f190d] shadow-xs'
                : 'typo-tab text-indigo-100/85 hover:text-white'
            }`}
          >
            专业营养评价
          </button>
        </div>
      </div>
    </div>
  );
};
