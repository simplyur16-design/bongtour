import { Link, Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EsimMarkTile } from '@/src/components/ui/SyUi';
import { SY, SY_RADIUS } from '@/src/constants/theme';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/** Unknown route — 1.0.2 empty state (ur mark, cobalt CTA), localized. */
export default function NotFoundScreen() {
  const { t } = useI18n();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <EsimMarkTile size={72} />
        <Text style={styles.title}>{t('notFound.title')}</Text>
        <Text style={styles.body}>{t('notFound.body')}</Text>
        <Link href="/(tabs)" asChild>
          <Pressable style={styles.cta} accessibilityRole="button">
            <Text style={styles.ctaText}>{t('notFound.cta')}</Text>
          </Pressable>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
    backgroundColor: SY.bg,
  },
  title: { marginTop: 8, fontSize: 20, color: SY.ink, textAlign: 'center', ...fp('700') },
  body: { fontSize: 14, lineHeight: 21, color: SY.ink2, textAlign: 'center', maxWidth: 280, ...fp('400') },
  cta: {
    marginTop: 12,
    alignSelf: 'stretch',
    height: 54,
    borderRadius: SY_RADIUS.button,
    backgroundColor: SY.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { fontSize: 16, color: '#fff', ...fp('700') },
});
