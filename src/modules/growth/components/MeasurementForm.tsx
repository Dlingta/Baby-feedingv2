import React, { useMemo, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle2, Info } from 'lucide-react';
import {
  GrowthBabyProfile,
  GrowthMeasurement,
  MeasurementMethod,
} from '../types/growth';
import { calculateGrowthAge } from '../calculations/ageCalculator';
import { getRecommendedMethodForAge } from '../calculations/lmsCalculator';
import { validateGrowthMeasurement } from '../calculations/measurementValidator';

interface MeasurementFormProps {
  profile: GrowthBabyProfile;
  todayStr: string;
  initialMeasurement?: GrowthMeasurement | null;
  onSubmit: (measurement: GrowthMeasurement) => void;
  onCancel: () => void;
}

export const MeasurementForm: React.FC<MeasurementFormProps> = ({
  profile,
  todayStr,
  initialMeasurement,
  onSubmit,
  onCancel,
}) => {
  const [date, setDate] = useState(initialMeasurement?.date || todayStr);
  const [heightStr, setHeightStr] = useState(
    typeof initialMeasurement?.heightCm === 'number' ? String(initialMeasurement.heightCm) : ''
  );
  const [weightStr, setWeightStr] = useState(
    typeof initialMeasurement?.weightKg === 'number' ? String(initialMeasurement.weightKg) : ''
  );
  const [headStr, setHeadStr] = useState(
    typeof initialMeasurement?.headCm === 'number' ? String(initialMeasurement.headCm) : ''
  );
  const [allowFutureImport, setAllowFutureImport] = useState(false);

  const ageAtFormDate = useMemo(
    () => (profile.birthDate ? calculateGrowthAge(profile.birthDate, date) : null),
    [profile.birthDate, date]
  );

  const recommended = useMemo(
    () => getRecommendedMethodForAge(ageAtFormDate?.isValid ? ageAtFormDate.exactMonths : null),
    [ageAtFormDate]
  );

  const [measurementMethod, setMeasurementMethod] = useState<MeasurementMethod>(
    initialMeasurement?.measurementMethod || recommended.method
  );
  const [note, setNote] = useState(initialMeasurement?.note || '');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const parseOptionalNumber = (raw: string): number | undefined => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : undefined;
  };

  const validation = useMemo(
    () =>
      validateGrowthMeasurement({
        date,
        todayStr,
        birthDate: profile.birthDate || undefined,
        heightCm: parseOptionalNumber(heightStr),
        weightKg: parseOptionalNumber(weightStr),
        headCm: parseOptionalNumber(headStr),
        measurementMethod,
        allowFutureImport,
      }),
    [date, todayStr, profile.birthDate, heightStr, weightStr, headStr, measurementMethod, allowFutureImport]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);
    if (!validation.valid) {
      return;
    }

    const nowIso = new Date().toISOString();
    const record: GrowthMeasurement = {
      id: initialMeasurement?.id || `grow-${Date.now()}`,
      babyId: profile.babyId || 'baby-primary',
      date,
      heightCm: parseOptionalNumber(heightStr),
      weightKg: parseOptionalNumber(weightStr),
      headCm: parseOptionalNumber(headStr),
      measurementMethod,
      note: note.trim(),
      isDemo: false,
      createdAt: initialMeasurement?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    onSubmit(record);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full min-w-0 space-y-3.5" noValidate>
      {/* 测量日期 */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label
            htmlFor="growth-date-input"
            className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#25324e]"
          >
            <Calendar className="h-3.5 w-3.5 text-[#3860a8]" />
            <span>测量日期</span>
          </label>
          {ageAtFormDate?.isValid && (
            <span className="text-[11px] font-semibold text-[#7b6e5f]">
              对应月龄：{ageAtFormDate.displayAge}
            </span>
          )}
        </div>

        <input
          id="growth-date-input"
          type="date"
          value={date}
          max={allowFutureImport ? undefined : todayStr}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-2xl border border-[#e3d5be] bg-[#faf4e8] px-3 py-2.5 font-typewriter text-[14px] font-bold text-[#1e2c49] focus:border-[#f0bd3f] focus:outline-none"
          required
        />

        <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-[11px] text-[#7c6f60]">
          <input
            type="checkbox"
            checked={allowFutureImport}
            onChange={(e) => setAllowFutureImport(e.target.checked)}
            className="h-3.5 w-3.5 rounded accent-[#21345e]"
          />
          <span>特殊数据导入模式（允许录入晚于今天的日期）</span>
        </label>
      </div>

      {/* 身长 / 身高 */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label
            htmlFor="growth-height-input"
            className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#25324e]"
          >
            <img
              src="./assets/extracted/growth_icon_ruler.png"
              alt=""
              aria-hidden="true"
              className="h-4 w-4 object-contain"
            />
            <span>身长 / 身高</span>
          </label>
          <span className="text-[10.5px] text-[#8a7d6c]">支持小数（如 78.5）</span>
        </div>

        <div className="flex overflow-hidden rounded-2xl border border-[#e3d5be] bg-[#faf4e8] focus-within:border-[#f0bd3f]">
          <input
            id="growth-height-input"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="25"
            max="135"
            value={heightStr}
            onChange={(e) => setHeightStr(e.target.value)}
            placeholder="请输入数值"
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-typewriter text-[15px] font-bold text-[#1e2c49] placeholder:font-sans placeholder:text-[13px] placeholder:font-normal placeholder:text-[#a69a8a] focus:outline-none tabular-nums"
          />
          <span className="flex items-center border-l border-[#e3d5be] bg-[#efe5d2]/80 px-3.5 text-[12.5px] font-bold text-[#5a5044]">
            cm
          </span>
        </div>

        {/* 测量方式：卧位测量 / 立位测量 */}
        <div className="mt-2.5">
          <div className="mb-1 flex items-center justify-between text-[11.5px] font-bold text-[#4b4237]">
            <span>测量方式</span>
            <span className="text-[10.5px] font-semibold text-[#31589c]">
              建议：{recommended.label}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: 'recumbent', label: '卧位测量（躺测身长）' },
                { value: 'standing', label: '立位测量（站测身高）' },
              ] as const
            ).map((opt) => {
              const active = measurementMethod === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMeasurementMethod(opt.value)}
                  className={`min-h-[38px] rounded-full px-2.5 text-[11.5px] font-bold transition-all active:scale-95 ${
                    active
                      ? 'border border-[#5da2e8] bg-gradient-to-b from-[#6ec0ff] to-[#4b9be8] text-white shadow-xs'
                      : 'border border-[#e3d6c1] bg-[#f7f1e5] text-[#554b40] hover:bg-[#efe4d1]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1 flex items-start gap-1 text-[10.5px] leading-relaxed text-[#786b5c]">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-[#4a6fa5]" />
            <span>
              {recommended.tip} 若实际测量方式与标准不同，系统将保留原始数值并按 WHO 规范（±0.7 cm）进行标准匹配。
            </span>
          </p>
        </div>
      </div>

      {/* 体重 */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label
            htmlFor="growth-weight-input"
            className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#25324e]"
          >
            <img
              src="./assets/extracted/growth_icon_scale.png"
              alt=""
              aria-hidden="true"
              className="h-4 w-4 object-contain"
            />
            <span>体重</span>
          </label>
          <span className="text-[10.5px] text-[#8a7d6c]">单位为公斤（如 11.20）</span>
        </div>

        <div className="flex overflow-hidden rounded-2xl border border-[#e3d5be] bg-[#faf4e8] focus-within:border-[#f0bd3f]">
          <input
            id="growth-weight-input"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.4"
            max="35"
            value={weightStr}
            onChange={(e) => setWeightStr(e.target.value)}
            placeholder="请输入数值"
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-typewriter text-[15px] font-bold text-[#1e2c49] placeholder:font-sans placeholder:text-[13px] placeholder:font-normal placeholder:text-[#a69a8a] focus:outline-none tabular-nums"
          />
          <span className="flex items-center border-l border-[#e3d5be] bg-[#efe5d2]/80 px-3.5 text-[12.5px] font-bold text-[#5a5044]">
            kg
          </span>
        </div>
      </div>

      {/* 头围 */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label
            htmlFor="growth-head-input"
            className="flex items-center gap-1.5 text-[12.5px] font-bold text-[#25324e]"
          >
            <img
              src="./assets/extracted/growth_icon_tape.png"
              alt=""
              aria-hidden="true"
              className="h-4 w-4 object-contain"
            />
            <span>头围</span>
          </label>
          <span className="text-[10.5px] text-[#8a7d6c]">用于单独发育监测（如 46.0）</span>
        </div>

        <div className="flex overflow-hidden rounded-2xl border border-[#e3d5be] bg-[#faf4e8] focus-within:border-[#f0bd3f]">
          <input
            id="growth-head-input"
            type="number"
            inputMode="decimal"
            step="0.1"
            min="20"
            max="62"
            value={headStr}
            onChange={(e) => setHeadStr(e.target.value)}
            placeholder="请输入数值"
            className="min-w-0 flex-1 bg-transparent px-3 py-2.5 font-typewriter text-[15px] font-bold text-[#1e2c49] placeholder:font-sans placeholder:text-[13px] placeholder:font-normal placeholder:text-[#a69a8a] focus:outline-none tabular-nums"
          />
          <span className="flex items-center border-l border-[#e3d5be] bg-[#efe5d2]/80 px-3.5 text-[12.5px] font-bold text-[#5a5044]">
            cm
          </span>
        </div>
      </div>

      {/* 备注 */}
      <div>
        <label
          htmlFor="growth-note-input"
          className="mb-1.5 block text-[12.5px] font-bold text-[#25324e]"
        >
          备注
        </label>
        <textarea
          id="growth-note-input"
          rows={3}
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="记录一下宝宝今天的状态吧……"
          className="w-full resize-none rounded-2xl border border-[#e3d5be] bg-[#faf4e8] px-3 py-2.5 text-[13px] leading-relaxed text-[#242f46] placeholder:text-[#a69a8a] focus:border-[#f0bd3f] focus:outline-none"
        />
      </div>

      {/* 校验错误与温和提醒 */}
      {submitAttempted && validation.errors.length > 0 && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-3 text-[12px] text-rose-700 space-y-1">
          {validation.errors.map((err, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {validation.valid && validation.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-300/80 bg-amber-50/90 p-2.5 text-[11.5px] text-amber-900 space-y-1">
          {validation.warnings.map((warn, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* 底部提交与取消按钮 */}
      <div className="space-y-2 pt-1">
        <button
          type="submit"
          className="flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-full border-2 border-[#fff0a6] bg-gradient-to-b from-[#ffe25e] via-[#facc34] to-[#f1a819] px-5 typo-cta text-[#241b09] shadow-[0_8px_20px_rgba(244,179,30,0.42),inset_0_2px_2px_rgba(255,255,255,0.65)] transition-transform hover:brightness-105 active:scale-[0.98]"
        >
          <span>✦ {initialMeasurement ? '更新成长记录' : '保存成长记录'}</span>
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="flex min-h-[42px] w-full items-center justify-center rounded-full border border-[#dfd2bc] bg-[#f4ece0] typo-body font-medium text-[#52483e] active:scale-[0.98]"
        >
          取消返回
        </button>
      </div>
    </form>
  );
};
