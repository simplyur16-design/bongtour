import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { fetchKoreaProduct, type PlanProduct } from '@/src/api/simplyur';
import { useI18n } from '@/src/i18n/I18nContext';

export default function CheckoutScreen() {
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

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>{t('checkout.title')}</Text>
      {product ? (
        <Text style={[styles.sub, { color: colors.inkMuted }]}>
          {product.plan_summary} · {product.simplyur_display?.formatted}
        </Text>
      ) : null}
      <View style={[styles.banner, { backgroundColor: colors.danMuted, borderColor: colors.hanjiBorder }]}>
        <Text style={[styles.bannerTitle, { color: colors.dan }]}>{t('product.checkoutSoon')}</Text>
        <Text style={[styles.bannerBody, { color: colors.text }]}>{t('product.checkoutSoonHint')}</Text>
      </View>
      <Link href="/plans" asChild>
        <Pressable style={{ marginTop: 20 }}>
          <Text style={{ color: colors.celadon, fontWeight: '600' }}>{t('product.backToPlans')}</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800' },
  sub: { marginTop: 8, fontSize: 15 },
  banner: { marginTop: 24, borderRadius: 14, borderWidth: 1, padding: 16 },
  bannerTitle: { fontSize: 17, fontWeight: '800' },
  bannerBody: { marginTop: 8, fontSize: 14, lineHeight: 21 },
});
