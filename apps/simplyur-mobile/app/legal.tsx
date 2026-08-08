import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LOGIN_1B } from '@/src/constants/login-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

type LegalDoc = 'terms' | 'privacy';

/**
 * Native legal copy — no website chrome / bottom sheet.
 * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: legal native — manifest
 */
export default function LegalScreen() {
  const { doc: rawDoc } = useLocalSearchParams<{ doc?: string }>();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const doc: LegalDoc = rawDoc === 'privacy' ? 'privacy' : 'terms';
  const title = doc === 'privacy' ? t('legal.privacyTitle') : t('legal.termsTitle');
  const body = doc === 'privacy' ? t('legal.privacyBody') : t('legal.termsBody');

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

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>

      <View style={styles.switchRow}>
        <Pressable
          onPress={() => router.setParams({ doc: 'terms' })}
          style={[styles.chip, doc === 'terms' ? styles.chipOn : null]}>
          <Text style={[styles.chipText, doc === 'terms' ? styles.chipTextOn : null]}>
            {t('legal.termsTitle')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.setParams({ doc: 'privacy' })}
          style={[styles.chip, doc === 'privacy' ? styles.chipOn : null]}>
          <Text style={[styles.chipText, doc === 'privacy' ? styles.chipTextOn : null]}>
            {t('legal.privacyTitle')}
          </Text>
        </Pressable>
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
  body: { fontSize: 14, lineHeight: 22, color: LOGIN_1B.muted, ...fp('400') },
  switchRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: LOGIN_1B.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  chipOn: { borderColor: LOGIN_1B.coral, backgroundColor: '#fff5f0' },
  chipText: { fontSize: 12, color: LOGIN_1B.muted, textAlign: 'center', ...fp('600') },
  chipTextOn: { color: LOGIN_1B.coral },
});
