import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useI18n } from '@/src/i18n/I18nContext';

/**
 * Browse screens (product/devices/settings/legal) live under (tabs) with href:null
 * so the tab bar stays visible. Checkout/sign-in remain outside this group.
 * REGRESSION-FREEZE[simplyur-mobile-tabs-browse-keep]: browse keeps tab bar — manifest
 */
export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useI18n();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#FF6B4A',
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        headerStyle: { backgroundColor: Colors[colorScheme ?? 'light'].background },
        headerTintColor: Colors[colorScheme ?? 'light'].text,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: t('nav.home'),
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'house.fill', android: 'home', web: 'home' }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          headerShown: false,
          title: t('nav.findPlan'),
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'simcard.fill', android: 'sim_card', web: 'sim_card' }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="guide"
        options={{
          headerShown: false,
          title: t('nav.guide'),
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'book.fill', android: 'menu_book', web: 'menu_book' }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-trip"
        options={{
          headerShown: false,
          title: t('nav.myTrip'),
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'airplane', android: 'flight', web: 'flight' }} tintColor={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="my-esim"
        options={{
          headerShown: false,
          title: t('nav.myEsim'),
          tabBarIcon: ({ color }) => (
            <SymbolView name={{ ios: 'simcard.2.fill', android: 'sim_card', web: 'sim_card' }} tintColor={color} size={24} />
          ),
        }}
      />
      {/* Nested browse routes — keep tab bar, hide from tab icons */}
      <Tabs.Screen name="product/[optionApiId]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="devices" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="settings" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="legal" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}
