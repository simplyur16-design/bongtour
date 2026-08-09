import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { fp } from '@/src/constants/typography';
import { useI18n } from '@/src/i18n/I18nContext';
import { probeSimplyurOnline } from '@/src/lib/network';

/**
 * REGRESSION-FREEZE[simplyur-mobile-p2-polish]: offline banner — manifest
 */
export function OfflineBanner({ onOnline }: { onOnline?: () => void }) {
  const { t } = useI18n();
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    const ok = await probeSimplyurOnline();
    setOffline(!ok);
    setChecking(false);
    if (ok) onOnline?.();
  }, [onOnline]);

  useFocusEffect(
    useCallback(() => {
      void check();
    }, [check]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  if (!offline) return null;

  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text style={styles.text}>{t('network.offlineBody')}</Text>
      <Pressable onPress={() => void check()} hitSlop={8} disabled={checking}>
        <Text style={styles.retry}>{checking ? t('network.checking') : t('network.retry')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    marginBottom: 8,
  },
  text: { fontSize: 13, lineHeight: 18, color: '#92400E', ...fp('400') },
  retry: { fontSize: 13, color: '#B45309', ...fp('600') },
});
