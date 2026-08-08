import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchMyEsimOrders, fetchMyEsimUsage, type MyEsimOrder, type MyEsimUsage } from '@/src/api/my-esim';
import { SocialAuthButtons } from '@/src/components/auth/SocialAuthButtons';
import { MY_ESIM_BADGE, MY_ESIM_DESIGN as D } from '@/src/constants/my-esim-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import {
  buildUsageSummaryView,
  chartBarHeight,
  formatOrderDate,
  myEsimBadgeTier,
  weekdayLabel,
} from '@/src/lib/my-esim-view-model';
import { subscribeSimplyurSession } from '@/src/lib/session';

type ViewState = 'loading' | 'signin' | 'empty' | 'list' | 'detail';

/**
 * design_handoff_my_esim — My eSIM 4th tab
 * REGRESSION-FREEZE[simplyur-mobile-my-esim-session-reload]: focus reload after native sign-in — manifest
 * REGRESSION-FREEZE[simplyur-mobile-my-esim-social-signin]: Apple/Google/Email on tab — manifest
 * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: usage is full-screen native, not bottom sheet web — manifest
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

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    setUnauthorized(false);
    const res = await fetchMyEsimOrders(locale);
    if (!res.ok) {
      if (res.unauthorized) setUnauthorized(true);
      else setLoadError(true);
      setOrders([]);
    } else {
      setOrders(res.orders);
    }
    setLoading(false);
  }, [locale]);

  // Tabs stay mounted under /sign-in — reload on focus + when SecureStore session is written.
  useFocusEffect(
    useCallback(() => {
      void loadOrders();
    }, [loadOrders]),
  );

  useEffect(() => subscribeSimplyurSession(() => {
    void loadOrders();
  }), [loadOrders]);

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
    if (loading) return 'loading';
    if (unauthorized) return 'signin';
    if (selectedOrderId && selectedOrder) return 'detail';
    if (orders.length === 0) return 'empty';
    return 'list';
  }, [loading, unauthorized, selectedOrderId, selectedOrder, orders.length]);

  const summary = selectedOrder ? buildUsageSummaryView(selectedOrder, detailUsage, t) : null;
  const modalSummary = selectedOrder ? buildUsageSummaryView(selectedOrder, detailUsage, t) : null;
  const maxDaily =
    detailUsage?.history?.length ?
      Math.max(1, ...detailUsage.history.map((h) => h.usageMb))
    : 1;

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
        <Text style={styles.signinIcon}>🔒</Text>
        <Text style={styles.signinTitle}>{t('myEsim.signInTitle')}</Text>
        <Text style={styles.signinBody}>{t('myEsim.signInBody')}</Text>
        <SocialAuthButtons inlineEmail onSignedIn={() => loadOrders()} />
      </ScrollView>
    );
  }

  if (view === 'empty') {
    return (
      <CenterBlock
        insets={insets}
        icon="📶"
        title={t('myEsim.emptyTitle')}
        body={loadError ? t('myEsim.loadError') : t('myEsim.emptyBody')}>
        <Link href="/plans" asChild>
          <Pressable style={styles.cta}>
            <Text style={styles.ctaText}>{t('myEsim.emptyCta')}</Text>
          </Pressable>
        </Link>
      </CenterBlock>
    );
  }

  if (view === 'detail' && selectedOrder && summary && modalSummary) {
    const tier = myEsimBadgeTier(selectedOrder.status_key);
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
        </ScrollView>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: D.bg }]}
      contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}>
      <Text style={styles.listTitle}>{t('myEsim.title')}</Text>
      {orders.map((o) => {
        const tier = myEsimBadgeTier(o.status_key);
        const badge = MY_ESIM_BADGE[tier];
        return (
          <Pressable key={o.order_id} style={styles.orderCard} onPress={() => setSelectedOrderId(o.order_id)}>
            <View style={styles.orderText}>
              <Text style={styles.orderDate}>{formatOrderDate(o.created_at, locale)}</Text>
              <Text style={styles.orderPlan}>{o.plan_summary}</Text>
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
  listTitle: { fontSize: 22, ...fp('800'), color: D.navy },
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
