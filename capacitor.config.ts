import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.cosmo.arcade',
  appName: 'Cosmo',
  webDir: 'dist',
  backgroundColor: '#030712',
  loggingBehavior: 'debug',
  // Native releases load their bundled Vite output, including all game assets.
  // Keep these origins stable: local records are scoped to the WebView origin.
  server: {
    hostname: 'localhost',
    androidScheme: 'https',
    iosScheme: 'capacitor',
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#030712',
  },
  ios: {
    contentInset: 'never',
    scrollEnabled: false,
    backgroundColor: '#030712',
    preferredContentMode: 'mobile',
  },
};

export default config;
