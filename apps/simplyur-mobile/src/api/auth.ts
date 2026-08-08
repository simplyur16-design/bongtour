import { getApiBaseUrl } from '@/src/constants/simplyur';
import { saveSimplyurSession, type SimplyurSession } from '@/src/lib/session';

type SessionOk = {
  ok: true;
  accessToken: string;
  expiresAt: number;
  email: string;
  userId: string;
};

type SessionFail = { ok: false; code?: string };

async function postMobileSession(body: Record<string, unknown>): Promise<SimplyurSession> {
  const res = await fetch(`${getApiBaseUrl()}/api/simplyur/auth/mobile-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => null)) as (SessionOk | SessionFail) | null;
  if (!res.ok || !json || !('accessToken' in json) || !json.ok) {
    const code = json && 'code' in json ? String(json.code ?? '') : '';
    throw new Error(code || 'auth_failed');
  }
  const session: SimplyurSession = {
    accessToken: json.accessToken,
    email: json.email,
    expiresAt: json.expiresAt,
  };
  await saveSimplyurSession(session);
  return session;
}

export async function signInWithEmailPassword(email: string, password: string) {
  return postMobileSession({ provider: 'credentials', email, password });
}

export async function signInWithGoogleIdToken(idToken: string) {
  return postMobileSession({ provider: 'google', idToken });
}

export async function signInWithAppleIdentityToken(identityToken: string) {
  return postMobileSession({ provider: 'apple', identityToken });
}

export async function registerWithEmail(args: {
  email: string;
  password: string;
  termsAccepted: boolean;
}): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/simplyur/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; code?: string } | null;
  if (!res.ok || !json?.ok) {
    throw new Error(json?.code || 'register_failed');
  }
}
