/** design_handoff_home — Home tab tokens (shared with Plans/Guide) */
export const SIMPLYUR_HOME_DESIGN = {
  bg: "#FFF4EF",
  navy: "#12233F",
  coral: "#FF6B4A",
  muted: "#6B7686",
  faint: "#98A0AB",
  border: "#E1DFD9",
  bannerBg: "#FDEDE7",
  bannerBorder: "#FBD9CB",
  iconTileBg: "#FDEDE7",
  cardRadius: 16,
  iconTileRadius: 10,
  iconTileSize: 36,
  buttonHeight: 56,
  buttonRadius: 16,
  paddingH: 22,
  sectionGap: 24,
  heroTitleSize: 34,
  ctaShadow: "0 12px 26px -12px rgba(255,107,74,0.6)",
} as const;

export const SIMPLYUR_HOME_WHY_KEYS = ["instant", "support", "refund"] as const;
export type SimplyurHomeWhyKey = (typeof SIMPLYUR_HOME_WHY_KEYS)[number];

/** Emoji glyphs from design_handoff_home — replace with SVG icons later if needed */
export const SIMPLYUR_HOME_WHY_ICONS: Record<SimplyurHomeWhyKey, string> = {
  instant: "⚡",
  support: "💬",
  refund: "↺",
};
