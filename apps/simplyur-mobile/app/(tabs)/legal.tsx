import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SyIcon, type SyIconName } from '@/src/components/ui/SyIcon';
import { ScreenHeader, Segmented } from '@/src/components/ui/SyUi';
import { LOGIN_1B } from '@/src/constants/login-design';
import { SY, SY_RADIUS } from '@/src/constants/theme';
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

  const icon: SyIconName = doc === 'privacy' ? 'shield' : doc === 'refund' ? 'refund' : 'doc';
  // Bodies are single paragraphs joined with sentences; split on blank lines when present.
  const paras = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: LOGIN_1B.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
      ]}>
      <ScreenHeader title={title} backLabel={t('product.backToPlans')} onBack={() => router.back()} />

      <Segmented
        items={[
          { key: 'terms', label: t('legal.termsTitle') },
          { key: 'privacy', label: t('legal.privacyTitle') },
          { key: 'refund', label: t('legal.refundTitle') },
        ]}
        value={doc}
        onChange={(key) => router.setParams({ doc: key })}
      />

      <View style={styles.card}>
        <View style={styles.cardHead}>
          <View style={styles.iconTile}>
            <SyIcon name={icon} size={18} color={SY.primary} strokeWidth={2} />
          </View>
          <Text style={styles.title}>{title}</Text>
        </View>
        {paras.map((p) => (
          <Text key={p.slice(0, 24)} style={styles.body}>
            {p}
          </Text>
        ))}
      </View>
      {/* legal.termsBody · legal.privacyBody · legal.refundBody — native text, no WebView */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 14 },
  card: {
    backgroundColor: SY.surface,
    borderWidth: 1,
    borderColor: LOGIN_1B.border,
    borderRadius: SY_RADIUS.card,
    padding: 18,
    gap: 12,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: SY.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 18, lineHeight: 23, color: LOGIN_1B.navy, ...fp('700') },
  body: { fontSize: 14.5, lineHeight: 23, color: LOGIN_1B.muted, ...fp('400') },
});
