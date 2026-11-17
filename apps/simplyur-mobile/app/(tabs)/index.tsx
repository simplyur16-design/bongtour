import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchKoreaPlans, type CountryPack } from '@/src/api/simplyur';
import { HomeLanguageChip } from '@/src/components/HomeLanguageChip';
import { OfflineBanner } from '@/src/components/OfflineBanner';
import { SyIcon, type SyIconName } from '@/src/components/ui/SyIcon';
import { EsimWordmark, IconButton } from '@/src/components/ui/SyUi';
import { HOME_DESIGN as D } from '@/src/constants/home-design';
import { SY } from '@/src/constants/theme';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import {
  SIMPLYUR_KOREA_DEFAULT_TRIP_DAYS,
  collectAvailableDays,
  filterProductsByDays,
  formatPlanCount,
  minFormattedPrice,
  snapTripDaysToAvailable,
} from '@/src/lib/plans-catalog';

/** Mockup chips: 3 · 5 · 7 · 10 · More — only lengths we actually sell are shown. */
const HOME_DAY_CHOICES = [3, 5, 7, 10] as const;

/**
 * 1.0.2 Home — redesign mockup 01 (ink hero card, trip-length chips → plans, benefit tiles).
 * Prices and benefit tiles come from the live catalog; nothing is hardcoded.
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: no system browser — manifest
 * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: devices native screen — manifest
 * REGRESSION-FREEZE[simplyur-mobile-p1-account-settings]: settings entry — manifest
 * REGRESSION-FREEZE[simplyur-mobile-p2-polish]: offline banner — manifest
 * REGRESSION-FREEZE[simplyur-mobile-home-language]: language chip on home — manifest
 */
export default function HomeScreen() {
  const { t, locale, ready } = useI18n();
  const insets = useSafeAreaInsets();
  const [pack, setPack] = useState<CountryPack | null>(null);
  const [days, setDays] = useState<number>(SIMPLYUR_KOREA_DEFAULT_TRIP_DAYS);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetchKoreaPlans(locale)
      .then((p) => {
        if (!cancelled) setPack(p);
      })
      .catch(() => {
        if (!cancelled) setPack(null);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, ready]);

  const available = useMemo(() => (pack ? collectAvailableDays(pack) : []), [pack]);
  const chips = useMemo(() => {
    if (available.length === 0) return [...HOME_DAY_CHOICES];
    const sold = HOME_DAY_CHOICES.filter((d) => available.includes(d));
    return sold.length > 0 ? sold : available.slice(0, 4);
  }, [available]);

  useEffect(() => {
    if (chips.length === 0) return;
    if (chips.includes(days as (typeof chips)[number])) return;
    const snapped = snapTripDaysToAvailable(SIMPLYUR_KOREA_DEFAULT_TRIP_DAYS, chips);
    if (snapped != null) setDays(snapped);
  }, [chips, days]);

  const allProducts = useMemo(
    () => (pack ? [...pack.roaming.products, ...(pack.local?.products ?? [])] : []),
    [pack],
  );
  const fromPrice = useMemo(
    () => (allProducts.length ? minFormattedPrice(filterProductsByDays(allProducts, days)) : null),
    [allProducts, days],
  );
  const hasFreeApps = allProducts.some((p) => p.free_apps_data);
  const hasUnusedRefund = allProducts.some((p) => p.unused_refund);

  const ctaBase = formatPlanCount(t, 'home.ctaDays', days);
  const cta = fromPrice ? `${ctaBase} · ${t('home.fromPrice').replace('{price}', fromPrice)}` : ctaBase;

  function openPlans(d?: number) {
    if (d == null) router.push('/plans');
    else router.push({ pathname: '/plans', params: { days: String(d) } });
  }

  function openDevices() {
    router.push('/devices');
  }

  const tiles: { key: string; icon: SyIconName; top: string; bottom: string; ok?: boolean }[] = [];
  if (hasFreeApps) {
    tiles.push({ key: 'free', icon: 'map', top: t('home.tileFreeTop'), bottom: t('home.tileFreeBottom'), ok: true });
  }
  if (hasUnusedRefund) {
    tiles.push({ key: 'refund', icon: 'refund', top: t('home.tileRefundTop'), bottom: t('home.tileRefundBottom') });
  }
  tiles.push({ key: 'pay', icon: 'lock', top: t('home.tilePayTop'), bottom: t('home.tilePayBottom') });

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: D.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 100 },
      ]}>
      <OfflineBanner />
      <View style={styles.header}>
        <EsimWordmark height={26} />
        <View style={styles.headerActions}>
          <HomeLanguageChip />
          <IconButton
            name="help"
            label={t('myEsim.settingsLink')}
            onPress={() => router.push('/settings')}
          />
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.heroGlow} pointerEvents="none">
          <SyIcon name="wifi" size={190} color={SY.primaryLight} strokeWidth={1.2} />
        </View>
        <Text style={styles.eyebrow}>{t('home.koreaBadge')}</Text>
        <Text style={styles.heroTitle}>{t('home.heroTitle')}</Text>
        <Text style={styles.heroBody}>{t('home.heroBody')}</Text>
        <Text style={styles.daysQ}>{t('home.daysQuestion')}</Text>
        <View style={styles.dayRow}>
          {chips.map((d) => {
            const on = d === days;
            return (
              <Pressable
                key={d}
                onPress={() => setDays(d)}
                style={[styles.dayChip, on && styles.dayChipOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={formatPlanCount(t, 'recommend.durationChip', d)}>
                <Text style={[styles.dayChipText, on && styles.dayChipTextOn]}>{d}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => openPlans()} style={styles.dayChip} accessibilityRole="button">
            <Text style={styles.dayChipText} numberOfLines={1}>
              {t('home.daysMore')}
            </Text>
          </Pressable>
        </View>
        <Pressable style={styles.cta} onPress={() => openPlans(days)} accessibilityRole="button">
          <Text style={styles.ctaText} numberOfLines={1} adjustsFontSizeToFit>
            {cta}
          </Text>
        </Pressable>
      </View>

      <View style={styles.tiles}>
        {tiles.map((tile) => (
          <View key={tile.key} style={styles.tile}>
            <View style={[styles.tileIcon, tile.ok && { backgroundColor: SY.okTint }]}>
              <SyIcon name={tile.icon} size={16} color={tile.ok ? SY.ok : SY.primary} strokeWidth={2} />
            </View>
            <Text style={styles.tileText}>
              {tile.top}
              {'\n'}
              <Text style={tile.ok ? styles.tileOk : null}>{tile.bottom}</Text>
            </Text>
          </View>
        ))}
      </View>

      <Pressable style={styles.deviceCard} onPress={openDevices} accessibilityRole="button">
        <View style={styles.deviceIcon}>
          <SyIcon name="phone" size={16} color={SY.primary} strokeWidth={2} />
        </View>
        <View style={styles.deviceText}>
          <Text style={styles.deviceTitle}>{t('home.deviceTitle')}</Text>
          <Text style={styles.deviceBody}>{t('home.deviceBody')}</Text>
        </View>
        <SyIcon name="chev" size={18} color={SY.ink3} strokeWidth={2} />
      </Pressable>

      <Pressable style={styles.steps} onPress={() => router.push('/guide')} accessibilityRole="button">
        {[t('home.step1'), t('home.step2'), t('home.step3')].map((label, i) => (
          <View key={label} style={styles.stepItem}>
            {i > 0 ? <Text style={styles.stepDash}>—</Text> : null}
            <Text style={styles.stepNum}>{i + 1}</Text>
            <Text style={styles.stepLabel}>{label}</Text>
          </View>
        ))}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: D.paddingH, gap: D.sectionGap },
  header: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hero: {
    backgroundColor: SY.ink,
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  heroGlow: { position: 'absolute', right: -30, top: -30, opacity: 0.16 },
  eyebrow: {
    fontSize: 11.5,
    ...fp('700'),
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: SY.primaryOnDark,
  },
  heroTitle: { marginTop: 8, fontSize: 30, lineHeight: 34, letterSpacing: -0.4, ...fp('700'), color: '#fff' },
  heroBody: { marginTop: 8, fontSize: 14.5, lineHeight: 20, ...fp('400'), color: SY.onInkBody },
  daysQ: { marginTop: 18, marginBottom: 9, fontSize: 13, ...fp('600'), color: '#fff' },
  dayRow: { flexDirection: 'row', gap: 7 },
  dayChip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SY.onInkLine,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dayChipOn: { backgroundColor: '#fff', borderColor: '#fff' },
  dayChipText: { fontSize: 14.5, ...fp('600'), color: '#fff' },
  dayChipTextOn: { color: SY.ink },
  cta: {
    marginTop: 14,
    height: D.buttonHeight,
    borderRadius: D.buttonRadius,
    backgroundColor: SY.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  ctaText: { fontSize: 16.5, ...fp('700'), color: '#fff' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    backgroundColor: SY.surface,
    borderWidth: 1,
    borderColor: SY.line,
    borderRadius: D.cardRadius,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  tileIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: SY.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { marginTop: 7, fontSize: 12.5, lineHeight: 15, ...fp('700'), color: SY.ink, textAlign: 'center' },
  tileOk: { color: SY.ok },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: SY.surface,
    borderWidth: 1,
    borderColor: SY.line,
    borderRadius: D.cardRadius,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  deviceIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: SY.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceText: { flex: 1 },
  deviceTitle: { fontSize: 15, lineHeight: 20, ...fp('700'), color: SY.ink },
  deviceBody: { fontSize: 12.5, lineHeight: 17, ...fp('400'), color: SY.ink3 },
  steps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    rowGap: 4,
    backgroundColor: SY.surface,
    borderWidth: 1,
    borderColor: SY.line,
    borderRadius: D.cardRadius,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  stepItem: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 6 },
  stepDash: { fontSize: 13, color: SY.line },
  stepNum: { fontSize: 13, ...fp('700'), color: SY.primary },
  stepLabel: { fontSize: 13, lineHeight: 16, ...fp('600'), color: SY.ink },
});
