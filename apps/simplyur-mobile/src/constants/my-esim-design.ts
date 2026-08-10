/** design_handoff_my_esim — sync with lib/simplyur/my-esim-design.ts */
export const MY_ESIM_DESIGN = {
  bg: '#FFF4EF',
  navy: '#12233F',
  coral: '#FF6B4A',
  muted: '#6B7686',
  faint: '#98A0AB',
  border: '#E1DFD9',
  divider: '#F0EEE9',
  iconCircleBg: '#FFE4DA',
  cardRadius: 16,
  panelRadius: 18,
  buttonHeight: 52,
  buttonRadius: 16,
  modalRadius: 24,
  paddingH: 22,
  sectionGap: 18,
  detailGap: 20,
  overlay: 'rgba(18,35,63,0.45)',
  barMuted: '#FFD5C6',
  progressTrack: '#F0EEE9',
} as const;

/** REGRESSION-FREEZE[simplyur-my-esim-badge-tiers]: no Upcoming — Ready/Preparing — manifest */
export const MY_ESIM_BADGE = {
  active: { bg: '#E4F5EC', color: '#1B8A56' },
  ready: { bg: '#EAF1FF', color: '#2E5FD9' },
  preparing: { bg: '#FFF3E0', color: '#C67A1A' },
  refundPending: { bg: '#F3E8FF', color: '#7A3DB8' },
  expired: { bg: '#F0EEE9', color: '#98A0AB' },
} as const;

export type MyEsimBadgeTier = keyof typeof MY_ESIM_BADGE;
