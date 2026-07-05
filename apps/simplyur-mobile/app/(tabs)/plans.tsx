import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { fetchKoreaPlans, type CountryPack, type PlanProduct } from '@/src/api/simplyur';
import { useI18n } from '@/src/i18n/I18nContext';

export default function PlansScreen() {
  const { t, locale } = useI18n();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];
  const [pack, setPack] = useState<CountryPack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPack(await fetchKoreaPlans(locale));
    } catch {
      setError('Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.celadon} />}>
      <View style={[styles.badge, { backgroundColor: colors.celadonLight, borderColor: colors.hanjiBorder }]}>
        <Text style={[styles.badgeText, { color: colors.celadonDark }]}>{t('countries.kr.name')}</Text>
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{t('recommend.title')}</Text>
      <Text style={[styles.sub, { color: colors.inkMuted }]}>{t('recommend.koreaOnly')}</Text>
      <View style={[styles.notice, { backgroundColor: colors.danMuted, borderColor: colors.hanjiBorder }]}>
        <Text style={[styles.noticeText, { color: colors.text }]}>
          {t('product.checkoutSoon')} — {t('product.checkoutSoonHint')}
        </Text>
      </View>

      {loading && !pack ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.celadon} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {pack ? (
        <>
          <PlanSection title={t('recommend.roaming')} pack={pack.roaming} colors={colors} t={t} />
          {pack.local ? <PlanSection title={t('recommend.local')} pack={pack.local} colors={colors} t={t} /> : null}
        </>
      ) : null}
    </ScrollView>
  );
}

function PlanCard({
  plan,
  colors,
  t,
}: {
  plan: PlanProduct;
  colors: (typeof Colors)['light'] | (typeof Colors)['dark'];
  t: (k: string) => string;
}) {
  return (
    <View style={[styles.card, { borderColor: colors.hanjiBorder }]}>
      <View style={styles.badges}>
        <View style={[styles.chip, { backgroundColor: colors.celadonLight }]}>
          <Text style={[styles.chipText, { color: colors.celadonDark }]}>{plan.data_label}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.danMuted }]}>
          <Text style={[styles.chipText, { color: colors.dan }]}>{plan.days_label}</Text>
        </View>
      </View>
      <Text style={[styles.price, { color: colors.dan }]}>{plan.simplyur_display?.formatted ?? '—'}</Text>
      <Link href={{ pathname: '/product/[optionApiId]', params: { optionApiId: plan.option_api_id } }} asChild>
        <Pressable style={[styles.selectBtn, { backgroundColor: colors.dan }]}>
          <Text style={styles.selectBtnText}>{t('recommend.selectPlan')}</Text>
        </Pressable>
      </Link>
    </View>
  );
}

function PlanSection({
  title,
  pack,
  colors,
  t,
}: {
  title: string;
  pack: CountryPack['roaming'];
  colors: (typeof Colors)['light'] | (typeof Colors)['dark'];
  t: (k: string) => string;
}) {
  if (pack.products.length === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        {pack.min_display ? (
          <Text style={[styles.fromPrice, { color: colors.inkMuted }]}>
            {t('recommend.fromPrice')}{' '}
            <Text style={{ color: colors.dan, fontWeight: '700' }}>{pack.min_display.formatted}</Text>
          </Text>
        ) : null}
      </View>
      {pack.products.map((p) => (
        <PlanCard key={p.option_api_id} plan={p} colors={colors} t={t} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '800' },
  sub: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  notice: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  noticeText: { fontSize: 13, lineHeight: 19 },
  error: { marginTop: 16, color: '#B91C1C' },
  section: { marginTop: 24 },
  sectionHead: { marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  fromPrice: { marginTop: 4, fontSize: 13 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 10,
  },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: '700' },
  price: { marginTop: 12, fontSize: 22, fontWeight: '800' },
  selectBtn: { marginTop: 14, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  selectBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
