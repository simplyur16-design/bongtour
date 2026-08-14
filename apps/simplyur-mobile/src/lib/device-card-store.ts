/**
 * Card reminder / Autofill preference on this phone only (SecureStore). Never POST PAN to simplyur servers.
 * REGRESSION-FREEZE[simplyur-device-card-wallet]: mobile SecureStore — manifest
 */
import * as SecureStore from 'expo-secure-store';

import {
  parseDeviceSavedCardList,
  sanitizeDeviceSavedCard,
  serializeDeviceSavedCardList,
  type DeviceSavedCard,
} from '@/src/lib/device-card-wallet';

const STORAGE_KEY = 'simplyur_device_cards_v1';
const PREFER_FILL_KEY = 'simplyur_device_card_autofill_v1';

export async function loadDeviceSavedCards(): Promise<DeviceSavedCard[]> {
  try {
    const raw = (await SecureStore.getItemAsync(STORAGE_KEY)) ?? '';
    return parseDeviceSavedCardList(raw);
  } catch {
    return [];
  }
}

export async function saveDeviceSavedCards(cards: DeviceSavedCard[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, serializeDeviceSavedCardList(cards));
  } catch {
    /* SecureStore unavailable */
  }
}

export async function upsertDeviceSavedCard(
  input: Omit<DeviceSavedCard, 'id' | 'savedAt'> & { id?: string; savedAt?: number },
): Promise<DeviceSavedCard | null> {
  const card = sanitizeDeviceSavedCard({ ...input, savedAt: input.savedAt ?? Date.now() });
  if (!card) return null;
  const existing = await loadDeviceSavedCards();
  const next = [
    card,
    ...existing.filter((c) => c.id !== card.id && !(c.brand === card.brand && c.last4 === card.last4)),
  ];
  await saveDeviceSavedCards(next);
  return card;
}

export async function removeDeviceSavedCard(id: string): Promise<void> {
  const existing = await loadDeviceSavedCards();
  await saveDeviceSavedCards(existing.filter((c) => c.id !== id));
}

export async function loadPreferPhoneCardFill(): Promise<boolean> {
  try {
    return ((await SecureStore.getItemAsync(PREFER_FILL_KEY)) ?? '') === '1';
  } catch {
    return false;
  }
}

export async function savePreferPhoneCardFill(on: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(PREFER_FILL_KEY, on ? '1' : '0');
  } catch {
    /* SecureStore unavailable */
  }
}

export type { DeviceSavedCard };
