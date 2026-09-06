import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { HOME_DESIGN as D } from '@/src/constants/home-design';
import { LOCALE_SHORT_LABELS } from '@/src/constants/simplyur';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/**
 * Home-visible language entry — same modal as Settings.
 * REGRESSION-FREEZE[simplyur-mobile-home-language]: home opens /modal — manifest
 */
export function HomeLanguageChip() {
  const { locale, t } = useI18n();

  return (
    <Pressable
      onPress={() => router.push('/modal')}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t('language.label')}
      style={styles.chip}>
      <Text style={styles.text}>{LOCALE_SHORT_LABELS[locale]}</Text>
      <Text style={styles.caret}>▾</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: D.border,
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: { fontSize: 12, ...fp('700'), color: D.navy, letterSpacing: 0.3 },
  caret: { fontSize: 10, color: D.muted, marginTop: -1 },
});
