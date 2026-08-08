/**
 * In-app Simplyur session — SecureStore Bearer (not browser cookies).
 * REGRESSION-FREEZE[simplyur-inapp-auth]: mobile SecureStore session — manifest
 */
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'simplyur_access_token';
const EMAIL_KEY = 'simplyur_access_email';
const EXP_KEY = 'simplyur_access_expires_at';

export type SimplyurSession = {
  accessToken: string;
  email: string;
  expiresAt: number;
};

let memory: SimplyurSession | null = null;

export async function saveSimplyurSession(session: SimplyurSession): Promise<void> {
  memory = session;
  await SecureStore.setItemAsync(TOKEN_KEY, session.accessToken);
  await SecureStore.setItemAsync(EMAIL_KEY, session.email);
  await SecureStore.setItemAsync(EXP_KEY, String(session.expiresAt));
}

export async function clearSimplyurSession(): Promise<void> {
  memory = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(EMAIL_KEY);
  await SecureStore.deleteItemAsync(EXP_KEY);
}

export async function loadSimplyurSession(): Promise<SimplyurSession | null> {
  if (memory?.accessToken) {
    if (memory.expiresAt > 0 && memory.expiresAt * 1000 < Date.now() - 30_000) {
      await clearSimplyurSession();
      return null;
    }
    return memory;
  }
  const accessToken = (await SecureStore.getItemAsync(TOKEN_KEY)) ?? '';
  const email = (await SecureStore.getItemAsync(EMAIL_KEY)) ?? '';
  const expRaw = (await SecureStore.getItemAsync(EXP_KEY)) ?? '';
  const expiresAt = Number.parseInt(expRaw, 10) || 0;
  if (!accessToken) return null;
  if (expiresAt > 0 && expiresAt * 1000 < Date.now() - 30_000) {
    await clearSimplyurSession();
    return null;
  }
  memory = { accessToken, email, expiresAt };
  return memory;
}

export async function getSimplyurAccessToken(): Promise<string> {
  const s = await loadSimplyurSession();
  return s?.accessToken ?? '';
}
