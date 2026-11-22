import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import { BabyProfile, PlanetAppState } from '../types/planet';
import { calculatePlanetAge, getTodayDateStr } from '../data/initialData';

interface SettingsScreenProps {
  state: PlanetAppState;
  onBackHome: () => void;
  onUpdateProfile: (profile: BabyProfile) => void;
  onImportState: (nextState: PlanetAppState) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  state,
  onBackHome,
  onUpdateProfile,
  onImportState,
}) => {
  const [name, setName] = useState(state.profile.name);
  const [planetName, setPlanetName] = useState(state.profile.planetName);
  const [birthDate, setBirthDate] = useState(state.profile.birthDate);
  const [gender, setGender] = useState<BabyProfile['gender']>(state.profile.gender);
  const [isPreterm, setIsPreterm] = useState(Boolean(state.profile.isPreterm));
  const [gestationalAgeWeeks, setGestationalAgeWeeks] = useState(
    state.profile.gestationalAgeWeeks ? String(state.profile.gestationalAgeWeeks) : ''
  );
  const [expectedDueDate, setExpectedDueDate] = useState(state.profile.expectedDueDate || '');
  const [newRecorder, setNewRecorder] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const todayStr = getTodayDateStr();
  const agePreview = calculatePlanetAge(birthDate, todayStr);
  const derivedPlanetTitle = name.trim() ? `${name.trim()}的登陆手帐` : '未知漫游者的登陆手帐';

  useEffect(() => {
    setName(state.profile.name);
    setPlanetName(state.profile.planetName);
    setBirthDate(state.profile.birthDate);
    setGender(state.profile.gender);
    setIsPreterm(Boolean(state.profile.isPreterm));
    setGestationalAgeWeeks(
      state.profile.gestationalAgeWeeks ? String(state.profile.gestationalAgeWeeks) : ''
    );
    setExpectedDueDate(state.profile.expectedDueDate || '');
  }, [
    state.profile.name,
    state.profile.planetName,
    state.profile.birthDate,
    state.profile.gender,
    state.profile.isPreterm,
    state.profile.gestationalAgeWeeks,
    state.profile.expectedDueDate,
  ]);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback((cur) => (cur === msg ? null : cur)), 3200);
  };

  const handleSaveBasic = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const nextPlanetName = trimmedName ? `${trimmedName}的登陆手帐` : '未知漫游者的登陆手帐';
    const parsedWeeks = gestationalAgeWeeks.trim() ? Number(gestationalAgeWeeks.trim()) : undefined;
    setPlanetName(nextPlanetName);
    onUpdateProfile({
      ...state.profile,
      babyId: state.profile.babyId || 'baby-primary',
      name: trimmedName,
      planetName: nextPlanetName,
      birthDate,
      gender,
      isPreterm,
      gestationalAgeWeeks:
        isPreterm && typeof parsedWeeks === 'number' && Number.isFinite(parsedWeeks)
          ? parsedWeeks
          : undefined,
      expectedDueDate: isPreterm && expectedDueDate ? expectedDueDate : undefined,
    });
    showToast('星球基本档案已更新并同步（成长曲线与营养评价已自动刷新）');
  };

  const handleAddRecorder = () => {
    const trimmed = newRecorder.trim();
    if (!trimmed) return;
    if (state.profile.recorders.includes(trimmed)) {
      showToast('该记录人已存在列表中');
      return;
    }
    onUpdateProfile({
      ...state.profile,
      recorders: [...state.profile.recorders, trimmed],
    });
    setNewRecorder('');
    showToast(`已新增常用记录人：${trimmed}`);
  };

  const handleRemoveRecorder = (rec: string) => {
    if (state.profile.recorders.length <= 1) {
      showToast('请至少保留一位常用记录人');
      return;
    }
    onUpdateProfile({
      ...state.profile,
      recorders: state.profile.recorders.filter((r) => r !== rec),
    });
  };

  // 打包宇宙记忆 (Export JSON)
  const handleExportMemory = () => {
    const payload = JSON.stringify(state, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `planet-memories-${todayStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('宇宙记忆包已打包导出（JSON）');
  };

  // 解冻记忆档案 (Import JSON)
  const handleImportMemory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as PlanetAppState;
        if (!parsed.profile || !Array.isArray(parsed.diaries) || !Array.isArray(parsed.vaccines)) {
          showToast('档案格式校验失败，请选择正确的星球记忆 JSON');
          return;
        }
        onImportState(parsed);
        setName(parsed.profile.name);
        setPlanetName(parsed.profile.planetName);
        setBirthDate(parsed.profile.birthDate);
        setGender(parsed.profile.gender);
        setIsPreterm(Boolean(parsed.profile.isPreterm));
        setGestationalAgeWeeks(
          parsed.profile.gestationalAgeWeeks ? String(parsed.profile.gestationalAgeWeeks) : ''
        );
        setExpectedDueDate(parsed.profile.expectedDueDate || '');
        showToast('记忆档案解冻成功，所有星光记录已恢复');
      } catch {
        showToast('解析记忆档案失败，请检查 JSON 文件');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-clip pb-6">
      {/* 顶部栏 */}
      <header className="sticky top-0 z-20 flex min-h-[56px] items-center justify-between bg-[#09132e]/88 px-4 pt-safe pb-2 backdrop-blur-md">
        <button
          type="button"
          onClick={onBackHome}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-indigo-100 hover:bg-white/10 active:scale-95"
          aria-label="返回星球首页"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <div className="font-display text-xl tracking-wide text-amber-100">星球档案与数据舱</div>
          <div className="text-[11px] text-indigo-200/75">档案设置 · 记录人 · 记忆备份</div>
        </div>

        <div className="w-[44px]" />
      </header>

      <div className="flex flex-col gap-4 px-4 pt-3">
        {feedback && (
          <div className="flex items-center gap-2 rounded-[20px] bg-emerald-500/20 border border-emerald-300/40 px-4 py-3 text-xs font-semibold text-emerald-100 shadow-[0_8px_20px_rgba(3,8,24,0.3)]">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
            <span>{feedback}</span>
          </div>
        )}

        {/* 1. 宝宝基本信息与实时年龄计算预览 */}
        <form onSubmit={handleSaveBasic} className="paper-card p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#2d251e]">小漫游者基本档案</h2>
            {birthDate && (
              <button
                type="button"
                onClick={() => {
                  setBirthDate('');
                  onUpdateProfile({ ...state.profile, birthDate: '' });
                  showToast('已重置出生日期（可回首页查看未初始化状态）');
                }}
                className="text-[11px] font-medium text-[#7c6e5f] underline underline-offset-2"
              >
                清空生日预览引导页
              </button>
            )}
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-[#6e6052]">宝宝昵称</span>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                const nextVal = e.target.value;
                setName(nextVal);
                setPlanetName(nextVal.trim() ? `${nextVal.trim()}的登陆手帐` : '未知漫游者的登陆手帐');
              }}
              placeholder="留空时显示“未知漫游者”"
              className="mt-1 w-full rounded-xl border border-[#dccbb0] bg-white px-3 py-2.5 text-sm font-semibold text-[#2d251e]"
            />
            <span className="mt-1 block text-[11px] text-[#7c6e5f]">
              首页标题预览：<strong className="text-[#2d251e]">{derivedPlanetTitle}</strong>
            </span>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-[#6e6052]">出生日期（登陆地球坐标日）</span>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="mt-1 w-full rounded-xl border border-[#dccbb0] bg-white px-3 py-2.5 text-sm font-typewriter text-[#2d251e]"
            />
          </label>

          {/* 生理性别：用于匹配 WHO 男女儿童生长参考标准 */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#6e6052]">生理性别（WHO 参考曲线匹配）</span>
              <span className="text-[10.5px] text-[#8b7a66]">用于成长曲线与营养评价</span>
            </div>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {(
                [
                  { id: 'boy', label: '男宝' },
                  { id: 'girl', label: '女宝' },
                  { id: 'star', label: '暂不设置' },
                ] as const
              ).map((opt) => {
                const active = gender === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setGender(opt.id)}
                    className={`min-h-[40px] rounded-xl border text-xs font-bold transition-all active:scale-[0.98] ${
                      active
                        ? 'border-[#d6a335] bg-[#fce38a] text-[#2d251e] shadow-xs'
                        : 'border-[#dccbb0] bg-white/90 text-[#6e6052] hover:bg-[#f7efe0]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {gender === 'star' && (
              <p className="mt-1 text-[11px] text-amber-800">
                未设置生理性别时，成长模块将不会套用 WHO 性别标准曲线，营养评价将显示「数据不足」。
              </p>
            )}
          </div>

          {/* 早产儿档案开关与条件字段 */}
          <div className="rounded-xl border border-[#e3d4bc] bg-[#faf3e4]/80 p-3 space-y-2.5">
            <label className="flex cursor-pointer items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-[#2d251e]">是否为早产儿（胎龄 &lt; 37 周）</div>
                <div className="text-[10.5px] text-[#7c6e5f]">
                  早产儿校正月龄规则需由儿保医生确认，系统不会擅自覆盖实际月龄
                </div>
              </div>
              <input
                type="checkbox"
                checked={isPreterm}
                onChange={(e) => setIsPreterm(e.target.checked)}
                className="h-4 w-4 accent-[#1b336b]"
              />
            </label>

            {isPreterm && (
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <label className="block">
                  <span className="text-[11px] font-semibold text-[#6e6052]">出生孕周（22～36 周）</span>
                  <input
                    type="number"
                    min={22}
                    max={36}
                    step={0.5}
                    value={gestationalAgeWeeks}
                    onChange={(e) => setGestationalAgeWeeks(e.target.value)}
                    placeholder="如：34"
                    className="mt-1 w-full rounded-xl border border-[#dccbb0] bg-white px-2.5 py-2 text-xs font-typewriter text-[#2d251e]"
                  />
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold text-[#6e6052]">预产期（选填）</span>
                  <input
                    type="date"
                    value={expectedDueDate}
                    onChange={(e) => setExpectedDueDate(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#dccbb0] bg-white px-2.5 py-2 text-xs font-typewriter text-[#2d251e]"
                  />
                </label>
              </div>
            )}
          </div>

          {/* 实时年龄计算预览 */}
          <div className="rounded-xl bg-[#efe3cb] px-3.5 py-2.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6e6052]">
              <Sparkles className="h-3.5 w-3.5 text-amber-700" />
              <span>实时年龄计算预览（今日 {todayStr.replace(/-/g, '.')}）</span>
            </div>
            <div className="mt-1 text-sm font-bold text-[#2d251e] tabular-nums">
              {agePreview ? agePreview.detailLabel : '尚未设定出生日期，首页将展示“等待建立星球连接…”'}
            </div>
          </div>

          <button
            type="submit"
            className="flex min-h-[46px] w-full items-center justify-center rounded-[20px] bg-[#1b336b] text-sm font-bold text-amber-100 shadow-[0_6px_16px_rgba(27,51,107,0.28)] active:scale-95"
          >
            保存星球档案
          </button>
        </form>

        {/* 2. 常用记录人管理列表 */}
        <section className="paper-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#2d251e]">常用记录人管理</h2>
            <span className="text-xs text-[#7c6e5f] tabular-nums">
              共 {state.profile.recorders.length} 位
            </span>
          </div>

          <div className="divide-y divide-[#e4d5bc]">
            {state.profile.recorders.map((rec) => (
              <div key={rec} className="flex items-center justify-between py-2.5">
                <span className="text-sm font-semibold text-[#2d251e]">{rec}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRecorder(rec)}
                  className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-[#9b8c7b] hover:bg-rose-50 hover:text-rose-700"
                  aria-label={`移除记录人 ${rec}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={newRecorder}
              onChange={(e) => setNewRecorder(e.target.value)}
              placeholder="输入新记录人（如：阿姨、爷爷）"
              className="min-w-0 flex-1 rounded-xl border border-[#dccbb0] bg-white px-3 py-2 text-sm text-[#2d251e]"
            />
            <button
              type="button"
              onClick={handleAddRecorder}
              className="flex min-h-[42px] shrink-0 items-center gap-1 rounded-xl bg-amber-300 px-3.5 text-xs font-bold text-slate-900 active:scale-95"
            >
              <UserPlus className="h-4 w-4" />
              <span>新增</span>
            </button>
          </div>
        </section>

        {/* 3. 数据舱：打包宇宙记忆 & 解冻记忆档案 */}
        <section className="paper-card p-4 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-[#2d251e]">宇宙数据舱（本地备份与迁移）</h2>
            <p className="mt-0.5 text-xs text-[#6e6052]">
              所有日记、喂养、生长坐标与疫苗护盾均可一键打包为本地 JSON 文件
            </p>
          </div>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportMemory}
            className="hidden"
          />

          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={handleExportMemory}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-[20px] bg-[#2d251e] px-4 text-sm font-bold text-amber-100 shadow-[0_6px_16px_rgba(45,37,30,0.25)] active:scale-[0.98]"
            >
              <Download className="h-4 w-4" />
              <span>打包宇宙记忆（导出备份）</span>
            </button>

            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-[20px] border-2 border-[#c8b599] bg-white/80 px-4 text-sm font-bold text-[#2d251e] active:scale-[0.98]"
            >
              <Upload className="h-4 w-4" />
              <span>解冻记忆档案（导入恢复）</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
