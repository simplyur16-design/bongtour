import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchKoreaProduct, type PlanProduct } from '@/src/api/simplyur';
import { PRODUCT_DESIGN as D, type ProductViewState } from '@/src/constants/product-design';
import { SIMPLYUR_CHECKOUT_ENABLED } from '@/src/constants/simplyur';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import {
  formatProductTitle,
  networkLabelFromFamily,
} from '@/src/lib/product-title';

/** design_handoff_product — Product detail [05] */
export default function ProductScreen() {
  const { optionApiId } = useLocalSearchParams<{ optionApiId: string }>();
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [product, setProduct] = useState<PlanProduct | null>(null);
  const [state, setState] = useState<ProductViewState>('loading');

  useEffect(() => {
    const id = String(optionApiId ?? '').trim();
    if (!id) {
      setState('not_found');
      return;
    }
    let cancelled = false;
    setState('loading');
    fetchKoreaProduct(id, locale)
      .then((p) => {
        if (cancelled) return;
        if (p) {
          setProduct(p);
          setState('loaded');
        } else {
          setState('not_found');
        }
      })
      .catch(() => {
        if (!cancelled) setState('not_found');
      });
    return () => {
      cancelled = true;
    };
  }, [optionApiId, locale]);

  const network =
    product != null
      ? networkLabelFromFamily(product.network_family, t('recommend.roaming'), t('recommend.local'))
      : '';

  const title =
    product != null
      ? formatProductTitle(locale, {
          days: product.days ?? null,
          dataLabel: product.data_label,
          networkLabel: network,
        })
      : '';

  const price = product?.simplyur_display?.formatted ?? '—';
  const perDay = product?.simplyur_display_per_day?.formatted;
  const perDayLabel = perDay
    ? t('recommend.perDay').replace('{amount}', perDay)
    : null;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: D.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 },
      ]}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
        <Text style={styles.backArrow}>←</Text>
        <Text style={styles.backText}>{t('product.backToPlans')}</Text>
      </Pressable>

      {state === 'loading' ? <LoadingSkeleton /> : null}

      {state === 'not_found' ? (
        <View style={styles.notFound}>
          <Text style={styles.notFoundIcon}>🔍</Text>
          <Text style={styles.notFoundTitle}>{t('product.notFoundTitle')}</Text>
          <Text style={styles.notFoundBody}>{t('product.notFoundBody')}</Text>
          <Link href="/plans" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.notFoundLink}>{t('product.backToPlans')}</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}

      {state === 'loaded' && product ? (
        <View style={styles.loaded}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{price}</Text>
            {perDayLabel ? <Text style={styles.perDay}>{perDayLabel}</Text> : null}
          </View>

          <View style={styles.panel}>
            <DetailRow label={t('product.network')} value={network} bordered />
            <DetailRow label={t('recommend.duration')} value={product.days_label} bordered />
            <DetailRow label={t('recommend.data')} value={product.data_label} />
          </View>

          {SIMPLYUR_CHECKOUT_ENABLED ? (
            <Link
              href={{ pathname: '/checkout', params: { optionApiId: product.option_api_id } }}
              asChild>
              <Pressable style={styles.ctaEnabled}>
                <Text style={styles.ctaEnabledText}>{t('product.buyNow')}</Text>
              </Pressable>
            </Link>
          ) : (
            <View style={styles.ctaBlock}>
              <View style={styles.ctaDisabled}>
                <Text style={styles.ctaDisabledText}>{t('product.checkoutSoon')}</Text>
              </View>
              <Text style={styles.ctaHint}>{t('product.checkoutSoonHint')}</Text>
            </View>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
  bordered,
}: {
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <View style={[styles.row, bordered && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function LoadingSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={[styles.skeletonLine, { width: '75%', height: 28 }]} />
      <View style={[styles.skeletonLine, { width: '45%', height: 38 }]} />
      <View style={[styles.skeletonLine, { width: '100%', height: 150, borderRadius: 18 }]} />
      <View style={[styles.skeletonLine, { width: '100%', height: 56, borderRadius: 16 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: D.paddingH, gap: D.sectionGap },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backArrow: { fontSize: 16, color: D.coral },
  backText: { fontSize: 13, ...fp('600'), color: D.coral },
  skeletonWrap: { gap: 16 },
  skeletonLine: { borderRadius: 8, backgroundColor: D.skeleton },
  notFound: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: D.border,
    borderRadius: 16,
    paddingHorizontal: 22,
    paddingVertical: 32,
    alignItems: 'center',
    gap: 10,
  },
  notFoundIcon: { fontSize: 28 },
  notFoundTitle: { fontSize: 15, ...fp('700'), color: D.navy },
  notFoundBody: {
    fontSize: 13,
    lineHeight: 20.8,
    ...fp('400'),
    color: D.muted,
    textAlign: 'center',
    maxWidth: 260,
  },
  notFoundLink: { marginTop: 6, fontSize: 13, ...fp('600'), color: D.coral },
  loaded: { gap: D.sectionGap },
  title: { fontSize: 24, ...fp('800'), lineHeight: 31, color: D.navy },
  price: { fontSize: 34, ...fp('800'), color: D.coral },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 },
  perDay: { fontSize: 14, ...fp('600'), color: D.faint },
  panel: {
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.cardRadius,
    backgroundColor: '#fff',
    paddingHorizontal: D.cardPadding,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: D.divider },
  rowLabel: { fontSize: 13, ...fp('400'), color: D.muted },
  rowValue: { fontSize: 14, ...fp('700'), color: D.navy },
  ctaBlock: { gap: 8 },
  ctaEnabled: {
    height: D.buttonHeight,
    borderRadius: D.buttonRadius,
    backgroundColor: D.coral,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: D.coral,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 13,
    elevation: 6,
  },
  ctaEnabledText: { fontSize: 16, ...fp('600'), color: '#fff' },
  ctaDisabled: {
    height: D.buttonHeight,
    borderRadius: D.buttonRadius,
    backgroundColor: D.disabledFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabledText: { fontSize: 16, ...fp('600'), color: D.faint },
  ctaHint: { fontSize: 12, lineHeight: 18, ...fp('400'), color: D.faint, textAlign: 'center' },
});
