/** Poppins — simplyur brand typography (sync with web --font-simplyur / opening screen spec). */
export const POPPINS = {
  light: 'Poppins_300Light',
  regular: 'Poppins_400Regular',
  semiBold: 'Poppins_600SemiBold',
  bold: 'Poppins_700Bold',
  extraBold: 'Poppins_800ExtraBold',
} as const;

export type PoppinsWeight = '300' | '400' | '600' | '700' | '800';

/** RN: use explicit fontFamily — fontWeight alone does not apply with bundled faces. */
export function fp(weight: PoppinsWeight = '400') {
  const map: Record<PoppinsWeight, string> = {
    '300': POPPINS.light,
    '400': POPPINS.regular,
    '600': POPPINS.semiBold,
    '700': POPPINS.bold,
    '800': POPPINS.extraBold,
  };
  return { fontFamily: map[weight] } as const;
}
