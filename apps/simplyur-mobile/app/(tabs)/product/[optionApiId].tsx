import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fetchKoreaProduct, openSimplyurInAppCheckout, type PlanProduct } from '@/src/api/simplyur';
import {
  SimplyurDockCta,
  simplyurDockScrollPad,
  simplyurScreenPadTop,
} from '@/src/components/SimplyurDockCta';
import { EsimMarkTile, IconButton, ListItem } from '@/src/components/ui/SyUi';
import { SY, SY_RADIUS } from '@/src/constants/theme';
import { PRODUCT_DESIGN as D, type ProductViewState } from '@/src/constants/product-design';
import { isSimplyurCheckoutEnabled } from '@/src/constants/simplyur';
import { fp } from '@/src/constants/typography';
import { SyIcon } from '@/src/components/ui/SyIcon';
import { useI18n } from '@/src/i18n/I18nContext';
import {
  formatProductTitle,
  networkLabelFromFamily,
} from '@/src/lib/product-title';

/**
 * design_handoff_product — Product detail [05]
 * Proposal 4: "What's included" + "Before you buy" (eSIM / unlock check) so buyers can decide here.
 * 1.0.2 (mockup 03-detail-after): header (back · Korea · days · share), mark card, big USD price,
 * icon list for inclusions, warn strip for device check. All values come from the catalog API.
 */
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
  const currency = product?.simplyur_display?.currency ?? '';
  const perDayLabel = perDay
    ? t('product.perDayUnit').replace('{currency}', currency).replace('{amount}', perDay)
    : currency || null;
  const isDaily = product?.plan_type === 'daily';

  const onShare = () => {
    if (!product) return;
    void Share.share({ message: `simplyur eSIM · ${title} · ${price}` }).catch(() => undefined);
  };

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
      <View style={styles.header}>
        <IconButton name="back" label={t('product.backToPlans')} onPress={() => router.back()} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {product ? t('product.headerTitle').replace('{days}', product.days_label) : ''}
        </Text>
        {product ? (
          <IconButton name="share" label={t('product.share')} onPress={onShare} />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

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
          <View style={styles.heroCard}>
            <EsimMarkTile size={64} />
            <View style={styles.heroText}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.heroSub}>
                {network ? `${network} · ` : ''}
                {t('product.validityNote')}
              </Text>
            </View>
          </View>

          <View>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{price}</Text>
              {perDayLabel ? <Text style={styles.perDay}>{perDayLabel}</Text> : null}
            </View>
            <View style={styles.promoTag}>
              <Text style={styles.promoTagText}>{t('product.firstOrderTag')}</Text>
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{t('product.includedTitle')}</Text>
            <ListItem
              icon="signal"
              title={product.data_label}
              sub={
                product.data_hint ??
                (isDaily ? t('product.dailyResetSub').replace('{days}', product.days_label) : null)
              }
            />
            {product.free_apps_data ? (
              <ListItem icon="map" tone="ok" title={t('product.freeApps')} sub={t('product.freeAppsNote')} />
            ) : null}
            {product.hotspot_note ? (
              <ListItem
                icon="wifi"
                title={t('product.hotspotShort').replace(/\*$/, '')}
                sub={product.hotspot_note}
              />
            ) : null}
            <ListItem icon="qr" title={t('product.qrTitle')} sub={t('product.qrDeliveryValue')} />
            {product.unused_refund ? (
              <Pressable
                onPress={() => router.push({ pathname: '/legal', params: { doc: 'refund' } })}
                accessibilityRole="link">
                <ListItem icon="refund" title={t('product.unusedRefund')} sub={t('product.refundPolicyLink')} />
              </Pressable>
            ) : null}
          </View>

          <Pressable
            style={styles.checkCard}
            onPress={() => router.push('/devices')}
            accessibilityRole="link"
            accessibilityLabel={t('product.checkDevicesLink')}>
            <View style={styles.checkIcon}>
              <SyIcon name="phone" size={16} color={SY.warn} strokeWidth={2} />
            </View>
            <Text style={styles.checkBody}>{t('product.checkBody')}</Text>
            <Text style={styles.checkLink}>{t('product.checkShort')}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
      {showDock ? (
        checkoutEnabled ? (
          <SimplyurDockCta
            label={
              openingPay
                ? t('checkout.processing')
                : product?.simplyur_display?.formatted
                  ? `${t('product.buyNow')} · ${product.simplyur_display.formatted}`
                  : t('product.buyNow')
            }
            hint={t('product.payHint')}
            hintIcon="lock"
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

function LoadingSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={[styles.skeletonLine, { width: '100%', height: 96, borderRadius: 18 }]} />
      <View style={[styles.skeletonLine, { width: '45%', height: 38 }]} />
      <View style={[styles.skeletonLine, { width: '100%', height: 220, borderRadius: 18 }]} />
      <View style={[styles.skeletonLine, { width: '100%', height: 56, borderRadius: 16 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: D.paddingH, gap: D.sectionGap },
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 14, ...fp('600'), color: D.muted },
  headerSpacer: { width: 36 },
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
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.cardRadius,
    backgroundColor: SY.surface,
    padding: D.cardPadding + 2,
  },
  heroText: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 22, ...fp('700'), lineHeight: 27, color: D.navy, letterSpacing: -0.2 },
  heroSub: { fontSize: 13, lineHeight: 18, ...fp('400'), color: D.muted },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 6 },
  price: { fontSize: 34, ...fp('700'), color: D.navy, letterSpacing: -0.5 },
  perDay: { fontSize: 13.5, ...fp('400'), color: D.faint },
  promoTag: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: SY.primaryTint,
    borderRadius: SY_RADIUS.tag,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  promoTagText: { fontSize: 12.5, ...fp('600'), color: SY.primaryDark },
  panel: {
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.cardRadius,
    backgroundColor: SY.surface,
    paddingHorizontal: D.cardPadding + 2,
    paddingTop: 8,
    paddingBottom: 18,
    gap: 14,
  },
  panelTitle: { fontSize: 16, ...fp('700'), color: D.navy, paddingTop: 10 },
  checkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: SY.warnBorder,
    borderRadius: D.cardRadius,
    backgroundColor: SY.warnTint,
    paddingHorizontal: D.cardPadding,
    paddingVertical: 14,
  },
  checkIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: SY.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBody: { flex: 1, fontSize: 13.5, lineHeight: 19, ...fp('600'), color: SY.warnText },
  checkLink: { fontSize: 13.5, ...fp('700'), color: SY.warn },
});
