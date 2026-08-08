import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backRow}>
        <Text style={styles.back}>← {t('product.backToPlans')}</Text>
      </Pressable>

      <Text style={styles.title}>{t('devices.title')}</Text>
      <Text style={styles.intro}>{t('devices.intro')}</Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>iPhone</Text>
        <Text style={styles.cardBody}>{t('devices.iphone')}</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Android</Text>
        <Text style={styles.cardBody}>{t('devices.android')}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 14 },
  backRow: { marginBottom: 4 },
  back: { fontSize: 14, color: LOGIN_1B.coral, ...fp('600') },
  title: { fontSize: 22, color: LOGIN_1B.navy, ...fp('700') },
  intro: { fontSize: 14, lineHeight: 21, color: LOGIN_1B.muted, ...fp('400') },
  card: {
    borderWidth: 1,
    borderColor: LOGIN_1B.border,
    borderRadius: 16,
    backgroundColor: '#fff',
    padding: 16,
    gap: 6,
  },
  cardLabel: { fontSize: 13, color: LOGIN_1B.coral, ...fp('700') },
  cardBody: { fontSize: 14, lineHeight: 21, color: LOGIN_1B.navy, ...fp('400') },
});
