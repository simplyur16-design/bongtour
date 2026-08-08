/**
 * In-app Simplyur session — SecureStore Bearer (not browser cookies).
 * REGRESSION-FREEZE[simplyur-inapp-auth]: mobile SecureStore session — manifest
 * REGRESSION-FREEZE[simplyur-mobile-my-esim-session-reload]: session listeners — manifest
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

type SessionListener = () => void;

let memory: SimplyurSession | null = null;
const listeners = new Set<SessionListener>();

function notifySimplyurSessionListeners() {
  for (const listener of listeners) listener();
}

/** My eSIM / checkout reload when native sign-in writes SecureStore. */
export function subscribeSimplyurSession(listener: SessionListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function saveSimplyurSession(session: SimplyurSession): Promise<void> {
  memory = session;
  await SecureStore.setItemAsync(TOKEN_KEY, session.accessToken);
  await SecureStore.setItemAsync(EMAIL_KEY, session.email);
  await SecureStore.setItemAsync(EXP_KEY, String(session.expiresAt));
  notifySimplyurSessionListeners();
}

export async function clearSimplyurSession(): Promise<void> {
  memory = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(EMAIL_KEY);
  await SecureStore.deleteItemAsync(EXP_KEY);
  notifySimplyurSessionListeners();
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
