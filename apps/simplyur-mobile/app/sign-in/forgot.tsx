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

import { requestPasswordReset } from '@/src/api/auth';
import { LOGIN_1B } from '@/src/constants/login-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/** REGRESSION-FREEZE[auth-password-reset]: sign-in/forgot — manifest */
export default function SignInForgotScreen() {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit() {
    setBusy(true);
    try {
      await requestPasswordReset({ email, locale });
    } catch {
      // generic success
    } finally {
      setBusy(false);
      setDone(true);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, LOGIN_1B.paddingTop) + 8 }]}>
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Text style={styles.back}>← {t('auth.backToMethods')}</Text>
      </Pressable>
      <Text style={styles.title}>{t('auth.forgotPasswordTitle')}</Text>
      <Text style={styles.sub}>{t('auth.forgotPasswordSubtitle')}</Text>

      {done ? (
        <>
          <Text style={styles.success}>{t('auth.forgotPasswordSuccess')}</Text>
          <Pressable onPress={() => router.replace('/sign-in/email')} style={styles.linkWrap}>
            <Text style={styles.link}>{t('auth.forgotPasswordBack')}</Text>
          </Pressable>
        </>
      ) : (
        <>
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
          <Pressable
            style={[styles.cta, busy ? { opacity: 0.7 } : null]}
            disabled={busy}
            onPress={() => void onSubmit()}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>{t('auth.forgotPasswordSubmit')}</Text>
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
  success: { fontSize: 14, color: LOGIN_1B.muted, lineHeight: 20, ...fp('400') },
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
