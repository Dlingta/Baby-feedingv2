import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Trash2,
  X,
} from 'lucide-react';
import { IllnessRecord, PlanetAppState, VaccineDose } from '../types/planet';
import { REFERENCE_TODAY } from '../data/initialData';
import { IconShield } from '../components/Illustrations';

export type HealthViewMode = 'vaccine' | 'vaccine_sheet' | 'illness' | 'illness_form';

interface HealthScreenProps {
  state: PlanetAppState;
  mode: HealthViewMode;
  activeSheetDoseId?: string | null;
  onChangeMode: (mode: HealthViewMode) => void;
  onBackHome: () => void;
  onConfirmVaccine: (doseId: string, date: string, note: string) => void;
  onResetVaccine: (doseId: string) => void;
  onAddIllness: (record: IllnessRecord) => void;
  onDeleteIllness: (id: string) => void;
}

const SYMPTOM_OPTIONS = [
  '发热',
  '咳嗽',
  '流涕',
  '腹泻',
  '呕吐',
  '皮疹',
  '食欲不振',
  '哭闹',
];

export const HealthScreen: React.FC<HealthScreenProps> = ({
  state,
  mode,
  activeSheetDoseId,
  onChangeMode,
  onBackHome,
  onConfirmVaccine,
  onResetVaccine,
  onAddIllness,
  onDeleteIllness,
}) => {
  const defaultNextDose =
    state.vaccines.find((v) => v.status === 'next') || state.vaccines[3] || state.vaccines[0];

  const [sheetDoseId, setSheetDoseId] = useState<string>(activeSheetDoseId || defaultNextDose.id);
  const [vacDate, setVacDate] = useState<string>(REFERENCE_TODAY);
  const [vacNote, setVacNote] = useState<string>('');

  // 5.4 生病护理新建表单状态
  const [illDate, setIllDate] = useState(REFERENCE_TODAY);
  const [illTime, setIllTime] = useState('21:30');
  const [tempStr, setTempStr] = useState('38.7');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>(['发热', '哭闹']);
  const [medication, setMedication] = useState('');
  const [recorder, setRecorder] = useState(state.profile.recorders[0] || '妈妈');

  const isSheetOpen = mode === 'vaccine_sheet';
  const isIllnessTab = mode === 'illness' || mode === 'illness_form';

  const activeDose =
    state.vaccines.find((v) => v.id === (activeSheetDoseId || sheetDoseId)) || defaultNextDose;

  const openVaccineSheet = (dose: VaccineDose) => {
    setSheetDoseId(dose.id);
    setVacDate(dose.inoculatedDate || REFERENCE_TODAY);
    setVacNote(dose.note || '');
    onChangeMode('vaccine_sheet');
  };

  const handleSaveVaccineSheet = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmVaccine(activeDose.id, vacDate, vacNote.trim() || '按计划顺利接种，观察半小时无异常');
    onChangeMode('vaccine');
  };

  const toggleSymptom = (sym: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]
    );
  };

  const handleSaveIllness = (e: React.FormEvent) => {
    e.preventDefault();
    const record: IllnessRecord = {
      id: `ill-${Date.now()}`,
      date: illDate,
      time: illTime,
      temperatureC: parseFloat(tempStr) || 37.0,
      symptoms: selectedSymptoms.length > 0 ? selectedSymptoms : ['观察中'],
      medication: medication.trim() || '温水物理降温，保持室内通风与补水',
      recorder,
    };
    onAddIllness(record);
    onChangeMode('illness');
  };

  const activatedCount = state.vaccines.filter((v) => v.status === 'activated').length;
  const parsedTemp = parseFloat(tempStr) || 0;
  const isFormOverheat = parsedTemp >= 38.5;

  return (
    <div className="relative flex min-h-full flex-col pb-6">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-20 flex h-[56px] items-center justify-between bg-[#09132e]/85 px-4 backdrop-blur-md">
        <button
          type="button"
          onClick={
            mode === 'illness_form'
              ? () => onChangeMode('illness')
              : onBackHome
          }
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-indigo-100 hover:bg-white/10 active:scale-95"
          aria-label="返回"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 font-display text-xl tracking-wide text-amber-100">
            <IconShield className="h-5 w-5" />
            <span>治愈工坊</span>
          </div>
          <div className="text-[11px] text-indigo-200/75">
            {mode === 'illness_form'
              ? '新建异常护理记录'
              : isIllnessTab
              ? '异常修复 · 生病护理'
              : `防御护盾 · 已激活 ${activatedCount}/19 剂`}
          </div>
        </div>

        {mode === 'illness' ? (
          <button
            type="button"
            onClick={() => onChangeMode('illness_form')}
            className="flex min-h-[40px] items-center gap-1 rounded-xl bg-amber-300 px-3 text-xs font-bold text-slate-900 shadow-sm active:scale-95 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>记护理</span>
          </button>
        ) : (
          <div className="w-[44px]" />
        )}
      </header>

      {/* 顶部右侧切换 Tab (防御护盾 / 异常修复) */}
      {mode !== 'illness_form' && (
        <div className="px-4 pt-2">
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-white/15 bg-white/10 p-1 backdrop-blur-sm">
            <button
              type="button"
              onClick={() => onChangeMode('vaccine')}
              className={`min-h-[42px] rounded-xl text-xs font-bold transition-all ${
                !isIllnessTab
                  ? 'bg-amber-300 text-slate-900 shadow-sm'
                  : 'text-indigo-100 hover:bg-white/10'
              }`}
            >
              防御护盾（19剂疫苗）
            </button>
            <button
              type="button"
              onClick={() => onChangeMode('illness')}
              className={`min-h-[42px] rounded-xl text-xs font-bold transition-all ${
                isIllnessTab
                  ? 'bg-amber-300 text-slate-900 shadow-sm'
                  : 'text-indigo-100 hover:bg-white/10'
              }`}
            >
              异常修复（生病护理）
            </button>
          </div>
        </div>
      )}

      {/* 5.1 健康·防御护盾 (19 剂疫苗时间轴列表) */}
      {!isIllnessTab && (
        <div className="mt-3.5 flex flex-col gap-3 px-4">
          {/* 护盾能量进度条 */}
          <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-amber-100">行星护盾激活度</span>
              <span className="font-typewriter font-bold text-amber-300 tabular-nums">
                {activatedCount} / 19 剂
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-300 transition-all duration-300"
                style={{ width: `${Math.round((activatedCount / 19) * 100)}%` }}
              />
            </div>
          </div>

          {/* 19 剂时间轴 */}
          <div className="relative space-y-2.5 pl-4">
            {/* 时间轴竖线 */}
            <div className="pointer-events-none absolute bottom-4 left-[23px] top-4 w-0.5 bg-indigo-300/25" />

            {state.vaccines.map((dose) => {
              const isActivated = dose.status === 'activated';
              const isNext = dose.status === 'next';

              return (
                <div key={dose.id} className="relative flex items-start gap-3">
                  {/* 节点圆点 */}
                  <div
                    className={`relative z-10 mt-3.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                      isActivated
                        ? 'border-emerald-300 bg-emerald-500 text-white shadow-[0_0_10px_rgba(52,211,153,0.75)]'
                        : isNext
                        ? 'border-amber-200 bg-amber-400 text-slate-900 shadow-[0_0_12px_rgba(251,191,36,0.85)]'
                        : 'border-indigo-300/40 bg-[#0d1a3d] text-indigo-300/50'
                    }`}
                  >
                    {isActivated ? (
                      <Check className="h-3 w-3 stroke-[3]" />
                    ) : isNext ? (
                      <Sparkles className="h-3 w-3" />
                    ) : (
                      <Lock className="h-2.5 w-2.5" />
                    )}
                  </div>

                  {/* 三种 UI 状态卡片 */}
                  {isActivated && (
                    <button
                      type="button"
                      onClick={() => openVaccineSheet(dose)}
                      className="paper-card flex-1 p-3 text-left transition-transform active:scale-[0.99]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
                          <span className="text-sm font-bold text-[#2d251e] truncate">
                            {String(dose.order).padStart(2, '0')}. {dose.name}
                          </span>
                        </div>
                        <span className="shrink-0 text-[11px] font-bold text-emerald-700">
                          已激活 · {dose.doseLabel}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-[#6e6052] tabular-nums">
                        <span className="font-typewriter">{dose.inoculatedDate?.replace(/-/g, '.')}</span>
                        <span aria-hidden="true">·</span>
                        <span>{dose.recommendedMonth}</span>
                      </div>
                      {dose.note && (
                        <p className="mt-1 text-xs text-[#5d4f41] line-clamp-1">{dose.note}</p>
                      )}
                    </button>
                  )}

                  {isNext && (
                    <div className="sticker-card flex-1 rounded-2xl p-3.5 ring-2 ring-amber-300">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-amber-700">
                          下一针待激活 · {dose.recommendedMonth}
                        </span>
                        <span className="font-typewriter text-xs font-bold text-[#6e6052]">
                          #{dose.order}/19
                        </span>
                      </div>
                      <div className="mt-1 text-base font-bold text-[#2d251e]">
                        {dose.name}（{dose.doseLabel}）
                      </div>
                      <p className="mt-0.5 text-xs text-[#6e6052]">{dose.description}</p>
                      <button
                        type="button"
                        onClick={() => openVaccineSheet(dose)}
                        className="mt-2.5 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#1b336b] text-xs font-bold text-amber-100 shadow-sm active:scale-95"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>立即打卡激活</span>
                      </button>
                    </div>
                  )}

                  {!isActivated && !isNext && (
                    <button
                      type="button"
                      onClick={() => openVaccineSheet(dose)}
                      className="flex-1 rounded-2xl border border-dashed border-indigo-300/30 bg-white/5 p-3 text-left text-indigo-100/75 transition-colors hover:bg-white/10"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold truncate">
                          {String(dose.order).padStart(2, '0')}. {dose.name}（{dose.doseLabel}）
                        </span>
                        <span className="shrink-0 text-[11px] text-indigo-200/65">
                          待解锁 · {dose.recommendedMonth}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-indigo-200/50 truncate">
                        {dose.description}
                      </div>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5.3 健康·异常修复 (生病护理列表视图) */}
      {mode === 'illness' && (
        <div className="mt-3.5 flex flex-col gap-3 px-4">
          {state.illnesses.length === 0 ? (
            <div className="paper-card p-6 text-center">
              <div className="font-display text-2xl text-[#2d251e]">星球运行平稳</div>
              <p className="mt-1 text-xs text-[#6e6052]">暂无异常生病护理记录，继续保持健康防护</p>
            </div>
          ) : (
            state.illnesses.map((rec) => {
              const isOverheat = rec.temperatureC >= 38.5;
              return (
                <div key={rec.id} className="paper-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          isOverheat
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-sky-100 text-sky-700 border border-sky-200'
                        }`}
                      >
                        <Thermometer className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-typewriter text-lg font-bold text-[#2d251e] tabular-nums">
                            {rec.temperatureC.toFixed(1)} °C
                          </span>
                          {isOverheat && (
                            <span className="inline-flex items-center gap-1 text-xs font-extrabold text-rose-600">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>体温过载</span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#6e6052] tabular-nums">
                          {rec.date.replace(/-/g, '.')} {rec.time} · 记录人：{rec.recorder}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteIllness(rec.id)}
                      className="flex min-h-[38px] min-w-[38px] items-center justify-center rounded-lg text-[#9b8c7b] hover:bg-rose-50 hover:text-rose-700"
                      aria-label="删除护理记录"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-2.5 text-xs font-semibold text-[#5a4c3e]">
                    症状：{rec.symptoms.join(' · ')}
                  </div>
                  <div className="mt-1.5 rounded-xl bg-[#efe4ce] px-3 py-2 text-xs leading-relaxed text-[#2d251e]">
                    用药与护理：{rec.medication}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5.4 健康·新建护理表单 */}
      {mode === 'illness_form' && (
        <form onSubmit={handleSaveIllness} className="mt-2 flex flex-col gap-4 px-4">
          <div className="paper-card p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-semibold text-[#6e6052]">记录日期</span>
                <input
                  type="date"
                  value={illDate}
                  onChange={(e) => setIllDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#dccbb0] bg-white px-3 py-2 text-sm font-typewriter text-[#2d251e]"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-[#6e6052]">记录时间</span>
                <input
                  type="time"
                  value={illTime}
                  onChange={(e) => setIllTime(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#dccbb0] bg-white px-3 py-2 text-sm font-typewriter text-[#2d251e]"
                  required
                />
              </label>
            </div>

            {/* 体温输入框 */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="temp-input" className="text-xs font-semibold text-[#6e6052]">
                  实测体温
                </label>
                {isFormOverheat ? (
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-rose-600">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>体温过载（≥38.5°C）</span>
                  </span>
                ) : (
                  <span className="text-xs font-medium text-emerald-700">体温安全区间</span>
                )}
              </div>
              <div
                className={`mt-1.5 flex items-center rounded-xl border bg-white px-3 ${
                  isFormOverheat ? 'border-rose-400 ring-2 ring-rose-200' : 'border-[#dccbb0]'
                }`}
              >
                <Thermometer className={`mr-2 h-5 w-5 ${isFormOverheat ? 'text-rose-600' : 'text-sky-600'}`} />
                <input
                  id="temp-input"
                  type="number"
                  step="0.1"
                  min="34"
                  max="43"
                  value={tempStr}
                  onChange={(e) => setTempStr(e.target.value)}
                  className="w-full py-2.5 font-typewriter text-2xl font-bold text-[#2d251e] focus:outline-none tabular-nums"
                  required
                />
                <span className="text-sm font-bold text-[#6e6052]">°C</span>
              </div>
            </div>

            {/* 生病症状胶囊多选标签 */}
            <div>
              <div className="mb-2 text-xs font-semibold text-[#6e6052]">异常症状（可多选）</div>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_OPTIONS.map((sym) => {
                  const active = selectedSymptoms.includes(sym);
                  return (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => toggleSymptom(sym)}
                      className={`min-h-[38px] rounded-full border px-3.5 text-xs font-bold transition-all active:scale-95 ${
                        active
                          ? 'border-[#2d251e] bg-[#2d251e] text-amber-100 shadow-xs'
                          : 'border-[#d6c4a9] bg-white/80 text-[#5e5042] hover:bg-white'
                      }`}
                    >
                      {sym}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 用药记录文本框 */}
            <label className="block">
              <span className="text-xs font-semibold text-[#6e6052]">用药与护理记录</span>
              <textarea
                rows={3}
                value={medication}
                onChange={(e) => setMedication(e.target.value)}
                placeholder="例如：服用布洛芬混悬液 2.5ml，配合温水擦浴降温…"
                className="mt-1.5 w-full resize-none rounded-xl border border-[#dccbb0] bg-white p-3 text-sm text-[#2d251e] placeholder:text-[#a89886] focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-[#6e6052]">记录人</span>
              <select
                value={recorder}
                onChange={(e) => setRecorder(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[#dccbb0] bg-white px-3 py-2 text-sm text-[#2d251e]"
              >
                {state.profile.recorders.map((rec) => (
                  <option key={rec} value={rec}>
                    {rec}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onChangeMode('illness')}
              className="flex-1 min-h-[48px] rounded-2xl border border-white/20 bg-white/10 text-sm font-semibold text-indigo-100 active:scale-95"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-[2] min-h-[48px] rounded-2xl bg-amber-300 text-sm font-bold text-slate-900 shadow-lg active:scale-95"
            >
              保存护理记录
            </button>
          </div>
        </form>
      )}

      {/* 5.2 健康·疫苗打卡弹窗 (Bottom Sheet) */}
      {isSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-xs lg:absolute"
          role="dialog"
          aria-modal="true"
          aria-label="疫苗打卡确认弹窗"
        >
          <div className="paper-card w-full max-w-md rounded-b-none rounded-t-3xl px-5 pb-6 pt-3 shadow-2xl">
            {/* 拖拽把手 */}
            <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-[#cbb99d]" />

            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-amber-800">
                  第 {activeDose.order} 剂防御护盾 · {activeDose.recommendedMonth}
                </div>
                <h3 className="mt-0.5 text-lg font-bold text-[#2d251e]">
                  {activeDose.name}（{activeDose.doseLabel}）
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onChangeMode('vaccine')}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e9dac0] text-[#5a4c3e]"
                aria-label="关闭弹窗"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVaccineSheet} className="mt-4 space-y-3.5">
              <label className="block">
                <span className="text-xs font-semibold text-[#6e6052]">实际接种日期</span>
                <input
                  type="date"
                  value={vacDate}
                  onChange={(e) => setVacDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#dccbb0] bg-white px-3 py-2.5 text-sm font-typewriter text-[#2d251e]"
                  required
                />
              </label>

              <label className="block">
                <span className="text-xs font-semibold text-[#6e6052]">接种后观察备注</span>
                <textarea
                  rows={3}
                  value={vacNote}
                  onChange={(e) => setVacNote(e.target.value)}
                  placeholder="记录接种部位、医院名称或留观 30 分钟后的宝宝状态…"
                  className="mt-1 w-full resize-none rounded-xl border border-[#dccbb0] bg-white p-3 text-sm text-[#2d251e]"
                />
              </label>

              <div className="flex gap-2.5 pt-1">
                {activeDose.status === 'activated' && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetVaccine(activeDose.id);
                      onChangeMode('vaccine');
                    }}
                    className="min-h-[48px] rounded-2xl border border-rose-300 bg-rose-50 px-4 text-xs font-bold text-rose-700"
                  >
                    撤销激活
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 min-h-[48px] rounded-2xl bg-[#1b336b] text-sm font-bold text-amber-100 shadow-md active:scale-95"
                >
                  确认激活护盾
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
