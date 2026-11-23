import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.planetdiary.babyfeeding',
  appName: '登陆手帐',
  webDir: 'dist',
  backgroundColor: '#060d23',
  ios: {
    contentInset: 'never',
    backgroundColor: '#060d23',
    preferredContentMode: 'mobile',
    allowsLinkPreview: false,
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#060d23',
      overlaysWebView: true,
    },
  },
};

export default config;
