import { Link } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { BRAND } from '@/src/constants/simplyur';
import { useI18n } from '@/src/i18n/I18nContext';

const WHY_KEYS = ['instant', 'support', 'refund'] as const;

export default function HomeScreen() {
  const { t } = useI18n();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  return (
    <ScrollView style={[styles.root, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.badge, { backgroundColor: colors.celadonLight, borderColor: colors.hanjiBorder }]}>
        <Text style={[styles.badgeText, { color: colors.celadonDark }]}>{t('countries.kr.name')}</Text>
      </View>

      <Text style={[styles.eyebrow, { color: colors.celadon }]}>{t('hero.eyebrow')}</Text>
      <Text style={[styles.title, { color: colors.text }]}>
        {t('hero.titleLine1')}{'\n'}
        <Text style={{ color: colors.dan }}>{t('hero.titleHighlight')}</Text>
      </Text>
      <Text style={[styles.subtitle, { color: colors.inkMuted }]}>{t('hero.subtitle')}</Text>

      <Link href="/plans" asChild>
        <Pressable style={[styles.cta, { backgroundColor: colors.dan }]}>
          <Text style={styles.ctaText}>{t('hero.cta')}</Text>
        </Pressable>
      </Link>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('why.title')}</Text>
      <View style={styles.whyGrid}>
        {WHY_KEYS.map((key) => (
          <View key={key} style={[styles.whyCard, { borderColor: colors.hanjiBorder, backgroundColor: colors.celadonLight }]}>
            <Text style={[styles.whyCardTitle, { color: colors.text }]}>{t(`why.items.${key}.title`)}</Text>
            <Text style={[styles.whyCardBody, { color: colors.inkMuted }]}>{t(`why.items.${key}.body`)}</Text>
          </View>
        ))}
      </View>

      <Link href="/modal" asChild>
        <Pressable style={styles.langLink}>
          <Text style={{ color: colors.celadon }}>{t('language.label')} →</Text>
        </Pressable>
      </Link>

      <Text style={[styles.footer, { color: colors.inkMuted }]}>{BRAND.parent}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { marginTop: 8, fontSize: 32, fontWeight: '800', lineHeight: 38 },
  subtitle: { marginTop: 12, fontSize: 16, lineHeight: 24 },
  cta: { marginTop: 24, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  sectionTitle: { marginTop: 36, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  whyGrid: { marginTop: 16, gap: 10 },
  whyCard: { borderRadius: 14, borderWidth: 1, padding: 16 },
  whyCardTitle: { fontSize: 15, fontWeight: '700' },
  whyCardBody: { marginTop: 6, fontSize: 13, lineHeight: 19 },
  langLink: { marginTop: 24, alignSelf: 'flex-start' },
  footer: { marginTop: 32, fontSize: 12, textAlign: 'center' },
});
