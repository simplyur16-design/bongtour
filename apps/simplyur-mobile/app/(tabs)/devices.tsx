import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SyIcon } from '@/src/components/ui/SyIcon';
import { ScreenHeader } from '@/src/components/ui/SyUi';
import { SY, SY_RADIUS } from '@/src/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LOGIN_1B } from '@/src/constants/login-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/**
 * Native compatible-devices screen — no website chrome.
 * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: devices native — manifest
 */
export default function DevicesScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: LOGIN_1B.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
      ]}>
      <ScreenHeader title={t('devices.title')} backLabel={t('product.backToPlans')} onBack={() => router.back()} />

      <Text style={styles.intro}>{t('devices.intro')}</Text>

      {/* Ink card (mockup hero style): the one check that works on every phone. */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <SyIcon name="phone" size={20} color="#fff" strokeWidth={2} />
        </View>
        <Text style={styles.heroText}>{t('product.checkDial')}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.iconTile}>
            <SyIcon name="phone" size={16} color={SY.primary} strokeWidth={2} />
          </View>
          <Text style={styles.cardLabel}>iPhone</Text>
        </View>
        <Text style={styles.cardBody}>{t('devices.iphone')}</Text>
        <Text style={styles.cardSub}>{t('product.checkIos')}</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.iconTile}>
            <SyIcon name="phone" size={16} color={SY.primary} strokeWidth={2} />
          </View>
          <Text style={styles.cardLabel}>Android</Text>
        </View>
        <Text style={styles.cardBody}>{t('devices.android')}</Text>
        <Text style={styles.cardSub}>{t('product.checkAndroid')}</Text>
      </View>

      <View style={styles.warn}>
        <SyIcon name="info" size={16} color={SY.warn} strokeWidth={2} />
        <Text style={styles.warnText}>{t('product.checkBody')}</Text>
      </View>

      <Pressable style={styles.cta} onPress={() => router.push('/guide')} accessibilityRole="button">
        <Text style={styles.ctaText}>{t('myEsim.openGuide')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 14 },
  intro: { fontSize: 14, lineHeight: 21, color: LOGIN_1B.muted, ...fp('400') },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: SY.ink,
    borderRadius: SY_RADIUS.hero,
    padding: 18,
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: SY.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, fontSize: 14, lineHeight: 20, color: '#fff', ...fp('600') },
  card: {
    borderWidth: 1,
    borderColor: LOGIN_1B.border,
    borderRadius: SY_RADIUS.card,
    backgroundColor: SY.surface,
    padding: 16,
    gap: 8,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconTile: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: SY.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: { fontSize: 16, color: LOGIN_1B.navy, ...fp('700') },
  cardBody: { fontSize: 14, lineHeight: 21, color: LOGIN_1B.navy, ...fp('400') },
  cardSub: { fontSize: 12.5, lineHeight: 18, color: LOGIN_1B.faint, ...fp('400') },
  warn: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    backgroundColor: SY.warnTint,
    borderWidth: 1,
    borderColor: SY.warnBorder,
    borderRadius: SY_RADIUS.card,
    padding: 14,
  },
  warnText: { flex: 1, fontSize: 13.5, lineHeight: 19, color: SY.warnText, ...fp('600') },
  cta: {
    height: 54,
    borderRadius: SY_RADIUS.button,
    backgroundColor: SY.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 16, color: '#fff', ...fp('700') },
});
