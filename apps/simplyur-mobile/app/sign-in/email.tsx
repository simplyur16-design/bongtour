import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignalPinIcon } from '@/src/components/auth/SignalPinIcon';
import { LOGIN_1B } from '@/src/constants/login-design';
import { getApiBaseUrl } from '@/src/constants/simplyur';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/** design_handoff_login_1b — email + password step after "Continue with Email". */
export default function SignInEmailScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ callbackUrl?: string }>();
  const callbackUrl =
    typeof params.callbackUrl === 'string' && params.callbackUrl.startsWith('/')
      ? params.callbackUrl
      : '/simplyur/en/my-esim';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function onSubmit() {
    setErr('');
    if (!email.trim() || !password) return;
    setBusy(true);
    try {
      const base = getApiBaseUrl();
      const csrfRes = await fetch(`${base}/api/auth/csrf`);
      if (!csrfRes.ok) throw new Error('csrf');
      const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
      if (!csrfToken) throw new Error('csrf');

      const body = new URLSearchParams({
        csrfToken,
        email: email.trim(),
        password,
        callbackUrl,
        json: 'true',
      });
      const res = await fetch(`${base}/api/auth/callback/credentials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        redirect: 'manual',
      });
      if (!res.ok && res.status !== 302) {
        setErr(t('auth.invalidCredentials'));
        return;
      }
      await WebBrowser.openBrowserAsync(`${base}${callbackUrl}`);
      router.replace('/(tabs)');
    } catch {
      setErr(t('auth.invalidCredentials'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.root,
          { paddingTop: Math.max(insets.top, LOGIN_1B.paddingTop) + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← {t('auth.backToMethods')}</Text>
        </Pressable>

        <View style={styles.hero}>
          <SignalPinIcon width={36} height={43} />
          <Text style={styles.title}>{t('auth.emailSubtitle')}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t('auth.emailLabel')}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholderTextColor={LOGIN_1B.faint}
            style={styles.input}
          />
          <Text style={[styles.label, styles.labelGap]}>{t('auth.passwordLabel')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholderTextColor={LOGIN_1B.faint}
            style={styles.input}
          />
          {err ? <Text style={styles.error}>{err}</Text> : null}
          <Pressable
            onPress={onSubmit}
            disabled={busy}
            style={[styles.submit, busy ? styles.submitBusy : null]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>{t('auth.signInSubmit')}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: LOGIN_1B.bg },
  root: {
    flexGrow: 1,
    backgroundColor: LOGIN_1B.bg,
    paddingHorizontal: LOGIN_1B.paddingH,
    paddingBottom: LOGIN_1B.paddingBottom,
  },
  back: { alignSelf: 'flex-start', marginBottom: 24 },
  backText: { fontSize: 14, color: LOGIN_1B.faint, ...fp('400') },
  hero: {
    alignItems: 'center',
    gap: 14,
    marginBottom: 32,
  },
  title: {
    fontSize: 15,
    color: LOGIN_1B.muted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
    ...fp('400'),
  },
  form: { width: '100%' },
  label: {
    fontSize: 12,
    color: LOGIN_1B.muted,
    marginBottom: 6,
    ...fp('600'),
  },
  labelGap: { marginTop: 14 },
  input: {
    borderWidth: 1.5,
    borderColor: LOGIN_1B.border,
    borderRadius: LOGIN_1B.buttonRadius,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: LOGIN_1B.navy,
    backgroundColor: '#fff',
    ...fp('400'),
  },
  error: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12,
    color: '#b91c1c',
    ...fp('400'),
  },
  submit: {
    marginTop: 20,
    height: LOGIN_1B.buttonHeight,
    borderRadius: LOGIN_1B.buttonRadius,
    backgroundColor: LOGIN_1B.coral,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: LOGIN_1B.coral,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius: 13,
    elevation: 8,
  },
  submitBusy: { opacity: 0.7 },
  submitText: {
    color: '#fff',
    fontSize: 16,
    ...fp('600'),
  },
});
