/** design_handoff_guide — 1.0.2 tokens from theme.ts. Key `coral` = primary (cobalt). */
import { SY, SY_RADIUS, SY_SPACE } from './theme';

export const GUIDE_DESIGN = {
  bg: SY.bg,
  navy: SY.ink,
  coral: SY.primary,
  muted: SY.ink2,
  faint: SY.ink3,
  border: SY.line,
  bannerBg: SY.primaryTint,
  bannerBorder: SY.primaryTintBorder,
  mockBg: SY.sage,
  mockBorder: SY.line,
  mockChevron: SY.ink3,
  cardRadius: SY_RADIUS.card,
  cardPadding: 14,
  segmentHeight: 42,
  segmentRadius: SY_RADIUS.chip,
  faqRadius: 16,
  paddingH: SY_SPACE.screenH,
  sectionGap: 13,
} as const;
