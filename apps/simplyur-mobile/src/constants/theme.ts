/**
 * Simplyur eSIM 1.0.2 theme — A안 eSIM family (ink · signal cobalt · sage), Source Sans 3.
 * Source of truth: /workspace/simplyur-esim-design-1117 (png/*-after.png, src/common.py AFTER_CSS).
 * Every *-design.ts token file reads from here so screens stay in sync.
 */
export const SY = {
  /** Screen background (near-white sage). */
  bg: '#F4F6F2',
  /** Surfaces: cards, inputs, dock. */
  surface: '#FFFFFF',
  /** Soft sage fill: segmented control track, mark tiles, neutral tags. */
  sage: '#EEF1EC',
  /** Ink — main text, selected chips, hero card. */
  ink: '#141A14',
  ink2: '#4D564D',
  ink3: '#7C857C',
  line: '#DDE3DA',
  /** Signal cobalt — primary buttons, links, active tab. */
  primary: '#2A62D4',
  primaryDark: '#1F4FB4',
  primaryTint: '#E7EEFC',
  primaryTintBorder: '#CFDDF8',
  primaryOnDark: '#9DBBF7',
  primaryLight: '#5B8FF2',
  ok: '#1B7F4E',
  okTint: '#E3F3EA',
  warn: '#9A5B00',
  warnText: '#6B4200',
  warnTint: '#FFF2DC',
  warnBorder: '#F2DDB5',
  danger: '#B42318',
  /** Hero (ink) card text tones. */
  onInkBody: '#C9D1C9',
  onInkMuted: '#AEB7AE',
  onInkLine: '#3A443A',
  tabInactive: '#8A928A',
  overlay: 'rgba(20,26,20,0.45)',
} as const;

export const SY_RADIUS = {
  card: 18,
  hero: 22,
  button: 14,
  chip: 12,
  tag: 7,
  input: 12,
} as const;

export const SY_SPACE = {
  /** Horizontal screen padding (mockup .c 20px). */
  screenH: 20,
  gap: 14,
} as const;
