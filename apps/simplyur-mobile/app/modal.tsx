import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { LOCALE_LABELS, SIMPLYUR_LOCALES, useI18n } from '@/src/i18n/I18nContext';
import type { SimplyurLocale } from '@/src/constants/simplyur';

export default function LanguageModal() {
  const { locale, setLocale, t } = useI18n();
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme];

  const pick = (loc: SimplyurLocale) => {
    setLocale(loc);
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t('language.label')}</Text>
      {SIMPLYUR_LOCALES.map((loc) => (
        <Pressable
          key={loc}
          onPress={() => pick(loc)}
          style={[
            styles.row,
            { borderColor: colors.hanjiBorder },
            loc === locale && { borderColor: colors.celadon, backgroundColor: colors.celadonLight },
          ]}>
          <Text style={[styles.rowText, { color: colors.text }]}>{LOCALE_LABELS[loc]}</Text>
          {loc === locale ? <Text style={{ color: colors.dan }}>✓</Text> : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 24 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  rowText: { fontSize: 16, fontWeight: '600' },
});
