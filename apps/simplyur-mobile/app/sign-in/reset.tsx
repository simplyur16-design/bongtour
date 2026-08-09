import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirmPasswordReset } from '@/src/api/auth';
import { LOGIN_1B } from '@/src/constants/login-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/** REGRESSION-FREEZE[auth-password-reset]: sign-in/reset — manifest */
export default function SignInResetScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const token = typeof params.token === 'string' ? params.token : '';
  const email = typeof params.email === 'string' ? params.email : '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  async function onSubmit() {
    setErr('');
    if (password !== confirm) {
      setErr(t('auth.signUpErrorPasswordMismatch'));
      return;
    }
    if (!email || !token) {
      setErr(t('auth.resetPasswordInvalid'));
      return;
    }
    setBusy(true);
    try {
      await confirmPasswordReset({ email, token, password });
      setDone(true);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (code === 'weak_password') setErr(t('auth.signUpErrorWeakPassword'));
      else if (
        code === 'expired_or_used' ||
        code === 'invalid_token' ||
        code === 'no_password_account'
      ) {
        setErr(t('auth.resetPasswordInvalid'));
      } else setErr(t('auth.resetPasswordErrorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, LOGIN_1B.paddingTop) + 8 }]}>
      <Pressable onPress={() => router.replace('/sign-in/email')} hitSlop={10}>
        <Text style={styles.back}>{t('auth.forgotPasswordBack')}</Text>
      </Pressable>
      <Text style={styles.title}>{t('auth.resetPasswordTitle')}</Text>
      <Text style={styles.sub}>{t('auth.resetPasswordSubtitle')}</Text>

      {done ? (
        <>
          <Text style={styles.success}>{t('auth.resetPasswordSuccess')}</Text>
          <Pressable
            style={styles.cta}
            onPress={() => router.replace('/sign-in/email')}
          >
            <Text style={styles.ctaText}>{t('auth.signInSubmit')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.label}>{t('auth.newPasswordLabel')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="new-password"
            style={styles.input}
            placeholderTextColor={LOGIN_1B.faint}
          />
          <Text style={styles.label}>{t('auth.confirmPasswordLabel')}</Text>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            autoComplete="new-password"
            style={styles.input}
            placeholderTextColor={LOGIN_1B.faint}
          />
          {err ? <Text style={styles.err}>{err}</Text> : null}
          <Pressable
            style={[styles.cta, busy ? { opacity: 0.7 } : null]}
            disabled={busy}
            onPress={() => void onSubmit()}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>{t('auth.resetPasswordSubmit')}</Text>
            )}
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LOGIN_1B.bg,
    paddingHorizontal: LOGIN_1B.paddingH,
  },
  back: { fontSize: 14, color: LOGIN_1B.faint, marginBottom: 20, ...fp('400') },
  title: { fontSize: 22, color: LOGIN_1B.navy, ...fp('700') },
  sub: { marginTop: 8, marginBottom: 20, fontSize: 13, color: LOGIN_1B.muted, ...fp('400') },
  label: { fontSize: 12, color: LOGIN_1B.muted, marginBottom: 6, ...fp('600') },
  input: {
    borderWidth: 1.5,
    borderColor: LOGIN_1B.border,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: LOGIN_1B.navy,
    marginBottom: 14,
  },
  err: { color: '#b42318', fontSize: 12, marginBottom: 10, textAlign: 'center', ...fp('400') },
  success: { fontSize: 14, color: LOGIN_1B.muted, lineHeight: 20, marginBottom: 16, ...fp('400') },
  cta: {
    height: 56,
    borderRadius: 16,
    backgroundColor: LOGIN_1B.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaText: { color: '#fff', fontSize: 16, ...fp('600') },
});
