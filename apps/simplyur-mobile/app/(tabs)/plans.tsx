import { Link } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchKoreaPlans, type CountryPack, type PlanProduct } from '@/src/api/simplyur';
import { PLANS_DESIGN as D } from '@/src/constants/plans-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import {
  collectAvailableDays,
  filterProductsByDays,
  formatPlanMessage,
  minFormattedPrice,
} from '@/src/lib/plans-catalog';

/** design_handoff_plans — duration-first Find my eSIM tab */
export default function PlansScreen() {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const chipsY = useRef(0);

  const [pack, setPack] = useState<CountryPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await fetchKoreaPlans(locale));
    } catch {
      setError('load failed');
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    load();
  }, [load]);

  const dayOptions = useMemo(() => (pack ? collectAvailableDays(pack) : []), [pack]);
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

  function scrollToChips() {
    scrollRef.current?.scrollTo({ y: Math.max(0, chipsY.current - 12), animated: true });
  }

  if (error && !pack) {
    return (
      <View style={[styles.root, { backgroundColor: D.bg, paddingTop: insets.top + 16 }]}>
        <View style={styles.errorWrap}>
          <View style={styles.errorIcon}>
            <Text style={styles.errorIconText}>!</Text>
          </View>
          <Text style={styles.errorTitle}>{t('recommend.errorTitle')}</Text>
          <Text style={styles.errorBody}>{t('recommend.errorBody')}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
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
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={D.coral} />}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('countries.kr.name').toUpperCase()}</Text>
        </View>
        <Text style={styles.title}>{t('recommend.title')}</Text>
        <Text style={styles.subtitle}>{t('recommend.subtitle')}</Text>
      </View>

      <InfoBanner t={t} />

      {loading && !pack ? (
        <View style={styles.skeletonBlock}>
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
              <View style={styles.skeletonBtn} />
            </View>
          ))}
        </View>
      ) : null}

      {pack ? (
        <>
          <View
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
            <Placeholder>{t('recommend.plansPlaceholder')}</Placeholder>
          ) : (
            <View style={styles.plansArea}>
              <View style={styles.selectedRow}>
                <Text style={styles.selectedText}>
                  {t('recommend.showingPlansPrefix')}
                  <Text style={styles.selectedDays}>{selectedDays}</Text>
                  {t('recommend.showingPlansSuffix')}
                </Text>
                <Pressable onPress={scrollToChips} hitSlop={8}>
                  <Text style={styles.changeLink}>{t('recommend.change')}</Text>
                </Pressable>
              </View>

              {showNoMatch ? (
                <Placeholder>{formatPlanMessage(t('recommend.noPlansForDays'), selectedDays)}</Placeholder>
              ) : (
                <>
                  <PlanSection
                    title={t('recommend.roaming')}
                    products={roamingFiltered}
                    fromLabel={minFormattedPrice(roamingFiltered)}
                    fromPrefix={t('recommend.fromPrice')}
                    t={t}
                  />
                  <PlanSection
                    title={t('recommend.local')}
                    products={localFiltered}
                    fromLabel={minFormattedPrice(localFiltered)}
                    fromPrefix={t('recommend.fromPrice')}
                    t={t}
                  />
                </>
              )}
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

function InfoBanner({ t }: { t: (k: string) => string }) {
  return (
    <View style={styles.banner}>
      <View style={styles.bannerIcon}>
        <Text style={styles.bannerIconText}>i</Text>
      </View>
      <View style={styles.bannerCopy}>
        <Text style={styles.bannerTitle}>{t('recommend.bannerTitle')}</Text>
        <Text style={styles.bannerBody}>{t('recommend.bannerBody')}</Text>
      </View>
    </View>
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
  return (
    <View style={styles.duration}>
      <Text style={styles.durationLabel}>{t('recommend.durationLabel')}</Text>
      <Text style={styles.durationHint}>{t('recommend.durationHint')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {options.map((d) => {
          const selected = value === d;
          return (
            <Pressable
              key={d}
              onPress={() => onChange(d)}
              style={[
                styles.chip,
                selected ? styles.chipSelected : styles.chipIdle,
              ]}>
              <Text style={[styles.chipText, selected ? styles.chipTextSelected : styles.chipTextIdle]}>
                {formatPlanMessage(t('recommend.durationChip'), d)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={styles.durationCaption}>{t('recommend.durationCaption')}</Text>
    </View>
  );
}

function Placeholder({ children }: { children: string }) {
  return (
    <View style={styles.placeholder}>
      <Text style={styles.placeholderText}>{children}</Text>
    </View>
  );
}

function PlanSection({
  title,
  products,
  fromLabel,
  fromPrefix,
  t,
}: {
  title: string;
  products: PlanProduct[];
  fromLabel: string | null;
  fromPrefix: string;
  t: (k: string) => string;
}) {
  if (products.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {fromLabel ? (
          <Text style={styles.fromPrice}>
            {fromPrefix} <Text style={styles.fromPriceValue}>{fromLabel}</Text>
          </Text>
        ) : null}
      </View>
      {products.map((p) => (
        <PlanCard key={p.option_api_id} plan={p} t={t} />
      ))}
    </View>
  );
}

function PlanCard({ plan, t }: { plan: PlanProduct; t: (k: string) => string }) {
  const perDay = plan.simplyur_display_per_day?.formatted;
  const perDayLabel = perDay && (plan.days ?? 0) >= 2
    ? t('recommend.perDay').replace('{amount}', perDay)
    : null;
  return (
    <View style={styles.card}>
      <View style={styles.planSummaryRow}>
        <Text style={styles.dataLabel}>{plan.data_label}</Text>
        <View style={styles.priceBlock}>
          <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit>
            {plan.simplyur_display?.formatted ?? '—'}
          </Text>
        {perDayLabel ? <Text style={styles.perDay}>{perDayLabel}</Text> : null}
        </View>
      </View>
      <Link href={{ pathname: '/product/[optionApiId]', params: { optionApiId: plan.option_api_id } }} asChild>
        <Pressable style={styles.selectBtn}>
          <Text style={styles.selectBtnText}>{t('recommend.selectPlan')}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: D.paddingH, gap: D.sectionGap },
  header: { gap: 10 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: D.navy,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { color: '#fff', fontSize: 11, ...fp('700'), letterSpacing: 0.8 },
  title: { fontSize: 26, ...fp('800'), color: D.navy, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, lineHeight: 21, ...fp('400'), color: D.muted },
  banner: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: D.bannerBg,
    borderWidth: 1,
    borderColor: D.bannerBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: D.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerIconText: { color: '#fff', fontSize: 12, ...fp('700') },
  bannerCopy: { flex: 1, gap: 2 },
  bannerTitle: { fontSize: 13, ...fp('700'), color: D.navy },
  bannerBody: { fontSize: 12, lineHeight: 18, ...fp('400'), color: D.muted },
  duration: { gap: 10 },
  durationLabel: { fontSize: 15, ...fp('600'), color: D.navy },
  durationHint: { fontSize: 12, ...fp('400'), color: D.muted },
  chipRow: { gap: 10, paddingVertical: 2 },
  chip: {
    height: D.chipHeight,
    minWidth: D.chipMinWidth,
    paddingHorizontal: 18,
    borderRadius: D.chipRadius,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  chipSelected: { backgroundColor: D.coral, borderColor: D.coral },
  chipIdle: { backgroundColor: 'transparent', borderColor: D.border },
  chipText: { fontSize: 14, ...fp('600') },
  chipTextSelected: { color: '#fff' },
  chipTextIdle: { color: D.faint },
  durationCaption: { fontSize: 11, ...fp('400'), color: D.faint },
  placeholder: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: D.border,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 22,
  },
  placeholderText: { textAlign: 'center', fontSize: 13, lineHeight: 21, ...fp('400'), color: D.faint },
  plansArea: { gap: 20 },
  selectedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectedText: { flex: 1, fontSize: 13, ...fp('400'), color: D.muted },
  selectedDays: { ...fp('700'), color: D.navy },
  changeLink: { fontSize: 13, ...fp('600'), color: D.coral },
  section: { gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontSize: 15, ...fp('700'), color: D.navy },
  fromPrice: { fontSize: 12, ...fp('600'), color: D.faint },
  fromPriceValue: { color: D.faint },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.cardRadius,
    padding: D.cardPadding,
    gap: 14,
  },
  planSummaryRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  dataLabel: { flex: 1, fontSize: 20, ...fp('800'), color: D.navy },
  priceBlock: { flexShrink: 0, alignItems: 'flex-end' },
  price: { fontSize: 26, ...fp('800'), color: D.coral, textAlign: 'right' },
  perDay: { marginTop: 5, fontSize: 13, ...fp('600'), color: D.faint, textAlign: 'right' },
  selectBtn: {
    height: D.buttonHeight,
    borderRadius: D.buttonRadius,
    backgroundColor: D.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectBtnText: { color: '#fff', fontSize: 16, ...fp('600') },
  skeletonBlock: { gap: 20 },
  loadingText: { fontSize: 13, ...fp('400'), color: D.faint },
  skeletonChips: { flexDirection: 'row', gap: 10 },
  skeletonChip: { width: 76, height: 48, borderRadius: 14, backgroundColor: D.skeleton },
  skeletonCard: {
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.cardRadius,
    backgroundColor: '#fff',
    padding: D.cardPadding,
    gap: 14,
  },
  skeletonLine: { width: 120, height: 22, borderRadius: 6, backgroundColor: D.skeleton },
  skeletonBtn: { height: 56, borderRadius: 16, backgroundColor: D.skeletonBtn },
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
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryBtnText: { color: '#fff', fontSize: 14, ...fp('600') },
});
