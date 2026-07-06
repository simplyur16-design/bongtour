/** design_handoff_home — sync with lib/simplyur/home-design.ts */
export const HOME_DESIGN = {
  bg: '#FFF4EF',
  navy: '#12233F',
  coral: '#FF6B4A',
  muted: '#6B7686',
  faint: '#98A0AB',
  border: '#E1DFD9',
  bannerBg: '#FDEDE7',
  bannerBorder: '#FBD9CB',
  iconTileBg: '#FDEDE7',
  cardRadius: 16,
  iconTileRadius: 10,
  iconTileSize: 36,
  buttonHeight: 56,
  buttonRadius: 16,
  paddingH: 22,
  sectionGap: 24,
} as const;

export const HOME_WHY_KEYS = ['instant', 'support', 'refund'] as const;
export type HomeWhyKey = (typeof HOME_WHY_KEYS)[number];

export const HOME_WHY_ICONS: Record<HomeWhyKey, string> = {
  instant: '⚡',
  support: '💬',
  refund: '↺',
};
