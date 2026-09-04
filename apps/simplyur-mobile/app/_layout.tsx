import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/poppins';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { SystemBars } from 'react-native-edge-to-edge';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { I18nProvider } from '@/src/i18n/I18nContext';
import { checkSimplyurOtaUpdate } from '@/src/lib/ota';
import { registerSimplyurPushTokenBestEffort } from '@/src/lib/push';
import { initSimplyurTelemetry } from '@/src/lib/telemetry';
import { subscribeSimplyurSession } from '@/src/lib/session';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

/**
 * REGRESSION-FREEZE[simplyur-mobile-p2-ops]: OTA + Sentry + push bootstrap — manifest
 * REGRESSION-FREEZE[simplyur-play-android15-large-screen]: SystemBars, not Window.setStatusBarColor — manifest
 */
export default function RootLayout() {
  const [loaded, error] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (!loaded) return;
    SplashScreen.hideAsync();
    initSimplyurTelemetry();
    void checkSimplyurOtaUpdate();
    void registerSimplyurPushTokenBestEffort();
  }, [loaded]);

  useEffect(() => {
    return subscribeSimplyurSession(() => {
      void registerSimplyurPushTokenBestEffort();
    });
  }, []);

  if (!loaded) return null;

  return (
    <I18nProvider>
      <RootLayoutNav />
    </I18nProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SystemBars style="dark" />
      <Stack screenOptions={{ animation: 'slide_from_right', presentation: 'card' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="oauth-complete" options={{ headerShown: false }} />
        <Stack.Screen
          name="checkout"
          options={{
            headerShown: false,
            title: '',
            // Full app screen — never bottom-sheet / fade_from_bottom
            presentation: 'card',
            animation: 'slide_from_right',
          }}
        />
        {/* Legacy WebView route kept for freeze/compat — app flows must not open website chrome */}
        <Stack.Screen name="in-app-web" options={{ headerShown: false, presentation: 'card' }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: 'card', animation: 'slide_from_right', title: 'Language' }}
        />
      </Stack>
    </ThemeProvider>
  );
}
