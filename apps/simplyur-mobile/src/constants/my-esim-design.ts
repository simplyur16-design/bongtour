/** design_handoff_my_esim — 1.0.2 tokens from theme.ts. Key `coral` = primary (cobalt). */
import { SY, SY_RADIUS, SY_SPACE } from './theme';

export const MY_ESIM_DESIGN = {
  bg: SY.bg,
  navy: SY.ink,
  coral: SY.primary,
  muted: SY.ink2,
  faint: SY.ink3,
  border: SY.line,
  divider: SY.sage,
  iconCircleBg: SY.primaryTint,
  cardRadius: 16,
  panelRadius: SY_RADIUS.card,
  buttonHeight: 46,
  buttonRadius: SY_RADIUS.button,
  modalRadius: 24,
  paddingH: SY_SPACE.screenH,
  sectionGap: 13,
  detailGap: 18,
  overlay: SY.overlay,
  barMuted: '#C9D8F6',
  progressTrack: SY.sage,
} as const;

/** REGRESSION-FREEZE[simplyur-my-esim-badge-tiers]: no Upcoming — Ready/Preparing — manifest */
export const MY_ESIM_BADGE = {
  active: { bg: SY.okTint, color: SY.ok },
  ready: { bg: SY.primaryTint, color: SY.primaryDark },
  preparing: { bg: SY.warnTint, color: SY.warn },
  refundPending: { bg: '#F3E8FF', color: '#7A3DB8' },
  expired: { bg: SY.sage, color: SY.ink3 },
} as const;

export type MyEsimBadgeTier = keyof typeof MY_ESIM_BADGE;
