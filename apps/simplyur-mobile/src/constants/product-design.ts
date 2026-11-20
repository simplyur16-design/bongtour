/** design_handoff_product — 1.0.2 tokens from theme.ts. Key `coral` = primary (cobalt). */
import { SY, SY_RADIUS, SY_SPACE } from './theme';

export const PRODUCT_DESIGN = {
  bg: SY.bg,
  navy: SY.ink,
  coral: SY.primary,
  muted: SY.ink2,
  faint: SY.ink3,
  border: SY.line,
  divider: SY.sage,
  disabledFill: SY.line,
  skeleton: SY.sage,
  cardRadius: SY_RADIUS.card,
  cardPadding: 16,
  buttonHeight: 54,
  buttonRadius: SY_RADIUS.button,
  paddingH: SY_SPACE.screenH,
  sectionGap: SY_SPACE.gap,
} as const;

export type ProductViewState = 'loading' | 'loaded' | 'not_found' | 'unavailable';
