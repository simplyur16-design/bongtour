/**
 * Expo push token registration (permission + server upsert).
 * REGRESSION-FREEZE[simplyur-mobile-p2-ops]: push register — manifest
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getApiBaseUrl } from '@/src/constants/simplyur';
import { getSimplyurAccessToken } from '@/src/lib/session';

Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }) as Notifications.NotificationBehavior,
});

function projectId(): string | undefined {
  const eas = Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined;
  return (
    eas?.projectId ||
    Constants.easConfig?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
    undefined
  );
}

export async function registerSimplyurPushTokenBestEffort(): Promise<void> {
  try {
    if (!Device.isDevice) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('simplyur-default', {
        name: 'simplyur',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: projectId(),
      })
    ).data;
    if (!token) return;

    const access = await getSimplyurAccessToken();
    if (!access) return;

    await fetch(`${getApiBaseUrl()}/api/simplyur/account/device-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        token,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      }),
    });
  } catch {
    // Push is optional — never block app start.
  }
}
