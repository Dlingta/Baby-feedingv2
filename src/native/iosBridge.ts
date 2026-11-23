import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Share } from '@capacitor/share';
import type { CoPilotParticipant, PlanetAppState } from '../types/planet';

// ============================================================================
// 1. 原生 Swift 插件接口声明（对应 ios-native/Plugins/*.swift）
// ============================================================================

export interface CloudKitAccountStatus {
  available: boolean;
  status: 'available' | 'noAccount' | 'restricted' | 'temporarilyUnavailable' | 'couldNotDetermine' | 'webPreview';
  role: 'owner' | 'coPilot';
  userRecordId: string;
}

interface CloudKitFamilyNativePlugin {
  getAccountStatus(): Promise<CloudKitAccountStatus>;
  inviteCoPilot(options: { planetTitle: string; stateJson: string }): Promise<{
    presented: boolean;
    shareUrl: string;
  }>;
  getParticipants(): Promise<{
    participants: CoPilotParticipant[];
    isShared: boolean;
  }>;
  pushSnapshot(options: {
    stateJson: string;
    updatedAt: string;
    updatedBy: string;
    planetTitle: string;
  }): Promise<{ synced: boolean; updatedAt: string; scope: 'private' | 'shared' }>;
  pullLatest(): Promise<{
    found: boolean;
    stateJson?: string;
    updatedAt?: string;
    updatedBy?: string;
    scope?: 'private' | 'shared';
  }>;
  registerSubscriptions(): Promise<{ subscribed: boolean }>;
  addListener(
    eventName: 'cloudKitDidUpdate',
    listenerFunc: (data: { timestamp?: string; reason?: string }) => void
  ): Promise<PluginListenerHandle>;
}

interface VisionOcrNativePlugin {
  recognizeText(options: { imageBase64: string }): Promise<{
    text: string;
    confidence: number;
    engine: 'apple-vision';
  }>;
}

interface SpeechDictationNativePlugin {
  start(): Promise<{ listening: boolean }>;
  stop(): Promise<{ listening: boolean }>;
  addListener(
    eventName: 'speechResult',
    listenerFunc: (data: { text: string; isFinal: boolean }) => void
  ): Promise<PluginListenerHandle>;
}

const CloudKitFamilyNative = registerPlugin<CloudKitFamilyNativePlugin>('CloudKitFamily');
const VisionOcrNative = registerPlugin<VisionOcrNativePlugin>('VisionOcr');
const SpeechDictationNative = registerPlugin<SpeechDictationNativePlugin>('SpeechDictation');

// ============================================================================
// 2. 平台检测与原生界面初始化
// ============================================================================

export function isNativeIOSApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export async function initNativeIOSChrome(): Promise<void> {
  if (!isNativeIOSApp()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setBackgroundColor({ color: '#060d23' });
  } catch {
    // ignore if StatusBar plugin unavailable
  }
}

// ============================================================================
// 3. iPhone Taptic Engine 触感反馈（浏览器预览下静默忽略）
// ============================================================================

export function hapticTap(): void {
  if (!isNativeIOSApp()) return;
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export function hapticSuccess(): void {
  if (!isNativeIOSApp()) return;
  Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}

export function hapticWarning(): void {
  if (!isNativeIOSApp()) return;
  Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
}

// ============================================================================
// 4. 苹果原生 iCloud（CloudKit + CKShare）家庭共同喂养桥接
// ============================================================================

export const cloudKitBridge = {
  async getAccountStatus(): Promise<CloudKitAccountStatus> {
    if (!isNativeIOSApp()) {
      return {
        available: false,
        status: 'webPreview',
        role: 'owner',
        userRecordId: '',
      };
    }
    try {
      return await CloudKitFamilyNative.getAccountStatus();
    } catch {
      return {
        available: false,
        status: 'couldNotDetermine',
        role: 'owner',
        userRecordId: '',
      };
    }
  },

  async registerSubscriptions(): Promise<boolean> {
    if (!isNativeIOSApp()) return false;
    try {
      const res = await CloudKitFamilyNative.registerSubscriptions();
      return Boolean(res.subscribed);
    } catch {
      return false;
    }
  },

  async inviteCoPilot(planetTitle: string, state: PlanetAppState): Promise<{
    mode: 'cloudkit' | 'share-file' | 'download';
    shareUrl?: string;
  }> {
    const stateJson = JSON.stringify(state);
    if (isNativeIOSApp()) {
      const res = await CloudKitFamilyNative.inviteCoPilot({
        planetTitle,
        stateJson,
      });
      return { mode: 'cloudkit', shareUrl: res.shareUrl };
    }

    // 浏览器预览环境：调用系统原生分享面板发出可智能合并的同步包（支持 AirDrop / 微信）
    const today = new Date().toISOString().slice(0, 10);
    const filename = `planet-family-sync-${today}.json`;
    const file = new File([stateJson], filename, { type: 'application/json' });

    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({
        title: `邀请共同记录《${planetTitle}》`,
        text: `这是宝宝的喂养与成长同步包，在「星际档案 → 合并家人记录」中打开即可自动合并，不会覆盖你手机上的新记录。`,
        files: [file],
      });
      return { mode: 'share-file' };
    }

    // 兜底导出同步包
    const blob = new Blob([stateJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return { mode: 'download' };
  },

  async getParticipants(): Promise<{ participants: CoPilotParticipant[]; isShared: boolean }> {
    if (!isNativeIOSApp()) {
      return { participants: [], isShared: false };
    }
    try {
      return await CloudKitFamilyNative.getParticipants();
    } catch {
      return { participants: [], isShared: false };
    }
  },

  async pushSnapshot(state: PlanetAppState, updatedBy: string): Promise<{
    synced: boolean;
    updatedAt?: string;
    scope?: 'private' | 'shared';
  }> {
    if (!isNativeIOSApp()) return { synced: false };
    const updatedAt = state.syncMeta?.updatedAt || new Date().toISOString();
    const planetTitle = state.profile.planetName || '未知漫游者的登陆手帐';
    return CloudKitFamilyNative.pushSnapshot({
      stateJson: JSON.stringify(state),
      updatedAt,
      updatedBy,
      planetTitle,
    });
  },

  async pullLatest(): Promise<{
    found: boolean;
    state?: PlanetAppState;
    updatedAt?: string;
    updatedBy?: string;
    scope?: 'private' | 'shared';
  }> {
    if (!isNativeIOSApp()) return { found: false };
    const res = await CloudKitFamilyNative.pullLatest();
    if (!res.found || !res.stateJson) {
      return { found: false, scope: res.scope };
    }
    try {
      const parsed = JSON.parse(res.stateJson) as PlanetAppState;
      return {
        found: true,
        state: parsed,
        updatedAt: res.updatedAt,
        updatedBy: res.updatedBy,
        scope: res.scope,
      };
    } catch {
      return { found: false, scope: res.scope };
    }
  },

  async onRemoteUpdate(callback: () => void): Promise<() => void> {
    if (!isNativeIOSApp()) return () => {};
    try {
      const handle = await CloudKitFamilyNative.addListener('cloudKitDidUpdate', () => {
        callback();
      });
      return () => {
        handle.remove().catch(() => {});
      };
    } catch {
      return () => {};
    }
  },
};

// ============================================================================
// 5. 苹果原生 Vision OCR 桥接（iPhone Neural Engine 本地加速）
// ============================================================================

export const visionOcrBridge = {
  async recognizeText(imageBase64: string): Promise<{
    text: string;
    confidence: number;
    engine: 'apple-vision';
  } | null> {
    if (!isNativeIOSApp()) return null;
    try {
      return await VisionOcrNative.recognizeText({ imageBase64 });
    } catch {
      return null;
    }
  },
};

// ============================================================================
// 6. 苹果原生 Speech 离线语音转文字桥接
// ============================================================================

export const speechBridge = {
  isNativeAvailable(): boolean {
    return isNativeIOSApp();
  },
  async startNative(onResult: (text: string, isFinal: boolean) => void): Promise<() => Promise<void>> {
    const listener = await SpeechDictationNative.addListener('speechResult', (data) => {
      onResult(data.text, data.isFinal);
    });
    await SpeechDictationNative.start();
    return async () => {
      await SpeechDictationNative.stop().catch(() => {});
      await listener.remove().catch(() => {});
    };
  },
};

// ============================================================================
// 7. 原生分享文本/摘要辅助
// ============================================================================

export async function shareTextNatively(title: string, text: string): Promise<boolean> {
  if (isNativeApp()) {
    try {
      await Share.share({ title, text, dialogTitle: title });
      return true;
    } catch {
      return false;
    }
  }
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
