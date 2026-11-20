/** design_handoff_plans — 1.0.2 tokens from theme.ts. Key `coral` = primary (cobalt). */
import { SY, SY_RADIUS, SY_SPACE } from './theme';

export const PLANS_DESIGN = {
  bg: SY.bg,
  navy: SY.ink,
  coral: SY.primary,
  muted: SY.ink2,
  faint: SY.ink3,
  border: SY.line,
  bannerBg: SY.primaryTint,
  bannerBorder: SY.primaryTintBorder,
  skeleton: SY.sage,
  skeletonBtn: SY.primaryTint,
  chipHeight: 40,
  chipMinWidth: 58,
  chipRadius: SY_RADIUS.chip,
  cardRadius: SY_RADIUS.card,
  cardPadding: 14,
  buttonHeight: 54,
  buttonRadius: SY_RADIUS.button,
  paddingH: SY_SPACE.screenH,
  sectionGap: SY_SPACE.gap,
} as const;
