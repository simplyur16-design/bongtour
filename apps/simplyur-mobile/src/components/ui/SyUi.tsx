import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { SY, SY_RADIUS } from '@/src/constants/theme';
import { fp } from '@/src/constants/typography';

import { SyIcon, type SyIconName } from './SyIcon';

/** Shared 1.0.2 building blocks (mockup classes: .ib .tag .li .card .seg). */

export const ESIM_WORDMARK = require('../../../assets/images/brand/esim-wordmark-light.png');
export const ESIM_MARK = require('../../../assets/images/brand/esim-mark.png');
export const ESIM_MARK_ON_DARK = require('../../../assets/images/brand/esim-mark-ondark.png');

/** "Simplyur eSIM" horizontal logo (A안 ur luggage tag + eSIM). Asset is 488×96. */
export function EsimWordmark({ height = 26 }: { height?: number }) {
  return (
    <Image
      source={ESIM_WORDMARK}
      style={{ height, width: Math.round((height * 488) / 96) }}
      resizeMode="contain"
      accessibilityLabel="Simplyur eSIM"
    />
  );
}

/** eSIM mark on a sage tile (product / checkout rows). */
export function EsimMarkTile({ size = 64, dark = false }: { size?: number; dark?: boolean }) {
  return (
    <View
      style={[
        styles.markTile,
        { width: size, height: size, borderRadius: Math.round(size / 4) },
        dark && { backgroundColor: 'transparent' },
      ]}>
      <Image
        source={dark ? ESIM_MARK_ON_DARK : ESIM_MARK}
        style={{ width: Math.round(size * 0.82), height: Math.round(size * 0.82) }}
        resizeMode="contain"
        accessible={false}
      />
    </View>
  );
}

/** Round 36pt icon button. */
export function IconButton({
  name,
  onPress,
  label,
}: {
  name: SyIconName;
  onPress?: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={styles.iconBtn}
      accessibilityRole="button"
      accessibilityLabel={label}>
      <SyIcon name={name} size={18} strokeWidth={1.8} />
    </Pressable>
  );
}

export type TagTone = 'free' | 'primary' | 'neutral' | 'warn';

export function Tag({
  label,
  tone = 'neutral',
  icon,
  style,
}: {
  label: string;
  tone?: TagTone;
  icon?: SyIconName;
  style?: StyleProp<ViewStyle>;
}) {
  const t = TAG_TONES[tone];
  return (
    <View style={[styles.tag, { backgroundColor: t.bg }, style]}>
      {icon ? <SyIcon name={icon} size={12} color={t.fg} strokeWidth={2.2} /> : null}
      <Text style={[styles.tagText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const TAG_TONES: Record<TagTone, { bg: string; fg: string }> = {
  free: { bg: SY.okTint, fg: SY.ok },
  primary: { bg: SY.primaryTint, fg: SY.primaryDark },
  neutral: { bg: SY.sage, fg: SY.ink2 },
  warn: { bg: SY.warnTint, fg: SY.warn },
};

/** Icon tile + title + sub (mockup .li). */
export function ListItem({
  icon,
  title,
  sub,
  tone = 'primary',
  right,
}: {
  icon: SyIconName;
  title: string;
  sub?: string | null;
  tone?: 'primary' | 'ok' | 'warn';
  right?: ReactNode;
}) {
  const bg = tone === 'ok' ? SY.okTint : tone === 'warn' ? SY.surface : SY.primaryTint;
  const fg = tone === 'ok' ? SY.ok : tone === 'warn' ? SY.warn : SY.primary;
  return (
    <View style={styles.li}>
      <View style={[styles.liIcon, { backgroundColor: bg }]}>
        <SyIcon name={icon} size={16} color={fg} strokeWidth={2} />
      </View>
      <View style={styles.liText}>
        <Text style={styles.liTitle}>{title}</Text>
        {sub ? <Text style={styles.liSub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** Segmented control (sage track, white selected pill). */
export function Segmented<K extends string>({
  items,
  value,
  onChange,
}: {
  items: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <View style={styles.seg} accessibilityRole="tablist">
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable
            key={it.key}
            onPress={() => onChange(it.key)}
            style={[styles.segItem, on && styles.segItemOn]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}>
            <Text style={[styles.segText, on && styles.segTextOn]} numberOfLines={1}>
              {it.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  markTile: { backgroundColor: SY.sage, alignItems: 'center', justifyContent: 'center' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: SY.surface,
    borderWidth: 1,
    borderColor: SY.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: SY_RADIUS.tag,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tagText: { fontSize: 11.5, lineHeight: 14, ...fp('600') },
  li: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  liIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  liText: { flex: 1, minWidth: 0 },
  liTitle: { fontSize: 14.5, lineHeight: 19, ...fp('600'), color: SY.ink },
  liSub: { fontSize: 12.5, lineHeight: 17, ...fp('400'), color: SY.ink3 },
  seg: { flexDirection: 'row', backgroundColor: SY.sage, borderRadius: 12, padding: 3, gap: 3 },
  segItem: { flex: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  segItemOn: {
    backgroundColor: SY.surface,
    shadowColor: SY.ink,
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segText: { fontSize: 14, ...fp('600'), color: SY.ink2 },
  segTextOn: { color: SY.ink },
});
