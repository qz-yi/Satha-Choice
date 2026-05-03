import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.satha.app',
  appName: 'سطحة',
  webDir: 'dist/public',
  server: {
    // ─── Use HTTP scheme (not HTTPS) for local assets ──────────────────────
    // PMTiles relies on HTTP Range requests to randomly access tile data
    // within the 114 MB south_iraq.pmtiles file. Capacitor's HTTP scheme
    // routes requests through AndroidProtocolHandler, which has native
    // seekable-stream support and correctly returns 206 Partial Content.
    //
    // The HTTPS scheme uses shouldInterceptRequest (WebView-level) which on
    // some Android API levels silently drops the Range header, causing every
    // fetch to return the full file starting at byte 0 — PMTiles interprets
    // this as a corrupted header and renders nothing (blank canvas).
    //
    // This app uses localStorage (not cookies) for auth, so switching from
    // https to http has zero security regression for the local bundle.
    androidScheme: 'http',
    cleartext: true,
  },
  plugins: {
    Geolocation: {
      requestAlwaysAccess: true,
    },
  },
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: false,
    initialFocus: true,
  },
};

export default config;
