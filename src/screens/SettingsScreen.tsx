import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Download,
  GitMerge,
  RefreshCw,
  Share2,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  BabyProfile,
  CoPilotParticipant,
  PlanetAppState,
} from '../types/planet';
import { calculatePlanetAge, getTodayDateStr } from '../data/initialData';
import { CosmicModuleHeader } from '../components/CosmicModuleHeader';
import { PWAInstallButton } from '../components/PWAInstallButton';
import {
  CloudKitAccountStatus,
  hapticSuccess,
  hapticTap,
  isNativeIOSApp,
} from '../native/iosBridge';

interface SettingsScreenProps {
  state: PlanetAppState;
  currentRecorder: string;
  cloudStatus: CloudKitAccountStatus;
  coPilots: CoPilotParticipant[];
  isSyncingCloud: boolean;
  lastSyncedAt: string | null;
  onBackHome: () => void;
  onChangeCurrentRecorder: (recorder: string) => void;
  onUpdateProfile: (profile: BabyProfile) => void;
  onImportState: (nextState: PlanetAppState) => void;
  onMergeState: (incomingState: PlanetAppState) => {
    addedFeedings: number;
    addedDiaries: number;
    addedGrowths: number;
    addedIllnesses: number;
  };
  onInviteCoPilot: () => Promise<string>;
  onSyncNow: () => Promise<string>;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  state,
  currentRecorder,
  cloudStatus,
  coPilots,
  isSyncingCloud,
  lastSyncedAt,
  onBackHome,
  onChangeCurrentRecorder,
  onUpdateProfile,
  onImportState,
  onMergeState,
  onInviteCoPilot,
  onSyncNow,
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
  const [inviting, setInviting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  const todayStr = getTodayDateStr();
  const agePreview = calculatePlanetAge(birthDate, todayStr);
  const derivedPlanetTitle = name.trim() ? `${name.trim()}的登陆手帐` : '未知漫游者的登陆手帐';
  const nativeIOS = isNativeIOSApp();

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
    setTimeout(() => setFeedback((cur) => (cur === msg ? null : cur)), 3800);
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
    hapticSuccess();
    showToast('星球基本档案已更新并同步（成长曲线与营养评价已自动刷新）');
  };

  const handleAddRecorder = () => {
    const trimmed = newRecorder.trim();
    if (!trimmed) return;
    if (state.profile.recorders.includes(trimmed)) {
      showToast('该领航员已在家庭列表中');
      return;
    }
    onUpdateProfile({
      ...state.profile,
      recorders: [...state.profile.recorders, trimmed],
    });
    setNewRecorder('');
    hapticTap();
    showToast(`已新增共同喂养人：${trimmed}`);
  };

  const handleRemoveRecorder = (rec: string) => {
    if (state.profile.recorders.length <= 1) {
      showToast('请至少保留一位共同喂养人');
      return;
    }
    const nextRecorders = state.profile.recorders.filter((r) => r !== rec);
    onUpdateProfile({
      ...state.profile,
      recorders: nextRecorders,
    });
    if (currentRecorder === rec && nextRecorders[0]) {
      onChangeCurrentRecorder(nextRecorders[0]);
    }
  };

  const handleInviteClick = async () => {
    hapticTap();
    setInviting(true);
    try {
      const msg = await onInviteCoPilot();
      hapticSuccess();
      showToast(msg);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '发起家庭共享失败，请稍后重试');
    } finally {
      setInviting(false);
    }
  };

  const handleManualSync = async () => {
    hapticTap();
    try {
      const msg = await onSyncNow();
      hapticSuccess();
      showToast(msg);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'iCloud 同步失败，请稍后重试');
    }
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

  const parseJsonFile = (
    file: File,
    onValid: (parsed: PlanetAppState) => void
  ) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as PlanetAppState;
        if (!parsed.profile || !Array.isArray(parsed.diaries) || !Array.isArray(parsed.vaccines)) {
          showToast('档案格式校验失败，请选择正确的星球记忆 JSON');
          return;
        }
        onValid(parsed);
      } catch {
        showToast('解析记忆档案失败，请检查 JSON 文件');
      }
    };
    reader.readAsText(file);
  };

  // 智能合并家人同步包（按 ID 与时间戳合并去重，不覆盖本机新记录）
  const handleMergeMemory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseJsonFile(file, (parsed) => {
      const summary = onMergeState(parsed);
      hapticSuccess();
      const totalAdded =
        summary.addedFeedings +
        summary.addedDiaries +
        summary.addedGrowths +
        summary.addedIllnesses;
      showToast(
        totalAdded > 0
          ? `合并完成：新增 ${summary.addedFeedings} 条喂养、${summary.addedDiaries} 篇日记、${summary.addedGrowths} 条成长、${summary.addedIllnesses} 条护理`
          : '合并完成：双方记录已是最新一致'
      );
    });
    e.target.value = '';
  };

  // 整库覆盖恢复 (Import JSON)
  const handleImportMemory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    parseJsonFile(file, (parsed) => {
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
      hapticSuccess();
      showToast('记忆档案解冻成功，所有星光记录已恢复');
    });
    e.target.value = '';
  };

  const cloudStatusBadge = (() => {
    if (nativeIOS && cloudStatus.available) {
      return {
        label: cloudStatus.role === 'coPilot' ? 'iCloud 已加入家庭共享' : 'iCloud 免登录同步就绪',
        tone: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      };
    }
    if (nativeIOS && cloudStatus.status === 'noAccount') {
      return {
        label: '请在 iPhone 设置登录 Apple ID',
        tone: 'bg-amber-100 text-amber-800 border-amber-200',
      };
    }
    return {
      label: 'iOS 原生打包后自动启用 iCloud',
      tone: 'bg-sky-100 text-sky-900 border-sky-200',
    };
  })();

  const formattedSyncTime = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="flex min-h-full w-full min-w-0 max-w-full flex-col overflow-x-clip pb-6">
      {/* 统一手绘星空顶栏 */}
      <CosmicModuleHeader
        title="星际档案"
        subtitle="共同喂养与设置"
        onBack={onBackHome}
        backLabel="返回星球首页"
        sticky
      />

      <div className="flex flex-col gap-4 px-4 pt-3">
        {feedback && (
          <div className="flex items-center gap-2 rounded-[20px] border border-emerald-300/40 bg-emerald-500/20 px-4 py-3 typo-meta font-medium text-emerald-100 shadow-[0_8px_20px_rgba(3,8,24,0.3)]">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
            <span>{feedback}</span>
          </div>
        )}

        {/* 0. 家庭共同喂养 · Apple iCloud 私人共享领航员 */}
        <section className="paper-card p-4 space-y-3.5" aria-label="家庭共同喂养与 iCloud 共享">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-1.5 typo-section-title text-[#1e2c4a]">
                <Cloud className="h-4.5 w-4.5 text-[#2563eb]" />
                <span>iCloud 共同领航员</span>
              </h2>
              <p className="mt-0.5 typo-meta text-[#6e6052]">
                免注册免登录，数据仅存于家人私人 iCloud 空间，离线记录联网自动合并
              </p>
            </div>
          </div>

          {/* iCloud 状态条 + 手动刷新 */}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[#e3d4bc] bg-[#faf3e4]/85 px-3 py-2">
            <div className="min-w-0">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cloudStatusBadge.tone}`}
              >
                <Cloud className="h-3 w-3" />
                <span>{cloudStatusBadge.label}</span>
              </span>
              {formattedSyncTime && (
                <div className="mt-1 text-[11px] text-[#7c6e5f]">
                  上次静默同步：{formattedSyncTime}
                </div>
              )}
            </div>
            {nativeIOS && (
              <button
                type="button"
                disabled={isSyncingCloud}
                onClick={handleManualSync}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-[#d6c2a2] bg-white px-2.5 py-1.5 text-[11.5px] font-semibold text-[#1e2c4a] active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isSyncingCloud ? 'animate-spin' : ''}`} />
                <span>{isSyncingCloud ? '同步中' : '立即同步'}</span>
              </button>
            )}
          </div>

          {/* 本机我是谁（每台 iPhone 独立保存，同步时互不覆盖） */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs font-semibold text-[#6e6052]">
                <UserCheck className="h-3.5 w-3.5 text-amber-700" />
                <span>本机默认喂养人（我是谁）</span>
              </span>
              <span className="text-[10.5px] text-[#8b7a66]">
                每台手机独立记住身份
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {state.profile.recorders.map((rec) => {
                const active = rec === currentRecorder;
                return (
                  <button
                    key={rec}
                    type="button"
                    onClick={() => {
                      hapticTap();
                      onChangeCurrentRecorder(rec);
                      showToast(`本机已切换为「${rec}」身份，后续喂养与日记将自动署名`);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
                      active
                        ? 'border-[#d6a335] bg-[#fce38a] text-[#1e2c4a] shadow-2xs'
                        : 'border-[#dccbb0] bg-white/90 text-[#6e6052] hover:bg-[#f7efe0]'
                    }`}
                  >
                    {active ? `★ ${rec}（本机）` : rec}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 邀请共同领航员主按钮 */}
          <button
            type="button"
            disabled={inviting}
            onClick={handleInviteClick}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[20px] bg-gradient-to-b from-[#ffe25e] via-[#facc34] to-[#f1a819] px-4 typo-cta text-[#241b09] shadow-[0_6px_18px_rgba(244,179,30,0.36)] transition-transform hover:brightness-105 active:scale-[0.98] disabled:opacity-60"
          >
            <Share2 className="h-4.5 w-4.5" />
            <span>
              {inviting
                ? '正在呼出 iOS 共享面板…'
                : nativeIOS
                ? '邀请共同领航员（iCloud 共享）'
                : '邀请共同领航员（分享家庭同步包）'}
            </span>
          </button>

          {/* 已加入的 iCloud 共同领航员列表 */}
          {coPilots.length > 0 && (
            <div className="rounded-xl border border-[#e3d4bc] bg-white/75 p-2.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[#6e6052]">
                <Users className="h-3.5 w-3.5 text-[#2563eb]" />
                <span>已连接的 iCloud 家庭领航员（{coPilots.length}）</span>
              </div>
              <div className="divide-y divide-[#efe3cb]">
                {coPilots.map((member) => (
                  <div key={member.id} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="font-semibold text-[#1e2c4a]">{member.name}</span>
                    <span className="rounded-full bg-[#efe4ce] px-2 py-0.5 text-[10.5px] text-[#6e6052]">
                      {member.role === 'owner'
                        ? '创建者'
                        : member.status === 'accepted'
                        ? '已实时同步'
                        : '待接受邀请'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!nativeIOS && (
            <p className="rounded-xl bg-[#efe3cb]/75 px-3 py-2 text-[11px] leading-relaxed text-[#6e6052]">
              在 Xcode 打包安装到 iPhone 后，点击上方按钮将直接呼出苹果原生{' '}
              <strong className="text-[#1e2c4a]">iCloud 共享面板</strong>，通过微信 / AirDrop
              发给爸爸一键加入并实时同步；当前网页预览中可直接分享/合并家庭同步包。
            </p>
          )}
        </section>

        {/* 1. 宝宝基本信息与实时年龄计算预览 */}
        <form onSubmit={handleSaveBasic} className="paper-card p-4 space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="typo-section-title text-[#1e2c4a]">小漫游者基本档案</h2>
            {birthDate && (
              <button
                type="button"
                onClick={() => {
                  setBirthDate('');
                  onUpdateProfile({ ...state.profile, birthDate: '' });
                  showToast('已重置出生日期（可回首页查看未初始化状态）');
                }}
                className="typo-badge text-[#7c6e5f] underline underline-offset-2"
              >
                清空生日预览引导页
              </button>
            )}
          </div>

          <label className="block">
            <span className="typo-meta font-medium text-[#6e6052]">宝宝昵称</span>
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
            className="flex min-h-[46px] w-full items-center justify-center rounded-[20px] bg-[#1b336b] typo-cta text-amber-100 shadow-[0_6px_16px_rgba(27,51,107,0.28)] active:scale-95"
          >
            保存星球档案
          </button>
        </form>

        {/* 2. 共同喂养人名单管理 */}
        <section className="paper-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="typo-section-title text-[#1e2c4a]">家庭喂养人名单</h2>
            <span className="typo-meta text-[#7c6e5f] tabular-nums">
              共 {state.profile.recorders.length} 位
            </span>
          </div>

          <div className="divide-y divide-[#e4d5bc]">
            {state.profile.recorders.map((rec) => (
              <div key={rec} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <span className="typo-item-title text-[#2d251e]">{rec}</span>
                  {rec === currentRecorder && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      当前本机
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveRecorder(rec)}
                  className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg text-[#9b8c7b] hover:bg-rose-50 hover:text-rose-700"
                  aria-label={`移除喂养人 ${rec}`}
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
              placeholder="新增家庭成员（如：阿姨、爷爷、月嫂）"
              className="min-w-0 flex-1 rounded-xl border border-[#dccbb0] bg-white px-3 py-2 typo-body text-[#2d251e]"
            />
            <button
              type="button"
              onClick={handleAddRecorder}
              className="flex min-h-[42px] shrink-0 items-center gap-1 rounded-xl bg-amber-300 px-3.5 typo-tab-active text-slate-900 active:scale-95"
            >
              <UserPlus className="h-4 w-4" />
              <span>新增</span>
            </button>
          </div>
        </section>

        {/* 3. 数据舱：智能合并家人记录 & 本地完整备份 */}
        <section className="paper-card p-4 space-y-3">
          <div>
            <h2 className="typo-section-title text-[#1e2c4a]">宇宙数据舱（智能合并与本地备份）</h2>
            <p className="mt-0.5 typo-meta text-[#6e6052]">
              支持按记录 ID 智能合并家人发来的同步包（互不覆盖），也支持完整备份与恢复
            </p>
          </div>

          <input
            ref={mergeInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleMergeMemory}
            className="hidden"
          />
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportMemory}
            className="hidden"
          />

          <div className="grid grid-cols-1 gap-2.5">
            <button
              type="button"
              onClick={() => mergeInputRef.current?.click()}
              className="flex min-h-[46px] items-center justify-center gap-2 rounded-[20px] bg-[#1b336b] px-4 typo-cta text-amber-100 shadow-[0_6px_16px_rgba(27,51,107,0.28)] active:scale-[0.98]"
            >
              <GitMerge className="h-4 w-4" />
              <span>合并家人同步包（智能去重不覆盖）</span>
            </button>

            <button
              type="button"
              onClick={handleExportMemory}
              className="flex min-h-[46px] items-center justify-center gap-2 rounded-[20px] bg-[#2d251e] px-4 typo-cta text-amber-100 shadow-[0_6px_16px_rgba(45,37,30,0.25)] active:scale-[0.98]"
            >
              <Download className="h-4 w-4" />
              <span>打包宇宙记忆（导出完整备份）</span>
            </button>

            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="flex min-h-[46px] items-center justify-center gap-2 rounded-[20px] border-2 border-[#c8b599] bg-white/80 px-4 typo-cta text-[#2d251e] active:scale-[0.98]"
            >
              <Upload className="h-4 w-4" />
              <span>解冻记忆档案（整库覆盖恢复）</span>
            </button>
          </div>
        </section>

        {/* 4. 网页端安装提示（原生 iOS App 内自动隐藏） */}
        <PWAInstallButton />
      </div>
    </div>
  );
};
