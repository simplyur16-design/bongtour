import { SIMPLYUR_PALETTE as P } from '@/src/constants/palette';

/** Korean-inspired palette — dan · celadon · hanji */
export default {
  light: {
    text: P.ink,
    background: P.hanji,
    tint: P.celadon,
    tabIconDefault: P.inkMuted,
    tabIconSelected: P.dan,
    dan: P.dan,
    danHover: P.danHover,
    danMuted: P.danMuted,
    celadon: P.celadon,
    celadonDark: P.celadonDark,
    celadonLight: P.celadonLight,
    hanjiWarm: P.hanjiWarm,
    hanjiBorder: P.hanjiBorder,
    inkMuted: P.inkMuted,
  },
  dark: {
    text: '#F5F2ED',
    background: '#1A1814',
    tint: '#6B9E8F',
    tabIconDefault: '#9C958C',
    tabIconSelected: P.dan,
    dan: P.dan,
    danHover: P.danHover,
    danMuted: '#3D2826',
    celadon: '#6B9E8F',
    celadonDark: '#A8C9BE',
    celadonLight: '#2A3D36',
    hanjiWarm: '#252219',
    hanjiBorder: '#3D3830',
    inkMuted: '#B8B0A6',
  },
};
