/**
 * Expo config — native Google Sign-In (no browser OAuth sheet).
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: google-signin plugin — manifest
 */
const appJson = require('./app.json');

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

const plugins = [...(appJson.expo.plugins ?? [])];
if (iosUrlScheme) {
  plugins.push([
    '@react-native-google-signin/google-signin',
    { iosUrlScheme },
  ]);
} else {
  // Build still works; Google button shows "not configured" until env is present at prebuild.
  plugins.push('@react-native-google-signin/google-signin');
}

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    plugins,
    extra: {
      ...(appJson.expo.extra ?? {}),
      // Runtime fallback when Metro does not inline EXPO_PUBLIC_* (still set on EAS).
      googleWebClientId: webClientId || undefined,
      googleIosClientId: iosClientId || undefined,
    },
  },
};
