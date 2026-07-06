import { StyleSheet, Text, View } from 'react-native';

import { SIMPLYUR_BRAND } from '@/src/constants/brand';
import { fp } from '@/src/constants/typography';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  tagline?: string;
};

export function SimplyurWordmark({ size = 'md', showTagline = true, tagline }: Props) {
  const textSize = size === 'sm' ? 22 : size === 'lg' ? 44 : 32;
  const tagSize = size === 'sm' ? 8 : size === 'lg' ? 11 : 9;

  return (
    <View style={styles.root}>
      <Text style={[styles.wordmark, { fontSize: textSize }]} accessibilityLabel="simplyur">
        <Text style={styles.simply}>simply</Text>
        <Text style={styles.ur}>ur</Text>
      </Text>
      {showTagline && tagline ? (
        <Text style={[styles.tagline, { fontSize: tagSize }]}>{tagline}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'flex-start' },
  wordmark: { letterSpacing: -0.5, lineHeight: 40 },
  simply: { ...fp('300'), color: SIMPLYUR_BRAND.simplyColor },
  ur: { ...fp('800'), color: SIMPLYUR_BRAND.urColor },
  tagline: {
    marginTop: 6,
    ...fp('400'),
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: SIMPLYUR_BRAND.simplyColor,
  },
});
