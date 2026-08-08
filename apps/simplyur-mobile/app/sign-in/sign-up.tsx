import { router } from 'expo-router';
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

import { registerWithEmail, signInWithEmailPassword } from '@/src/api/auth';
import { LOGIN_1B } from '@/src/constants/login-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/** In-app email signup — no WebBrowser. */
export default function SignUpEmailScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit() {
    setErr('');
    if (password !== confirm) {
      setErr(t('auth.signUpErrorPasswordMismatch'));
      return;
    }
    if (!terms) {
      setErr(t('auth.signUpErrorTermsRequired'));
      return;
    }
    setBusy(true);
    try {
      await registerWithEmail({ email, password, termsAccepted: true });
      await signInWithEmailPassword(email, password);
      router.replace('/(tabs)/my-esim');
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      if (code === 'email_taken') setErr(t('auth.signUpErrorEmailTaken'));
      else if (code === 'weak_password') setErr(t('auth.signUpErrorWeakPassword'));
      else if (code === 'invalid_email') setErr(t('auth.signUpErrorInvalidEmail'));
      else setErr(t('auth.signUpErrorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, LOGIN_1B.paddingTop) + 8 }]}>
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Text style={styles.back}>← {t('auth.backToMethods')}</Text>
      </Pressable>
      <Text style={styles.title}>{t('auth.signUpTitle')}</Text>
      <Text style={styles.sub}>{t('auth.signUpSubtitle')}</Text>

      <Text style={styles.label}>{t('auth.emailLabel')}</Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        style={styles.input}
      />
      <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        style={styles.input}
      />
      <Text style={styles.label}>{t('auth.confirmPasswordLabel')}</Text>
      <TextInput
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
        autoComplete="new-password"
        style={styles.input}
      />

      <Pressable style={styles.termsRow} onPress={() => setTerms((v) => !v)}>
        <View style={[styles.checkbox, terms ? styles.checkboxOn : null]} />
        <Text style={styles.termsText}>
          {t('auth.signUpTermsPrefix')} {t('auth.signUpTermsLink')} {t('auth.signUpTermsAnd')}{' '}
          {t('auth.signUpPrivacyLink')}
        </Text>
      </Pressable>

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <Pressable
        style={[styles.cta, busy ? { opacity: 0.7 } : null]}
        disabled={busy}
        onPress={() => void onSubmit()}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.ctaText}>{t('auth.signUpSubmit')}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.push('/sign-in/email')} style={styles.linkWrap}>
        <Text style={styles.link}>
          {t('auth.haveAccount')} {t('auth.signInLink')}
        </Text>
      </Pressable>
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
  sub: { marginTop: 8, marginBottom: 20, fontSize: 13, color: LOGIN_1B.muted, lineHeight: 19, ...fp('400') },
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
  termsRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 12 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: LOGIN_1B.border,
    backgroundColor: '#fff',
    marginTop: 2,
  },
  checkboxOn: { backgroundColor: LOGIN_1B.coral, borderColor: LOGIN_1B.coral },
  termsText: { flex: 1, fontSize: 12, color: LOGIN_1B.muted, lineHeight: 18, ...fp('400') },
  err: { color: '#b42318', fontSize: 12, marginBottom: 10, textAlign: 'center', ...fp('400') },
  cta: {
    height: 56,
    borderRadius: 16,
    backgroundColor: LOGIN_1B.coral,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  ctaText: { color: '#fff', fontSize: 16, ...fp('600') },
  linkWrap: { marginTop: 18, alignItems: 'center' },
  link: { color: LOGIN_1B.coral, fontSize: 13, ...fp('600') },
});
