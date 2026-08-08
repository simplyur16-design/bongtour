import { Link, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import {
  buildEximbayPayHtml,
  completeSimplyurEximbayPayerAuth,
  confirmSimplyurCheckout,
  createSimplyurEximbaySession,
} from '@/src/api/checkout';
import { fetchKoreaProduct, type PlanProduct } from '@/src/api/simplyur';
import { LOGIN_1B } from '@/src/constants/login-design';
import { isSimplyurCheckoutEnabled } from '@/src/constants/simplyur';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import { loadCheckoutBuyerEmail } from '@/src/lib/checkout-buyer-email';
import { classifySimplyurCheckoutWebViewUrl } from '@/src/lib/checkout-webview-nav';
import { loadSimplyurSession } from '@/src/lib/session';

type Phase = 'form' | 'auth' | 'completing';

/**
 * Native checkout → Eximbay PAYER_AUTH (issuer only) → server PAYMENT_PA → My eSIM.
 * REGRESSION-FREEZE[simplyur-mobile-inapp-eximbay-checkout]: WebView pay — manifest
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: native checkout screen — manifest
 * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: cancel/fail + legal stay native — manifest
 * REGRESSION-FREEZE[simplyur-eximbay-payer-auth-pa]: auth_ok → complete-pa — manifest
 */
export default function CheckoutScreen() {
  const { optionApiId } = useLocalSearchParams<{ optionApiId: string }>();
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const checkoutEnabled = isSimplyurCheckoutEnabled();
  const id = String(optionApiId ?? '').trim();
  const handledRef = useRef(false);
  const webRef = useRef<React.ElementRef<typeof WebView>>(null);
  const idemRef = useRef(`su_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`);
  const attemptIdRef = useRef('');
  const orderIdRef = useRef('');

  const [product, setProduct] = useState<PlanProduct | null>(null);
  const [email, setEmail] = useState('');
  const [emailLocked, setEmailLocked] = useState(false);
  const [phone, setPhone] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [payHtml, setPayHtml] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [externalBlocked, setExternalBlocked] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const [p, session] = await Promise.all([
        fetchKoreaProduct(id, locale).catch(() => null),
        loadSimplyurSession(),
      ]);
      if (cancelled) return;
      setProduct(p);
      const fromSession = (session?.email ?? '').trim();
      const fromCheckout = loadCheckoutBuyerEmail();
      const picked = fromSession || fromCheckout;
      if (picked.includes('@')) {
        setEmail(picked);
        setEmailLocked(Boolean(fromSession));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, locale]);

  const returnToNativeForm = useCallback((message?: string) => {
    setPhase('form');
    setPayHtml('');
    setPayLoading(false);
    setExternalBlocked(false);
    handledRef.current = false;
    if (message) setErr(message);
  }, []);

  const runCompletePa = useCallback(
    async (payerAuthId: string) => {
      // Lock immediately — onShouldStart + onNavigationStateChange can both fire.
      if (handledRef.current) return;
      handledRef.current = true;
      setPhase('completing');
      setPayHtml('');
      try {
        await completeSimplyurEximbayPayerAuth({
          paymentAttemptId: attemptIdRef.current,
          orderId: orderIdRef.current,
          payerAuthId: payerAuthId || undefined,
          locale,
        });
        router.replace('/(tabs)/my-esim');
      } catch {
        handledRef.current = false;
        returnToNativeForm(t('checkout.errorGeneric'));
      }
    },
    [locale, returnToNativeForm, t],
  );

  const onNavChange = useCallback(
    (nav: WebViewNavigation) => {
      const classified = classifySimplyurCheckoutWebViewUrl(nav.url);
      // Never jump to My eSIM without server PAYMENT_PA — treat legacy complete as auth finish.
      if (classified.kind === 'auth_ok' || classified.kind === 'complete') {
        void runCompletePa(classified.kind === 'auth_ok' ? classified.payerAuthId : '');
      }
      if (classified.kind === 'cancel_or_fail') returnToNativeForm(t('checkout.errorGeneric'));
    },
    [returnToNativeForm, runCompletePa, t],
  );

  const onShouldStart = useCallback(
    (req: { url: string }) => {
      const classified = classifySimplyurCheckoutWebViewUrl(req.url);
      if (classified.kind === 'auth_ok' || classified.kind === 'complete') {
        void runCompletePa(classified.kind === 'auth_ok' ? classified.payerAuthId : '');
        return false;
      }
      if (classified.kind === 'cancel_or_fail') {
        returnToNativeForm(t('checkout.errorGeneric'));
        return false;
      }
      if (classified.kind === 'external_app') {
        setExternalBlocked(true);
        return false;
      }
      return true;
    },
    [returnToNativeForm, runCompletePa, t],
  );

  async function onSubmit() {
    if (!product || busy) return;
    setErr('');
    if (!email.trim().includes('@')) {
      setErr(t('checkout.errorGeneric'));
      return;
    }
    if (!terms) {
      setErr(t('checkout.errorGeneric'));
      return;
    }
    setBusy(true);
    try {
      const order = await confirmSimplyurCheckout({
        optionApiId: product.option_api_id,
        email,
        phone,
        locale,
        idempotencyKey: idemRef.current,
      });
      orderIdRef.current = order.order_id;
      const session = await createSimplyurEximbaySession({
        orderId: order.order_id,
        orderNumber: order.order_number,
        locale,
        optionApiId: product.option_api_id,
        idempotencyKey: idemRef.current,
      });
      attemptIdRef.current = session.payment_attempt_id;
      setPayHtml(buildEximbayPayHtml(session.client.sdk_script_url, session.client.request_pay));
      setPhase('auth');
      setPayLoading(true);
    } catch {
      setErr(t('checkout.errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  const price = product?.simplyur_display?.formatted ?? '—';

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

  if (!id) {
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

  if (phase === 'completing') {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 40, backgroundColor: LOGIN_1B.bg }]}>
        <ActivityIndicator color={LOGIN_1B.coral} size="large" />
        <Text style={[styles.body, { textAlign: 'center', marginTop: 16 }]}>
          {t('checkout.completing')}
        </Text>
      </View>
    );
  }

  if (phase === 'auth' && payHtml) {
    return (
      <View style={[styles.flex, { paddingTop: insets.top, backgroundColor: LOGIN_1B.bg }]}>
        <View style={styles.toolbar}>
          <Pressable
            onPress={() => returnToNativeForm()}
            hitSlop={10}
            accessibilityRole="button">
            <Text style={styles.back}>← {t('checkout.title')}</Text>
          </Pressable>
          <Text style={styles.toolbarTitle} numberOfLines={1}>
            {t('checkout.authTitle')}
          </Text>
          <View style={styles.toolbarSpacer} />
        </View>
        <Text style={styles.authHint}>{t('checkout.authHint')}</Text>

        {externalBlocked ? (
          <View style={styles.errorBox}>
            <Text style={styles.body}>{t('checkout.stayInAppOnly')}</Text>
            <Pressable
              onPress={() => {
                setExternalBlocked(false);
                setPayLoading(true);
                setPayHtml((h) => h + ' ');
              }}>
              <Text style={styles.link}>{t('checkout.continueInApp')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.flex}>
          {payLoading ? (
            <View style={styles.loadingOverlay} pointerEvents="none">
              <ActivityIndicator color={LOGIN_1B.coral} size="large" />
              <Text style={styles.loadingHint}>{t('checkout.processing')}</Text>
            </View>
          ) : null}
          <WebView
            ref={webRef}
            originWhitelist={['*']}
            source={{
              html: payHtml,
              baseUrl: 'https://api.eximbay.com/',
            }}
            style={styles.flex}
            onLoadStart={() => setPayLoading(true)}
            onLoadEnd={() => setPayLoading(false)}
            onNavigationStateChange={onNavChange}
            onShouldStartLoadWithRequest={onShouldStart}
            setSupportMultipleWindows={false}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            startInLoadingState
            allowsBackForwardNavigationGestures
            onOpenWindow={(e) => {
              const target = e.nativeEvent.targetUrl;
              if (!target) return;
              const classified = classifySimplyurCheckoutWebViewUrl(target);
              if (classified.kind === 'auth_ok' || classified.kind === 'complete') {
                void runCompletePa(classified.kind === 'auth_ok' ? classified.payerAuthId : '');
                return;
              }
              if (classified.kind === 'cancel_or_fail') {
                returnToNativeForm(t('checkout.errorGeneric'));
                return;
              }
              if (classified.kind === 'external_app') {
                setExternalBlocked(true);
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

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: LOGIN_1B.bg }]}
      contentContainerStyle={[
        styles.formContent,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
      ]}
      keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
        <Text style={styles.back}>← {t('product.backToPlans')}</Text>
      </Pressable>

      <Text style={styles.title}>{t('checkout.title')}</Text>

      {!product ? (
        <ActivityIndicator color={LOGIN_1B.coral} style={{ marginTop: 24 }} />
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>{t('checkout.summary')}</Text>
            <Text style={styles.summaryPrice}>{price}</Text>
          </View>

          <Text style={styles.label}>{t('checkout.email')}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            editable={!emailLocked}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder={t('checkout.emailHint')}
            placeholderTextColor={LOGIN_1B.faint}
            style={[styles.input, emailLocked ? styles.inputLocked : null]}
          />
          <Text style={styles.hint}>{t('checkout.emailHint')}</Text>

          <Text style={styles.label}>{t('checkout.phone')}</Text>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder={t('checkout.phoneHint')}
            placeholderTextColor={LOGIN_1B.faint}
            style={styles.input}
          />

          <Pressable
            onPress={() => setTerms((v) => !v)}
            style={styles.termsRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: terms }}>
            <View style={[styles.checkbox, terms ? styles.checkboxOn : null]}>
              {terms ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <Text style={styles.termsText}>{t('checkout.terms')}</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push({ pathname: '/legal', params: { doc: 'terms' } })
            }>
            <Text style={styles.legalLink}>{t('legal.termsTitle')}</Text>
          </Pressable>

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <Pressable
            style={[styles.cta, busy ? { opacity: 0.7 } : null]}
            disabled={busy}
            onPress={() => void onSubmit()}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>{t('checkout.submit')}</Text>
            )}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, paddingHorizontal: 20 },
  formContent: { paddingHorizontal: 20, gap: 10 },
  backRow: { marginBottom: 8 },
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
  authHint: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 12,
    color: LOGIN_1B.muted,
    ...fp('400'),
  },
  title: { fontSize: 22, color: LOGIN_1B.navy, ...fp('700') },
  body: { marginTop: 12, fontSize: 14, lineHeight: 21, color: LOGIN_1B.muted, ...fp('400') },
  linkWrap: { marginTop: 20 },
  link: { fontSize: 15, color: LOGIN_1B.coral, ...fp('600') },
  summary: {
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: LOGIN_1B.border,
    backgroundColor: '#fff',
    gap: 6,
  },
  summaryLabel: { fontSize: 13, color: LOGIN_1B.muted, ...fp('400') },
  summaryPrice: { fontSize: 28, color: LOGIN_1B.coral, ...fp('800') },
  label: { marginTop: 10, fontSize: 13, color: LOGIN_1B.navy, ...fp('600') },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: LOGIN_1B.border,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    fontSize: 15,
    color: LOGIN_1B.navy,
    ...fp('400'),
  },
  inputLocked: { backgroundColor: '#f3f0ee' },
  hint: { fontSize: 12, color: LOGIN_1B.faint, ...fp('400') },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: LOGIN_1B.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxOn: { backgroundColor: LOGIN_1B.coral, borderColor: LOGIN_1B.coral },
  checkMark: { color: '#fff', fontSize: 14, ...fp('700') },
  termsText: { flex: 1, fontSize: 14, color: LOGIN_1B.navy, ...fp('400') },
  legalLink: { fontSize: 13, color: LOGIN_1B.coral, ...fp('600') },
  err: { color: '#b42318', fontSize: 13, ...fp('400') },
  cta: {
    marginTop: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: LOGIN_1B.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, ...fp('600') },
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
