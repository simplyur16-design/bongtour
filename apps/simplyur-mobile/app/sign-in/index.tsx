import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppleMark, EmailMark, GoogleMark } from '@/src/components/auth/SignInButtonMarks';
import { SignalPinIcon } from '@/src/components/auth/SignalPinIcon';
import { LOGIN_1B } from '@/src/constants/login-design';
import { getApiBaseUrl } from '@/src/constants/simplyur';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/**
 * design_handoff_login_1b — centered chooser: Apple · Google · Email + Skip.
 */
export default function SignInChooserScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);

  async function openOAuth(provider: 'google' | 'apple') {
    setBusy(provider);
    try {
      const base = getApiBaseUrl();
      const q = encodeURIComponent('/simplyur/en/my-esim');
      await WebBrowser.openBrowserAsync(`${base}/api/auth/oauth-start/${provider}?callbackUrl=${q}`);
    } finally {
      setBusy(null);
    }
  }

  function onSkip() {
    router.replace('/(tabs)');
  }

  function onEmail() {
    router.push('/sign-in/email');
  }

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, LOGIN_1B.paddingTop) }]}>
      <Pressable
        onPress={onSkip}
        style={[styles.skip, { top: Math.max(insets.top + 12, LOGIN_1B.skipTop) }]}
        accessibilityRole="button"
      >
        <Text style={styles.skipText}>{t('auth.skip')}</Text>
      </Pressable>

      <View style={styles.spacer} />

      <View style={styles.hero}>
        <SignalPinIcon />
        <View style={styles.headingStack}>
          <Text style={styles.welcomeTitle}>{t('auth.welcomeTitle')}</Text>
          <Text style={styles.welcomeSubtitle}>{t('auth.welcomeSubtitle')}</Text>
        </View>
      </View>

      <View style={styles.buttons}>
        <Pressable
          onPress={() => openOAuth('apple')}
          disabled={busy !== null}
          style={[styles.btn, styles.btnApple, busy ? styles.btnBusy : null]}
        >
          {busy === 'apple' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <AppleMark />
              <Text style={styles.btnAppleText}>{t('auth.apple')}</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={() => openOAuth('google')}
          disabled={busy !== null}
          style={[styles.btn, styles.btnGoogle, busy ? styles.btnBusy : null]}
        >
          {busy === 'google' ? (
            <ActivityIndicator />
          ) : (
            <>
              <GoogleMark />
              <Text style={styles.btnGoogleText}>{t('auth.google')}</Text>
            </>
          )}
        </Pressable>

        <Pressable onPress={onEmail} disabled={busy !== null} style={[styles.btn, styles.btnEmail]}>
          <EmailMark />
          <Text style={styles.btnEmailText}>{t('auth.continueEmail')}</Text>
        </Pressable>
      </View>

      <View style={styles.spacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LOGIN_1B.bg,
    paddingHorizontal: LOGIN_1B.paddingH,
    paddingBottom: LOGIN_1B.paddingBottom,
    position: 'relative',
  },
  skip: {
    position: 'absolute',
    right: LOGIN_1B.paddingH,
    zIndex: 2,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 13,
    color: LOGIN_1B.faint,
    ...fp('400'),
  },
  spacer: { flex: 1 },
  hero: {
    alignItems: 'center',
    gap: LOGIN_1B.logoGap,
    marginBottom: LOGIN_1B.blockMarginBottom,
  },
  headingStack: {
    alignItems: 'center',
    gap: LOGIN_1B.headingGap,
  },
  welcomeTitle: {
    fontSize: 24,
    color: LOGIN_1B.navy,
    letterSpacing: -0.24,
    textAlign: 'center',
    ...fp('600'),
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: LOGIN_1B.muted,
    textAlign: 'center',
    lineHeight: 19.5,
    ...fp('400'),
  },
  buttons: {
    gap: LOGIN_1B.buttonGap,
  },
  btn: {
    height: LOGIN_1B.buttonHeight,
    borderRadius: LOGIN_1B.buttonRadius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnBusy: { opacity: 0.7 },
  btnApple: {
    backgroundColor: '#000',
  },
  btnAppleText: {
    color: '#fff',
    fontSize: 16,
    ...fp('600'),
  },
  btnGoogle: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: LOGIN_1B.border,
  },
  btnGoogleText: {
    color: LOGIN_1B.navy,
    fontSize: 16,
    ...fp('600'),
  },
  btnEmail: {
    backgroundColor: LOGIN_1B.coral,
    shadowColor: LOGIN_1B.coral,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 13,
    elevation: 8,
  },
  btnEmailText: {
    color: '#fff',
    fontSize: 16,
    ...fp('600'),
  },
});
