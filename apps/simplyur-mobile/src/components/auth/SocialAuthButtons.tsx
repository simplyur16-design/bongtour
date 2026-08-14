// REGRESSION-FREEZE[simplyur-android-application-id]: package is com.bongtour.simplyur not com.bongtravel — manifest
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { signInWithEmailPassword } from '@/src/api/auth';
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
  /** Where to go after success. Default Find my eSIM (plans) — avoids My eSIM list flash. */
  successHref?: string;
  /**
   * When false, skip router.replace (rare). Default true → Find my eSIM plans.
   * REGRESSION-FREEZE[simplyur-mobile-my-esim-soft-reload]: login lands on plans — manifest
   */
  navigateOnSuccess?: boolean;
  /**
   * When true (My eSIM), email form expands inline — no stack push that feels like a web sheet.
   * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: inline email — manifest
   */
  inlineEmail?: boolean;
};

/**
 * Apple · Google · Email — always on My eSIM / sign-in (no website-only email gate).
 * REGRESSION-FREEZE[simplyur-mobile-my-esim-social-signin]: social buttons SSOT — manifest
 * REGRESSION-FREEZE[auth-password-reset]: inline email forgot link — manifest
 */
export function SocialAuthButtons({
  onSignedIn,
  successHref = '/(tabs)/plans',
  navigateOnSuccess = true,
  inlineEmail = false,
}: Props) {
  const { t } = useI18n();
  const [busy, setBusy] = useState<'apple' | 'google' | 'email' | null>(null);
  const [err, setErr] = useState('');
  /** Always show Apple on iOS (product SSOT). Capability may still fail until Apple ID is signed in. */
  const showApple = Platform.OS === 'ios';
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const googleConfigured = isGoogleNativeConfigured();

  async function afterOk() {
    await onSignedIn?.();
    if (navigateOnSuccess) {
      router.replace(successHref as '/(tabs)/plans');
    }
  }

  async function onApple() {
    setErr('');
    setBusy('apple');
    try {
      if (!(await isAppleNativeAvailable())) {
        // Do not auto-open Settings — that strands users in the Settings app.
        setErr(t('auth.appleUnavailable'));
        return;
      }
      await signInWithAppleNative();
      await afterOk();
    } catch {
      setErr(t('auth.errorGeneric'));
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
      else if (code === 'oauth_android_sha_mismatch') {
        // Dev builds: include exact package + debug SHA-1 so ops can register without hunting.
        setErr(
          typeof __DEV__ !== 'undefined' && __DEV__
            ? `${t('auth.googleAndroidShaMismatch')} (com.bongtour.simplyur / SHA-1 5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25)`
            : t('auth.googleAndroidShaMismatch'),
        );
      } else if (code === 'oauth_cancelled') setErr('');
      else setErr(t('auth.errorGeneric'));
    } finally {
      setBusy(null);
    }
  }

  async function onEmailSubmit() {
    setErr('');
    setBusy('email');
    try {
      await signInWithEmailPassword(email, password);
      await afterOk();
    } catch {
      setErr(t('auth.invalidCredentials'));
    } finally {
      setBusy(null);
    }
  }

  function onEmailPress() {
    setErr('');
    if (inlineEmail) {
      setEmailOpen(true);
      return;
    }
    router.push('/sign-in/email');
  }

  return (
    <View style={styles.wrap}>
      {showApple ? (
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

      {!emailOpen ? (
        <Pressable
          onPress={onEmailPress}
          disabled={busy !== null}
          style={[styles.btn, styles.btnEmail, busy ? styles.btnBusy : null]}
          accessibilityRole="button"
          accessibilityLabel={t('auth.continueEmail')}>
          <EmailMark />
          <Text style={styles.btnEmailText}>{t('auth.continueEmail')}</Text>
        </Pressable>
      ) : (
        <View style={styles.emailBox}>
          <Text style={styles.emailTitle}>{t('auth.email')}</Text>
          <Text style={styles.label}>{t('auth.emailLabel')}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            style={styles.input}
            placeholderTextColor={LOGIN_1B.faint}
          />
          <View style={styles.passwordRow}>
            <Text style={styles.labelTight}>{t('auth.passwordLabel')}</Text>
            <Pressable onPress={() => router.push('/sign-in/forgot')} hitSlop={8}>
              <Text style={styles.forgot}>{t('auth.forgotPasswordLink')}</Text>
            </Pressable>
          </View>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            style={styles.input}
            placeholderTextColor={LOGIN_1B.faint}
          />
          <Pressable
            style={[styles.btn, styles.btnEmail, busy ? styles.btnBusy : null]}
            disabled={busy !== null}
            onPress={() => void onEmailSubmit()}>
            {busy === 'email' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnEmailText}>{t('auth.signInSubmit')}</Text>
            )}
          </Pressable>
          <Pressable onPress={() => setEmailOpen(false)} hitSlop={8}>
            <Text style={styles.backLink}>{t('auth.backToMethods')}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/sign-in/sign-up')} hitSlop={8}>
            <Text style={styles.backLink}>
              {t('auth.noAccount')} {t('auth.signUpLink')}
            </Text>
          </Pressable>
        </View>
      )}

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
  emailBox: {
    gap: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LOGIN_1B.border,
    backgroundColor: '#fff',
  },
  emailTitle: { fontSize: 16, color: LOGIN_1B.navy, ...fp('700'), marginBottom: 4 },
  label: { fontSize: 12, color: LOGIN_1B.muted, ...fp('600') },
  labelTight: { fontSize: 12, color: LOGIN_1B.muted, ...fp('600') },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  forgot: { fontSize: 12, color: LOGIN_1B.coral, ...fp('600') },
  input: {
    borderWidth: 1.5,
    borderColor: LOGIN_1B.border,
    backgroundColor: LOGIN_1B.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: LOGIN_1B.navy,
  },
  backLink: {
    textAlign: 'center',
    color: LOGIN_1B.coral,
    fontSize: 13,
    marginTop: 4,
    ...fp('600'),
  },
  err: {
    marginTop: 4,
    textAlign: 'center',
    color: '#b42318',
    fontSize: 12,
    ...fp('400'),
  },
});
