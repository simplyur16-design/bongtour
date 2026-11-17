/**
 * Source Sans 3 — Simplyur eSIM 1.0.2 typography (A안 eSIM family; mockup AFTER_CSS).
 * Poppins was the 1.0.x face; fp() keeps the same weight keys so call sites do not change.
 * '800' maps to Bold: the new design tops out at 700 for headings.
 */
export const SOURCE_SANS = {
  light: 'SourceSans3_300Light',
  regular: 'SourceSans3_400Regular',
  semiBold: 'SourceSans3_600SemiBold',
  bold: 'SourceSans3_700Bold',
} as const;

export type PoppinsWeight = '300' | '400' | '600' | '700' | '800';

/** RN: use explicit fontFamily — fontWeight alone does not apply with bundled faces.
 * Spread into styles (`...fp('700')`). Never pass a pixel number into fp() — it is not a size helper.
 * REGRESSION-FREEZE[simplyur-my-trip-fontsize]: fp() returns fontFamily; never pass a px size — manifest
 */
export function fp(weight: PoppinsWeight = '400') {
  const map: Record<PoppinsWeight, string> = {
    '300': SOURCE_SANS.light,
    '400': SOURCE_SANS.regular,
    '600': SOURCE_SANS.semiBold,
    '700': SOURCE_SANS.bold,
    '800': SOURCE_SANS.bold,
  };
  return { fontFamily: map[weight] } as const;
}
