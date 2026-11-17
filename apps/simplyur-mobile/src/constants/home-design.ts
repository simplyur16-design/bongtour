/** design_handoff_home — 1.0.2 tokens from theme.ts (A안 eSIM family). Key `coral` = primary (cobalt). */
import { SY, SY_RADIUS, SY_SPACE } from './theme';

export const HOME_DESIGN = {
  bg: SY.bg,
  navy: SY.ink,
  coral: SY.primary,
  muted: SY.ink2,
  faint: SY.ink3,
  border: SY.line,
  bannerBg: SY.primaryTint,
  bannerBorder: SY.primaryTintBorder,
  iconTileBg: SY.primaryTint,
  cardRadius: SY_RADIUS.card,
  iconTileRadius: 9,
  iconTileSize: 30,
  buttonHeight: 54,
  buttonRadius: SY_RADIUS.button,
  paddingH: SY_SPACE.screenH,
  sectionGap: 16,
} as const;
