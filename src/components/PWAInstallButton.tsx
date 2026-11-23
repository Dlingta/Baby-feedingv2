import React, { useState } from 'react';
import { Download, PlusSquare, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // 已以独立 PWA 模式运行时自动隐藏
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop 原生安装弹窗
  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => {
          void install();
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-[20px] border border-amber-200/30 bg-[#16295c]/80 text-left text-[#fffaf0] shadow-[0_6px_16px_rgba(3,8,24,0.3)] transition-colors hover:bg-[#1c3470] active:scale-[0.98] ${
          compact ? 'px-3.5 py-2.5' : 'px-4 py-3'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-300/20 text-amber-300">
            <Download className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate typo-item-title text-[#fffaf0]">
              安装到主屏幕
            </span>
            <span className="block truncate typo-badge text-indigo-200/75">
              全屏离线打开，像原生 App 一样顺滑
            </span>
          </span>
        </span>
      </button>
    );
  }

  // iOS Safari 引导添加到主屏幕
  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`flex w-full items-center justify-between gap-2 rounded-[20px] border border-amber-200/30 bg-[#16295c]/80 text-left text-[#fffaf0] shadow-[0_6px_16px_rgba(3,8,24,0.3)] transition-colors hover:bg-[#1c3470] active:scale-[0.98] ${
            compact ? 'px-3.5 py-2.5' : 'px-4 py-3'
          }`}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-300/20 text-amber-300">
              <Smartphone className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate typo-item-title text-[#fffaf0]">
                添加到 iPhone 主屏幕
              </span>
              <span className="block truncate typo-badge text-indigo-200/75">
                沉浸全屏启动，隐藏浏览器地址栏
              </span>
            </span>
          </span>
        </button>

        {showIOSGuide && (
          <div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/72 p-4 pb-safe backdrop-blur-xs sm:items-center"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              className="w-full max-w-[340px] rounded-[24px] border border-white/15 bg-gradient-to-b from-[#132556] to-[#0a1536] p-5 text-[#fffaf0] shadow-[0_20px_48px_rgba(2,6,20,0.85)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="typo-section-title text-amber-200">
                  添加到 iPhone 主屏幕
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="关闭引导"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-indigo-100 hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <ol className="mt-3.5 space-y-3 typo-body text-indigo-100/90">
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-300/20 text-amber-300">
                    <Share className="h-3.5 w-3.5" />
                  </span>
                  <span>
                    在 Safari 底部工具栏点击 <strong>分享</strong> 按钮
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-300/20 text-amber-300">
                    <PlusSquare className="h-3.5 w-3.5" />
                  </span>
                  <span>
                    向上滑动菜单，选择 <strong>添加到主屏幕</strong>
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-300/20 text-[12px] font-bold text-amber-300">
                    3
                  </span>
                  <span>
                    点击右上角 <strong>添加</strong>，即可从桌面全屏打开手帐
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-[18px] bg-gradient-to-b from-[#fde074] to-[#f2b932] py-2.5 typo-cta text-[#182848] shadow-[0_6px_16px_rgba(249,207,76,0.35)] active:scale-[0.98]"
              >
                我知道了
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="pointer-events-none fixed left-1/2 top-[calc(var(--safe-top-resolved,env(safe-area-inset-top,0px))+14px)] z-[60] flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-amber-200/40 bg-[#1a2c5e]/95 px-3.5 py-1.5 text-[11.5px] font-medium text-amber-100 shadow-[0_8px_20px_rgba(3,8,24,0.55)] backdrop-blur-md"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-300" />
      <span>当前离线 · 本地记录仍可正常浏览与保存</span>
    </div>
  );
};
