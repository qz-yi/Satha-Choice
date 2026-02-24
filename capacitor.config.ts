import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.satha.app',
  appName: 'سطحة',
  webDir: 'dist/public',
  server: {
    // Use https scheme on Android (required for cookies & modern security)
    androidScheme: 'https',
    // Allow cleartext traffic to the production API (needed if server uses http)
    cleartext: true,
  },
  plugins: {
    Geolocation: {
      // Request precise location on Android 12+
      requestAlwaysAccess: true,
    },
  },
};

export default config;
