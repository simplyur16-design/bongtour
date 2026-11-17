/**
 * Shared purchase chrome — docked primary (cobalt) CTA + back row (product + checkout).
 * REGRESSION-FREEZE[simplyur-purchase-dock-cta]: same bottom dock after plan select — manifest
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SY } from '@/src/constants/theme';
import { fp } from '@/src/constants/typography';
import {
  SIMPLYUR_DOCK_CTA_HEIGHT,
  SIMPLYUR_DOCK_HINT_SLOT,
  SIMPLYUR_DOCK_PAD_H,
} from '@/src/lib/dock-cta-layout';

export {
  SIMPLYUR_DOCK_CTA_HEIGHT,
  simplyurDockScrollPad,
  simplyurScreenPadTop,
} from '@/src/lib/dock-cta-layout';

const PRIMARY = SY.primary;

export function SimplyurBackRow({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={styles.backRow}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <Text style={styles.backArrow}>←</Text>
      <Text style={styles.backText}>{label}</Text>
    </Pressable>
  );
}

export function SimplyurDockCta({
  label,
  hint,
  onPress,
  busy,
  disabled,
  bottomInset,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  bottomInset: number;
}) {
  return (
    <View style={[styles.dock, { paddingBottom: Math.max(bottomInset, 10) }]}>
      <Pressable
        style={[styles.btn, busy || disabled ? styles.btnDim : null]}
        onPress={onPress}
        disabled={Boolean(busy || disabled)}
        accessibilityRole="button"
        accessibilityLabel={label}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.label}>{label}</Text>
        )}
      </Pressable>
      <View style={styles.hintSlot}>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  backArrow: { fontSize: 16, color: PRIMARY },
  backText: { fontSize: 13, ...fp('600'), color: PRIMARY },
  dock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: SY.line,
    backgroundColor: SY.surface,
    paddingHorizontal: SIMPLYUR_DOCK_PAD_H,
    paddingTop: 10,
    gap: 8,
  },
  btn: {
    height: SIMPLYUR_DOCK_CTA_HEIGHT,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDim: { opacity: 0.7 },
  label: { color: '#fff', fontSize: 16.5, ...fp('700') },
  hintSlot: { minHeight: SIMPLYUR_DOCK_HINT_SLOT, justifyContent: 'center' },
  hint: { fontSize: 12, lineHeight: 18, ...fp('400'), color: SY.ink3, textAlign: 'center' },
});
