/** design_handoff_login_1b — 1.0.2 tokens from theme.ts. Key `coral` = primary (cobalt). */
import { SY, SY_RADIUS } from './theme';

export const LOGIN_1B = {
  bg: SY.bg,
  navy: SY.ink,
  coral: SY.primary,
  muted: SY.ink2,
  faint: SY.ink3,
  border: SY.line,
  buttonHeight: 54,
  buttonRadius: SY_RADIUS.button,
  buttonGap: 12,
  paddingH: 28,
  paddingTop: 24,
  paddingBottom: 40,
  skipTop: 64,
  logoGap: 18,
  headingGap: 6,
  blockMarginBottom: 40,
} as const;
