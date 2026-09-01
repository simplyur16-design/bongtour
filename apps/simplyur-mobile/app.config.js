/**
 * Expo config — Google Sign-In + Sentry DSN wiring.
 * Must export a function that spreads `{ config }` (static app.json).
 * Object export makes expo-doctor fail: "app.config.js is not using the values from app.json".
 * REGRESSION-FREEZE[simplyur-eas-doctor-sdk57]: function + ...config — manifest
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: google-signin plugin — manifest
 * REGRESSION-FREEZE[simplyur-mobile-p2-ops]: sentry/updates plugins — manifest
 */
function googleIosUrlSchemeFromWebClientId(clientId) {
  const id = String(clientId ?? '').trim();
  const suffix = '.apps.googleusercontent.com';
  if (!id.endsWith(suffix)) return null;
  const body = id.slice(0, -suffix.length);
  if (!body) return null;
  return `com.googleusercontent.apps.${body}`;
}

const webClientId = (
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  process.env.AUTH_GOOGLE_ID ||
  ''
).trim();
const iosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim();
const iosUrlScheme = googleIosUrlSchemeFromWebClientId(iosClientId || webClientId);
const sentryDsn = (process.env.EXPO_PUBLIC_SENTRY_DSN || '').trim();

module.exports = ({ config }) => {
  const plugins = [...(config.plugins ?? []), 'expo-asset'];
  if (iosUrlScheme) {
    plugins.push([
      '@react-native-google-signin/google-signin',
      { iosUrlScheme },
    ]);
  } else {
    // Build still works; Google button shows "not configured" until env is present at prebuild.
    plugins.push('@react-native-google-signin/google-signin');
  }

  // Source-map upload only when Sentry auth is present (avoids EAS build fail without org).
  if (process.env.SENTRY_AUTH_TOKEN?.trim()) {
    plugins.push([
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG?.trim() || 'bongtour',
        project: process.env.SENTRY_PROJECT?.trim() || 'simplyur-mobile',
      },
    ]);
  }

  return {
    ...config,
    plugins,
    extra: {
      ...(config.extra ?? {}),
      // Runtime fallback when Metro does not inline EXPO_PUBLIC_* (still set on EAS).
      googleWebClientId: webClientId || undefined,
      googleIosClientId: iosClientId || undefined,
      sentryDsn: sentryDsn || undefined,
    },
  };
};
