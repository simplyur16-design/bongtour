import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { fetchKoreaProduct, openSimplyurWebCheckout, type PlanProduct } from '@/src/api/simplyur';
import { isSimplyurCheckoutEnabled } from '@/src/constants/simplyur';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/** Bridge screen — opens web Eximbay checkout (mobile UI). Native pay is Phase 2c. */
export default function CheckoutScreen() {
  const { optionApiId } = useLocalSearchParams<{ optionApiId: string }>();
  const { t, locale } = useI18n();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [product, setProduct] = useState<PlanProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const checkoutEnabled = isSimplyurCheckoutEnabled();
  const id = String(optionApiId ?? '').trim();

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchKoreaProduct(id, locale)
      .then((p) => {
        if (!cancelled) setProduct(p);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, locale]);

  const openPay = useCallback(async () => {
    if (!id || opening) return;
    setOpening(true);
    try {
      await openSimplyurWebCheckout(locale, id);
    } finally {
      setOpening(false);
    }
  }, [id, locale, opening]);

  useEffect(() => {
    if (!checkoutEnabled || loading || !id) return;
    void openPay();
    // Auto-open once when ready
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot on load
  }, [checkoutEnabled, loading, id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.celadon} />
      </View>
    );
  }

  if (!checkoutEnabled) {
    return (
      <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{t('checkout.title')}</Text>
        <View style={[styles.banner, { backgroundColor: colors.danMuted, borderColor: colors.hanjiBorder }]}>
          <Text style={[styles.bannerTitle, { color: colors.dan }]}>{t('product.checkoutSoon')}</Text>
          <Text style={[styles.bannerBody, { color: colors.text }]}>{t('product.checkoutSoonHint')}</Text>
        </View>
        <Link href="/plans" asChild>
          <Pressable style={{ marginTop: 20 }}>
            <Text style={{ color: colors.celadon, ...fp('600') }}>{t('product.backToPlans')}</Text>
          </Pressable>
        </Link>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>{t('checkout.title')}</Text>
      {product ? (
        <Text style={[styles.sub, { color: colors.inkMuted }]}>
          {product.plan_summary} · {product.simplyur_display?.formatted}
        </Text>
      ) : null}
      <Text style={[styles.bannerBody, { color: colors.inkMuted, marginTop: 16 }]}>
        {t('product.payInBrowserHint')}
      </Text>
      <Pressable
        style={[styles.cta, { backgroundColor: colors.dan, opacity: opening ? 0.7 : 1 }]}
        onPress={() => void openPay()}
        disabled={opening || !id}>
        <Text style={styles.ctaText}>
          {opening ? t('checkout.processing') : t('checkout.continueInBrowser')}
        </Text>
      </Pressable>
      <Link href="/plans" asChild>
        <Pressable style={{ marginTop: 20 }}>
          <Text style={{ color: colors.celadon, ...fp('600') }}>{t('product.backToPlans')}</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, ...fp('800') },
  sub: { marginTop: 8, fontSize: 15, ...fp('400') },
  banner: { marginTop: 24, borderRadius: 14, borderWidth: 1, padding: 16 },
  bannerTitle: { fontSize: 17, ...fp('800') },
  bannerBody: { marginTop: 8, fontSize: 14, lineHeight: 21, ...fp('400') },
  cta: {
    marginTop: 24,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, ...fp('600') },
});
