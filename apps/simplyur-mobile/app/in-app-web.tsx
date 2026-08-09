import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { LOGIN_1B } from '@/src/constants/login-design';
import { getApiBaseUrl } from '@/src/constants/simplyur';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

function nativeRedirectForPath(path: string): { pathname: '/devices' } | { pathname: '/legal'; params: { doc: string } } | null {
  const lower = path.toLowerCase();
  if (lower.includes('devices') || lower.endsWith('/devices') || lower === 'devices') {
    return { pathname: '/devices' };
  }
  if (lower.includes('privacy')) {
    return { pathname: '/legal', params: { doc: 'privacy' } };
  }
  if (lower.includes('refund')) {
    return { pathname: '/legal', params: { doc: 'refund' } };
  }
  if (lower.includes('terms') || lower.includes('/legal') || lower.includes('legal/')) {
    return { pathname: '/legal', params: { doc: 'terms' } };
  }
  return null;
}

/**
 * Legacy in-app WebView (compat only). Product flows use native /devices and /legal.
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: in-app-web — manifest
 */
export default function InAppWebScreen() {
  const { path, title } = useLocalSearchParams<{ path?: string; title?: string }>();
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const rawPath = String(path ?? '').trim();
  const nativeTarget = useMemo(() => nativeRedirectForPath(rawPath), [rawPath]);

  useEffect(() => {
    if (nativeTarget) router.replace(nativeTarget);
  }, [nativeTarget]);

  const uri = useMemo(() => {
    if (nativeTarget) return '';
    const base = getApiBaseUrl().replace(/\/+$/, '');
    if (rawPath.startsWith('http://') || rawPath.startsWith('https://')) return rawPath;
    const cleaned = rawPath.replace(/^\/+/, '');
    if (!cleaned) return '';
    if (cleaned.startsWith('simplyur/')) return `${base}/${cleaned}`;
    return `${base}/simplyur/${locale}/${cleaned}`;
  }, [rawPath, locale, nativeTarget]);

  if (nativeTarget || !uri) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top, backgroundColor: LOGIN_1B.bg }]}>
        <ActivityIndicator color={LOGIN_1B.coral} style={{ marginTop: 40 }} />
      </View>
    );
  }

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
