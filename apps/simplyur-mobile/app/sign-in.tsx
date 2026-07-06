import { Link, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { getApiBaseUrl } from '@/src/constants/simplyur';
import { useI18n } from '@/src/i18n/I18nContext';

/** simplyur 앱 — 이메일 먼저, 그 아래 Google·Apple (외국인 방문객 전용). */
export default function SignInScreen() {
  const { t } = useI18n();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const params = useLocalSearchParams<{ callbackUrl?: string }>();
  const callbackUrl = typeof params.callbackUrl === 'string' && params.callbackUrl.startsWith('/')
    ? params.callbackUrl
    : '/simplyur/en/my-esim';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'email' | 'google' | 'apple' | null>(null);
  const [err, setErr] = useState('');

  async function openOAuth(provider: 'google' | 'apple') {
    setErr('');
    setBusy(provider);
    try {
      const base = getApiBaseUrl();
      const q = encodeURIComponent(callbackUrl);
      await WebBrowser.openBrowserAsync(`${base}/api/auth/signin/${provider}?callbackUrl=${q}`);
    } finally {
      setBusy(null);
    }
  }

  async function onEmailSubmit() {
    setErr('');
    if (!email.trim() || !password) return;
    setBusy('email');
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
    } catch {
      setErr(t('auth.invalidCredentials'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: colors.text }]}>{t('auth.title')}</Text>
      <Text style={[styles.subtitle, { color: colors.inkMuted }]}>{t('auth.subtitle')}</Text>

      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.inkMuted }]}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          style={[styles.input, { borderColor: colors.hanjiBorder, color: colors.text, backgroundColor: '#fff' }]}
        />
        <Text style={[styles.label, { color: colors.inkMuted, marginTop: 12 }]}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          style={[styles.input, { borderColor: colors.hanjiBorder, color: colors.text, backgroundColor: '#fff' }]}
        />
        {err ? <Text style={styles.error}>{err}</Text> : null}
        <Pressable
          onPress={onEmailSubmit}
          disabled={busy !== null}
          style={[styles.emailBtn, { backgroundColor: colors.dan, opacity: busy ? 0.7 : 1 }]}
        >
          {busy === 'email' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.emailBtnText}>{t('auth.email')}</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: colors.hanjiBorder }]} />
        <Text style={[styles.dividerText, { color: colors.inkMuted }]}>or</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.hanjiBorder }]} />
      </View>

      <Pressable
        onPress={() => openOAuth('google')}
        disabled={busy !== null}
        style={[styles.socialBtn, { borderColor: colors.hanjiBorder, opacity: busy ? 0.7 : 1 }]}
      >
        {busy === 'google' ? (
          <ActivityIndicator />
        ) : (
          <Text style={[styles.socialBtnText, { color: colors.text }]}>{t('auth.google')}</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => openOAuth('apple')}
        disabled={busy !== null}
        style={[styles.socialBtn, styles.appleBtn, { opacity: busy ? 0.7 : 1 }]}
      >
        {busy === 'apple' ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.appleBtnText}>{t('auth.apple')}</Text>
        )}
      </Pressable>

      <Link href="/(tabs)" asChild>
        <Pressable style={styles.backLink}>
          <Text style={{ color: colors.celadon }}>← {t('auth.backHome')}</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { marginTop: 10, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  form: { marginTop: 28, width: '100%', maxWidth: 400, alignSelf: 'center' },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
  },
  error: { marginTop: 10, textAlign: 'center', fontSize: 12, color: '#b91c1c' },
  emailBtn: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  emailBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  dividerRow: { marginVertical: 24, flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '600' },
  socialBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  socialBtnText: { fontSize: 15, fontWeight: '600' },
  appleBtn: { backgroundColor: '#111', borderColor: '#111' },
  appleBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  backLink: { marginTop: 24, alignSelf: 'center' },
});
