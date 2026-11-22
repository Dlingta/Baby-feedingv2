import React, { useState } from 'react';
import { ChevronRight, Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  GrowthAssessmentResult,
  GrowthBabyProfile,
  GrowthMeasurement,
} from '../types/growth';
import { calculateGrowthAge } from '../calculations/ageCalculator';

interface GrowthHistoryProps {
  profile: GrowthBabyProfile;
  measurements: GrowthMeasurement[];
  assessments: Record<string, GrowthAssessmentResult>;
  selectedMeasurementId: string | null;
  onSelectMeasurement: (id: string) => void;
  onEditMeasurement: (measurement: GrowthMeasurement) => void;
  onDeleteMeasurement: (id: string) => void;
  onCreateNew: () => void;
  onOpenAssessmentFor: (id: string) => void;
}

export const GrowthHistory: React.FC<GrowthHistoryProps> = ({
  profile,
  measurements,
  assessments,
  selectedMeasurementId,
  onSelectMeasurement,
  onEditMeasurement,
  onDeleteMeasurement,
  onCreateNew,
  onOpenAssessmentFor,
}) => {
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const reversed = [...measurements].sort((a, b) => b.date.localeCompare(a.date));
  const detailMeasurement = reversed.find((m) => m.id === detailId) || null;
  const detailAssessment = detailMeasurement ? assessments[detailMeasurement.id] : null;

  return (
    <section className="diary-paper-card relative z-20 min-w-0 px-2 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <div className="flex items-center gap-1.5">
          <img
            src="/assets/extracted/health_icon_calendar.png"
            alt=""
            aria-hidden="true"
            className="h-4.5 w-4.5 object-contain"
          />
          <h3 className="typo-section-title text-[#1e2c4a]">历史成长记录</h3>
          <span className="font-typewriter typo-badge text-[#8a7d6c] tabular-nums">
            ({reversed.length} 条)
          </span>
        </div>

        <button
          type="button"
          onClick={onCreateNew}
          className="inline-flex min-h-[32px] items-center gap-1 rounded-full bg-gradient-to-b from-[#ffe25e] to-[#f4b626] px-2.5 typo-badge font-semibold text-[#241b09] shadow-xs active:scale-95"
        >
          <Plus className="h-3.5 w-3.5 stroke-[2.4]" />
          <span>新增记录</span>
        </button>
      </div>

      {reversed.length === 0 ? (
        <div className="rounded-[20px] bg-[#f7f0e2] px-4 py-7 text-center">
          <div className="font-display text-2xl text-[#24324e]">尚未留下星轨坐标</div>
          <p className="mt-1 text-[12px] text-[#7a6d5e]">
            点击右上角「新增记录」，收藏宝宝第一次身长、体重与头围成长数据
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {reversed.map((item) => {
            const age = profile.birthDate
              ? calculateGrowthAge(profile.birthDate, item.date)
              : null;
            const isSelected = selectedMeasurementId === item.id;
            const assessment = assessments[item.id];
            const isDeleting = confirmDeleteId === item.id;

            return (
              <div
                key={item.id}
                onClick={() => onSelectMeasurement(item.id)}
                className={`cursor-pointer rounded-[20px] border px-3 py-3 shadow-[0_4px_12px_rgba(68,52,28,0.06)] transition-colors ${
                  isSelected
                    ? 'border-[#e8bc52] bg-[#fff7e1]'
                    : 'border-[#e6dac3] bg-[#faf4e8]/95 hover:bg-[#f6eddc]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 typo-meta">
                      <img
                        src="/assets/extracted/health_star_small.png"
                        alt=""
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 object-contain"
                      />
                      <span className="font-typewriter typo-num text-[#1e2c4a]">
                        {item.date.replace(/-/g, '.')}
                      </span>
                      <span className="typo-badge text-[#7b6e5f]">
                        {age && age.isValid ? age.displayAge : '未算月龄'}
                      </span>
                      {item.isDemo && (
                        <span className="typo-badge text-[#9b7320]">· 演示数据</span>
                      )}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 typo-body font-medium text-[#25324e] tabular-nums">
                      <span>
                        身高 {typeof item.heightCm === 'number' ? `${item.heightCm.toFixed(1)} cm` : '--'}
                      </span>
                      <span className="text-[#c5b69e]" aria-hidden="true">|</span>
                      <span>
                        体重 {typeof item.weightKg === 'number' ? `${item.weightKg.toFixed(2)} kg` : '--'}
                      </span>
                      <span className="text-[#c5b69e]" aria-hidden="true">|</span>
                      <span>
                        头围 {typeof item.headCm === 'number' ? `${item.headCm.toFixed(1)} cm` : '--'}
                      </span>
                    </div>

                    {item.note && (
                      <p className="mt-1 truncate typo-meta text-[#7c6f60]">{item.note}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailId(item.id);
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#7a6d5e] hover:bg-[#efe3cb]"
                    aria-label="查看完整测量详情"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* 底部操作行：评价状态 + 查看详情 / 编辑 / 删除 */}
                <div className="mt-2 flex items-center justify-between gap-2 border-t border-dashed border-[#e7dac2] pt-2">
                  <span
                    className={`truncate typo-badge ${
                      assessment?.overallSeverity === 'normal'
                        ? 'text-[#2e6b2a]'
                        : assessment?.overallSeverity === 'attention'
                        ? 'text-[#a16207]'
                        : assessment?.overallSeverity === 'professional'
                        ? 'text-[#c2410c]'
                        : 'text-[#7c6f60]'
                    }`}
                  >
                    评价：{assessment ? assessment.overallLabel : '待计算'}
                  </span>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailId(item.id);
                      }}
                      className="inline-flex min-h-[28px] items-center gap-0.5 rounded-lg bg-[#efe4ce] px-2 typo-badge text-[#2a3c63] hover:bg-[#e5d5b6]"
                    >
                      <Eye className="h-3 w-3" />
                      <span>详情</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditMeasurement(item);
                      }}
                      className="inline-flex min-h-[28px] items-center gap-0.5 rounded-lg bg-[#efe4ce] px-2 typo-badge text-[#2a3c63] hover:bg-[#e5d5b6]"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>编辑</span>
                    </button>

                    {isDeleting ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteMeasurement(item.id);
                          setConfirmDeleteId(null);
                        }}
                        className="inline-flex min-h-[28px] items-center rounded-lg bg-rose-600 px-2 typo-badge text-white"
                      >
                        确认删
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(item.id);
                        }}
                        aria-label="删除此条记录"
                        className="inline-flex min-h-[28px] min-w-[28px] items-center justify-center rounded-lg text-[#9a8c7b] hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 记录完整详情与当时评价弹窗 */}
      {detailMeasurement && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-4 pb-safe backdrop-blur-xs sm:items-center"
          onClick={() => setDetailId(null)}
          role="dialog"
          aria-modal="true"
          aria-label="成长记录完整详情"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[368px] max-h-[82dvh] overflow-y-auto rounded-[24px] border-2 border-[#f2dec0] bg-[#fbf4e4] p-4 text-[#1f2b47] shadow-[0_20px_48px_rgba(3,8,24,0.62)]"
          >
            <div className="flex items-center justify-between border-b border-[#e6d7bc] pb-2.5">
              <div>
                <h4 className="typo-section-title text-[#1c2a48]">
                  测量详情 · {detailMeasurement.date.replace(/-/g, '.')}
                </h4>
                <p className="text-[11px] text-[#7a6d5e]">
                  {detailAssessment?.age?.isValid
                    ? `${detailAssessment.age.displayAge}（第 ${detailAssessment.age.ageDays} 天 / ${detailAssessment.age.exactMonths.toFixed(1)} 月龄）`
                    : '未计算月龄'}
                  {detailMeasurement.isDemo ? ' · 演示数据' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                aria-label="关闭详情"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#efe4ce] text-[#5e5244]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 原始测量数据 */}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-[#f3ead6] p-2.5">
                <div className="typo-badge text-[#7a6d5e]">身长/身高</div>
                <div className="mt-0.5 font-typewriter text-[15px] typo-num">
                  {typeof detailMeasurement.heightCm === 'number'
                    ? `${detailMeasurement.heightCm.toFixed(1)} cm`
                    : '--'}
                </div>
                <div className="mt-0.5 text-[10px] text-[#8a7c6b]">
                  {detailMeasurement.measurementMethod === 'standing'
                    ? '立位测量'
                    : detailMeasurement.measurementMethod === 'recumbent'
                    ? '卧位测量'
                    : '默认方式'}
                </div>
              </div>
              <div className="rounded-2xl bg-[#f3ead6] p-2.5">
                <div className="typo-badge text-[#7a6d5e]">体重</div>
                <div className="mt-0.5 font-typewriter text-[15px] typo-num">
                  {typeof detailMeasurement.weightKg === 'number'
                    ? `${detailMeasurement.weightKg.toFixed(2)} kg`
                    : '--'}
                </div>
              </div>
              <div className="rounded-2xl bg-[#f3ead6] p-2.5">
                <div className="typo-badge text-[#7a6d5e]">头围</div>
                <div className="mt-0.5 font-typewriter text-[15px] typo-num">
                  {typeof detailMeasurement.headCm === 'number'
                    ? `${detailMeasurement.headCm.toFixed(1)} cm`
                    : '--'}
                </div>
              </div>
            </div>

            {detailMeasurement.note && (
              <div className="mt-3 rounded-2xl bg-[#f6efe0] px-3 py-2 text-[12px] text-[#4c4237]">
                <span className="font-bold">备注：</span>
                {detailMeasurement.note}
              </div>
            )}

            {/* 对应评价结果摘要 */}
            {detailAssessment && (
              <div className="mt-3 space-y-2 rounded-2xl border border-[#e3d4b8] bg-white/75 p-3">
                <div className="flex items-center justify-between">
                  <span className="typo-meta font-semibold text-[#1e2c4a]">对应营养评价快照</span>
                  <span className="text-[11px] font-bold text-[#2b5298]">
                    {detailAssessment.overallLabel}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  {(
                    [
                      detailAssessment.indicators.WAZ,
                      detailAssessment.indicators.LAZ,
                      detailAssessment.indicators.WLZ,
                      detailAssessment.indicators.BMIZ,
                    ] as const
                  ).map((ind) => (
                    <div key={ind.key} className="rounded-xl bg-[#f7f1e3] px-2 py-1.5">
                      <div className="font-bold text-[#25324e]">{ind.title}</div>
                      <div className="mt-0.5 font-typewriter text-[10.5px] text-[#6d6052] tabular-nums">
                        Z: {ind.zScore !== null ? `${ind.zScore >= 0 ? '+' : ''}${ind.zScore.toFixed(2)}` : '--'} ·{' '}
                        {ind.percentileLabel}
                      </div>
                      <div className="mt-0.5 text-[10.5px] font-bold text-[#2f6b2a]">
                        {ind.statusLabel}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-[#f1f6ff] px-2.5 py-1.5 text-[11px] text-[#284478]">
                  <span className="font-bold">头围发育监测（HCZ）：</span>
                  Z {detailAssessment.headCircumference.zScore !== null ? detailAssessment.headCircumference.zScore.toFixed(2) : '--'} ·{' '}
                  {detailAssessment.headCircumference.percentileLabel} ·{' '}
                  {detailAssessment.headCircumference.statusLabel}
                </div>

                <div className="text-[10px] text-[#8a7d6c]">
                  追溯参考版本：{detailAssessment.referenceVersionId}
                </div>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  const target = detailMeasurement;
                  setDetailId(null);
                  onEditMeasurement(target);
                }}
                className="min-h-[42px] rounded-full border border-[#d9cab0] bg-[#f4ece0] text-[13px] font-bold text-[#3f372e]"
              >
                编辑此记录
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = detailMeasurement.id;
                  setDetailId(null);
                  onOpenAssessmentFor(id);
                }}
                className="min-h-[42px] rounded-full bg-gradient-to-b from-[#ffe25e] to-[#f4b21d] typo-body font-semibold text-[#241b09]"
              >
                查看完整评价
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
