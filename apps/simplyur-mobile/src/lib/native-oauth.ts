/**
 * Native Google / Apple sign-in (no system browser login sheet for auth).
 * REGRESSION-FREEZE[simplyur-inapp-auth]: native oauth helpers — manifest
 */
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import {
  signInWithAppleIdentityToken,
  signInWithGoogleIdToken,
} from '@/src/api/auth';

WebBrowser.maybeCompleteAuthSession();

function googleWebClientId(): string {
  return (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
}

function googleIosClientId(): string {
  return (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim();
}

function googleAndroidClientId(): string {
  return (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '').trim();
}

export function isGoogleNativeConfigured(): boolean {
  // Web client id is enough for id_token verify on server; platform ids preferred.
  return Boolean(googleWebClientId() || googleIosClientId() || googleAndroidClientId());
}

export function useGoogleIdTokenRequest() {
  return Google.useIdTokenAuthRequest({
    webClientId: googleWebClientId() || undefined,
    iosClientId: googleIosClientId() || googleWebClientId() || undefined,
    androidClientId: googleAndroidClientId() || googleWebClientId() || undefined,
  });
}

export async function completeGoogleSignIn(idToken: string | undefined | null) {
  const token = (idToken ?? '').trim();
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
