import React from 'react';
import { HelpCircle } from 'lucide-react';
import { EvaluationSeverity, IndicatorEvaluation } from '../types/growth';

interface AssessmentCardProps {
  indicator: IndicatorEvaluation;
  onShowExplanation: (indicator: IndicatorEvaluation) => void;
}

const ICON_MAP: Record<IndicatorEvaluation['key'], string> = {
  WAZ: '/assets/extracted/growth_icon_scale.png',
  LAZ: '/assets/extracted/growth_icon_ruler.png',
  WLZ: '/assets/extracted/growth_icon_tape.png',
  BMIZ: '/assets/extracted/growth_icon_bmi.png',
};

export function getSeverityBadgeClass(severity: EvaluationSeverity): string {
  switch (severity) {
    case 'normal':
      return 'bg-[#d8edc9] text-[#28641f] border-[#b7dc9f]';
    case 'attention':
      return 'bg-[#fef0c7] text-[#9a5b08] border-[#f4d47c]';
    case 'professional':
      return 'bg-[#ffedd5] text-[#c2410c] border-[#fdba74]';
    case 'insufficient':
    default:
      return 'bg-[#e7e2d9] text-[#6b6257] border-[#d4cdc1]';
  }
}

export const AssessmentCard: React.FC<AssessmentCardProps> = ({
  indicator,
  onShowExplanation,
}) => {
  const iconSrc = ICON_MAP[indicator.key];
  const badgeCls = getSeverityBadgeClass(indicator.severity);

  return (
    <div className="rounded-[20px] border border-[#e7dac3] bg-[#faf4e8]/95 p-3.5 shadow-[0_6px_16px_rgba(68,52,28,0.08)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f2e8d4]">
            <img
              src={iconSrc}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              className="h-7 w-7 object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="truncate text-[14px] font-extrabold text-[#1e2c4a]">
                {indicator.title}
              </h4>
              <span className="font-typewriter text-[11px] font-bold text-[#7c6e5e]">
                {indicator.shortLabel}
              </span>
            </div>
            <div className="mt-0.5 text-[11.5px] font-semibold text-[#5b5044] tabular-nums">
              当前值：
              <strong className="font-typewriter text-[#1e2c4a]">
                {indicator.rawValue !== null
                  ? `${indicator.rawValue} ${indicator.unit}`
                  : '未录入'}
              </strong>
              {indicator.medianReference !== null && (
                <span className="text-[#8a7c6b]">
                  {' '}
                  · 参考中位数 {indicator.medianReference} {indicator.unit}
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onShowExplanation(indicator)}
          className="inline-flex min-h-[30px] shrink-0 items-center gap-0.5 rounded-full border border-[#dfd1b8] bg-[#f4ebda] px-2 text-[11px] font-bold text-[#2b4474] hover:bg-[#ebdfc7] active:scale-95"
        >
          <HelpCircle className="h-3.5 w-3.5" />
          <span>说明</span>
        </button>
      </div>

      {/* Z-score / 百分位数 / 评价结果（颜色+文字双重呈现） */}
      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-[#e6d8c0] pt-2">
        <div className="flex items-center gap-3 font-typewriter text-[11.5px] text-[#4c4237] tabular-nums">
          <span>
            Z-score：
            <strong className="text-[#1e2c4a]">
              {indicator.zScore !== null
                ? `${indicator.zScore >= 0 ? '+' : ''}${indicator.zScore.toFixed(2)}`
                : '待计算'}
            </strong>
          </span>
          <span className="text-[#cbbba3]" aria-hidden="true">·</span>
          <span>
            百分位：
            <strong className="text-[#1e2c4a]">{indicator.percentileLabel}</strong>
          </span>
        </div>

        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-extrabold ${badgeCls}`}
        >
          {indicator.statusLabel}
        </span>
      </div>

      {indicator.conversionNote && (
        <div className="mt-1.5 text-[10.5px] font-medium text-[#9a5b08]">
          {indicator.conversionNote}
        </div>
      )}

      <div className="mt-1 text-[10.5px] text-[#837565]">
        参考标准：{indicator.referenceStandard}
      </div>
    </div>
  );
};
