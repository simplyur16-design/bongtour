/**
 * Native Google / Apple sign-in — system account chooser only (no Safari / Chrome auth window).
 * REGRESSION-FREEZE[simplyur-inapp-auth]: native oauth helpers — manifest
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: GoogleSignin SDK — manifest
 */
import Constants from 'expo-constants';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

import {
  signInWithAppleIdentityToken,
  signInWithGoogleIdToken,
} from '@/src/api/auth';

/** Lazy — Expo Go has no RNGoogleSignin native module; top-level import crashes the client. */
type GoogleSigninModule = typeof import('@react-native-google-signin/google-signin').GoogleSignin;

function getGoogleSignin(): GoogleSigninModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-google-signin/google-signin').GoogleSignin as GoogleSigninModule;
  } catch {
    return null;
  }
}

let googleConfigured = false;

function extraGoogleWebClientId(): string {
  const extra = Constants.expoConfig?.extra as { googleWebClientId?: string } | undefined;
  return (extra?.googleWebClientId ?? '').trim();
}

function googleWebClientId(): string {
  return (
    (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim() ||
    extraGoogleWebClientId()
  );
}

function googleIosClientId(): string {
  const extra = Constants.expoConfig?.extra as { googleIosClientId?: string } | undefined;
  return (
    (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim() ||
    (extra?.googleIosClientId ?? '').trim()
  );
}

export function isGoogleNativeConfigured(): boolean {
  // id_token (server audience) always needs the Web client ID — iOS-only is not enough on Android.
  // Also require the native module (absent in Expo Go).
  return Boolean(googleWebClientId()) && Boolean(getGoogleSignin());
}

function ensureGoogleConfigured(): GoogleSigninModule {
  const GoogleSignin = getGoogleSignin();
  if (!GoogleSignin) throw new Error('oauth_not_configured');
  if (googleConfigured) return GoogleSignin;
  const webClientId = googleWebClientId();
  if (!webClientId) throw new Error('oauth_not_configured');
  const iosClientId = googleIosClientId() || undefined;
  // webClientId is required for id_token (server verifies AUTH_GOOGLE_ID / web audience).
  GoogleSignin.configure({
    webClientId,
    ...(iosClientId ? { iosClientId } : {}),
    offlineAccess: false,
  });
  googleConfigured = true;
  return GoogleSignin;
}

async function readGoogleIdToken(): Promise<string> {
  const GoogleSignin = ensureGoogleConfigured();
  const result = await GoogleSignin.signIn();
  if (result.type !== 'success') throw new Error('oauth_cancelled');
  let token = (result.data.idToken ?? '').trim();
  if (!token) {
    // Some iOS builds return profile without idToken on signIn — getTokens fills it when webClientId is set.
    try {
      const tokens = await GoogleSignin.getTokens();
      token = (tokens.idToken ?? '').trim();
    } catch {
      token = '';
    }
  }
  if (!token) throw new Error('oauth_invalid_token');
  return token;
}

function mapGoogleNativeError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e ?? '');
  const code =
    e && typeof e === 'object' && 'code' in e ? String((e as { code?: unknown }).code ?? '') : '';
  // Android: package+SHA not registered in Google Cloud → DEVELOPER_ERROR (often code 10).
  if (
    /DEVELOPER_ERROR/i.test(msg) ||
    code === '10' ||
    /ApiException:\s*10\b/i.test(msg) ||
    /code:\s*10\b/i.test(msg)
  ) {
    return new Error('oauth_android_sha_mismatch');
  }
  if (/SIGN_IN_CANCELLED|canceled|cancelled/i.test(msg) || code === '-1' || code === '12501') {
    return new Error('oauth_cancelled');
  }
  if (e instanceof Error) return e;
  return new Error(msg || 'oauth_failed');
}

/** Native Google account picker → id_token → mobile-session (no system browser). */
export async function signInWithGoogleNative() {
  if (!isGoogleNativeConfigured()) throw new Error('oauth_not_configured');
  try {
    const GoogleSignin = ensureGoogleConfigured();
    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    }
    const token = await readGoogleIdToken();
    return await signInWithGoogleIdToken(token);
  } catch (e) {
    throw mapGoogleNativeError(e);
  }
}

/** Best-effort Google SDK sign-out (local session clear is separate). */
export async function signOutGoogleNativeBestEffort(): Promise<void> {
  if (!isGoogleNativeConfigured()) return;
  try {
    const GoogleSignin = ensureGoogleConfigured();
    await GoogleSignin.signOut();
  } catch {
    // ignore — local Simplyur session is still cleared by caller
  }
}

export async function isAppleNativeAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithAppleNative() {
  const cred = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  const identityToken = (cred.identityToken ?? '').trim();
  if (!identityToken) throw new Error('oauth_invalid_token');
  return signInWithAppleIdentityToken(identityToken);
}
