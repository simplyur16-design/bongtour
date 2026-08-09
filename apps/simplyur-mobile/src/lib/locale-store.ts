/**
 * Persist app UI locale across launches.
 * REGRESSION-FREEZE[simplyur-mobile-p1-account-settings]: locale SecureStore — manifest
 */
import * as SecureStore from 'expo-secure-store';

import {
  DEFAULT_LOCALE,
  SIMPLYUR_LOCALES,
  type SimplyurLocale,
} from '@/src/constants/simplyur';

const LOCALE_KEY = 'simplyur_locale';

export function isSimplyurLocale(value: string): value is SimplyurLocale {
  return (SIMPLYUR_LOCALES as readonly string[]).includes(value);
}

export async function loadPersistedLocale(): Promise<SimplyurLocale> {
  try {
    const raw = (await SecureStore.getItemAsync(LOCALE_KEY))?.trim() ?? '';
    if (raw && isSimplyurLocale(raw)) return raw;
  } catch {
    /* SecureStore unavailable (web/tests) */
  }
  return DEFAULT_LOCALE;
}

export async function persistLocale(locale: SimplyurLocale): Promise<void> {
  try {
    await SecureStore.setItemAsync(LOCALE_KEY, locale);
  } catch {
    /* ignore */
  }
}
