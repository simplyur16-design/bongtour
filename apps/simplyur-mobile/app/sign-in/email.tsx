import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LOGIN_1B } from '@/src/constants/login-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import { buildEmailSignInWebUrl, mobileOAuthRedirectUri } from '@/src/lib/oauth';
import { markWebOAuthSession } from '@/src/lib/web-oauth-session';

WebBrowser.maybeCompleteAuthSession();

/** 이메일 로그인 — 웹 simplyur sign-in (세션은 Safari/Chrome; 앱 API fetch 와 분리) */
export default function SignInEmailScreen() {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void (async () => {
      const redirectUri = mobileOAuthRedirectUri();
      const authUrl = buildEmailSignInWebUrl(locale);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type === 'success' || result.type === 'dismiss') {
        markWebOAuthSession();
        router.replace('/(tabs)/my-esim');
      } else {
        router.back();
      }
    })();
  }, [locale]);

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, LOGIN_1B.paddingTop) + 24 }]}>
      <ActivityIndicator color={LOGIN_1B.coral} size="large" />
      <Text style={styles.hint}>{t('auth.emailSubtitle')}</Text>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Text style={styles.backText}>← {t('auth.backToMethods')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LOGIN_1B.bg,
    paddingHorizontal: LOGIN_1B.paddingH,
    alignItems: 'center',
    gap: 16,
  },
  hint: {
    fontSize: 14,
    color: LOGIN_1B.muted,
    textAlign: 'center',
    maxWidth: 280,
    ...fp('400'),
  },
  back: { marginTop: 24 },
  backText: { fontSize: 14, color: LOGIN_1B.faint, ...fp('400') },
});
