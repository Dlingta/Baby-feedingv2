import React, { useEffect, useState } from 'react';
import {
  BabyProfile,
  DiaryEntry,
  FeedingRecord,
  GrowthRecord,
  IllnessRecord,
  ModuleTab,
  PlanetAppState,
  ScreenCode,
  VaccineBrandOrigin,
  VaccineDose,
  VaccineFundingType,
} from './types/planet';
import { createInitialAppState, getTodayDateStr } from './data/initialData';
import { BottomNav } from './components/BottomNav';
import { PrototypeSidebar } from './components/PrototypeSidebar';
import { HomeScreen } from './screens/HomeScreen';
import { DiaryScreen, DiaryViewMode } from './screens/DiaryScreen';
import { FeedingScreen, FeedingViewMode } from './screens/FeedingScreen';
import { GrowthScreen, GrowthViewMode } from './screens/GrowthScreen';
import { HealthScreen, HealthViewMode } from './screens/HealthScreen';
import { SettingsScreen } from './screens/SettingsScreen';

const STORAGE_KEY = 'planet_feeding_prototype_state_v1';

export default function App() {
  const [state, setState] = useState<PlanetAppState>(() => {
    const todayStr = getTodayDateStr();
    const freshInit = createInitialAppState(todayStr);

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as PlanetAppState;
        if (parsed && parsed.profile && Array.isArray(parsed.vaccines)) {
          const isLegacyDate = (dateStr?: string) =>
            Boolean(dateStr && (dateStr.startsWith('2025-10-') || dateStr.startsWith('2025-11-')));

          // 若仍为旧版未编辑过的默认宝宝档案，清空默认占位名并更新基准生日；若用户已填写则完整保留
          if (
            parsed.profile.name === '小星尘' &&
            parsed.profile.birthDate === '2025-10-08'
          ) {
            parsed.profile = {
              ...parsed.profile,
              name: '',
              planetName: '未知漫游者的登陆手帐',
              birthDate: freshInit.profile.birthDate,
            };
          }

          // 若仍保留旧版占位日记示例图或旧基准日期，平滑升级为新版手绘日记与实时日期
          if (Array.isArray(parsed.diaries)) {
            const legacyPaths = new Set([
              '/assets/extracted/orange_cat.png',
              '/assets/aistudio/____f8d9ecf9.png',
              '/assets/aistudio/___f4298ab8.png',
            ]);
            parsed.diaries = parsed.diaries.map((d) => {
              const fresh = freshInit.diaries.find((init) => init.id === d.id);
              if (!fresh) return d;
              if (d.photos?.[0] && legacyPaths.has(d.photos[0])) {
                return fresh;
              }
              return {
                ...d,
                date: isLegacyDate(d.date) ? fresh.date : d.date,
                reflection: d.reflection || fresh.reflection,
              };
            });
          }

          // 若本地缓存仍是旧版默认喂养数据（未包含营养品示例），平滑补充最新默认示例
          if (Array.isArray(parsed.feedings)) {
            if (
              parsed.feedings.some((f) => f.id === 'feed-1' && f.time === '06:30') &&
              !parsed.feedings.some((f) => f.type === 'supplement')
            ) {
              const customFeedings = parsed.feedings.filter(
                (f) => !['feed-1', 'feed-2', 'feed-3', 'feed-4', 'feed-5'].includes(f.id)
              );
              parsed.feedings = [
                ...freshInit.feedings.slice(0, 5),
                ...customFeedings,
              ];
            }
            parsed.feedings = parsed.feedings.map((f) => {
              const fresh = freshInit.feedings.find((init) => init.id === f.id);
              if (fresh && isLegacyDate(f.date)) {
                return { ...f, date: fresh.date };
              }
              return f;
            });
          }

          if (Array.isArray(parsed.growths)) {
            parsed.growths = parsed.growths.map((g) => {
              const fresh = freshInit.growths.find((init) => init.id === g.id);
              if (fresh && isLegacyDate(g.date)) {
                return { ...g, date: fresh.date };
              }
              return g;
            });
          }

          if (Array.isArray(parsed.illnesses)) {
            const isLegacySeedIllnesses =
              parsed.illnesses.length === 2 &&
              parsed.illnesses.every((i) => !i.careCategory) &&
              parsed.illnesses.some((i) => i.id === 'ill-1' && i.time === '22:40');
            if (isLegacySeedIllnesses) {
              parsed.illnesses = freshInit.illnesses;
            } else {
              parsed.illnesses = parsed.illnesses.map((i) => {
                const fresh = freshInit.illnesses.find((init) => init.id === i.id);
                if (fresh && isLegacyDate(i.date)) {
                  return { ...i, date: fresh.date };
                }
                return i;
              });
            }
          }

          parsed.vaccines = parsed.vaccines.map((v) => {
            const fresh = freshInit.vaccines.find((init) => init.id === v.id);
            if (fresh && isLegacyDate(v.inoculatedDate)) {
              return { ...v, inoculatedDate: fresh.inoculatedDate };
            }
            return v;
          });

          return parsed;
        }
      }
    } catch {
      // ignore storage errors
    }
    return freshInit;
  });

  const [activeTab, setActiveTab] = useState<ModuleTab>('home');
  const [homeForceEmpty, setHomeForceEmpty] = useState(false);
  const [diaryMode, setDiaryMode] = useState<DiaryViewMode>('list');
  const [feedingMode, setFeedingMode] = useState<FeedingViewMode>('timeline');
  const [growthMode, setGrowthMode] = useState<GrowthViewMode>('chart');
  const [healthMode, setHealthMode] = useState<HealthViewMode>('vaccine');
  const [activeSheetDoseId, setActiveSheetDoseId] = useState<string | null>(null);
  const [showSlotTag, setShowSlotTag] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage quota errors
    }
  }, [state]);

  // 计算当前处于 15 个设计视图中的哪一个编号
  const getCurrentScreenCode = (): ScreenCode => {
    if (activeTab === 'home') {
      return !state.profile.birthDate || homeForceEmpty ? '1.2' : '1.1';
    }
    if (activeTab === 'diary') {
      if (diaryMode === 'form') return '2.3';
      if (diaryMode === 'empty' || state.diaries.length === 0) return '2.2';
      return '2.1';
    }
    if (activeTab === 'feeding') {
      if (feedingMode === 'form') return '3.3';
      if (feedingMode === 'empty') return '3.2';
      return '3.1';
    }
    if (activeTab === 'growth') {
      return growthMode === 'form' ? '4.2' : '4.1';
    }
    if (activeTab === 'health') {
      if (healthMode === 'vaccine_sheet') return '5.2';
      if (healthMode === 'illness') return '5.3';
      if (healthMode === 'illness_form') return '5.4';
      return '5.1';
    }
    return '6.1';
  };

  // 从桌面原型索引侧栏直达 15 个指定页面状态
  const handleSelectScreenCode = (code: ScreenCode) => {
    setHomeForceEmpty(false);
    switch (code) {
      case '1.1':
        setActiveTab('home');
        setHomeForceEmpty(false);
        break;
      case '1.2':
        setActiveTab('home');
        setHomeForceEmpty(true);
        break;
      case '2.1':
        setActiveTab('diary');
        setDiaryMode('list');
        break;
      case '2.2':
        setActiveTab('diary');
        setDiaryMode('empty');
        break;
      case '2.3':
        setActiveTab('diary');
        setDiaryMode('form');
        break;
      case '3.1':
        setActiveTab('feeding');
        setFeedingMode('timeline');
        break;
      case '3.2':
        setActiveTab('feeding');
        setFeedingMode('empty');
        break;
      case '3.3':
        setActiveTab('feeding');
        setFeedingMode('form');
        break;
      case '4.1':
        setActiveTab('growth');
        setGrowthMode('chart');
        break;
      case '4.2':
        setActiveTab('growth');
        setGrowthMode('form');
        break;
      case '5.1':
        setActiveTab('health');
        setHealthMode('vaccine');
        break;
      case '5.2': {
        const nextVac =
          state.vaccines.find((v) => v.status === 'next') || state.vaccines[3] || state.vaccines[0];
        setActiveSheetDoseId(nextVac.id);
        setActiveTab('health');
        setHealthMode('vaccine_sheet');
        break;
      }
      case '5.3':
        setActiveTab('health');
        setHealthMode('illness');
        break;
      case '5.4':
        setActiveTab('health');
        setHealthMode('illness_form');
        break;
      case '6.1':
        setActiveTab('settings');
        break;
    }
  };

  const handleNavigateTab = (tab: ModuleTab) => {
    setHomeForceEmpty(false);
    setActiveTab(tab);
    if (tab === 'diary') {
      if (diaryMode === 'detail' || (diaryMode === 'empty' && state.diaries.length > 0)) {
        setDiaryMode('list');
      }
    }
    if (tab === 'feeding' && feedingMode === 'empty') {
      setFeedingMode('timeline');
    }
    if (tab === 'health' && healthMode === 'vaccine_sheet') {
      setHealthMode('vaccine');
    }
  };

  // 数据修改 Handlers
  const handleToggleChecklist = (id: string) => {
    setState((prev) => ({
      ...prev,
      checklist: prev.checklist.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      ),
    }));
  };

  const handleSaveDiary = (entry: DiaryEntry) => {
    setState((prev) => {
      const exists = prev.diaries.some((d) => d.id === entry.id);
      const nextDiaries = exists
        ? prev.diaries.map((d) => (d.id === entry.id ? entry : d))
        : [entry, ...prev.diaries];
      return { ...prev, diaries: nextDiaries };
    });
  };

  const handleDeleteDiary = (id: string) => {
    setState((prev) => ({
      ...prev,
      diaries: prev.diaries.filter((d) => d.id !== id),
    }));
  };

  const handleAddFeeding = (record: FeedingRecord) => {
    setState((prev) => ({
      ...prev,
      feedings: [record, ...prev.feedings],
    }));
  };

  const handleDeleteFeeding = (id: string) => {
    setState((prev) => ({
      ...prev,
      feedings: prev.feedings.filter((f) => f.id !== id),
    }));
  };

  const handleAddGrowth = (record: GrowthRecord) => {
    setState((prev) => ({
      ...prev,
      growths: [...prev.growths, record],
    }));
  };

  const handleDeleteGrowth = (id: string) => {
    setState((prev) => ({
      ...prev,
      growths: prev.growths.filter((g) => g.id !== id),
    }));
  };

  const handleConfirmVaccine = (
    doseId: string,
    date: string,
    note: string,
    brandOrigin?: VaccineBrandOrigin,
    fundingType?: VaccineFundingType
  ) => {
    setState((prev) => {
      const updated = prev.vaccines.map((v) =>
        v.id === doseId
          ? {
              ...v,
              status: 'activated' as const,
              inoculatedDate: date,
              brandOrigin: brandOrigin || v.brandOrigin || '国产',
              fundingType: fundingType || v.fundingType || '免费',
              note,
            }
          : v
      );
      // 自动顺延下一针高亮
      const hasNext = updated.some((v) => v.status === 'next');
      if (!hasNext) {
        const firstLockedIdx = updated.findIndex((v) => v.status === 'locked');
        if (firstLockedIdx !== -1) {
          updated[firstLockedIdx] = { ...updated[firstLockedIdx], status: 'next' };
        }
      }
      return { ...prev, vaccines: updated };
    });
  };

  const handleResetVaccine = (doseId: string) => {
    setState((prev) => {
      const updated = prev.vaccines.map((v) =>
        v.id === doseId
          ? {
              ...v,
              status: 'locked' as const,
              inoculatedDate: undefined,
              brandOrigin: undefined,
              fundingType: undefined,
              note: undefined,
            }
          : v
      );
      // 确保第一个非 activated 的成为 next
      const firstUnactivated = updated.findIndex((v) => v.status !== 'activated');
      const normalized = updated.map((v, idx) => {
        if (v.status === 'activated') return v;
        return { ...v, status: idx === firstUnactivated ? ('next' as const) : ('locked' as const) };
      });
      return { ...prev, vaccines: normalized };
    });
  };

  const handleAddIllness = (record: IllnessRecord) => {
    setState((prev) => ({
      ...prev,
      illnesses: [record, ...prev.illnesses],
    }));
  };

  const handleToggleIllnessHandled = (id: string) => {
    setState((prev) => ({
      ...prev,
      illnesses: prev.illnesses.map((item) =>
        item.id === id ? { ...item, handled: !item.handled } : item
      ),
    }));
  };

  const handleDeleteIllness = (id: string) => {
    setState((prev) => ({
      ...prev,
      illnesses: prev.illnesses.filter((i) => i.id !== id),
    }));
  };

  const handleUpdateProfile = (profile: BabyProfile) => {
    setHomeForceEmpty(false);
    setState((prev) => ({ ...prev, profile }));
  };

  const handleQuickOpenVaccine = (dose: VaccineDose) => {
    setActiveSheetDoseId(dose.id);
    setActiveTab('health');
    setHealthMode('vaccine_sheet');
  };

  const handleResetDemo = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(createInitialAppState(getTodayDateStr()));
    setHomeForceEmpty(false);
    setActiveTab('home');
    setDiaryMode('list');
    setFeedingMode('timeline');
    setGrowthMode('chart');
    setHealthMode('vaccine');
  };

  const currentScreenCode = getCurrentScreenCode();

  return (
    <div className="flex min-h-[100dvh] w-full bg-[#050b1c] text-slate-100">
      {/* 桌面端 15 页原型状态索引侧栏 */}
      <PrototypeSidebar
        activeScreen={currentScreenCode}
        showSlotTag={showSlotTag}
        onSelectScreen={handleSelectScreenCode}
        onToggleSlotTag={() => setShowSlotTag((v) => !v)}
        onResetDemo={handleResetDemo}
      />

      {/* 主画布区：移动端全屏适配，桌面端居中呈现 390px 手机交互画布 */}
      <main className="flex flex-1 items-center justify-center lg:p-6">
        <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden cosmic-canvas lg:h-[844px] lg:max-h-[calc(100dvh-3rem)] lg:w-[396px] lg:rounded-[42px] lg:border-[6px] lg:border-[#1c2c58] lg:shadow-[0_28px_80px_rgba(0,0,0,0.75)]">
          {/* 滚动内容区 */}
          <div className="no-scrollbar flex-1 overflow-y-auto overflow-x-hidden">
            {activeTab === 'home' && (
              <HomeScreen
                state={state}
                forceEmptyState={homeForceEmpty}
                showSlotTag={showSlotTag}
                onNavigate={handleNavigateTab}
                onToggleChecklist={handleToggleChecklist}
                onQuickOpenVaccine={handleQuickOpenVaccine}
              />
            )}

            {activeTab === 'diary' && (
              <DiaryScreen
                state={state}
                mode={diaryMode}
                showSlotTag={showSlotTag}
                onChangeMode={setDiaryMode}
                onBackHome={() => handleNavigateTab('home')}
                onSaveDiary={handleSaveDiary}
                onDeleteDiary={handleDeleteDiary}
              />
            )}

            {activeTab === 'feeding' && (
              <FeedingScreen
                state={state}
                mode={feedingMode}
                showSlotTag={showSlotTag}
                onChangeMode={setFeedingMode}
                onBackHome={() => handleNavigateTab('home')}
                onAddFeeding={handleAddFeeding}
                onDeleteFeeding={handleDeleteFeeding}
              />
            )}

            {activeTab === 'growth' && (
              <GrowthScreen
                state={state}
                mode={growthMode}
                onChangeMode={setGrowthMode}
                onBackHome={() => handleNavigateTab('home')}
                onAddGrowth={handleAddGrowth}
                onDeleteGrowth={handleDeleteGrowth}
              />
            )}

            {activeTab === 'health' && (
              <HealthScreen
                state={state}
                mode={healthMode}
                activeSheetDoseId={activeSheetDoseId}
                showSlotTag={showSlotTag}
                onChangeMode={setHealthMode}
                onBackHome={() => handleNavigateTab('home')}
                onConfirmVaccine={handleConfirmVaccine}
                onResetVaccine={handleResetVaccine}
                onAddIllness={handleAddIllness}
                onToggleIllnessHandled={handleToggleIllnessHandled}
                onDeleteIllness={handleDeleteIllness}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsScreen
                state={state}
                onBackHome={() => handleNavigateTab('home')}
                onUpdateProfile={handleUpdateProfile}
                onImportState={(nextState) => {
                  setHomeForceEmpty(false);
                  setState(nextState);
                }}
              />
            )}
          </div>

          {/* 底部星尘主导航栏 (在日记详情/编辑页、喂养键盘录入页与治愈工坊表单页沉浸隐藏) */}
          {!(
            (activeTab === 'diary' && (diaryMode === 'detail' || diaryMode === 'form')) ||
            (activeTab === 'feeding' && feedingMode === 'form') ||
            (activeTab === 'health' && (healthMode === 'vaccine_sheet' || healthMode === 'illness_form'))
          ) && (
            <BottomNav
              activeTab={activeTab}
              onSelectTab={handleNavigateTab}
              showSlotTag={showSlotTag}
            />
          )}
        </div>
      </main>
    </div>
  );
}
