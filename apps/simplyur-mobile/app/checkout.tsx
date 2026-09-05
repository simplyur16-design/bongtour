import { Link, router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
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
  fetchSimplyurFirstPurchasePreview,
  type SimplyurFirstPurchasePreview,
} from '@/src/api/checkout';
import { fetchKoreaProduct, type PlanProduct } from '@/src/api/simplyur';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import {
  SimplyurBackRow,
  SimplyurDockCta,
  simplyurDockScrollPad,
  simplyurScreenPadTop,
} from '@/src/components/SimplyurDockCta';
import { SIMPLYUR_DOCK_PAD_H } from '@/src/lib/dock-cta-layout';
import { LOGIN_1B } from '@/src/constants/login-design';
import { isSimplyurCheckoutEnabled } from '@/src/constants/simplyur';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import { loadCheckoutBuyerEmail } from '@/src/lib/checkout-buyer-email';
import {
  classifySimplyurCheckoutWebViewUrl,
  EXIMBAY_WEBVIEW_SAME_FRAME_OPEN_INJECT,
  eximbayAppStoreUrlForOs,
  firstSearchParam,
  storeUrlToOpen,
} from '@/src/lib/checkout-webview-nav';
import {
  formatDeviceSavedCardLabel,
} from '@/src/lib/device-card-wallet';
import {
  loadDeviceSavedCards,
  loadPreferPhoneCardFill,
  removeDeviceSavedCard,
  savePreferPhoneCardFill,
  type DeviceSavedCard,
} from '@/src/lib/device-card-store';
import { loadSimplyurSession } from '@/src/lib/session';
import { captureSimplyurError, trackSimplyurEvent } from '@/src/lib/telemetry';

type Phase = 'form' | 'auth' | 'completing';

/**
 * Native checkout → Eximbay PAYER_AUTH (issuer only) → server PAYMENT_PA → My eSIM.
 * REGRESSION-FREEZE[simplyur-mobile-inapp-eximbay-checkout]: WebView pay — manifest
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: native checkout screen — manifest
 * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: cancel/fail + legal stay native — manifest
 * REGRESSION-FREEZE[simplyur-eximbay-payer-auth-pa]: auth_ok → complete-pa — manifest
 * REGRESSION-FREEZE[simplyur-mobile-checkout-email-editable]: session email prefill but always editable (Apple Hide My Email) — manifest
 * REGRESSION-FREEZE[simplyur-mobile-p2-polish]: offline banner on checkout form — manifest
 * REGRESSION-FREEZE[simplyur-mobile-p2-ops]: checkout funnel telemetry — manifest
 * REGRESSION-FREEZE[simplyur-device-card-wallet]: phone-only card reminder — manifest
 * REGRESSION-FREEZE[simplyur-eximbay-app-install-optional]: EXIMPay+ store link only — manifest
 * REGRESSION-FREEZE[simplyur-launch-discount-14pct]: first-purchase preview 14% — manifest
 * REGRESSION-FREEZE[simplyur-mobile-pay-window-visible]: same-frame pay + no overlay cover — manifest
 * REGRESSION-FREEZE[simplyur-purchase-dock-cta]: docked submit CTA — manifest
 */
export default function CheckoutScreen() {
  const { optionApiId } = useLocalSearchParams<{ optionApiId: string | string[] }>();
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const checkoutEnabled = isSimplyurCheckoutEnabled();
  const id = firstSearchParam(optionApiId);
  const handledRef = useRef(false);
  const webRef = useRef<React.ElementRef<typeof WebView>>(null);
  const idemRef = useRef(`su_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`);
  const attemptIdRef = useRef('');
  const orderIdRef = useRef('');

  const [product, setProduct] = useState<PlanProduct | null>(null);
  const [email, setEmail] = useState('');
  const [emailFromAccount, setEmailFromAccount] = useState(false);
  const [phone, setPhone] = useState('');
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [payHtml, setPayHtml] = useState('');
  const [payLoading, setPayLoading] = useState(false);
  const [externalBlocked, setExternalBlocked] = useState(false);
  const [storeLinkHint, setStoreLinkHint] = useState(false);
  const [savedCards, setSavedCards] = useState<DeviceSavedCard[]>([]);
  const [saveCardOnPhone, setSaveCardOnPhone] = useState(false);
  const [firstPurchase, setFirstPurchase] = useState<SimplyurFirstPurchasePreview | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const [p, session, cards, preferFill] = await Promise.all([
        fetchKoreaProduct(id, locale).catch(() => null),
        loadSimplyurSession(),
        loadDeviceSavedCards().catch(() => [] as DeviceSavedCard[]),
        loadPreferPhoneCardFill().catch(() => false),
      ]);
      if (cancelled) return;
      setProduct(p);
      setSavedCards(cards);
      setSaveCardOnPhone(preferFill);
      const fromSession = (session?.email ?? '').trim();
      const fromCheckout = loadCheckoutBuyerEmail();
      const picked = fromSession || fromCheckout;
      if (picked.includes('@')) {
        setEmail(picked);
        // Prefill from account/Apple relay — never lock; buyer may route QR to a real inbox.
        setEmailFromAccount(Boolean(fromSession));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, locale]);

  useEffect(() => {
    const buyer = email.trim();
    const optionId = product?.option_api_id?.trim() ?? '';
    if (!buyer.includes('@') || !optionId) {
      setFirstPurchase(null);
      return;
    }
    let cancelled = false;
    void fetchSimplyurFirstPurchasePreview({
      optionApiId: optionId,
      email: buyer,
      subtotalKrw: product?.simplyur_sell_price_krw ?? 1,
    })
      .then((preview) => {
        if (!cancelled) setFirstPurchase(preview);
      })
      .catch(() => {
        if (!cancelled) setFirstPurchase(null);
      });
    return () => {
      cancelled = true;
    };
  }, [email, product]);

  const returnToNativeForm = useCallback((message?: string) => {
    setPhase('form');
    setPayHtml('');
    setPayLoading(false);
    setExternalBlocked(false);
    setStoreLinkHint(false);
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
        trackSimplyurEvent('checkout_pa_complete', { orderId: orderIdRef.current });
        router.replace('/(tabs)/my-esim');
      } catch (e) {
        captureSimplyurError(e, 'checkout_pa_complete');
        trackSimplyurEvent('checkout_pa_fail', { orderId: orderIdRef.current });
        handledRef.current = false;
        returnToNativeForm(t('checkout.errorGeneric'));
      }
    },
    [locale, returnToNativeForm, t],
  );

  const openOptionalEximbayStore = useCallback((tapped?: string) => {
    const os = Platform.OS === 'ios' ? 'ios' : 'android';
    const url = tapped ? storeUrlToOpen(tapped, os) : eximbayAppStoreUrlForOs(os);
    setStoreLinkHint(true);
    void Linking.openURL(url).catch(() => {
      void Linking.openURL(eximbayAppStoreUrlForOs(os)).catch(() => undefined);
    });
  }, []);

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
      if (classified.kind === 'optional_store_link') {
        openOptionalEximbayStore(classified.url);
        return false;
      }
      if (classified.kind === 'external_app') {
        setExternalBlocked(true);
        return false;
      }
      return true;
    },
    [openOptionalEximbayStore, returnToNativeForm, runCompletePa, t],
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
    trackSimplyurEvent('checkout_start', { optionApiId: product.option_api_id });
    try {
      await savePreferPhoneCardFill(saveCardOnPhone);
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
      trackSimplyurEvent('checkout_webview_pay', { orderId: order.order_id });
    } catch (e) {
      captureSimplyurError(e, 'checkout_start');
      trackSimplyurEvent('checkout_start_fail', { optionApiId: product.option_api_id });
      setErr(t('checkout.errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  const price = product?.simplyur_display?.formatted ?? '—';
  const discountedPrice = (() => {
    if (!firstPurchase || !product?.simplyur_display || product.simplyur_display.amount <= 0) return null;
    const listKrw = firstPurchase.subtotal_krw > 0 ? firstPurchase.subtotal_krw : product.simplyur_sell_price_krw;
    if (!listKrw || listKrw <= 0) return null;
    const ratio = 1 - firstPurchase.discount_krw / listKrw;
    const displayAmt = Math.max(0, Math.round(product.simplyur_display.amount * ratio));
    try {
      return new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale, {
        style: 'currency',
        currency: product.simplyur_display.currency,
        maximumFractionDigits: product.simplyur_display.currency === 'KRW' ? 0 : 2,
      }).format(displayAmt);
    } catch {
      return null;
    }
  })();

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

        {storeLinkHint ? (
          <View style={styles.errorBox}>
            <Text style={styles.body}>{t('checkout.eximbayAppOpenedHint')}</Text>
          </View>
        ) : null}

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
            onLoadEnd={() => setPayLoading(false)}
            onNavigationStateChange={onNavChange}
            onShouldStartLoadWithRequest={onShouldStart}
            injectedJavaScriptBeforeContentLoaded={EXIMBAY_WEBVIEW_SAME_FRAME_OPEN_INJECT}
            setSupportMultipleWindows={false}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            cacheEnabled
            importantForAutofill="yes"
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
              if (classified.kind === 'optional_store_link') {
                openOptionalEximbayStore(classified.url);
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
    <View style={[styles.flex, { backgroundColor: LOGIN_1B.bg }]}>
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.formContent,
        { paddingTop: simplyurScreenPadTop(insets.top), paddingBottom: simplyurDockScrollPad(insets.bottom) },
      ]}
      keyboardShouldPersistTaps="handled">
      <SimplyurBackRow label={t('product.backToPlans')} onPress={() => router.back()} />

      <OfflineBanner />
      <Text style={styles.title}>{t('checkout.title')}</Text>

      {!product ? (
        <ActivityIndicator color={LOGIN_1B.coral} style={{ marginTop: 24 }} />
      ) : (
        <>
          <View style={styles.summary}>
            <Text style={styles.summaryLabel}>{t('checkout.summary')}</Text>
            {discountedPrice ? (
              <>
                <Text style={styles.summaryList}>{price}</Text>
                <Text style={styles.summaryPrice}>{discountedPrice}</Text>
                <Text style={styles.summaryPromo}>
                  {t('checkout.firstPurchaseBanner').replace(
                    '{rate}',
                    String(firstPurchase?.discount_rate_pct ?? 14),
                  )}
                </Text>
              </>
            ) : (
              <Text style={styles.summaryPrice}>{price}</Text>
            )}
          </View>

          <Text style={styles.label}>{t('checkout.email')}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            editable
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            placeholder={t('checkout.emailHint')}
            placeholderTextColor={LOGIN_1B.faint}
            style={styles.input}
          />
          <Text style={styles.hint}>
            {emailFromAccount ? t('checkout.emailFromAccountHint') : t('checkout.emailHint')}
          </Text>

          <Text style={styles.label}>{t('checkout.saveCardTitle')}</Text>
          {savedCards.map((card) => (
            <View key={card.id} style={styles.savedCardRow}>
              <Text style={styles.savedCardLabel}>{formatDeviceSavedCardLabel(card)}</Text>
              <Pressable
                onPress={() => {
                  void removeDeviceSavedCard(card.id).then(() =>
                    loadDeviceSavedCards().then(setSavedCards),
                  );
                }}
                hitSlop={8}>
                <Text style={styles.link}>{t('checkout.saveCardRemove')}</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={() => {
              setSaveCardOnPhone((v) => {
                const next = !v;
                void savePreferPhoneCardFill(next);
                return next;
              });
            }}
            style={styles.termsRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: saveCardOnPhone }}>
            <View style={[styles.checkbox, saveCardOnPhone ? styles.checkboxOn : null]}>
              {saveCardOnPhone ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <Text style={styles.termsText}>{t('checkout.saveCardToggle')}</Text>
          </Pressable>
          <Text style={styles.hint}>{t('checkout.saveCardHint')}</Text>

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

          <Text style={styles.hint}>{t('checkout.eximbayAppOptional')}</Text>
          <Pressable onPress={() => openOptionalEximbayStore()} hitSlop={8}>
            <Text style={styles.legalLink}>{t('checkout.eximbayAppInstallLink')}</Text>
          </Pressable>

          {err ? <Text style={styles.err}>{err}</Text> : null}
        </>
      )}
    </ScrollView>
      {product ? (
        <SimplyurDockCta
          label={t('checkout.submit')}
          onPress={() => void onSubmit()}
          busy={busy}
          bottomInset={insets.bottom}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1, paddingHorizontal: 20 },
  formContent: { paddingHorizontal: SIMPLYUR_DOCK_PAD_H, gap: 10 },
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
  summaryList: {
    marginTop: 4,
    fontSize: 16,
    color: LOGIN_1B.muted,
    textDecorationLine: 'line-through',
    ...fp('400'),
  },
  summaryPrice: { fontSize: 28, color: LOGIN_1B.coral, ...fp('800') },
  summaryPromo: { marginTop: 4, fontSize: 13, color: LOGIN_1B.coral, ...fp('600') },
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
  hint: { fontSize: 12, color: LOGIN_1B.faint, ...fp('400') },
  savedCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 6,
  },
  savedCardLabel: { flex: 1, fontSize: 14, color: LOGIN_1B.navy, ...fp('500') },
  brandRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  brandChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: LOGIN_1B.border,
    backgroundColor: '#fff',
  },
  brandChipOn: { backgroundColor: LOGIN_1B.coral, borderColor: LOGIN_1B.coral },
  brandChipText: { fontSize: 12, color: LOGIN_1B.navy, ...fp('600') },
  brandChipTextOn: { color: '#fff' },
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
