/**
 * Shared purchase chrome — docked primary (cobalt) CTA + back row (product + checkout).
 * REGRESSION-FREEZE[simplyur-purchase-dock-cta]: same bottom dock after plan select — manifest
 */
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { SyIcon, type SyIconName } from '@/src/components/ui/SyIcon';
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
  icon,
  hintIcon,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  bottomInset: number;
  /** 1.0.2: optional leading icon on the button (e.g. lock on Pay). */
  icon?: SyIconName;
  /** 1.0.2: optional small icon before the hint line. */
  hintIcon?: SyIconName;
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
          <View style={styles.labelRow}>
            {icon ? <SyIcon name={icon} size={17} color="#fff" strokeWidth={2.2} /> : null}
            <Text style={styles.label}>{label}</Text>
          </View>
        )}
      </Pressable>
      <View style={styles.hintSlot}>
        {hint ? (
          <View style={styles.hintRow}>
            {hintIcon ? <SyIcon name={hintIcon} size={12} color={SY.ink3} strokeWidth={2} /> : null}
            <Text style={styles.hint}>{hint}</Text>
          </View>
        ) : null}
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
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  label: { color: '#fff', fontSize: 16.5, ...fp('700') },
  hintSlot: { minHeight: SIMPLYUR_DOCK_HINT_SLOT, justifyContent: 'center' },
  hint: { fontSize: 12.5, lineHeight: 17, ...fp('400'), color: SY.ink3, textAlign: 'center' },
});
