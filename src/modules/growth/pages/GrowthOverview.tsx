import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  ChevronLeft,
  Plus,
  Settings,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import {
  GrowthAssessmentResult,
  GrowthBabyProfile,
  GrowthMeasurement,
  GrowthMetricKey,
  GrowthReminderItem,
} from '../types/growth';
import { ReferenceLoadMode } from '../data/whoGrowthStandards';
import { calculateGrowthAge } from '../calculations/ageCalculator';
import { GrowthTabs } from '../components/GrowthTabs';
import { GrowthChart } from '../components/GrowthChart';
import { GrowthHistory } from '../components/GrowthHistory';

interface GrowthOverviewProps {
  profile: GrowthBabyProfile;
  measurements: GrowthMeasurement[];
  assessments: Record<string, GrowthAssessmentResult>;
  reminders: GrowthReminderItem[];
  todayStr: string;
  activeMetric: GrowthMetricKey;
  selectedMeasurementId: string | null;
  referenceMode: ReferenceLoadMode;
  onChangeMetric: (metric: GrowthMetricKey) => void;
  onSelectMeasurement: (id: string) => void;
  onGoToAssessment: (measurementId?: string) => void;
  onGoToCreate: () => void;
  onGoToEdit: (measurement: GrowthMeasurement) => void;
  onDeleteMeasurement: (id: string) => void;
  onOpenSettings: () => void;
  onBackHome: () => void;
  onRetryLoadReference: () => void;
}

function formatDelta(current?: number, previous?: number, unit = 'cm', decimals = 1): string | null {
  if (
    typeof current !== 'number' ||
    !Number.isFinite(current) ||
    typeof previous !== 'number' ||
    !Number.isFinite(previous)
  ) {
    return null;
  }
  const diff = current - previous;
  const sign = diff >= 0 ? '+' : '';
  return `${sign}${diff.toFixed(decimals)} ${unit}`;
}

export const GrowthOverview: React.FC<GrowthOverviewProps> = ({
  profile,
  measurements,
  assessments,
  reminders,
  todayStr,
  activeMetric,
  selectedMeasurementId,
  referenceMode,
  onChangeMetric,
  onSelectMeasurement,
  onGoToAssessment,
  onGoToCreate,
  onGoToEdit,
  onDeleteMeasurement,
  onOpenSettings,
  onBackHome,
  onRetryLoadReference,
}) => {
  const [showCalendarPanel, setShowCalendarPanel] = useState(false);

  const sortedAsc = useMemo(
    () => [...measurements].sort((a, b) => a.date.localeCompare(b.date)),
    [measurements]
  );

  const latestMeasurement = sortedAsc[sortedAsc.length - 1] || null;
  const prevMeasurement = sortedAsc.length >= 2 ? sortedAsc[sortedAsc.length - 2] : null;

  const latestAssessment = latestMeasurement ? assessments[latestMeasurement.id] || null : null;

  const currentAge = useMemo(
    () =>
      profile.birthDate
        ? calculateGrowthAge(profile.birthDate, todayStr, {
            isPreterm: profile.isPreterm,
            gestationalAgeWeeks: profile.gestationalAgeWeeks,
            expectedDueDate: profile.expectedDueDate,
          })
        : null,
    [profile, todayStr]
  );

  const hasProfile = Boolean(profile.birthDate);
  const hasDemoRecords = sortedAsc.some((m) => m.isDemo);

  const heightDelta = formatDelta(latestMeasurement?.heightCm, prevMeasurement?.heightCm, 'cm', 1);
  const weightDelta = formatDelta(latestMeasurement?.weightKg, prevMeasurement?.weightKg, 'kg', 2);
  const headDelta = formatDelta(latestMeasurement?.headCm, prevMeasurement?.headCm, 'cm', 1);

  const sexDisplay =
    profile.sex === 'male' ? '男宝' : profile.sex === 'female' ? '女宝' : '未设性别';

  return (
    <div className="relative flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-clip pb-6">
      {/* 顶部微星光晕染背景 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-56 opacity-45"
        style={{
          backgroundImage: 'url(/assets/aistudio/____f8d9ecf9.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          WebkitMaskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
          maskImage: 'linear-gradient(to bottom, black 35%, transparent 100%)',
        }}
      />

      {/* 底部左右花草装饰（限定在滚动内容底部，不遮挡固定底栏） */}
      <img
        src="/assets/extracted/health_footer_flowers.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 z-0 w-32 opacity-70"
      />
      <img
        src="/assets/extracted/health_footer_flowers.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 z-0 w-32 -scale-x-100 opacity-70"
      />

      {/* 首屏独立视口区：顶部栏 + 宝宝档案 + 指标切换 + WHO 核心生长曲线，严防下方模块局部露出 */}
      <div
        style={{ minHeight: 'var(--app-viewport-h)' }}
        className="relative z-10 flex w-full min-w-0 flex-col justify-between pb-3"
      >
        <div>
          {/* 4.1.1 页面顶部导航栏 */}
          <header className="relative z-20 flex min-h-[54px] items-center justify-between px-4 pt-safe pb-1">
            <button
              type="button"
              onClick={onBackHome}
              aria-label="返回首页"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#132550]/65 text-indigo-100 backdrop-blur-sm transition-transform hover:bg-white/15 active:scale-90"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-1.5">
              <h1 className="text-[18px] font-bold tracking-[0.1em] text-[#fffaf0] drop-shadow-[0_2px_8px_rgba(4,10,30,0.85)]">
                观测坐标
              </h1>
              <span
                className="text-[12px] text-[#fde047] drop-shadow-[0_0_6px_rgba(253,224,71,0.9)]"
                aria-hidden="true"
              >
                ✦
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowCalendarPanel((v) => !v)}
              aria-label="查看成长记录日期与月龄日历"
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-transform active:scale-90 ${
                showCalendarPanel
                  ? 'bg-amber-300/25 text-amber-200'
                  : 'text-indigo-100 hover:bg-white/10'
              }`}
            >
              <Calendar className="h-5 w-5" />
            </button>
          </header>

          <div className="flex w-full min-w-0 flex-col gap-3 px-4">
            {/* 顶部标题区 + 星星帽宝宝半身插画（不遮挡任何数据） */}
            <div className="flex items-end justify-between gap-2 px-0.5 pt-0.5">
              <div className="min-w-0 flex-1 pb-1">
                <p className="text-[12px] font-medium leading-relaxed text-amber-100/90 drop-shadow">
                  每一次长大，都是一次新的星际探索。
                </p>
                <div className="mt-2 inline-flex items-center rounded-full border border-white/15 bg-[#152550]/80 p-0.5 backdrop-blur-md">
                  <button
                    type="button"
                    className="rounded-full bg-gradient-to-b from-[#ffe25f] via-[#facc34] to-[#f2ab1a] px-3 py-1 text-[11.5px] font-bold text-[#1f190d] shadow-xs"
                  >
                    走势与历史
                  </button>
                  <button
                    type="button"
                    onClick={() => onGoToAssessment(selectedMeasurementId || latestMeasurement?.id)}
                    className="rounded-full px-3 py-1 text-[11.5px] font-medium text-indigo-100/85 transition-colors hover:text-white"
                  >
                    专业营养评价
                  </button>
                </div>
              </div>

              <img
                src="/assets/extracted/feed_boy_pug_planet.png"
                alt="黄色星星帽宝宝与巴哥犬"
                referrerPolicy="no-referrer"
                className="h-[78px] w-auto shrink-0 object-contain drop-shadow-[0_6px_14px_rgba(3,8,24,0.5)]"
              />
            </div>

            {/* 右上角日历展开面板：已记录日期快捷定位 + 0~3岁评估日历 */}
            {showCalendarPanel && (
              <div className="rounded-[22px] border border-white/15 bg-[#122452]/92 p-3.5 text-xs text-indigo-100 shadow-[0_12px_28px_rgba(3,8,24,0.5)] backdrop-blur-md">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-bold text-amber-200">成长记录日期与 0～3 岁评估节点</span>
              <button
                type="button"
                onClick={() => setShowCalendarPanel(false)}
                aria-label="关闭日历面板"
                className="rounded-lg p-1 text-indigo-200 hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {sortedAsc.length > 0 ? (
              <div className="mb-2.5">
                <div className="mb-1 text-[10.5px] text-indigo-200/80">
                  已记录测量日期（点击定位曲线节点）：
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[...sortedAsc].reverse().map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        onSelectMeasurement(m.id);
                        setShowCalendarPanel(false);
                      }}
                      className={`rounded-full px-2.5 py-1 font-typewriter text-[11px] font-bold transition-colors ${
                        selectedMeasurementId === m.id
                          ? 'bg-amber-300 text-slate-900'
                          : 'bg-white/10 text-indigo-100 hover:bg-white/20'
                      }`}
                    >
                      {m.date.replace(/-/g, '.')}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mb-2 text-[11px] text-indigo-200/80">暂无已记录测量日期。</p>
            )}

            <div className="border-t border-white/10 pt-2">
              <div className="mb-1.5 text-[10.5px] text-indigo-200/80">
                国家卫健委建议 9 次评估月龄：
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {reminders.map((r) => (
                  <div
                    key={r.monthAge}
                    className={`rounded-xl px-2 py-1.5 text-center text-[10.5px] font-bold ${
                      r.status === 'completed'
                        ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/30'
                        : r.status === 'upcoming'
                        ? 'bg-amber-400/20 text-amber-200 border border-amber-300/45'
                        : 'bg-white/8 text-indigo-200/80 border border-white/10'
                    }`}
                  >
                    <div>{r.label}</div>
                    <div className="mt-0.5 text-[9.5px] font-normal opacity-85">
                      {r.status === 'completed'
                        ? '已记录'
                        : r.status === 'upcoming'
                        ? '建议评估'
                        : r.status === 'overdue'
                        ? '可补录'
                        : '待到达'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4.1.2 宝宝基础信息卡片（完全动态读取档案，无档案时显示「等待建立星球连接……」） */}
        {!hasProfile ? (
          <div className="diary-paper-card relative z-20 px-3 py-3.5 text-center">
            <div className="font-display text-2xl text-[#1e2c4a]">等待建立星球连接……</div>
            <p className="mt-1 text-[12px] text-[#6d6052]">
              完善宝宝姓名、出生日期与生理性别后，即可自动匹配 WHO 0～36 月龄标准生长曲线与营养评价
            </p>
            <button
              type="button"
              onClick={onOpenSettings}
              className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-gradient-to-b from-[#ffe25e] to-[#f4b21d] px-5 text-[13px] font-extrabold text-[#241b09] shadow-sm active:scale-95"
            >
              <UserCheck className="h-4 w-4" />
              <span>创建宝宝档案</span>
            </button>
          </div>
        ) : (
          <div className="rounded-[22px] border border-white/15 bg-[#122452]/75 px-3.5 py-2.5 text-[#fffaf0] shadow-[0_10px_24px_rgba(3,8,24,0.38)] backdrop-blur-md">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[15px] font-extrabold text-amber-100">
                    {profile.name || '未知漫游者'}
                  </span>
                  <span className="text-[11.5px] font-semibold text-sky-200">
                    · {currentAge?.isValid ? currentAge.displayAge : '未算月龄'}
                  </span>
                  <span className="text-[11.5px] text-indigo-200/90">· {sexDisplay}</span>
                  {profile.isPreterm && (
                    <span className="text-[11px] font-semibold text-amber-300">· 早产档案</span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-indigo-200/80 tabular-nums">
                  <span>出生：{profile.birthDate.replace(/-/g, '.')}</span>
                  <span aria-hidden="true">|</span>
                  <span>
                    最近记录：
                    {latestMeasurement ? latestMeasurement.date.replace(/-/g, '.') : '暂无'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onOpenSettings}
                className="flex h-8 shrink-0 items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2.5 text-[11px] font-semibold text-amber-100 hover:bg-white/15 active:scale-95"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>档案</span>
              </button>
            </div>
          </div>
        )}

            {/* 4.1.3 身高 / 体重 / 头围切换 Tab */}
            <GrowthTabs activeMetric={activeMetric} onChangeMetric={onChangeMetric} />

            {/* 4.1.4 核心生长曲线（WHO 0~36月龄动态参考曲线 + 金色星星节点 + 奶油色读数气泡） */}
            <GrowthChart
              metric={activeMetric}
              profile={profile}
              measurements={sortedAsc}
              assessments={assessments}
              selectedMeasurementId={selectedMeasurementId}
              referenceMode={referenceMode}
              onSelectMeasurement={onSelectMeasurement}
              onOpenSettings={onOpenSettings}
              onRetryLoadReference={onRetryLoadReference}
            />
          </div>
        </div>
      </div>

      {/* 下滑第二屏区：最近一次成长记录 + 历史记录 + 新增按钮（卡片间保持 16px 明确间距） */}
      <div className="relative z-10 mt-4 flex w-full min-w-0 max-w-full flex-col gap-4 px-4">
        {/* 4.1.5 最新成长数据卡片 */}
        <section className="diary-paper-card relative z-20 min-w-0 px-3 py-3">
          <div className="flex items-center justify-between gap-2 pb-2">
            <div className="flex items-center gap-1.5">
              <img
                src="/assets/extracted/health_star_small.png"
                alt=""
                aria-hidden="true"
                className="h-4.5 w-4.5 object-contain"
              />
              <h2 className="text-[14.5px] font-extrabold text-[#1e2c4a]">最近一次成长记录</h2>
            </div>

            {hasDemoRecords && (
              <span className="text-[10.5px] font-semibold text-[#9a6a15]">含演示数据</span>
            )}
          </div>

          {!latestMeasurement ? (
            <div className="rounded-[20px] bg-[#f7f0e2] px-3 py-5 text-center text-[12px] text-[#7a6d5e]">
              暂无成长测量数据，点击下方按钮录入第一条记录。
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-[20px] border border-[#e7dac3] bg-[#faf4e8] p-2.5 text-center shadow-[0_3px_10px_rgba(68,52,28,0.06)]">
                  <div className="text-[11px] font-semibold text-[#7b6e5f]">身长/身高</div>
                  <div className="mt-0.5 font-typewriter text-[15px] font-extrabold text-[#1e2c4a] tabular-nums">
                    {typeof latestMeasurement.heightCm === 'number'
                      ? `${latestMeasurement.heightCm.toFixed(1)}`
                      : '--'}
                    <span className="ml-0.5 text-[10.5px] font-semibold">cm</span>
                  </div>
                  <div className="mt-0.5 font-typewriter text-[10.5px] font-bold text-[#2f6b2a] tabular-nums">
                    {heightDelta ? `较上次 ${heightDelta}` : '首次记录'}
                  </div>
                </div>

                <div className="rounded-[20px] border border-[#e7dac3] bg-[#faf4e8] p-2.5 text-center shadow-[0_3px_10px_rgba(68,52,28,0.06)]">
                  <div className="text-[11px] font-semibold text-[#7b6e5f]">体重</div>
                  <div className="mt-0.5 font-typewriter text-[15px] font-extrabold text-[#1e2c4a] tabular-nums">
                    {typeof latestMeasurement.weightKg === 'number'
                      ? `${latestMeasurement.weightKg.toFixed(2)}`
                      : '--'}
                    <span className="ml-0.5 text-[10.5px] font-semibold">kg</span>
                  </div>
                  <div className="mt-0.5 font-typewriter text-[10.5px] font-bold text-[#1d5fa7] tabular-nums">
                    {weightDelta ? `较上次 ${weightDelta}` : '首次记录'}
                  </div>
                </div>

                <div className="rounded-[20px] border border-[#e7dac3] bg-[#faf4e8] p-2.5 text-center shadow-[0_3px_10px_rgba(68,52,28,0.06)]">
                  <div className="text-[11px] font-semibold text-[#7b6e5f]">头围</div>
                  <div className="mt-0.5 font-typewriter text-[15px] font-extrabold text-[#1e2c4a] tabular-nums">
                    {typeof latestMeasurement.headCm === 'number'
                      ? `${latestMeasurement.headCm.toFixed(1)}`
                      : '--'}
                    <span className="ml-0.5 text-[10.5px] font-semibold">cm</span>
                  </div>
                  <div className="mt-0.5 font-typewriter text-[10.5px] font-bold text-[#9a5b08] tabular-nums">
                    {headDelta ? `较上次 ${headDelta}` : '首次记录'}
                  </div>
                </div>
              </div>

              {/* 直达专业营养评价入口 */}
              <button
                type="button"
                onClick={() => onGoToAssessment(latestMeasurement.id)}
                className="mt-3 flex min-h-[44px] w-full items-center justify-between gap-2 rounded-[20px] border border-[#d6e0f2] bg-[#f1f6ff] px-3.5 py-2.5 text-left shadow-[0_4px_12px_rgba(30,60,114,0.08)] transition-colors hover:bg-[#e5eeff] active:scale-[0.99]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1 text-[12px] font-extrabold text-[#1e3c72]">
                    <Sparkles className="h-3.5 w-3.5 text-[#d98a18]" />
                    <span>本次营养状况评价：{latestAssessment?.overallLabel || '待计算'}</span>
                  </div>
                  <div className="mt-0.5 truncate text-[10.5px] text-[#556b92]">
                    查看 WAZ / LAZ / WLZ / BMIZ 与头围发育监测详细报告
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-[#2b5298]" />
              </button>
            </>
          )}
        </section>

        {/* 4.1.6 历史成长记录列表 */}
        <GrowthHistory
          profile={profile}
          measurements={sortedAsc}
          assessments={assessments}
          selectedMeasurementId={selectedMeasurementId}
          onSelectMeasurement={onSelectMeasurement}
          onEditMeasurement={onGoToEdit}
          onDeleteMeasurement={onDeleteMeasurement}
          onCreateNew={onGoToCreate}
          onOpenAssessmentFor={(id) => onGoToAssessment(id)}
        />

        {/* 底部醒目新增成长记录 CTA */}
        <div className="relative z-10 mt-1 flex justify-center pb-4">
          <button
            type="button"
            onClick={onGoToCreate}
            className="flex min-h-[48px] w-[82%] items-center justify-center gap-1.5 rounded-full border-2 border-[#fff0a6]/85 bg-gradient-to-b from-[#ffe25e] via-[#facc34] to-[#f1a819] px-6 text-[15px] font-extrabold tracking-wide text-[#241b09] shadow-[0_8px_22px_rgba(244,179,30,0.45),inset_0_2px_2px_rgba(255,255,255,0.65)] transition-transform hover:brightness-105 active:scale-[0.97]"
          >
            <Plus className="h-4.5 w-4.5 stroke-[2.8]" />
            <span>记录新的成长坐标</span>
          </button>
        </div>
      </div>
    </div>
  );
};
