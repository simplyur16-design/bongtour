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
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';
import { I18nProvider } from '@/src/i18n/I18nContext';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Poppins_800ExtraBold,
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

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
      <Stack screenOptions={{ animation: 'slide_from_right', presentation: 'card' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="oauth-complete" options={{ headerShown: false }} />
        <Stack.Screen name="product/[optionApiId]" options={{ headerShown: false, title: '' }} />
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
        <Stack.Screen
          name="devices"
          options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="legal"
          options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="settings"
          options={{ headerShown: false, presentation: 'card', animation: 'slide_from_right' }}
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
