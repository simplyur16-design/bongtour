import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppleMark, EmailMark, GoogleMark } from '@/src/components/auth/SignInButtonMarks';
import { LOGIN_1B } from '@/src/constants/login-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import {
  isAppleNativeAvailable,
  isGoogleNativeConfigured,
  signInWithAppleNative,
  signInWithGoogleNative,
} from '@/src/lib/native-oauth';

type Props = {
  /** Called after SecureStore session is written (before navigation). */
  onSignedIn?: () => void | Promise<void>;
  /** Where to go after success. Default My eSIM. */
  successHref?: string;
};

/**
 * Apple · Google · Email — always on My eSIM / sign-in (no website-only email gate).
 * REGRESSION-FREEZE[simplyur-mobile-my-esim-social-signin]: social buttons SSOT — manifest
 */
export function SocialAuthButtons({
  onSignedIn,
  successHref = '/(tabs)/my-esim',
}: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<'apple' | 'google' | 'email' | null>(null);
  const [err, setErr] = useState('');
  const [appleOk, setAppleOk] = useState(Platform.OS === 'ios');
  const googleConfigured = isGoogleNativeConfigured();

  useEffect(() => {
    void isAppleNativeAvailable().then(setAppleOk);
  }, []);

  async function afterOk() {
    await onSignedIn?.();
    router.replace(successHref as '/(tabs)/my-esim');
  }

  async function onApple() {
    setErr('');
    setBusy('apple');
    try {
      await signInWithAppleNative();
      await afterOk();
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setErr(
        code === 'oauth_invalid_token' || code === 'oauth_not_configured'
          ? t('auth.errorGeneric')
          : t('auth.errorGeneric'),
      );
    } finally {
      setBusy(null);
    }
  }

  async function onGoogle() {
    setErr('');
    if (!googleConfigured) {
      setErr(t('auth.googleNotConfigured'));
      return;
    }
    setBusy('google');
    try {
      await signInWithGoogleNative();
      await afterOk();
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (code === 'oauth_not_configured') setErr(t('auth.googleNotConfigured'));
      else if (code === 'oauth_cancelled') setErr('');
      else setErr(t('auth.errorGeneric'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View style={styles.wrap}>
      {appleOk ? (
        <Pressable
          onPress={() => void onApple()}
          disabled={busy !== null}
          style={[styles.btn, styles.btnApple, busy ? styles.btnBusy : null]}
          accessibilityRole="button"
          accessibilityLabel={t('auth.apple')}>
          {busy === 'apple' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <AppleMark />
              <Text style={styles.btnAppleText}>{t('auth.apple')}</Text>
            </>
          )}
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => void onGoogle()}
        disabled={busy !== null}
        style={[styles.btn, styles.btnGoogle, busy ? styles.btnBusy : null]}
        accessibilityRole="button"
        accessibilityLabel={t('auth.google')}>
        {busy === 'google' ? (
          <ActivityIndicator />
        ) : (
          <>
            <GoogleMark />
            <Text style={styles.btnGoogleText}>{t('auth.google')}</Text>
          </>
        )}
      </Pressable>

      <Pressable
        onPress={() => router.push('/sign-in/email')}
        disabled={busy !== null}
        style={[styles.btn, styles.btnEmail, busy ? styles.btnBusy : null]}
        accessibilityRole="button"
        accessibilityLabel={t('auth.continueEmail')}>
        <EmailMark />
        <Text style={styles.btnEmailText}>{t('auth.continueEmail')}</Text>
      </Pressable>

      {err ? <Text style={styles.err}>{err}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: LOGIN_1B.buttonGap, width: '100%' },
  btn: {
    height: LOGIN_1B.buttonHeight,
    borderRadius: LOGIN_1B.buttonRadius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  btnBusy: { opacity: 0.7 },
  btnApple: { backgroundColor: '#000' },
  btnAppleText: { color: '#fff', fontSize: 16, ...fp('600') },
  btnGoogle: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: LOGIN_1B.border,
  },
  btnGoogleText: { color: LOGIN_1B.navy, fontSize: 16, ...fp('600') },
  btnEmail: {
    backgroundColor: LOGIN_1B.coral,
    shadowColor: LOGIN_1B.coral,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 13,
    elevation: 8,
  },
  btnEmailText: { color: '#fff', fontSize: 16, ...fp('600') },
  err: {
    marginTop: 4,
    textAlign: 'center',
    color: '#b42318',
    fontSize: 12,
    ...fp('400'),
  },
});
