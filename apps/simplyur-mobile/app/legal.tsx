import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LOGIN_1B } from '@/src/constants/login-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

type LegalDoc = 'terms' | 'privacy' | 'refund';

/**
 * Native legal copy — no website chrome / bottom sheet.
 * REGRESSION-FREEZE[simplyur-native-no-website-chrome]: legal native — manifest
 * REGRESSION-FREEZE[simplyur-mobile-p1-account-settings]: refund native — manifest
 */
export default function LegalScreen() {
  const { doc: rawDoc } = useLocalSearchParams<{ doc?: string }>();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const doc: LegalDoc =
    rawDoc === 'privacy' ? 'privacy' : rawDoc === 'refund' ? 'refund' : 'terms';
  const title =
    doc === 'privacy'
      ? t('legal.privacyTitle')
      : doc === 'refund'
        ? t('legal.refundTitle')
        : t('legal.termsTitle');
  const body =
    doc === 'privacy'
      ? t('legal.privacyBody')
      : doc === 'refund'
        ? t('legal.refundBody')
        : t('legal.termsBody');

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
        {(
          [
            ['terms', t('legal.termsTitle')],
            ['privacy', t('legal.privacyTitle')],
            ['refund', t('legal.refundTitle')],
          ] as const
        ).map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => router.setParams({ doc: key })}
            style={[styles.chip, doc === key ? styles.chipOn : null]}>
            <Text style={[styles.chipText, doc === key ? styles.chipTextOn : null]}>{label}</Text>
          </Pressable>
        ))}
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
  switchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  chip: {
    flexGrow: 1,
    minWidth: '28%',
    borderWidth: 1,
    borderColor: LOGIN_1B.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  chipOn: { borderColor: LOGIN_1B.coral, backgroundColor: '#fff5f0' },
  chipText: { fontSize: 11, color: LOGIN_1B.muted, textAlign: 'center', ...fp('600') },
  chipTextOn: { color: LOGIN_1B.coral },
});
