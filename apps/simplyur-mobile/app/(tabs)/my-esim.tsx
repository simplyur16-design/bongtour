import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  fetchMyEsimOrders,
  fetchMyEsimUsage,
  requestMyEsimRefund,
  type MyEsimOrder,
  type MyEsimUsage,
} from '@/src/api/my-esim';
import { SocialAuthButtons } from '@/src/components/auth/SocialAuthButtons';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import { MY_ESIM_BADGE, MY_ESIM_DESIGN as D } from '@/src/constants/my-esim-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import { signOutGoogleNativeBestEffort } from '@/src/lib/native-oauth';
import {
  buildUsageSummaryView,
  chartBarHeight,
  formatOrderDate,
  myEsimBadgeTier,
  weekdayLabel,
} from '@/src/lib/my-esim-view-model';
import { clearSimplyurSession, getSimplyurAccessToken, subscribeSimplyurSession } from '@/src/lib/session';

type ViewState = 'loading' | 'signin' | 'error' | 'empty' | 'list' | 'detail';

/**
 * design_handoff_my_esim — My eSIM 4th tab
 * REGRESSION-FREEZE[simplyur-my-esim-badge-tiers]: Ready/Preparing badges, no Upcoming — manifest
 * REGRESSION-FREEZE[simplyur-mobile-my-esim-session-reload]: focus reload after native sign-in — manifest
 * REGRESSION-FREEZE[simplyur-mobile-my-esim-soft-reload]: login leaves My eSIM before orders flash — manifest
 * REGRESSION-FREEZE[simplyur-mobile-my-esim-social-signin]: Apple/Google/Email on tab — manifest
 * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: usage is full-screen native, not bottom sheet web — manifest
 * REGRESSION-FREEZE[simplyur-eximbay-refund]: unused eSIM cancel CTA — manifest
 * REGRESSION-FREEZE[simplyur-mobile-p0-account-install]: sign-out + SM-DP/activation codes — manifest
 * REGRESSION-FREEZE[simplyur-mobile-p1-account-settings]: settings + load-error vs empty — manifest
 * REGRESSION-FREEZE[simplyur-mobile-p2-polish]: order share + guide CTA + offline — manifest
 */
export default function MyEsimScreen() {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<MyEsimOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [detailUsage, setDetailUsage] = useState<MyEsimUsage | null>(null);
  const [usageScreenOpen, setUsageScreenOpen] = useState(false);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState<string | null>(null);
  const [refundBusy, setRefundBusy] = useState(false);
  const ordersRef = useRef<MyEsimOrder[]>([]);
  const unauthorizedRef = useRef(false);
  const loadSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const leavingForPlansRef = useRef(false);
  ordersRef.current = orders;
  unauthorizedRef.current = unauthorized;

  // Soft reload + coalesce. Never tear down a painted list into full-screen Loading.
  // REGRESSION-FREEZE[simplyur-mobile-my-esim-soft-reload]: stayOnSignIn + leave to plans on login — manifest
  const loadOrders = useCallback(async () => {
    if (leavingForPlansRef.current) return;
    if (inFlightRef.current) {
      pendingReloadRef.current = true;
      return;
    }
    inFlightRef.current = true;
    try {
      do {
        pendingReloadRef.current = false;
        if (leavingForPlansRef.current) break;
        const seq = ++loadSeqRef.current;
        const soft = ordersRef.current.length > 0;
        const stayOnSignIn = unauthorizedRef.current && !soft;
        // Only show Loading on cold first paint — never after list/sign-in.
        if (!soft && !stayOnSignIn && ordersRef.current.length === 0 && !unauthorizedRef.current) {
          setLoading(true);
        }
        setLoadError(false);
        const res = await fetchMyEsimOrders(locale);
        if (seq !== loadSeqRef.current || leavingForPlansRef.current) continue;
        if (!res.ok) {
          if (res.unauthorized) {
            setUnauthorized(true);
            setOrders([]);
          } else {
            setUnauthorized(false);
            setLoadError(true);
            if (!soft) setOrders([]);
          }
        } else {
          setUnauthorized(false);
          setOrders(res.orders);
        }
        setLoading(false);
      } while (pendingReloadRef.current && !leavingForPlansRef.current);
    } finally {
      inFlightRef.current = false;
    }
  }, [locale]);

  useFocusEffect(
    useCallback(() => {
      leavingForPlansRef.current = false;
      void loadOrders();
    }, [loadOrders]),
  );

  // Login from this tab → leave immediately (do not paint Upcoming list flash).
  useEffect(
    () =>
      subscribeSimplyurSession(() => {
        void (async () => {
          if (unauthorizedRef.current) {
            const token = await getSimplyurAccessToken();
            if (token) {
              leavingForPlansRef.current = true;
              router.replace('/(tabs)/plans');
              return;
            }
          }
          void loadOrders();
        })();
      }),
    [loadOrders],
  );

  const selectedOrder = useMemo(
    () => orders.find((o) => o.order_id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const fetchUsage = useCallback(async (orderId: string) => {
    setUsageLoading(true);
    setUsageError(null);
    const usage = await fetchMyEsimUsage(orderId);
    if (!usage) setUsageError(t('myEsim.usageError'));
    setDetailUsage(usage);
    setUsageLoading(false);
  }, [t]);

  useEffect(() => {
    if (!selectedOrderId || !selectedOrder?.can_check_usage) {
      setDetailUsage(null);
      return;
    }
    fetchUsage(selectedOrderId);
  }, [selectedOrderId, selectedOrder?.can_check_usage, fetchUsage]);

  const view: ViewState = useMemo(() => {
    // Sign-in wins over loading so post-login never flashes Loading… over the form.
    if (unauthorized) return 'signin';
    if (loading && orders.length === 0) return 'loading';
    if (loadError) return 'error';
    if (selectedOrderId && selectedOrder) return 'detail';
    if (orders.length === 0) return 'empty';
    return 'list';
  }, [loading, unauthorized, loadError, selectedOrderId, selectedOrder, orders.length]);

  const summary = selectedOrder ? buildUsageSummaryView(selectedOrder, detailUsage, t) : null;
  const modalSummary = selectedOrder ? buildUsageSummaryView(selectedOrder, detailUsage, t) : null;
  const maxDaily =
    detailUsage?.history?.length ?
      Math.max(1, ...detailUsage.history.map((h) => h.usageMb))
    : 1;

  async function onSignOut() {
    Alert.alert(t('nav.signOut'), t('myEsim.signOutConfirm'), [
      { text: t('myEsim.close'), style: 'cancel' },
      {
        text: t('nav.signOut'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await signOutGoogleNativeBestEffort();
            await clearSimplyurSession();
            setSelectedOrderId(null);
            setOrders([]);
            setUnauthorized(true);
          })();
        },
      },
    ]);
  }

  async function shareInstallValue(label: string, value: string) {
    const v = value.trim();
    if (!v) return;
    try {
      await Share.share({ message: v, title: label });
    } catch {
      Alert.alert(label, v);
    }
  }

  if (view === 'loading') {
    return (
      <View style={[styles.center, { backgroundColor: D.bg, paddingTop: insets.top }]}>
        <Text style={styles.muted}>{t('myEsim.loading')}</Text>
      </View>
    );
  }

  if (view === 'signin') {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: D.bg }}
        contentContainerStyle={[
          styles.signinContent,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled">
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={10}
          style={styles.settingsCorner}>
          <Text style={styles.signOutLink}>{t('myEsim.settingsLink')}</Text>
        </Pressable>
        <Text style={styles.signinIcon}>🔒</Text>
        <Text style={styles.signinTitle}>{t('myEsim.signInTitle')}</Text>
        <Text style={styles.signinBody}>{t('myEsim.signInBody')}</Text>
        <SocialAuthButtons inlineEmail successHref="/(tabs)/plans" />
      </ScrollView>
    );
  }

  if (view === 'error') {
    return (
      <CenterBlock
        insets={insets}
        icon="⚠️"
        title={t('myEsim.loadErrorTitle')}
        body={t('myEsim.loadError')}>
        <Pressable style={styles.cta} onPress={() => void loadOrders()}>
          <Text style={styles.ctaText}>{t('myEsim.retry')}</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/settings')} style={{ marginTop: 16 }} hitSlop={8}>
          <Text style={styles.signOutLink}>{t('myEsim.settingsLink')}</Text>
        </Pressable>
      </CenterBlock>
    );
  }

  if (view === 'empty') {
    return (
      <CenterBlock
        insets={insets}
        icon="📶"
        title={t('myEsim.emptyTitle')}
        body={t('myEsim.emptyBody')}>
        <Link href="/plans" asChild>
          <Pressable style={styles.cta}>
            <Text style={styles.ctaText}>{t('myEsim.emptyCta')}</Text>
          </Pressable>
        </Link>
        <Pressable onPress={() => router.push('/settings')} style={{ marginTop: 16 }} hitSlop={8}>
          <Text style={styles.signOutLink}>{t('myEsim.settingsLink')}</Text>
        </Pressable>
        <Pressable onPress={() => void onSignOut()} style={{ marginTop: 12 }} hitSlop={8}>
          <Text style={styles.signOutLink}>{t('nav.signOut')}</Text>
        </Pressable>
      </CenterBlock>
    );
  }

  if (view === 'detail' && selectedOrder && summary && modalSummary) {
    const tier = myEsimBadgeTier(selectedOrder.status_key, {
      can_show_qr: selectedOrder.can_show_qr,
    });
    const badge = MY_ESIM_BADGE[tier];

    if (usageScreenOpen) {
      return (
        <ScrollView
          style={[styles.root, { backgroundColor: D.bg }]}
          contentContainerStyle={[
            styles.detailContent,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
          ]}>
          <Pressable onPress={() => setUsageScreenOpen(false)} hitSlop={8} style={styles.backRow}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backText}>{t('myEsim.backToList')}</Text>
          </Pressable>
          <Text style={styles.detailTitle}>{t('myEsim.usageTitle')}</Text>

          {usageLoading ? <Text style={styles.muted}>{t('myEsim.loading')}</Text> : null}
          {usageError ? <Text style={styles.errorText}>{usageError}</Text> : null}

          {detailUsage ? (
            <>
              <View style={styles.modalUsedRow}>
                <Text style={styles.modalUsedBig}>{modalSummary.usedDisplay}</Text>
                <Text style={styles.modalUsedOf}>{modalSummary.usedOfLabel}</Text>
              </View>
              {modalSummary.sublabel ? <Text style={styles.modalSub}>{modalSummary.sublabel}</Text> : null}

              {modalSummary.hasCap ? (
                <View style={styles.capBlock}>
                  <View style={styles.fullTrack}>
                    <View style={[styles.fullFill, { width: `${modalSummary.usedPct}%` }]} />
                  </View>
                  <View style={styles.capLabels}>
                    <Text style={styles.capLabel}>
                      {modalSummary.usedDisplay} {t('myEsim.usedWord')}
                    </Text>
                    <Text style={styles.capRemain}>
                      {modalSummary.remainingDisplay} {t('myEsim.leftWord')}
                    </Text>
                  </View>
                </View>
              ) : null}

              {detailUsage.history.length > 0 ? (
                <View style={styles.chart}>
                  {detailUsage.history.slice(-7).map((h, i, arr) => (
                    <View key={h.date} style={styles.barCol}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: chartBarHeight(h.usageMb, maxDaily),
                            backgroundColor: i === arr.length - 1 ? D.coral : D.barMuted,
                          },
                        ]}
                      />
                      <Text style={styles.barLabel}>{weekdayLabel(h.date, locale)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.muted}>{t('myEsim.noDailyUsage')}</Text>
              )}
            </>
          ) : null}
        </ScrollView>
      );
    }

    return (
      <View style={[styles.root, { backgroundColor: D.bg, paddingTop: insets.top + 16 }]}>
        <ScrollView contentContainerStyle={[styles.detailContent, { paddingBottom: insets.bottom + 100 }]}>
          <Pressable
            onPress={() => {
              setSelectedOrderId(null);
              setUsageScreenOpen(false);
            }}
            hitSlop={8}
            style={styles.backRow}>
            <Text style={styles.backArrow}>←</Text>
            <Text style={styles.backText}>{t('myEsim.backToList')}</Text>
          </Pressable>

          <View style={styles.detailHeader}>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={[styles.badgeText, { color: badge.color }]}>{t(`myEsim.badge.${tier}`)}</Text>
            </View>
            <Text style={styles.detailTitle}>{selectedOrder.plan_summary}</Text>
            <Text style={styles.orderedOn}>
              {t('myEsim.orderedOn')} {formatOrderDate(selectedOrder.created_at, locale)}
            </Text>
            {selectedOrder.order_number ? (
              <Pressable
                style={styles.orderNoRow}
                onPress={() =>
                  void shareInstallValue(t('myEsim.orderNoLabel'), selectedOrder.order_number)
                }>
                <Text style={styles.orderNoLabel}>{t('myEsim.orderNoLabel')}</Text>
                <Text style={styles.orderNoValue} selectable>
                  {selectedOrder.order_number}
                </Text>
                <Text style={styles.codeShare}>{t('myEsim.shareOrderNo')}</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.qrPanel}>
            {selectedOrder.can_show_qr && selectedOrder.qr_code_img_url ? (
              <Image source={{ uri: selectedOrder.qr_code_img_url }} style={styles.qrImage} resizeMode="contain" />
            ) : (
              <View style={styles.qrPlaceholder}>
                <Text style={styles.qrPlaceholderText}>QR CODE</Text>
              </View>
            )}
            <Text style={styles.qrHint}>{t('myEsim.qrHint')}</Text>
            {selectedOrder.can_show_qr && selectedOrder.qr_code_img_url ? (
              <Pressable
                onPress={() =>
                  void shareInstallValue(t('myEsim.shareQr'), selectedOrder.qr_code_img_url!)
                }
                hitSlop={8}
                style={styles.shareQrBtn}>
                <Text style={styles.signOutLink}>{t('myEsim.shareQr')}</Text>
              </Pressable>
            ) : null}
          </View>

          {(selectedOrder.sm_dp_plus_address || selectedOrder.activation_code) &&
          selectedOrder.can_show_qr ? (
            <View style={styles.manualBox}>
              <Text style={styles.manualTitle}>{t('myEsim.manualInstallTitle')}</Text>
              <Text style={styles.manualBody}>{t('myEsim.manualInstallBody')}</Text>
              {selectedOrder.sm_dp_plus_address ? (
                <Pressable
                  style={styles.codeRow}
                  onPress={() =>
                    void shareInstallValue(t('myEsim.smDpAddress'), selectedOrder.sm_dp_plus_address!)
                  }>
                  <Text style={styles.codeLabel}>{t('myEsim.smDpAddress')}</Text>
                  <Text style={styles.codeValue} selectable>
                    {selectedOrder.sm_dp_plus_address}
                  </Text>
                  <Text style={styles.codeShare}>{t('myEsim.shareCode')}</Text>
                </Pressable>
              ) : null}
              {selectedOrder.activation_code ? (
                <Pressable
                  style={styles.codeRow}
                  onPress={() =>
                    void shareInstallValue(t('myEsim.activationCode'), selectedOrder.activation_code!)
                  }>
                  <Text style={styles.codeLabel}>{t('myEsim.activationCode')}</Text>
                  <Text style={styles.codeValue} selectable>
                    {selectedOrder.activation_code}
                  </Text>
                  <Text style={styles.codeShare}>{t('myEsim.shareCode')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={styles.tipsBox}>
            <Text style={styles.manualTitle}>{t('myEsim.installTipsTitle')}</Text>
            <Text style={styles.manualBody}>{t('myEsim.installTipDataLine')}</Text>
            <Text style={styles.manualBody}>{t('myEsim.installTipRoaming')}</Text>
            <Pressable onPress={() => router.push('/guide')} style={styles.guideCta} hitSlop={8}>
              <Text style={styles.signOutLink}>{t('myEsim.openGuide')}</Text>
            </Pressable>
          </View>

          <Pressable style={styles.usageCard} onPress={() => setUsageScreenOpen(true)}>
            <View style={styles.usageCardText}>
              <Text style={styles.usageLabel}>{t('myEsim.usageCardLabel')}</Text>
              <Text style={styles.usageValue}>{summary.usageLabel}</Text>
              {summary.hasCap ? (
                <View style={styles.miniTrack}>
                  <View style={[styles.miniFill, { width: `${summary.usedPct}%` }]} />
                </View>
              ) : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>

          {selectedOrder.status_key === 'refundPending' ? (
            <Text style={styles.refundNote}>{t('myEsim.refundInProgress')}</Text>
          ) : null}
          {selectedOrder.status_key === 'cancelled' ? (
            <Text style={styles.refundNote}>{t('myEsim.refundDone')}</Text>
          ) : null}
          {selectedOrder.can_request_refund ? (
            <View style={styles.refundBox}>
              <Text style={styles.refundTitle}>{t('myEsim.refundTitle')}</Text>
              <Text style={styles.refundBody}>{t('myEsim.refundBody')}</Text>
              <Pressable
                disabled={refundBusy}
                style={[styles.refundBtn, refundBusy ? { opacity: 0.6 } : null]}
                onPress={() => {
                  Alert.alert(t('myEsim.refundTitle'), t('myEsim.refundConfirm'), [
                    { text: t('myEsim.close'), style: 'cancel' },
                    {
                      text: t('myEsim.refundCta'),
                      style: 'destructive',
                      onPress: () => {
                        void (async () => {
                          setRefundBusy(true);
                          const r = await requestMyEsimRefund(selectedOrder.order_id);
                          setRefundBusy(false);
                          if (!r.ok) {
                            Alert.alert(t('myEsim.refundError'), r.message);
                            return;
                          }
                          await loadOrders();
                        })();
                      },
                    },
                  ]);
                }}>
                <Text style={styles.refundBtnText}>
                  {refundBusy ? t('myEsim.refundBusy') : t('myEsim.refundCta')}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable onPress={() => void onSignOut()} style={styles.signOutDetail} hitSlop={8}>
            <Text style={styles.signOutLink}>{t('nav.signOut')}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: D.bg }]}
      contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}>
      <OfflineBanner onOnline={() => void loadOrders()} />
      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>{t('myEsim.title')}</Text>
        <View style={styles.listHeaderActions}>
          <Pressable onPress={() => router.push('/settings')} hitSlop={10}>
            <Text style={styles.signOutLink}>{t('myEsim.settingsLink')}</Text>
          </Pressable>
          <Pressable onPress={() => void onSignOut()} hitSlop={10}>
            <Text style={styles.signOutLink}>{t('nav.signOut')}</Text>
          </Pressable>
        </View>
      </View>
      {orders.map((o) => {
        const tier = myEsimBadgeTier(o.status_key, { can_show_qr: o.can_show_qr });
        const badge = MY_ESIM_BADGE[tier];
        const hint =
          tier === 'active' || tier === 'ready'
            ? t('myEsim.listHintReady')
            : t('myEsim.listHintPreparing');
        return (
          <Pressable key={o.order_id} style={styles.orderCard} onPress={() => setSelectedOrderId(o.order_id)}>
            <View style={styles.orderText}>
              <Text style={styles.orderDate}>{formatOrderDate(o.created_at, locale)}</Text>
              <Text style={styles.orderPlan}>{o.plan_summary}</Text>
              <Text style={styles.orderHint}>{hint}</Text>
            </View>
            <View style={styles.orderRight}>
              <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>{t(`myEsim.badge.${tier}`)}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function CenterBlock({
  insets,
  icon,
  title,
  body,
  children,
}: {
  insets: { top: number; bottom: number };
  icon: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.center, { backgroundColor: D.bg, paddingTop: insets.top, paddingBottom: insets.bottom + 80 }]}>
      <View style={styles.iconCircle}>
        <Text style={styles.iconGlyph}>{icon}</Text>
      </View>
      <Text style={styles.centerTitle}>{title}</Text>
      <Text style={styles.centerBody}>{body}</Text>
      <View style={styles.ctaWrap}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  signinContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 14,
    alignItems: 'stretch',
  },
  signinIcon: { fontSize: 36, textAlign: 'center', marginBottom: 4 },
  signinTitle: { fontSize: 20, ...fp('800'), color: D.navy, textAlign: 'center' },
  signinBody: {
    fontSize: 13,
    lineHeight: 20.8,
    ...fp('400'),
    color: D.muted,
    textAlign: 'center',
    marginBottom: 8,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 16 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: D.iconCircleBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 28 },
  centerTitle: { fontSize: 19, ...fp('800'), color: D.navy, textAlign: 'center' },
  centerBody: { fontSize: 13, lineHeight: 20.8, ...fp('400'), color: D.muted, textAlign: 'center', maxWidth: 260 },
  ctaWrap: { marginTop: 8, width: '100%', maxWidth: 280 },
  cta: {
    height: D.buttonHeight,
    borderRadius: D.buttonRadius,
    backgroundColor: D.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 15, ...fp('600'), color: '#fff' },
  ctaSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: D.border,
  },
  ctaTextSecondary: { color: D.navy },
  muted: { fontSize: 14, ...fp('400'), color: D.muted },
  errorText: { fontSize: 14, color: '#dc2626' },
  listContent: { paddingHorizontal: D.paddingH, gap: D.sectionGap },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  listHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  listTitle: { fontSize: 22, ...fp('800'), color: D.navy },
  settingsCorner: { alignSelf: 'flex-end', marginBottom: 8 },
  signOutLink: { fontSize: 13, ...fp('600'), color: D.coral, textAlign: 'center' },
  orderNoRow: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    backgroundColor: '#fff',
    alignSelf: 'stretch',
  },
  orderNoLabel: { fontSize: 11, ...fp('600'), color: D.faint },
  orderNoValue: { fontSize: 13, ...fp('600'), color: D.navy },
  shareQrBtn: { marginTop: 8, alignItems: 'center' },
  tipsBox: {
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.panelRadius,
    backgroundColor: '#fff',
    padding: 16,
    gap: 8,
  },
  guideCta: { marginTop: 4, alignSelf: 'flex-start' },
  signOutDetail: { marginTop: 8, alignItems: 'center', paddingVertical: 12 },
  manualBox: {
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.panelRadius,
    backgroundColor: '#fff',
    padding: 16,
    gap: 10,
  },
  manualTitle: { fontSize: 14, ...fp('700'), color: D.navy },
  manualBody: { fontSize: 12, lineHeight: 18, ...fp('400'), color: D.muted },
  codeRow: {
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    backgroundColor: D.bg,
  },
  codeLabel: { fontSize: 11, ...fp('600'), color: D.faint },
  codeValue: { fontSize: 13, ...fp('600'), color: D.navy },
  codeShare: { fontSize: 12, ...fp('600'), color: D.coral, marginTop: 2 },
  orderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.cardRadius,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 12,
  },
  orderText: { flex: 1, gap: 4, paddingRight: 8 },
  orderDate: { fontSize: 12, ...fp('400'), color: D.faint },
  orderPlan: { fontSize: 14, ...fp('700'), color: D.navy },
  orderHint: { marginTop: 4, fontSize: 11, lineHeight: 15, ...fp('400'), color: D.muted },
  orderRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, ...fp('700') },
  chevron: { fontSize: 16, color: D.faint },
  detailContent: { paddingHorizontal: D.paddingH, gap: D.detailGap },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backArrow: { fontSize: 16, color: D.coral },
  backText: { fontSize: 13, ...fp('600'), color: D.coral },
  detailHeader: { gap: 6 },
  detailTitle: { fontSize: 20, ...fp('800'), color: D.navy },
  orderedOn: { fontSize: 12, ...fp('400'), color: D.faint },
  qrPanel: {
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.panelRadius,
    backgroundColor: '#fff',
    padding: 22,
    alignItems: 'center',
    gap: 12,
  },
  qrImage: { width: 168, height: 168, borderRadius: 14 },
  qrPlaceholder: {
    width: 168,
    height: 168,
    borderRadius: 14,
    backgroundColor: D.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrPlaceholderText: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    fontSize: 12,
    ...fp('700'),
    color: D.navy,
  },
  qrHint: { fontSize: 12, ...fp('400'), color: D.muted, textAlign: 'center' },
  refundBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#F5D0A9',
    backgroundColor: '#FFF8F0',
    borderRadius: D.panelRadius,
    padding: 16,
    gap: 8,
  },
  refundTitle: { fontSize: 14, ...fp('700'), color: D.navy },
  refundBody: { fontSize: 12, ...fp('400'), color: D.faint, lineHeight: 18 },
  refundBtn: {
    marginTop: 4,
    height: 44,
    borderRadius: 14,
    backgroundColor: D.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refundBtnText: { fontSize: 14, ...fp('700'), color: '#fff' },
  refundNote: { marginTop: 4, fontSize: 13, ...fp('400'), color: D.faint },
  usageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.panelRadius,
    backgroundColor: '#fff',
    padding: 18,
  },
  usageCardText: { flex: 1, gap: 4 },
  usageLabel: { fontSize: 12, ...fp('400'), color: D.faint },
  usageValue: { fontSize: 16, ...fp('700'), color: D.navy },
  miniTrack: {
    marginTop: 2,
    width: 120,
    height: 6,
    borderRadius: 999,
    backgroundColor: D.progressTrack,
    overflow: 'hidden',
  },
  miniFill: { height: '100%', borderRadius: 999, backgroundColor: D.coral },
  modalUsedRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  modalUsedBig: { fontSize: 28, ...fp('800'), color: D.navy },
  modalUsedOf: { fontSize: 14, ...fp('600'), color: D.faint },
  modalSub: { fontSize: 12, ...fp('400'), color: D.faint },
  capBlock: { gap: 8 },
  fullTrack: { height: 10, borderRadius: 999, backgroundColor: D.progressTrack, overflow: 'hidden' },
  fullFill: { height: '100%', borderRadius: 999, backgroundColor: D.coral },
  capLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  capLabel: { fontSize: 12, ...fp('400'), color: D.muted },
  capRemain: { fontSize: 12, ...fp('700'), color: D.navy },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 100, paddingTop: 8 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  bar: { width: '100%', maxWidth: 22, borderRadius: 6 },
  barLabel: { fontSize: 10, ...fp('400'), color: D.faint },
});
