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

/** Always resolves on success-shaped response (API never enumerates emails). */
export async function requestPasswordReset(args: {
  email: string;
  locale?: string;
}): Promise<void> {
  await fetch(`${getApiBaseUrl()}/api/auth/password-reset/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: args.email,
      surface: 'simplyur',
      locale: args.locale,
      client: 'mobile',
    }),
  });
}

export async function confirmPasswordReset(args: {
  email: string;
  token: string;
  password: string;
}): Promise<void> {
  const res = await fetch(`${getApiBaseUrl()}/api/auth/password-reset/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: args.email,
      token: args.token,
      password: args.password,
      surface: 'simplyur',
    }),
  });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; code?: string } | null;
  if (!res.ok || !json?.ok) {
    throw new Error(json?.code || 'reset_failed');
  }
}
