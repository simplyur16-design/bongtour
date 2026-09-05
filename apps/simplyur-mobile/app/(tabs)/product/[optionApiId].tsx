import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchKoreaProduct, openSimplyurInAppCheckout, type PlanProduct } from '@/src/api/simplyur';
import {
  SimplyurBackRow,
  SimplyurDockCta,
  simplyurDockScrollPad,
  simplyurScreenPadTop,
} from '@/src/components/SimplyurDockCta';
import { PRODUCT_DESIGN as D, type ProductViewState } from '@/src/constants/product-design';
import { isSimplyurCheckoutEnabled } from '@/src/constants/simplyur';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import {
  formatProductTitle,
  networkLabelFromFamily,
} from '@/src/lib/product-title';

/** design_handoff_product — Product detail [05] */
// REGRESSION-FREEZE[simplyur-product-detail-same-catalog-pipe]: 5xx ≠ Plan not found — manifest
// REGRESSION-FREEZE[simplyur-purchase-dock-cta]: docked buy CTA — manifest
export default function ProductScreen() {
  const { optionApiId } = useLocalSearchParams<{ optionApiId: string }>();
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [product, setProduct] = useState<PlanProduct | null>(null);
  const [state, setState] = useState<ProductViewState>('loading');
  const [openingPay, setOpeningPay] = useState(false);
  const checkoutEnabled = isSimplyurCheckoutEnabled();

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
      .catch((e) => {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : '';
        setState(/API (5\d\d|429)/.test(msg) ? 'unavailable' : 'not_found');
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
  const perDay =
    (product?.days ?? 0) >= 2 ? product?.simplyur_display_per_day?.formatted : null;
  const perDayLabel = perDay
    ? t('recommend.perDay').replace('{amount}', perDay)
    : null;

  const onBuy = () => {
    if (!product || openingPay) return;
    setOpeningPay(true);
    openSimplyurInAppCheckout(product.option_api_id);
    setOpeningPay(false);
  };

  const showDock = state === 'loaded' && product != null;
  const dockHint = showDock
    ? checkoutEnabled
      ? t('product.payInAppHint')
      : t('product.checkoutSoonHint')
    : undefined;

  return (
    <View style={[styles.root, { backgroundColor: D.bg }]}>
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: simplyurScreenPadTop(insets.top),
          paddingBottom: showDock
            ? simplyurDockScrollPad(insets.bottom)
            : insets.bottom + 40,
        },
      ]}>
      <SimplyurBackRow label={t('product.backToPlans')} onPress={() => router.back()} />

      {state === 'loading' ? <LoadingSkeleton /> : null}

      {state === 'unavailable' ? (
        <View style={styles.notFound}>
          <Text style={styles.notFoundTitle}>{t('recommend.errorTitle')}</Text>
          <Text style={styles.notFoundBody}>{t('recommend.errorBody')}</Text>
          <Link href="/plans" asChild>
            <Pressable hitSlop={8}>
              <Text style={styles.notFoundLink}>{t('recommend.retry')}</Text>
            </Pressable>
          </Link>
        </View>
      ) : null}

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
        </View>
      ) : null}
    </ScrollView>
      {showDock ? (
        checkoutEnabled ? (
          <SimplyurDockCta
            label={openingPay ? t('checkout.processing') : t('product.buyNow')}
            hint={t('product.payInAppHint')}
            onPress={() => void onBuy()}
            busy={openingPay}
            bottomInset={insets.bottom}
          />
        ) : (
          <SimplyurDockCta
            label={t('product.checkoutSoon')}
            hint={t('product.checkoutSoonHint')}
            onPress={() => undefined}
            disabled
            bottomInset={insets.bottom}
          />
        )
      ) : null}
    </View>
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
});
