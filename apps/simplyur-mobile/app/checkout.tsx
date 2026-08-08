import { Link, router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { simplyurWebCheckoutUrl } from '@/src/api/simplyur';
import { LOGIN_1B } from '@/src/constants/login-design';
import { isSimplyurCheckoutEnabled } from '@/src/constants/simplyur';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import { loadCheckoutBuyerEmail } from '@/src/lib/checkout-buyer-email';
import { classifySimplyurCheckoutWebViewUrl } from '@/src/lib/checkout-webview-nav';
import { loadSimplyurSession } from '@/src/lib/session';

/**
 * In-app Eximbay checkout — WebView (not system browser).
 * REGRESSION-FREEZE[simplyur-mobile-inapp-eximbay-checkout]: WebView pay — manifest
 */
export default function CheckoutScreen() {
  const { optionApiId } = useLocalSearchParams<{ optionApiId: string }>();
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const checkoutEnabled = isSimplyurCheckoutEnabled();
  const id = String(optionApiId ?? '').trim();
  const handledRef = useRef(false);
  const webRef = useRef<React.ElementRef<typeof WebView>>(null);
  const [loading, setLoading] = useState(true);
  const [navError, setNavError] = useState(false);
  const [webKey, setWebKey] = useState(0);
  const [checkoutUrl, setCheckoutUrl] = useState('');

  useEffect(() => {
    if (!id) {
      setCheckoutUrl('');
      return;
    }
    let cancelled = false;
    void (async () => {
      const session = await loadSimplyurSession();
      const email = session?.email || loadCheckoutBuyerEmail();
      if (!cancelled) setCheckoutUrl(simplyurWebCheckoutUrl(locale, id, email));
    })();
    return () => {
      cancelled = true;
    };
  }, [id, locale]);

  const finishComplete = useCallback(() => {
    if (handledRef.current) return;
    handledRef.current = true;
    router.replace('/(tabs)/my-esim');
  }, []);

  const onNavChange = useCallback(
    (nav: WebViewNavigation) => {
      const classified = classifySimplyurCheckoutWebViewUrl(nav.url);
      if (classified.kind === 'complete') {
        finishComplete();
      }
    },
    [finishComplete],
  );

  const onShouldStart = useCallback(
    (req: { url: string }) => {
      const classified = classifySimplyurCheckoutWebViewUrl(req.url);
      if (classified.kind === 'complete') {
        finishComplete();
        return false;
      }
      if (classified.kind === 'external_app') {
        void Linking.openURL(classified.url).catch(() => {});
        return false;
      }
      return true;
    },
    [finishComplete],
  );

  if (!checkoutEnabled) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 16, backgroundColor: LOGIN_1B.bg }]}>
        <Text style={styles.title}>{t('checkout.title')}</Text>
        <Text style={styles.body}>{t('product.checkoutSoonHint')}</Text>
        <Link href="/plans" asChild>
          <Pressable style={styles.linkWrap}>
            <Text style={styles.link}>{t('product.backToPlans')}</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  if (!id || !checkoutUrl) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 16, backgroundColor: LOGIN_1B.bg }]}>
        <Text style={styles.title}>{t('checkout.title')}</Text>
        <Text style={styles.body}>{t('product.notFoundBody')}</Text>
        <Link href="/plans" asChild>
          <Pressable style={styles.linkWrap}>
            <Text style={styles.link}>{t('product.backToPlans')}</Text>
          </Pressable>
        </Link>
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
          {t('checkout.title')}
        </Text>
        <View style={styles.toolbarSpacer} />
      </View>

      {navError ? (
        <View style={styles.errorBox}>
          <Text style={styles.body}>{t('checkout.errorGeneric')}</Text>
          <Pressable
            onPress={() => {
              setNavError(false);
              setLoading(true);
              setWebKey((k) => k + 1);
            }}>
            <Text style={styles.link}>{t('checkout.continueInApp')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.flex}>
        {loading ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator color={LOGIN_1B.coral} size="large" />
            <Text style={styles.loadingHint}>{t('checkout.processing')}</Text>
          </View>
        ) : null}
        <WebView
          key={webKey}
          ref={webRef}
          source={{ uri: checkoutUrl }}
          style={styles.flex}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setNavError(true);
          }}
          onNavigationStateChange={onNavChange}
          onShouldStartLoadWithRequest={onShouldStart}
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          startInLoadingState
          allowsBackForwardNavigationGestures
          // Eximbay / 3DS may open a secondary window — fold into this WebView
          onOpenWindow={(e) => {
            const target = e.nativeEvent.targetUrl;
            if (!target) return;
            const classified = classifySimplyurCheckoutWebViewUrl(target);
            if (classified.kind === 'complete') {
              finishComplete();
              return;
            }
            if (classified.kind === 'external_app') {
              void Linking.openURL(classified.url).catch(() => {});
              return;
            }
            webRef.current?.injectJavaScript(
              `window.location.href = ${JSON.stringify(target)}; true;`,
            );
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, paddingHorizontal: 20 },
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
  toolbarSpacer: { width: 72 },
  title: { fontSize: 22, color: LOGIN_1B.navy, ...fp('700') },
  body: { marginTop: 12, fontSize: 14, lineHeight: 21, color: LOGIN_1B.muted, ...fp('400') },
  linkWrap: { marginTop: 20 },
  link: { fontSize: 15, color: LOGIN_1B.coral, ...fp('600') },
  errorBox: { padding: 16, gap: 12 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,247,242,0.72)',
    gap: 12,
  },
  loadingHint: { fontSize: 13, color: LOGIN_1B.muted, ...fp('400') },
});
