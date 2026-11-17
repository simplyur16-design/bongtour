import { Tabs, usePathname } from 'expo-router';

import { SyIcon } from '@/src/components/ui/SyIcon';
import { SY } from '@/src/constants/theme';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/**
 * Devices/settings/legal stay under (tabs) with href:null so the tab bar stays visible.
 * Product purchase hides the tab bar so the docked CTA matches checkout.
 * REGRESSION-FREEZE[simplyur-mobile-tabs-browse-keep]: devices/settings/legal keep tab bar — manifest
 * REGRESSION-FREEZE[simplyur-purchase-dock-cta]: product hides tab bar — manifest
 * REGRESSION-FREEZE[simplyur-esim-app-no-trip-tab]: My Trip hidden from eSIM tab bar — manifest
 * 1.0.2: cobalt active tint + line icons (Home · Plans · Install · My eSIM) from the redesign mockups.
 */
export default function TabLayout() {
  const { t } = useI18n();
  const pathname = usePathname();
  const hideTabBar = pathname.includes('/product/');

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: SY.primary,
        tabBarInactiveTintColor: SY.tabInactive,
        tabBarLabelStyle: { fontSize: 10.5, ...fp('600') },
        headerStyle: { backgroundColor: SY.bg },
        headerTintColor: SY.ink,
        tabBarStyle: hideTabBar
          ? { display: 'none' }
          : { backgroundColor: 'rgba(255,255,255,0.96)', borderTopColor: SY.line },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          title: t('nav.home'),
          tabBarIcon: ({ color }) => <SyIcon name="home" size={24} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          headerShown: false,
          title: t('nav.tabPlans'),
          tabBarIcon: ({ color }) => <SyIcon name="sim" size={24} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="guide"
        options={{
          headerShown: false,
          title: t('nav.tabInstall'),
          tabBarIcon: ({ color }) => <SyIcon name="book" size={24} color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="my-trip"
        options={{
          // REGRESSION-FREEZE[simplyur-esim-app-no-trip-tab]: My Trip is not an eSIM tab — manifest
          href: null,
          headerShown: false,
          title: t('nav.myTrip'),
        }}
      />
      <Tabs.Screen
        name="my-esim"
        options={{
          headerShown: false,
          title: t('nav.myEsim'),
          tabBarIcon: ({ color }) => <SyIcon name="signal" size={24} color={String(color)} />,
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
