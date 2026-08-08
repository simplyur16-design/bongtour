import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { LOGIN_1B } from '@/src/constants/login-design';
import { getApiBaseUrl } from '@/src/constants/simplyur';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/**
 * Generic in-app WebView — never opens system browser.
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: in-app-web — manifest
 */
export default function InAppWebScreen() {
  const { path, title } = useLocalSearchParams<{ path?: string; title?: string }>();
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);

  const uri = useMemo(() => {
    const base = getApiBaseUrl().replace(/\/+$/, '');
    const raw = String(path ?? '').trim();
    if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
    const cleaned = raw.replace(/^\/+/, '');
    if (cleaned.startsWith('simplyur/')) return `${base}/${cleaned}`;
    return `${base}/simplyur/${locale}/${cleaned || 'devices'}`;
  }, [path, locale]);

  return (
    <View style={[styles.flex, { paddingTop: insets.top, backgroundColor: LOGIN_1B.bg }]}>
      <View style={styles.toolbar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
          <Text style={styles.back}>← {t('product.backToPlans')}</Text>
        </Pressable>
        <Text style={styles.toolbarTitle} numberOfLines={1}>
          {String(title ?? '').trim() || t('nav.guide')}
        </Text>
        <View style={styles.spacer} />
      </View>
      {loading ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color={LOGIN_1B.coral} />
        </View>
      ) : null}
      <WebView
        source={{ uri }}
        style={styles.flex}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: LOGIN_1B.border,
  },
  back: { fontSize: 14, color: LOGIN_1B.coral, ...fp('600') },
  toolbarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    color: LOGIN_1B.navy,
    ...fp('600'),
  },
  spacer: { width: 72 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    top: 56,
  },
});
