/** design_handoff_opening — Korea photo hero + Get Started */
export const OPENING_DESIGN = {
  scrim: 'rgba(18, 35, 63, 0.58)',
  navy: '#12233F',
  coral: '#FF6B4A',
  faint: '#98A0AB',
  buttonHeight: 56,
  buttonRadius: 16,
  paddingH: 28,
  rotateMs: 5000,
} as const;

/** Operator-confirmed Korea travel photos (bundled). */
export const OPENING_PHOTOS = [
  require('../../assets/images/korea/korea-1.png'),
  require('../../assets/images/korea/korea-2.png'),
  require('../../assets/images/korea/korea-3.png'),
] as const;
