import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  RefreshCw,
  Settings,
  ShieldAlert,
  X,
} from 'lucide-react';
import {
  GrowthAssessmentResult,
  GrowthBabyProfile,
  GrowthMeasurement,
  GrowthReminderItem,
  IndicatorEvaluation,
} from '../types/growth';
import {
  getCurrentReferenceVersion,
  getReferenceTableMetadata,
  ReferenceLoadMode,
} from '../data/whoGrowthStandards';
import { AssessmentCard, getSeverityBadgeClass } from '../components/AssessmentCard';
import { GrowthHeroScene } from '../components/GrowthHeroScene';
import {
  CosmicModuleHeader,
  HandDrawnInfoIcon,
} from '../../../components/CosmicModuleHeader';

interface GrowthAssessmentProps {
  profile: GrowthBabyProfile;
  measurements: GrowthMeasurement[];
  assessments: Record<string, GrowthAssessmentResult>;
  reminders: GrowthReminderItem[];
  selectedMeasurementId: string | null;
  referenceMode: ReferenceLoadMode;
  onSelectMeasurement: (id: string) => void;
  onBackOverview: () => void;
  onGoToCreate: () => void;
  onOpenSettings: () => void;
  onToggleReferenceMode: (mode: ReferenceLoadMode) => void;
}

export const GrowthAssessment: React.FC<GrowthAssessmentProps> = ({
  profile,
  measurements,
  assessments,
  reminders,
  selectedMeasurementId,
  referenceMode,
  onSelectMeasurement,
  onBackOverview,
  onGoToCreate,
  onOpenSettings,
  onToggleReferenceMode,
}) => {
  const [explainingIndicator, setExplainingIndicator] = useState<IndicatorEvaluation | null>(null);
  const [showSourcesDetail, setShowSourcesDetail] = useState(false);

  const sortedDesc = useMemo(
    () => [...measurements].sort((a, b) => b.date.localeCompare(a.date)),
    [measurements]
  );

  const activeMeasurement =
    sortedDesc.find((m) => m.id === selectedMeasurementId) || sortedDesc[0] || null;

  const assessment: GrowthAssessmentResult | null = activeMeasurement
    ? assessments[activeMeasurement.id] || null
    : null;

  const refVersion = getCurrentReferenceVersion();

  const overallBannerStyle = useMemo(() => {
    if (!assessment) {
      return 'bg-[#e7e2d9] text-[#5e5449] border-[#d4cdc1]';
    }
    return getSeverityBadgeClass(assessment.overallSeverity);
  }, [assessment]);

  const headEval = assessment?.headCircumference || null;

  return (
    <div className="relative flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-clip pb-6">
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

      {/* 5.1 统一手绘星空顶栏 */}
      <CosmicModuleHeader
        title="观测坐标"
        subtitle="营养评价"
        onBack={onBackOverview}
        backLabel="返回观测坐标"
        rightAction={
          <button
            type="button"
            onClick={() => setShowSourcesDetail((v) => !v)}
            aria-label="查看参考标准说明"
            className={`flex h-11 w-11 items-center justify-center rounded-xl transition-transform active:scale-90 ${
              showSourcesDetail
                ? 'bg-amber-300/20 text-amber-200'
                : 'text-[#c5cdfa] hover:bg-white/10'
            }`}
          >
            <HandDrawnInfoIcon />
          </button>
        }
      />

      {/* 全景融合插画区：星星帽宝宝 + 巴哥犬 + 蓝色土星 + 弧形草地山丘 */}
      <GrowthHeroScene
        activeTab="assessment"
        subtitle="从每一次测量，读懂宝宝的成长。"
        onSelectOverview={onBackOverview}
        onSelectAssessment={() => {}}
      />

      <div className="relative z-20 -mt-1 flex w-full min-w-0 max-w-full flex-1 flex-col gap-4 px-4">

        {/* 宝宝姓名、月龄与被评估测量记录切换器 */}
        <div className="rounded-[22px] border border-white/15 bg-[#122452]/78 px-3.5 py-2.5 text-[12px] text-indigo-100 shadow-[0_10px_24px_rgba(3,8,24,0.38)] backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="font-semibold text-amber-100">
                {profile.name || '未知漫游者'}
              </span>
              <span className="mx-1.5 text-indigo-300/70">·</span>
              <span>
                {assessment?.age?.isValid ? assessment.age.displayAge : '未计算月龄'}
              </span>
              <span className="mx-1.5 text-indigo-300/70">·</span>
              <span>
                {profile.sex === 'male' ? '男宝' : profile.sex === 'female' ? '女宝' : '未设性别'}
              </span>
            </div>

            {sortedDesc.length > 0 && activeMeasurement && (
              <select
                aria-label="选择需要查看营养评价的测量日期"
                value={activeMeasurement.id}
                onChange={(e) => onSelectMeasurement(e.target.value)}
                className="rounded-xl border border-white/20 bg-white/10 px-2 py-1 font-typewriter text-[11px] font-bold text-amber-100"
              >
                {sortedDesc.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#0e1c42] text-white">
                    {m.date.replace(/-/g, '.')} {m.isDemo ? '(演示)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* 5.2 综合评价大奶油色手帐卡片 */}
        <section className="diary-paper-card relative z-20 min-w-0 px-2.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <img
                src="/assets/extracted/health_star_small.png"
                alt=""
                aria-hidden="true"
                className="h-5 w-5 object-contain"
              />
              <h2 className="typo-section-title text-[#1c2a48]">本次营养状况评价</h2>
            </div>
            {activeMeasurement?.isDemo && (
              <span className="typo-badge text-[#9a6a15]">演示数据</span>
            )}
          </div>

          {/* 综合状态主标牌 */}
          <div className="mt-3 flex flex-col items-center text-center">
            <div
              className={`inline-flex items-center justify-center rounded-full border-2 px-5 py-2 typo-nav-title shadow-xs ${overallBannerStyle}`}
            >
              {assessment ? assessment.overallLabel : '数据不足，暂无法评价'}
            </div>

            <p className="mt-2.5 text-[12px] leading-relaxed text-[#4f463c]">
              {assessment
                ? assessment.overallSummary
                : '请先完善宝宝档案并录入至少一条身长/身高与体重测量记录。'}
            </p>
          </div>

          {/* 缺失条件与快捷引导 */}
          {assessment && assessment.blockingReasons.length > 0 && (
            <div className="mt-3 rounded-2xl border border-[#e6d3b3] bg-[#f6ecd7] p-2.5 text-[11.5px] text-[#6d5428] space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#b45309]" />
                <span>当前暂无法生成完整评价的原因：</span>
              </div>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                {assessment.blockingReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                {(!profile.birthDate || !profile.sex || profile.isPreterm) && (
                  <button
                    type="button"
                    onClick={onOpenSettings}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-[#21345e] px-3 text-[11px] font-bold text-amber-100"
                  >
                    <Settings className="h-3 w-3" />
                    <span>去完善宝宝档案</span>
                  </button>
                )}
                {!activeMeasurement && (
                  <button
                    type="button"
                    onClick={onGoToCreate}
                    className="inline-flex min-h-[32px] items-center rounded-full bg-amber-300 px-3 text-[11px] font-bold text-[#241b09]"
                  >
                    去录入测量数据
                  </button>
                )}
                {referenceMode === 'unloaded' && (
                  <button
                    type="button"
                    onClick={() => onToggleReferenceMode('official_who_2006')}
                    className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-amber-300 px-3 text-[11px] font-bold text-[#241b09]"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>重新加载 WHO 参考数据</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 早产儿专项提醒 */}
          {assessment?.pretermNotice && (
            <div className="mt-2.5 rounded-2xl border border-[#d6e0f2] bg-[#f1f6ff] p-2.5 text-[11px] leading-relaxed text-[#24437a]">
              <div className="font-semibold">早产儿评估规则提示：</div>
              <p className="mt-0.5">{assessment.pretermNotice}</p>
            </div>
          )}

          {/* 5.3 四项核心评价指标 */}
          {assessment && (
            <div className="mt-3.5 space-y-3">
              <AssessmentCard
                indicator={assessment.indicators.WAZ}
                onShowExplanation={setExplainingIndicator}
              />
              <AssessmentCard
                indicator={assessment.indicators.LAZ}
                onShowExplanation={setExplainingIndicator}
              />
              <AssessmentCard
                indicator={assessment.indicators.WLZ}
                onShowExplanation={setExplainingIndicator}
              />
              <AssessmentCard
                indicator={assessment.indicators.BMIZ}
                onShowExplanation={setExplainingIndicator}
              />
            </div>
          )}

          {/* 概念区分提示条 */}
          <div className="mt-3.5 flex items-start gap-2 rounded-[20px] border border-[#d6e0f2] bg-[#edf3ff] px-3 py-2.5 text-[11px] leading-relaxed text-[#27447a]">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#3860a8]" />
            <span>
              低体重（WAZ）、生长迟缓（LAZ）、消瘦 / 超重 / 肥胖（WLZ 与 BMIZ）属于不同维度指标，不可混为一谈，也不可仅因单项在参考区间内即判定整体营养正常。
            </span>
          </div>

          {/* 强制免责声明 */}
          <p className="mt-3 border-t border-dashed border-[#dfd2ba] pt-2.5 text-center text-[11px] font-medium text-[#7b6e5f]">
            评价结果仅用于成长监测和营养状况参考，不替代专业医疗诊断。
          </p>
        </section>

        {/* 5.6 头围单独评价（不归入体重营养状态分级） */}
        <section className="diary-paper-card relative z-20 min-w-0 px-2.5 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <img
                src="/assets/extracted/growth_icon_tape.png"
                alt=""
                aria-hidden="true"
                className="h-6 w-6 object-contain"
              />
              <div>
                <h3 className="typo-section-title text-[#1e2c4a]">
                  头围单独评价（发育监测）
                </h3>
                <p className="typo-meta text-[#7c6f60]">
                  独立监测颅脑与生长发育，不归入体重营养状态分级
                </p>
              </div>
            </div>

            {headEval && (
              <span
                className={`shrink-0 rounded-full border px-2.5 py-0.5 typo-badge font-semibold ${getSeverityBadgeClass(
                  headEval.severity
                )}`}
              >
                {headEval.statusLabel}
              </span>
            )}
          </div>

          <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-[#f5ecda] px-2 py-2">
              <div className="typo-badge text-[#7a6d5e]">当前头围</div>
              <div className="mt-0.5 font-typewriter text-[14px] typo-num text-[#1e2c4a]">
                {headEval?.rawValue !== null && headEval?.rawValue !== undefined
                  ? `${headEval.rawValue.toFixed(1)} cm`
                  : '未录入'}
              </div>
            </div>
            <div className="rounded-xl bg-[#f5ecda] px-2 py-2">
              <div className="typo-badge text-[#7a6d5e]">HCZ Z-score</div>
              <div className="mt-0.5 font-typewriter text-[14px] typo-num text-[#1e2c4a]">
                {headEval && headEval.zScore !== null
                  ? `${headEval.zScore >= 0 ? '+' : ''}${headEval.zScore.toFixed(2)}`
                  : '待计算'}
              </div>
            </div>
            <div className="rounded-xl bg-[#f5ecda] px-2 py-2">
              <div className="typo-badge text-[#7a6d5e]">百分位数</div>
              <div className="mt-0.5 font-typewriter text-[14px] typo-num text-[#1e2c4a]">
                {headEval ? headEval.percentileLabel : '待计算'}
              </div>
            </div>
          </div>

          <p className="mt-2 text-[11.5px] leading-relaxed text-[#52483d]">
            {headEval?.advice || '录入头围后将单独对照 WHO 年龄别头围参考标准（hcfa）给出监测提示。'}
          </p>
        </section>

        {/* 0～3岁国家卫健委 9 次关键月龄评估提醒日历 */}
        <section className="diary-paper-card relative z-20 min-w-0 px-2.5 py-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <img
                src="/assets/extracted/health_icon_calendar.png"
                alt=""
                aria-hidden="true"
                className="h-4.5 w-4.5 object-contain"
              />
              <h3 className="typo-section-title text-[#1e2c4a]">
                0～3 岁成长评估日历（9 次随访节点）
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {reminders.map((item) => (
              <div
                key={item.monthAge}
                className={`rounded-xl border px-2 py-2 text-center ${
                  item.status === 'completed'
                    ? 'border-[#b7dc9f] bg-[#e4f3da] text-[#28641f]'
                    : item.status === 'upcoming'
                    ? 'border-[#f4c95d] bg-[#fff3cc] text-[#8a5514]'
                    : 'border-[#e5d9c3] bg-[#f8f2e6] text-[#6d6052]'
                }`}
              >
                <div className="flex items-center justify-center gap-1 typo-meta font-semibold">
                  <img
                    src="/assets/extracted/health_star_small.png"
                    alt=""
                    aria-hidden="true"
                    className={`h-3.5 w-3.5 object-contain ${
                      item.status === 'completed' || item.status === 'upcoming'
                        ? ''
                        : 'opacity-45 grayscale'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                <div className="mt-0.5 text-[10px] font-semibold">
                  {item.status === 'completed'
                    ? `已记 ${item.completedDate?.slice(5).replace('-', '.')}`
                    : item.status === 'upcoming'
                    ? '当前建议评估'
                    : item.status === 'overdue'
                    ? '可补录记录'
                    : '待解锁'}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5.5 生长参考区间说明：「这些参考曲线从哪里来？」 */}
        <section className="diary-paper-card relative z-20 min-w-0 px-2.5 py-3">
          <button
            type="button"
            onClick={() => setShowSourcesDetail((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
          >
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-[#2b5298]" />
              <h3 className="typo-section-title text-[#1e2c4a]">
                这些参考曲线从哪里来？
              </h3>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-[#7c6f60] transition-transform ${
                showSourcesDetail ? 'rotate-180' : ''
              }`}
            />
          </button>

          <p className="mt-1.5 text-[11.5px] leading-relaxed text-[#5c5145]">
            本页面参考世界卫生组织（WHO）儿童生长标准，并结合国家卫生健康委《婴幼儿营养喂养评估服务指南（试行）》进行设计。WHO 百分位数与 Z-score 仅反映相对参考人群的位置，不能直接等同于医学诊断。
          </p>

          {showSourcesDetail && (
            <div className="mt-2.5 space-y-2 border-t border-dashed border-[#dfd2ba] pt-2.5 text-[11px] text-[#453c33]">
              <div>
                <span className="font-bold text-[#1e2c4a]">参考标准名称：</span>
                {refVersion.standardName} &amp; {refVersion.guidelineName}
              </div>
              <div>
                <span className="font-bold text-[#1e2c4a]">数据版本与追溯 ID：</span>
                <span className="font-typewriter">{refVersion.versionId}</span>（{refVersion.version}）
              </div>
              <div>
                <span className="font-bold text-[#1e2c4a]">适用年龄与单位：</span>
                {refVersion.ageRangeLabel} · {refVersion.unitsSummary}
              </div>
              <div>
                <span className="font-bold text-[#1e2c4a]">数据更新时间：</span>
                {refVersion.updatedAt}
              </div>

              <div className="rounded-xl bg-[#f5ecda] p-2.5 space-y-1">
                <div className="font-bold text-[#1e2c4a]">已接入官方 WHO LMS 参数表：</div>
                {(['wfa', 'lhfa', 'wfl', 'wfh', 'bfa', 'hcfa'] as const).map((code) => {
                  const meta = getReferenceTableMetadata(code);
                  return (
                    <div key={code} className="text-[10.5px] text-[#5c5145]">
                      • <strong>{meta.zhName}</strong>（{meta.enName}）：{meta.validRange}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl bg-[#f1f6ff] p-2.5 space-y-1 text-[#24437a]">
                <div className="font-bold">评价规则与标准差异说明：</div>
                <div>• 低体重：WAZ &lt; -2SD（&lt;P3）；生长迟缓：LAZ &lt; -2SD（&lt;P3）；消瘦：WLZ / BMIZ &lt; -2SD（&lt;P3）。</div>
                <div>• 超重与肥胖：国家卫健委试行指南采用 WLZ / BMIZ &gt;+1SD～+2SD 为超重、&gt;+2SD 为肥胖；WHO 2006 对 0～5 岁则将 &gt;+1SD 称为超重风险、&gt;+2SD 为超重、&gt;+3SD 为肥胖，本系统在提示文案中均明确标出。</div>
                <div>• 头围（HCZ）：单独用于颅脑与生长发育监测，不参与体重营养状态分级。</div>
              </div>

              {/* 参考数据状态诊断开关（便于测试参考数据未加载状态） */}
              <div className="flex items-center justify-between rounded-xl border border-[#dfd2ba] bg-white/75 px-2.5 py-2">
                <span className="text-[10.5px] font-semibold text-[#5b5044]">
                  参考数据状态：{referenceMode === 'official_who_2006' ? '已加载官方 WHO 2006' : '模拟未加载状态'}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onToggleReferenceMode(
                      referenceMode === 'official_who_2006' ? 'unloaded' : 'official_who_2006'
                    )
                  }
                  className="rounded-lg bg-[#efe4ce] px-2 py-1 text-[10.5px] font-bold text-[#21345e] hover:bg-[#e5d5b6]"
                >
                  {referenceMode === 'official_who_2006' ? '测试未加载状态' : '恢复官方数据'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 指标专业说明弹窗 */}
      {explainingIndicator && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 pb-safe backdrop-blur-xs sm:items-center"
          onClick={() => setExplainingIndicator(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${explainingIndicator.title} 指标说明`}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[360px] rounded-[24px] border-2 border-[#f2dec0] bg-[#fbf4e4] p-4 text-[#1e2c4a] shadow-[0_20px_48px_rgba(3,8,24,0.62)]"
          >
            <div className="flex items-center justify-between border-b border-[#e6d7bc] pb-2.5">
              <div>
                <h4 className="typo-section-title">
                  {explainingIndicator.title}（{explainingIndicator.shortLabel}）
                </h4>
                <p className="text-[11px] text-[#7a6d5e]">{explainingIndicator.referenceStandard}</p>
              </div>
              <button
                type="button"
                onClick={() => setExplainingIndicator(null)}
                aria-label="关闭说明"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#efe4ce] text-[#5e5244]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2.5 text-[12px] leading-relaxed text-[#453c33]">
              <p>{explainingIndicator.explanation}</p>

              <div className="rounded-2xl bg-[#f4ebda] p-2.5">
                <div className="text-[11px] font-bold text-[#6e6052]">本次判定解读：</div>
                <div className="mt-1 font-semibold text-[#1e2c4a]">
                  {explainingIndicator.detailMessage}
                </div>
              </div>

              <div className="rounded-2xl bg-[#f1f6ff] p-2.5 text-[11px] text-[#27447a]">
                <div className="font-bold">对应评价边界：</div>
                <div className="mt-0.5">{explainingIndicator.guidelineBoundaryNote}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExplainingIndicator(null)}
              className="mt-4 min-h-[42px] w-full rounded-full bg-gradient-to-b from-[#ffe25e] to-[#f4b21d] typo-item-title text-[#241b09]"
            >
              我知道了
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
