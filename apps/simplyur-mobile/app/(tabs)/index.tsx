import { Link, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  HOME_DESIGN as D,
  HOME_WHY_ICONS,
  HOME_WHY_KEYS,
} from '@/src/constants/home-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/**
 * design_handoff_home — Home tab [03]
 * REGRESSION-FREEZE[simplyur-inapp-surface-no-external-window]: no system browser — manifest
 * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: devices native screen — manifest
 * REGRESSION-FREEZE[simplyur-mobile-p1-account-settings]: settings entry — manifest
 */
export default function HomeScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  function onFindEsim() {
    router.push('/plans');
  }

  function openDevices() {
    router.push('/devices');
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: D.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 100 },
      ]}>
      <View style={styles.topRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{t('countries.kr.name').toUpperCase()}</Text>
        </View>
        <Pressable onPress={() => router.push('/settings')} hitSlop={10}>
          <Text style={styles.settingsLink}>{t('myEsim.settingsLink')}</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.heroLine1}>{t('hero.titleLine1')}</Text>
        <Text style={styles.heroLine2}>{t('hero.titleHighlight')}</Text>
        <Text style={styles.subtitle}>{t('hero.subtitle')}</Text>
      </View>

      <Pressable style={styles.cta} onPress={onFindEsim} accessibilityRole="button">
        <Text style={styles.ctaText}>{t('hero.cta')}</Text>
      </Pressable>

      <View style={styles.banner}>
        <View style={styles.bannerIcon}>
          <Text style={styles.bannerIconText}>i</Text>
        </View>
        <View style={styles.bannerText}>
          <Text style={styles.bannerTitle}>{t('recommend.bannerTitle')}</Text>
          <Text style={styles.bannerBody}>{t('recommend.bannerBody')}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>{t('why.title')}</Text>
      <View style={styles.whyList}>
        {HOME_WHY_KEYS.map((key) => (
          <View key={key} style={styles.whyCard}>
            <View style={styles.iconTile}>
              <Text style={styles.iconGlyph}>{HOME_WHY_ICONS[key]}</Text>
            </View>
            <View style={styles.whyText}>
              <Text style={styles.whyTitle}>{t(`why.items.${key}.title`)}</Text>
              <Text style={styles.whyBody}>{t(`why.items.${key}.body`)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.links}>
        <Link href="/guide" asChild>
          <Pressable hitSlop={8}>
            <Text style={styles.link}>{t('hero.guideLink')}</Text>
          </Pressable>
        </Link>
        <Pressable onPress={openDevices} hitSlop={8}>
          <Text style={styles.link}>{t('hero.deviceLink')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: D.paddingH, gap: D.sectionGap },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: D.navy,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, ...fp('700'), letterSpacing: 0.88, color: '#fff' },
  settingsLink: { fontSize: 13, ...fp('600'), color: D.coral },
  hero: { gap: 12 },
  heroLine1: { fontSize: 34, ...fp('800'), lineHeight: 39, letterSpacing: -0.34, color: D.navy },
  heroLine2: { fontSize: 34, ...fp('800'), lineHeight: 39, letterSpacing: -0.34, color: D.coral, marginTop: -8 },
  subtitle: { fontSize: 14, lineHeight: 22.4, ...fp('400'), color: D.muted, maxWidth: 320 },
  cta: {
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
  ctaText: { fontSize: 16, ...fp('600'), color: '#fff', letterSpacing: 0.16 },
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
  bannerIconText: { fontSize: 12, ...fp('700'), color: '#fff' },
  bannerText: { flex: 1, gap: 2 },
  bannerTitle: { fontSize: 13, ...fp('700'), color: D.navy },
  bannerBody: { fontSize: 12, lineHeight: 18, ...fp('400'), color: D.muted },
  sectionTitle: { fontSize: 15, ...fp('700'), color: D.navy },
  whyList: { gap: 10, marginTop: -12 },
  whyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: D.cardRadius,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  iconTile: {
    width: D.iconTileSize,
    height: D.iconTileSize,
    borderRadius: D.iconTileRadius,
    backgroundColor: D.iconTileBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: { fontSize: 16, color: D.coral },
  whyText: { flex: 1, gap: 2 },
  whyTitle: { fontSize: 14, ...fp('700'), color: D.navy },
  whyBody: { fontSize: 12.5, lineHeight: 18.75, ...fp('400'), color: D.muted },
  links: { flexDirection: 'row', gap: 22, paddingHorizontal: 2, paddingTop: 2 },
  link: { fontSize: 13, ...fp('600'), color: D.coral },
});
