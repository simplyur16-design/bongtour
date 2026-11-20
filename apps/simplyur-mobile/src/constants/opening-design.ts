/** design_handoff_opening — Korea photo hero + Get Started (1.0.2: ink scrim + cobalt CTA) */
import { SY } from './theme';

export const OPENING_DESIGN = {
  scrim: 'rgba(20, 26, 20, 0.58)',
  navy: SY.ink,
  coral: SY.primary,
  faint: SY.ink3,
  buttonHeight: 56,
  buttonRadius: 14,
  paddingH: 28,
  rotateMs: 5000,
} as const;

/** Operator-confirmed Korea travel photos (bundled). */
export const OPENING_PHOTOS = [
  // REGRESSION-FREEZE[simplyur-mobile-asset-magic]: real JPEG files must use .jpg — manifest
  require('../../assets/images/korea/korea-1.jpg'),
  require('../../assets/images/korea/korea-2.jpg'),
  require('../../assets/images/korea/korea-3.jpg'),
] as const;
