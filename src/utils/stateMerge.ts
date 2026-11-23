import {
  BabyProfile,
  ChecklistItem,
  PlanetAppState,
  VaccineDose,
} from '../types/planet';

export interface MergeSummary {
  state: PlanetAppState;
  addedFeedings: number;
  addedDiaries: number;
  addedGrowths: number;
  addedIllnesses: number;
}

function toTs(iso?: string): number {
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mergeDeletedMaps(
  localMap?: Record<string, string>,
  remoteMap?: Record<string, string>
): Record<string, string> {
  const merged: Record<string, string> = { ...(localMap || {}) };
  for (const [id, ts] of Object.entries(remoteMap || {})) {
    if (!merged[id] || toTs(ts) > toTs(merged[id])) {
      merged[id] = ts;
    }
  }
  return merged;
}

function mergeCollectionById<T extends { id: string; updatedAt?: string }>(
  localItems: T[],
  remoteItems: T[],
  deletedIds: Record<string, string>,
  sortFn: (a: T, b: T) => number
): { items: T[]; addedCount: number } {
  const localIds = new Set(localItems.map((i) => i.id));
  const map = new Map<string, T>();

  const consider = (item: T) => {
    const delTs = toTs(deletedIds[item.id]);
    const itemTs = toTs(item.updatedAt);
    // 若墓碑删除时间晚于记录更新时间，则不保留
    if (delTs > 0 && delTs >= itemTs) return;

    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      return;
    }
    if (itemTs > toTs(existing.updatedAt)) {
      map.set(item.id, item);
    }
  };

  localItems.forEach(consider);
  remoteItems.forEach(consider);

  const items = Array.from(map.values()).sort(sortFn);
  const addedCount = items.filter((item) => !localIds.has(item.id)).length;
  return { items, addedCount };
}

function mergeVaccines(localVaccines: VaccineDose[], remoteVaccines: VaccineDose[]): VaccineDose[] {
  const remoteMap = new Map(remoteVaccines.map((v) => [v.id, v]));
  const merged = localVaccines.map((localDose) => {
    const remoteDose = remoteMap.get(localDose.id);
    if (!remoteDose) return localDose;

    const localTs = toTs(localDose.updatedAt);
    const remoteTs = toTs(remoteDose.updatedAt);
    if (remoteTs > localTs) return remoteDose;
    if (localTs > remoteTs) return localDose;
    if (remoteDose.status === 'activated' && localDose.status !== 'activated') {
      return remoteDose;
    }
    return localDose;
  });

  // 保证第一个未激活剂次高亮为 next
  const firstPending = merged.findIndex((v) => v.status !== 'activated');
  return merged.map((v, idx) => {
    if (v.status === 'activated') return v;
    return { ...v, status: idx === firstPending ? 'next' : 'locked' };
  });
}

function mergeChecklist(localList: ChecklistItem[], remoteList: ChecklistItem[]): ChecklistItem[] {
  const remoteMap = new Map(remoteList.map((c) => [c.id, c]));
  return localList.map((item) => {
    const remote = remoteMap.get(item.id);
    if (!remote) return item;
    const localTs = toTs(item.updatedAt);
    const remoteTs = toTs(remote.updatedAt);
    if (remoteTs > localTs) return remote;
    if (localTs > remoteTs) return item;
    return { ...item, completed: item.completed || remote.completed };
  });
}

function mergeProfile(
  localProfile: BabyProfile,
  remoteProfile: BabyProfile,
  localUpdatedAt?: string,
  remoteUpdatedAt?: string
): BabyProfile {
  const preferRemote = toTs(remoteUpdatedAt) > toTs(localUpdatedAt);
  const base = preferRemote ? remoteProfile : localProfile;
  const secondary = preferRemote ? localProfile : remoteProfile;

  // 合并所有家庭共同领航员名字，去重保序
  const recorders = Array.from(
    new Set([
      ...(localProfile.recorders || []),
      ...(remoteProfile.recorders || []),
    ].filter((r) => Boolean(r && r.trim())))
  );

  return {
    ...secondary,
    ...base,
    name: base.name || secondary.name,
    planetName: base.planetName || secondary.planetName,
    birthDate: base.birthDate || secondary.birthDate,
    recorders: recorders.length > 0 ? recorders : ['妈妈', '爸爸'],
  };
}

/**
 * 多设备离线冲突安全合并引擎（CloudKit 静默同步 & 家庭同步包通用）
 * 保证两台 iPhone 同时离线记录喂养/日记后，合并零丢失、不互相覆盖、已删记录不复活。
 */
export function mergePlanetStates(
  local: PlanetAppState,
  remote: PlanetAppState
): MergeSummary {
  const deletedIds = mergeDeletedMaps(local.syncMeta?.deletedIds, remote.syncMeta?.deletedIds);

  const diariesRes = mergeCollectionById(
    local.diaries || [],
    remote.diaries || [],
    deletedIds,
    (a, b) => b.date.localeCompare(a.date) || toTs(b.updatedAt) - toTs(a.updatedAt)
  );

  const feedingsRes = mergeCollectionById(
    local.feedings || [],
    remote.feedings || [],
    deletedIds,
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.time.localeCompare(a.time) ||
      toTs(b.updatedAt) - toTs(a.updatedAt)
  );

  const growthsRes = mergeCollectionById(
    local.growths || [],
    remote.growths || [],
    deletedIds,
    (a, b) => a.date.localeCompare(b.date)
  );

  const illnessesRes = mergeCollectionById(
    local.illnesses || [],
    remote.illnesses || [],
    deletedIds,
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.time.localeCompare(a.time) ||
      toTs(b.updatedAt) - toTs(a.updatedAt)
  );

  const profile = mergeProfile(
    local.profile,
    remote.profile,
    local.syncMeta?.updatedAt,
    remote.syncMeta?.updatedAt
  );

  const vaccines = mergeVaccines(local.vaccines || [], remote.vaccines || []);
  const checklist = mergeChecklist(local.checklist || [], remote.checklist || []);

  const latestTs =
    toTs(remote.syncMeta?.updatedAt) > toTs(local.syncMeta?.updatedAt)
      ? remote.syncMeta?.updatedAt || new Date().toISOString()
      : local.syncMeta?.updatedAt || new Date().toISOString();

  return {
    state: {
      profile,
      diaries: diariesRes.items,
      feedings: feedingsRes.items,
      growths: growthsRes.items,
      vaccines,
      illnesses: illnessesRes.items,
      checklist,
      syncMeta: {
        schemaVersion: 2,
        updatedAt: latestTs,
        updatedBy: remote.syncMeta?.updatedBy || local.syncMeta?.updatedBy,
        deletedIds,
      },
    },
    addedFeedings: feedingsRes.addedCount,
    addedDiaries: diariesRes.addedCount,
    addedGrowths: growthsRes.addedCount,
    addedIllnesses: illnessesRes.addedCount,
  };
}
