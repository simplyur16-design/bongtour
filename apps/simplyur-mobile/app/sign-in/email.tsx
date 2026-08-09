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

import { signInWithEmailPassword } from '@/src/api/auth';
import { LOGIN_1B } from '@/src/constants/login-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/** In-app email/password sign-in — no WebBrowser. */
export default function SignInEmailScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit() {
    setErr('');
    setBusy(true);
    try {
      await signInWithEmailPassword(email, password);
      router.replace('/(tabs)/my-esim');
    } catch {
      setErr(t('auth.invalidCredentials'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, LOGIN_1B.paddingTop) + 8 }]}>
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Text style={styles.back}>← {t('auth.backToMethods')}</Text>
      </Pressable>
      <Text style={styles.title}>{t('auth.email')}</Text>
      <Text style={styles.sub}>{t('auth.emailSubtitle')}</Text>

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

      {err ? <Text style={styles.err}>{err}</Text> : null}

      <Pressable
        style={[styles.cta, busy ? { opacity: 0.7 } : null]}
        disabled={busy}
        onPress={() => void onSubmit()}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.ctaText}>{t('auth.signInSubmit')}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => router.push('/sign-in/sign-up')} style={styles.linkWrap}>
        <Text style={styles.link}>
          {t('auth.noAccount')} {t('auth.signUpLink')}
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
  sub: { marginTop: 8, marginBottom: 20, fontSize: 13, color: LOGIN_1B.muted, ...fp('400') },
  label: { fontSize: 12, color: LOGIN_1B.muted, marginBottom: 6, ...fp('600') },
  labelTight: { fontSize: 12, color: LOGIN_1B.muted, ...fp('600') },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  forgot: { fontSize: 12, color: LOGIN_1B.coral, ...fp('600') },
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
