import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { fetchKoreaProduct, type PlanProduct } from '@/src/api/simplyur';
import { SIMPLYUR_CHECKOUT_ENABLED } from '@/src/constants/simplyur';
import { useI18n } from '@/src/i18n/I18nContext';

export default function ProductScreen() {
  const { optionApiId } = useLocalSearchParams<{ optionApiId: string }>();
  const { t, locale } = useI18n();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [product, setProduct] = useState<PlanProduct | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = String(optionApiId ?? '').trim();
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
  }, [optionApiId, locale]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.celadon} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Text style={{ color: colors.inkMuted }}>{t('product.notFound')}</Text>
        <Link href="/plans" asChild>
          <Pressable style={{ marginTop: 16 }}>
            <Text style={{ color: colors.dan }}>{t('product.backToPlans')}</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  const network =
    (product.network_family || '').toLowerCase() === 'local'
      ? t('recommend.local')
      : t('recommend.roaming');

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.badge, { color: colors.celadonDark }]}>{t('countries.kr.name')}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{product.plan_summary}</Text>
      <Text style={[styles.price, { color: colors.dan }]}>{product.simplyur_display?.formatted ?? '—'}</Text>

      <View style={[styles.panel, { borderColor: colors.hanjiBorder, backgroundColor: colors.celadonLight }]}>
        <Text style={[styles.panelTitle, { color: colors.text }]}>{t('product.details')}</Text>
        <Text style={[styles.row, { color: colors.inkMuted }]}>
          {t('product.network')}: <Text style={{ color: colors.text }}>{network}</Text>
        </Text>
      </View>

      {SIMPLYUR_CHECKOUT_ENABLED ? (
        <Link
          href={{
            pathname: '/checkout',
            params: { optionApiId: product.option_api_id },
          }}
          asChild>
          <Pressable style={[styles.cta, { backgroundColor: colors.dan }]}>
            <Text style={styles.ctaText}>{t('product.buyNow')}</Text>
          </Pressable>
        </Link>
      ) : (
        <>
          <View style={[styles.cta, { backgroundColor: colors.inkMuted, opacity: 0.85 }]}>
            <Text style={styles.ctaText}>{t('product.checkoutSoon')}</Text>
          </View>
          <Text style={[styles.hint, { color: colors.inkMuted }]}>{t('product.checkoutSoonHint')}</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  badge: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  title: { marginTop: 8, fontSize: 24, fontWeight: '800', lineHeight: 30 },
  price: { marginTop: 8, fontSize: 28, fontWeight: '800' },
  panel: { marginTop: 24, borderRadius: 14, borderWidth: 1, padding: 16 },
  panelTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  row: { fontSize: 14, lineHeight: 22 },
  cta: { marginTop: 24, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  hint: { marginTop: 10, fontSize: 13, lineHeight: 19, textAlign: 'center' },
});
