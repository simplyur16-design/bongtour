/** design_handoff_product — sync with lib/simplyur/product-design.ts */
export const PRODUCT_DESIGN = {
  bg: '#FFF4EF',
  navy: '#12233F',
  coral: '#FF6B4A',
  muted: '#6B7686',
  faint: '#98A0AB',
  border: '#E1DFD9',
  divider: '#F0EEE9',
  disabledFill: '#E1DFD9',
  skeleton: '#EDE9E4',
  cardRadius: 18,
  cardPadding: 18,
  buttonHeight: 56,
  buttonRadius: 16,
  paddingH: 22,
  sectionGap: 22,
} as const;

export type ProductViewState = 'loading' | 'loaded' | 'not_found' | 'unavailable';
