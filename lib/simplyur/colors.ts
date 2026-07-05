/**
 * simplyur — Korean-inspired color palette
 *
 * - dan (단 적색): CTA, price highlight — obangsaek red / hanbok accent
 * - celadon (청자): brand primary, nav, tabs
 * - hanji (한지): warm paper background
 * - ink (먹): body text
 * - taegukBlue: secondary links (태극 청, sparing use)
 */
export const SIMPLYUR_PALETTE = {
  dan: "#C53E3A",
  danHover: "#A8322E",
  danMuted: "#F8EBEA",

  celadon: "#3D6B5E",
  celadonLight: "#E6EFEC",
  celadonDark: "#2A4F45",
  celadonMuted: "#D4E4DE",

  hanji: "#FAF7F2",
  hanjiWarm: "#F3EDE4",
  hanjiBorder: "#E8DFD4",

  ink: "#1F1B2D",
  inkMuted: "#5C5650",

  taegukBlue: "#1E4D7B",
  taegukBlueLight: "#E8EEF4",
} as const;

export type SimplyurPaletteKey = keyof typeof SIMPLYUR_PALETTE;

/** CSS variable names — use with `var(--su-dan)` etc. */
export const SIMPLYUR_CSS_VARS = {
  dan: "--su-dan",
  danHover: "--su-dan-hover",
  danMuted: "--su-dan-muted",
  celadon: "--su-celadon",
  celadonLight: "--su-celadon-light",
  celadonDark: "--su-celadon-dark",
  hanji: "--su-hanji",
  hanjiWarm: "--su-hanji-warm",
  hanjiBorder: "--su-hanji-border",
  ink: "--su-ink",
  inkMuted: "--su-ink-muted",
  taegukBlue: "--su-taeguk-blue",
  taegukBlueLight: "--su-taeguk-blue-light",
} as const;
