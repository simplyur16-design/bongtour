import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchKoreaPlans, type CountryPack, type PlanProduct } from '@/src/api/simplyur';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import { SyIcon } from '@/src/components/ui/SyIcon';
import { Segmented, Tag } from '@/src/components/ui/SyUi';
import { PLANS_DESIGN as D } from '@/src/constants/plans-design';
import { SY } from '@/src/constants/theme';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import {
  SIMPLYUR_KOREA_DEFAULT_TRIP_DAYS,
  collectAvailableDays,
  filterProductsByDays,
  formatPlanCount,
  resolvePlanDataHint,
  snapTripDaysToAvailable,
} from '@/src/lib/plans-catalog';

type LineKey = 'local' | 'roaming';

/**
 * 1.0.2 Plans — redesign mockup 02: trip-length chips, Local/Roaming segment, tappable plan cards with benefit tags.
 * design_handoff_plans — duration-first Find my eSIM tab
 * REGRESSION-FREEZE[simplyur-mobile-plans-auto-select]: default day like web — manifest
 * REGRESSION-FREEZE[simplyur-mobile-plans-scroll-stable]: Android finger-up cancels fling — manifest
 * REGRESSION-FREEZE[simplyur-plan-unlimited-hint]: data_hint on unlimited cards — manifest
 * REGRESSION-FREEZE[simplyur-mobile-p2-polish]: offline banner — manifest
 * REGRESSION-FREEZE[simplyur-mobile-offline-reload-once]: RefreshControl ≠ catalog load — manifest
 */
export default function PlansScreen() {
  const { t, locale, ready } = useI18n();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ days?: string }>();
  const requestedDays = Number.parseInt(String(params.days ?? ''), 10);
  const scrollRef = useRef<ScrollView>(null);
  const chipsY = useRef(0);
  const loadGen = useRef(0);

  const [pack, setPack] = useState<CountryPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [line, setLine] = useState<LineKey | null>(null);
  const [showWhich, setShowWhich] = useState(false);
  const packRef = useRef<CountryPack | null>(null);
  packRef.current = pack;

  const load = useCallback(async (opts?: { pull?: boolean; soft?: boolean }) => {
    const gen = ++loadGen.current;
    const keepPainted = Boolean(opts?.soft && packRef.current);
    if (opts?.pull) setRefreshing(true);
    else if (!keepPainted) setLoading(true);
    setError(null);
    try {
      const next = await fetchKoreaPlans(locale);
      if (gen !== loadGen.current) return;
      setPack(next);
    } catch {
      if (gen !== loadGen.current) return;
      setError('load failed');
      setPack(null);
    } finally {
      if (gen !== loadGen.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, [locale]);

  useEffect(() => {
    if (!ready) return;
    setSelectedDays(null);
    void load();
  }, [load, ready]);

  const dayOptions = useMemo(() => (pack ? collectAvailableDays(pack) : []), [pack]);

  // Web recommend SSOT: auto-pick ~5 days so plans are not hidden behind an empty placeholder.
  useEffect(() => {
    if (!pack || dayOptions.length === 0) return;
    if (selectedDays != null && dayOptions.includes(selectedDays)) return;
    // Home trip-length chip → /plans?days=N; otherwise the web default (~5 days).
    const preferred = Number.isFinite(requestedDays) && requestedDays > 0 ? requestedDays : SIMPLYUR_KOREA_DEFAULT_TRIP_DAYS;
    const days = snapTripDaysToAvailable(preferred, dayOptions);
    if (days != null) setSelectedDays(days);
  }, [pack, dayOptions, selectedDays, requestedDays]);

  // A new chip on Home while this tab is mounted → follow it.
  useEffect(() => {
    if (!Number.isFinite(requestedDays) || requestedDays <= 0 || dayOptions.length === 0) return;
    const snapped = snapTripDaysToAvailable(requestedDays, dayOptions);
    if (snapped != null) setSelectedDays(snapped);
  }, [requestedDays, dayOptions]);

  const roamingFiltered = useMemo(
    () => (pack && selectedDays != null ? filterProductsByDays(pack.roaming.products, selectedDays) : []),
    [pack, selectedDays],
  );
  const localFiltered = useMemo(
    () => (pack?.local && selectedDays != null ? filterProductsByDays(pack.local.products, selectedDays) : []),
    [pack, selectedDays],
  );
  const showNoMatch =
    selectedDays != null && roamingFiltered.length === 0 && localFiltered.length === 0;
  const hasBothLines = localFiltered.length > 0 && roamingFiltered.length > 0;
  // Mockup default: Local line first when both are sold for this length.
  const activeLine: LineKey =
    line === 'roaming' && roamingFiltered.length > 0
      ? 'roaming'
      : line === 'local' && localFiltered.length > 0
        ? 'local'
        : localFiltered.length > 0
          ? 'local'
          : 'roaming';
  const shownProducts = activeLine === 'local' ? localFiltered : roamingFiltered;
  const allUsd = shownProducts.length > 0 && shownProducts.every((p) => p.simplyur_display?.currency === 'USD');
  const hotspotFootnote = shownProducts.find((p) => p.hotspot_note)?.hotspot_note ?? null;
  const showCatalogEmpty = !loading && !error && (!pack || dayOptions.length === 0);

  /** Android ScrollView keeps flinging after finger-up; pin to the lift offset. */
  const stopAndroidFling = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (Platform.OS !== 'android') return;
    const y = e.nativeEvent.contentOffset.y;
    scrollRef.current?.scrollTo({ y, animated: false });
  }, []);

  if (error && !pack) {
    return (
      <View style={[styles.root, { backgroundColor: D.bg, paddingTop: insets.top + 16 }]}>
        <View style={styles.errorWrap}>
          <View style={styles.errorIcon}>
            <Text style={styles.errorIconText}>!</Text>
          </View>
          <Text style={styles.errorTitle}>{t('recommend.errorTitle')}</Text>
          <Text style={styles.errorBody}>{t('recommend.errorBody')}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryBtnText}>{t('recommend.retry')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.root, { backgroundColor: D.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 },
      ]}
      // Android: contentContainerStyle gap mis-measures scroll extent.
      // Finger-up: cancel residual fling so the list stops where the drag ended.
      decelerationRate="fast"
      bounces={false}
      alwaysBounceVertical={false}
      overScrollMode={Platform.OS === 'android' ? 'never' : undefined}
      onScrollEndDrag={stopAndroidFling}
      onMomentumScrollBegin={stopAndroidFling}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void load({ pull: true })}
          tintColor={D.coral}
        />
      }>
      <View style={styles.stackItem}>
        <OfflineBanner onOnline={() => void load({ soft: true })} />
      </View>
      <View style={[styles.header, styles.stackItem]}>
        <Text style={styles.title}>{t('recommend.titleShort')}</Text>
        {allUsd ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{t('recommend.pricesInUsd')}</Text>
          </View>
        ) : null}
      </View>

      {loading && !pack ? (
        <View style={[styles.skeletonBlock, styles.stackItem]}>
          <Text style={styles.loadingText}>{t('recommend.loading')}</Text>
          <View style={styles.skeletonChips}>
            {[1, 2, 3, 4].map((i) => (
              <View key={i} style={styles.skeletonChip} />
            ))}
          </View>
          {[1, 2].map((i) => (
            <View key={i} style={[styles.skeletonCard, i === 2 && { opacity: 0.6 }]}>
              <View style={styles.skeletonLine} />
              <View style={[styles.skeletonLine, { width: 100 }]} />
            </View>
          ))}
        </View>
      ) : null}

      {showCatalogEmpty ? (
        <View style={styles.stackItem}>
          <Placeholder>{t('recommend.noPlans')}</Placeholder>
        </View>
      ) : null}

      {pack && dayOptions.length > 0 ? (
        <>
          <View
            style={styles.stackItem}
            onLayout={(e) => {
              chipsY.current = e.nativeEvent.layout.y;
            }}>
            <DurationPicker
              options={dayOptions}
              value={selectedDays}
              onChange={setSelectedDays}
              t={t}
            />
          </View>

          {selectedDays == null ? (
            <View style={styles.stackItem}>
              <Placeholder>{t('recommend.plansPlaceholder')}</Placeholder>
            </View>
          ) : showNoMatch ? (
            <View style={styles.stackItem}>
              <Placeholder>{formatPlanCount(t, 'recommend.noPlansForDays', selectedDays)}</Placeholder>
            </View>
          ) : (
            <>
              {hasBothLines ? (
                <View style={styles.stackItem}>
                  <Segmented<LineKey>
                    items={[
                      { key: 'local', label: t('recommend.localShort') },
                      { key: 'roaming', label: t('recommend.roamingShort') },
                    ]}
                    value={activeLine}
                    onChange={setLine}
                  />
                </View>
              ) : null}
              <View style={[styles.lineRow, styles.stackItem]}>
                <Text style={styles.lineNote}>
                  {activeLine === 'local' ? t('recommend.lineLocalNote') : t('recommend.lineRoamingNote')}
                </Text>
                <Pressable onPress={() => setShowWhich((v) => !v)} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.whichLink}>{t('recommend.whichOne')}</Text>
                </Pressable>
              </View>
              {showWhich ? (
                <View style={[styles.whichCard, styles.stackItem]}>
                  <Text style={styles.whichBody}>{t('recommend.whichOneBody')}</Text>
                </View>
              ) : null}

              {shownProducts.map((p) => (
                <View key={p.option_api_id} style={styles.stackItem}>
                  <PlanCard plan={p} t={t} />
                </View>
              ))}

              <View style={[styles.promo, styles.stackItem]}>
                <SyIcon name="tag" size={18} color={SY.primaryDark} strokeWidth={2} />
                <Text style={styles.promoText}>{t('recommend.firstOrderBanner')}</Text>
              </View>
              {hotspotFootnote ? (
                <Text style={[styles.footnote, styles.stackItem]}>* {hotspotFootnote}</Text>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function DurationPicker({
  options,
  value,
  onChange,
  t,
}: {
  options: number[];
  value: number | null;
  onChange: (d: number) => void;
  t: (k: string) => string;
}) {
  const chipsRef = useRef<ScrollView>(null);
  const stopAndroidFling = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (Platform.OS !== 'android') return;
    const x = e.nativeEvent.contentOffset.x;
    chipsRef.current?.scrollTo({ x, animated: false });
  }, []);

  return (
    <ScrollView
      ref={chipsRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      bounces={false}
      overScrollMode={Platform.OS === 'android' ? 'never' : undefined}
      onScrollEndDrag={stopAndroidFling}
      onMomentumScrollBegin={stopAndroidFling}
      style={styles.chipScroll}
      contentContainerStyle={styles.chipRow}
      keyboardShouldPersistTaps="handled">
      {options.map((d, index) => {
        const selected = value === d;
        return (
          <Pressable
            key={d}
            onPress={() => onChange(d)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[
              styles.chip,
              index < options.length - 1 ? styles.chipSpacing : null,
              selected ? styles.chipSelected : styles.chipIdle,
            ]}>
            <Text style={[styles.chipText, selected ? styles.chipTextSelected : styles.chipTextIdle]}>
              {formatPlanCount(t, 'recommend.durationChip', d)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function Placeholder({ children }: { children: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{children}</Text>
    </View>
  );
}

/** Whole card opens the plan (mockup: no Select button). Price/per-day are API values. */
function PlanCard({ plan, t }: { plan: PlanProduct; t: (k: string) => string }) {
  const perDay = plan.simplyur_display_per_day?.formatted;
  const perDayLabel = perDay && (plan.days ?? 0) >= 2
    ? t('recommend.perDay').replace('{amount}', perDay)
    : null;
  const dataHint = resolvePlanDataHint(plan, t) ?? (plan.plan_type === 'daily' ? t('recommend.dailyHint') : null);
  return (
    <Pressable
      style={styles.card}
      onPress={() =>
        router.push({ pathname: '/product/[optionApiId]', params: { optionApiId: plan.option_api_id } })
      }
      accessibilityRole="button"
      accessibilityLabel={`${plan.data_label} ${plan.simplyur_display?.formatted ?? ''}`}>
      <View style={styles.planSummaryRow}>
        <View style={styles.dataBlock}>
          <Text style={styles.dataLabel}>{plan.data_label}</Text>
          {dataHint ? <Text style={styles.dataHint}>{dataHint}</Text> : null}
        </View>
        <View style={styles.priceBlock}>
          <Text style={styles.price} numberOfLines={1}>
            {plan.simplyur_display?.formatted ?? '—'}
          </Text>
          {perDayLabel ? <Text style={styles.perDay}>{perDayLabel}</Text> : null}
        </View>
        <View style={styles.chev}>
          <SyIcon name="chev" size={18} color={SY.ink3} strokeWidth={2} />
        </View>
      </View>
      <PlanBenefitChips plan={plan} t={t} />
    </Pressable>
  );
}

/** Proposal 3 — benefit tags from optional API fields; nothing renders on older servers. */
function PlanBenefitChips({ plan, t }: { plan: PlanProduct; t: (k: string) => string }) {
  if (!plan.featured && !plan.free_apps_data && !plan.hotspot_note && !plan.unused_refund) return null;
  return (
    <View style={styles.benefitRow}>
      {plan.featured ? <Tag tone="primary" label={t('recommend.recommendedTag')} /> : null}
      {plan.free_apps_data ? <Tag tone="free" icon="map" label={t('product.freeAppsShort')} /> : null}
      {plan.hotspot_note ? <Tag tone="neutral" icon="wifi" label={t('product.hotspotShort')} /> : null}
      {plan.unused_refund ? <Tag tone="neutral" icon="refund" label={t('product.unusedRefundShort')} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Prefer stackItem margins over contentContainerStyle gap (Android scroll overshoot).
  content: { paddingHorizontal: D.paddingH },
  stackItem: { marginBottom: D.sectionGap },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, lineHeight: 27, ...fp('700'), color: D.navy, letterSpacing: -0.2 },
  pill: {
    borderWidth: 1,
    borderColor: D.border,
    backgroundColor: SY.surface,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  pillText: { fontSize: 12, ...fp('600'), color: D.navy },
  chipScroll: { marginRight: -D.paddingH },
  // No contentContainerStyle gap — Android horizontal overshoot (same as vertical list).
  chipRow: { paddingVertical: 2, paddingRight: D.paddingH },
  chip: {
    height: D.chipHeight,
    minWidth: D.chipMinWidth,
    paddingHorizontal: 12,
    borderRadius: D.chipRadius,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  chipSpacing: { marginRight: 7 },
  chipSelected: { backgroundColor: SY.ink, borderColor: SY.ink },
  chipIdle: { backgroundColor: SY.surface, borderColor: D.border },
  chipText: { fontSize: 14.5, ...fp('600') },
  chipTextSelected: { color: '#fff' },
  chipTextIdle: { color: D.muted },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginTop: -4 },
  lineNote: { flex: 1, fontSize: 12.5, lineHeight: 17, ...fp('400'), color: D.faint },
  whichLink: { fontSize: 12.5, lineHeight: 17, ...fp('600'), color: D.coral },
  whichCard: {
    backgroundColor: SY.surface,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 14,
    padding: 12,
  },
  whichBody: { fontSize: 13, lineHeight: 19, ...fp('400'), color: D.muted },
  placeholder: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: D.border,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 22,
  },
  placeholderText: { textAlign: 'center', fontSize: 13, lineHeight: 21, ...fp('400'), color: D.faint },
  card: {
    backgroundColor: SY.surface,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.cardRadius,
    paddingHorizontal: D.cardPadding,
    paddingTop: 14,
    paddingBottom: 13,
  },
  planSummaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dataBlock: { flex: 1, minWidth: 0 },
  dataLabel: { fontSize: 19, lineHeight: 22, ...fp('700'), color: D.navy },
  dataHint: { marginTop: 2, fontSize: 12.5, lineHeight: 17, ...fp('400'), color: D.faint },
  priceBlock: { flexShrink: 0, alignItems: 'flex-end' },
  price: { fontSize: 22, lineHeight: 24, ...fp('700'), color: D.navy, textAlign: 'right' },
  perDay: { fontSize: 12.5, lineHeight: 17, ...fp('400'), color: D.faint, textAlign: 'right' },
  chev: { alignSelf: 'center', marginRight: -4 },
  benefitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: SY.primaryTint,
    borderWidth: 1,
    borderColor: SY.primaryTintBorder,
    borderRadius: D.cardRadius,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  promoText: { flex: 1, fontSize: 13, lineHeight: 17, ...fp('600'), color: SY.primaryDark },
  footnote: { marginTop: -4, fontSize: 12.5, lineHeight: 17, ...fp('400'), color: D.faint },
  skeletonBlock: { gap: 14 },
  loadingText: { fontSize: 13, ...fp('400'), color: D.faint },
  skeletonChips: { flexDirection: 'row', gap: 7 },
  skeletonChip: { width: 64, height: 40, borderRadius: 12, backgroundColor: D.skeleton },
  skeletonCard: {
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.cardRadius,
    backgroundColor: SY.surface,
    padding: D.cardPadding,
    gap: 10,
  },
  skeletonLine: { width: 120, height: 20, borderRadius: 6, backgroundColor: D.skeleton },
  errorWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 16 },
  errorIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: D.bannerBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorIconText: { fontSize: 24, ...fp('700'), color: D.coral },
  errorTitle: { fontSize: 15, ...fp('600'), color: D.navy, textAlign: 'center' },
  errorBody: { fontSize: 13, lineHeight: 20, ...fp('400'), color: D.faint, textAlign: 'center', maxWidth: 240 },
  retryBtn: {
    marginTop: 6,
    backgroundColor: D.coral,
    borderRadius: D.buttonRadius,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryBtnText: { color: '#fff', fontSize: 14, ...fp('600') },
});
