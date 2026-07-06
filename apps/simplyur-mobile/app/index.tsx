import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SignalPinIcon } from '@/src/components/auth/SignalPinIcon';
import { OPENING_DESIGN as D, OPENING_PHOTOS } from '@/src/constants/opening-design';
import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';

/** design_handoff_opening — first screen; Get Started → Login 1b */
export default function OpeningScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [photoIndex, setPhotoIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPhotoIndex((i) => (i + 1) % OPENING_PHOTOS.length);
    }, D.rotateMs);
    return () => clearInterval(id);
  }, []);

  function onGetStarted() {
    router.push('/sign-in');
  }

  return (
    <View style={styles.root}>
      <ImageBackground source={OPENING_PHOTOS[photoIndex]} style={styles.photo} resizeMode="cover">
        <View style={styles.scrim} />
        <View style={[styles.content, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}>
          <View style={styles.spacer} />
          <View style={styles.hero}>
            <SignalPinIcon />
            <Text style={styles.tagline}>{t('brand.tagline')}</Text>
          </View>
          <Pressable style={styles.cta} onPress={onGetStarted} accessibilityRole="button">
            <Text style={styles.ctaText}>{t('opening.getStarted')}</Text>
          </Pressable>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: D.navy },
  photo: { flex: 1, width: '100%' },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: D.scrim,
  },
  content: {
    flex: 1,
    paddingHorizontal: D.paddingH,
    justifyContent: 'space-between',
  },
  spacer: { flex: 1 },
  hero: { alignItems: 'center', gap: 18, marginBottom: 40 },
  tagline: {
    textAlign: 'center',
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.85)',
    ...fp('600'),
  },
  cta: {
    height: D.buttonHeight,
    borderRadius: D.buttonRadius,
    backgroundColor: D.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: { color: '#fff', fontSize: 16, ...fp('600') },
});
