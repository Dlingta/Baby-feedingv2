import { useEffect } from 'react';
import { isNativeIOSApp } from '../native/iosBridge';

/**
 * 跨机型 iPhone / iOS 原生 App & PWA 视口高度与安全区动态适配 Hook
 *
 * 1. 原生 iOS App（Capacitor WKWebView, contentInset: never）：直接沿用 UIKit 精确的物理屏高与安全区；
 * 2. iOS 独立主屏 PWA（black-translucent + viewport-fit=cover）：修正 WebKit 截断高度导致的底部空带；
 * 3. 灵动岛 / 刘海顶部阴影避让：实时探测 env(safe-area-inset-top/bottom)（含冷启动兜底），按机型分级留白。
 */
export function useViewportSafeArea(): void {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const root = document.documentElement;

    // 隐藏探针：实时读取浏览器/WKWebView 解析后的 env(safe-area-inset-*) 实际像素值
    const probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:0',
      'height:0',
      'visibility:hidden',
      'pointer-events:none',
      'padding-top:env(safe-area-inset-top, 0px)',
      'padding-bottom:env(safe-area-inset-bottom, 0px)',
    ].join(';');
    document.body.appendChild(probe);

    const detectIOS = (): boolean => {
      if (isNativeIOSApp()) return true;
      const ua = navigator.userAgent || '';
      return (
        /iPad|iPhone|iPod/.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
      );
    };

    const detectStandalone = (): boolean => {
      if (isNativeIOSApp()) return true;
      const nav = navigator as Navigator & { standalone?: boolean };
      return (
        nav.standalone === true ||
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches
      );
    };

    const syncMetrics = () => {
      const nativeIOS = isNativeIOSApp();
      const isIOS = detectIOS();
      const isStandalone = detectStandalone();
      const isMobileLayout = window.innerWidth < 1024;
      const isPortrait = window.matchMedia('(orientation: portrait)').matches;

      const computed = window.getComputedStyle(probe);
      let safeTop = Math.round(parseFloat(computed.paddingTop) || 0);
      let safeBottom = Math.round(parseFloat(computed.paddingBottom) || 0);

      const innerH = Math.round(window.innerHeight || 0);
      const vvH = Math.round(window.visualViewport?.height || innerH);
      const keyboardOpen = innerH > 0 && vvH < innerH - 120;

      const screenLong = Math.max(window.screen.height, window.screen.width);
      const screenShort = Math.min(window.screen.height, window.screen.width);
      const physicalTargetH = isPortrait ? screenLong : screenShort;

      const statusGap = physicalTargetH - innerH;
      const hasWebkitStandaloneGap =
        !nativeIOS &&
        isIOS &&
        isStandalone &&
        isMobileLayout &&
        !keyboardOpen &&
        statusGap > 0 &&
        statusGap <= 120;

      if (nativeIOS && isMobileLayout) {
        // 原生 iOS App（Capacitor WKWebView）直接铺满物理窗口
        root.style.setProperty('--app-shell-h', `${innerH > 0 ? innerH : physicalTargetH}px`);
      } else if (isIOS && isStandalone && isMobileLayout) {
        const resolvedShellH = hasWebkitStandaloneGap ? physicalTargetH : innerH;
        if (resolvedShellH > 0) {
          root.style.setProperty('--app-shell-h', `${resolvedShellH}px`);
        }
      } else {
        // 普通移动浏览器（含 Safari 地址栏）与桌面端交由原生 100dvh 管理
        root.style.removeProperty('--app-shell-h');
      }

      if (isIOS && isStandalone && isMobileLayout) {
        // 若冷启动阶段 env(safe-area-inset-top) 暂时返回 0，按真实视口差值或屏幕规格分级兜底
        if (safeTop < 1 && isPortrait) {
          if (hasWebkitStandaloneGap && statusGap >= 18 && statusGap <= 80) {
            safeTop = statusGap;
          } else if (screenLong === 874 || screenLong === 956) {
            safeTop = 62; // iPhone 16 Pro / 16 Pro Max
          } else if (screenLong === 852 || screenLong === 932 || screenLong > 956) {
            safeTop = 59; // iPhone 14 Pro / 15 / 15 Pro / 15 Pro Max / 16 / 16 Plus
          } else if (screenLong >= 812) {
            safeTop = 47; // iPhone X / 11 / 12 / 13 / 14 / 14 Plus
          } else {
            safeTop = 20; // iPhone SE / 非全面屏
          }
        }

        if (safeBottom < 1 && isPortrait && screenLong >= 812) {
          safeBottom = 34; // 全面屏 iPhone 底部 Home Indicator
        }
      }

      // 按顶部硬件区域高度自适应留白：
      // - 灵动岛机型 (>=54pt)：额外 +40px，完整越过灵动岛本体与 iOS 顶部深色渐变阴影
      // - 刘海屏机型 (40~53pt)：额外 +28px，越过刘海及顶部阴影
      // - 普通状态栏 (1~39pt)：额外 +16px
      // - 无刘海桌面/浏览器 (0pt)：保持紧凑 14px
      let extraTop = 14;
      if (safeTop >= 54) {
        extraTop = 40;
      } else if (safeTop >= 40) {
        extraTop = 28;
      } else if (safeTop > 0) {
        extraTop = 16;
      }

      // 底部导航贴近物理底边，同时为全面屏 Home Indicator 留出原生 TabBar 级别的舒适空间
      const bottomNavPad = safeBottom > 0 ? Math.max(safeBottom - 10, 12) : 8;

      root.style.setProperty('--safe-top-resolved', `${safeTop}px`);
      root.style.setProperty('--safe-bottom-resolved', `${safeBottom}px`);
      root.style.setProperty('--header-top-pad', `${safeTop + extraTop}px`);
      root.style.setProperty('--bottom-nav-pad', `${bottomNavPad}px`);
    };

    syncMetrics();
    const rafId = window.requestAnimationFrame(syncMetrics);
    const t1 = window.setTimeout(syncMetrics, 120);
    const t2 = window.setTimeout(syncMetrics, 450);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncMetrics();
      }
    };

    const handleFocusOut = () => {
      if (!detectIOS() || !detectStandalone()) return;
      window.setTimeout(() => {
        const activeTag = document.activeElement?.tagName;
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA' && activeTag !== 'SELECT') {
          window.scrollTo(0, 0);
          syncMetrics();
        }
      }, 80);
    };

    window.addEventListener('resize', syncMetrics);
    window.addEventListener('orientationchange', syncMetrics);
    window.addEventListener('pageshow', syncMetrics);
    document.addEventListener('visibilitychange', handleVisibility);
    document.addEventListener('focusout', handleFocusOut);
    window.visualViewport?.addEventListener('resize', syncMetrics);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', syncMetrics);
      window.removeEventListener('orientationchange', syncMetrics);
      window.removeEventListener('pageshow', syncMetrics);
      document.removeEventListener('visibilitychange', handleVisibility);
      document.removeEventListener('focusout', handleFocusOut);
      window.visualViewport?.removeEventListener('resize', syncMetrics);
      probe.remove();
    };
  }, []);
}
