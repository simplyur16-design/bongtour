import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SyIcon } from '@/src/components/ui/SyIcon';
import { ScreenHeader } from '@/src/components/ui/SyUi';
import { SY, SY_RADIUS } from '@/src/constants/theme';
import { LOCALE_LABELS, SIMPLYUR_LOCALES, useI18n } from '@/src/i18n/I18nContext';
import type { SimplyurLocale } from '@/src/constants/simplyur';
import { fp } from '@/src/constants/typography';

/** Language picker — 1.0.2 (sage bg, white grouped card, cobalt check). */
export default function LanguageModal() {
  const { locale, setLocale, t } = useI18n();
  const insets = useSafeAreaInsets();

  const pick = (loc: SimplyurLocale) => {
    setLocale(loc);
    router.back();
  };

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: SY.bg }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
      <ScreenHeader title={t('language.label')} backLabel={t('settings.back')} onBack={() => router.back()} />
      <View style={styles.card} accessibilityRole="radiogroup">
        {SIMPLYUR_LOCALES.map((loc, i) => {
          const on = loc === locale;
          return (
            <Pressable
              key={loc}
              onPress={() => pick(loc)}
              style={[styles.row, i < SIMPLYUR_LOCALES.length - 1 && styles.rowDivider]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}>
              <View style={[styles.iconTile, on && styles.iconTileOn]}>
                <SyIcon name="globe" size={16} color={on ? '#fff' : SY.primary} strokeWidth={2} />
              </View>
              <Text style={[styles.rowText, on && styles.rowTextOn]}>{LOCALE_LABELS[loc]}</Text>
              {on ? <SyIcon name="check" size={18} color={SY.primary} strokeWidth={2.4} /> : null}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  card: {
    backgroundColor: SY.surface,
    borderWidth: 1,
    borderColor: SY.line,
    borderRadius: SY_RADIUS.card,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: SY.sage },
  iconTile: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: SY.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTileOn: { backgroundColor: SY.primary },
  rowText: { flex: 1, fontSize: 16, color: SY.ink, ...fp('600') },
  rowTextOn: { color: SY.primaryDark },
});
