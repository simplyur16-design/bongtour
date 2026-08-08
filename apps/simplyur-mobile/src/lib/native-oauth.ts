/**
 * Native Google / Apple sign-in — system account chooser only (no Safari / Chrome auth window).
 * REGRESSION-FREEZE[simplyur-inapp-auth]: native oauth helpers — manifest
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: GoogleSignin SDK — manifest
 */
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';

import {
  signInWithAppleIdentityToken,
  signInWithGoogleIdToken,
} from '@/src/api/auth';

let googleConfigured = false;

function googleWebClientId(): string {
  return (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
}

function googleIosClientId(): string {
  return (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim();
}

export function isGoogleNativeConfigured(): boolean {
  return Boolean(googleWebClientId() || googleIosClientId());
}

function ensureGoogleConfigured(): void {
  if (googleConfigured) return;
  const webClientId = googleWebClientId() || undefined;
  const iosClientId = googleIosClientId() || undefined;
  GoogleSignin.configure({
    webClientId,
    ...(iosClientId ? { iosClientId } : {}),
    offlineAccess: false,
  });
  googleConfigured = true;
}

/** Native Google account picker → id_token → mobile-session (no system browser). */
export async function signInWithGoogleNative() {
  if (!isGoogleNativeConfigured()) throw new Error('oauth_not_configured');
  ensureGoogleConfigured();
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }
  const result = await GoogleSignin.signIn();
  if (result.type !== 'success') throw new Error('oauth_cancelled');
  const token = (result.data.idToken ?? '').trim();
  if (!token) throw new Error('oauth_invalid_token');
  return signInWithGoogleIdToken(token);
}

export async function isAppleNativeAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync();
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
