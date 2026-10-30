/** Simplyur eSIM brand assets — approved luggage-tag wordmark + eSIM mark (favicon) */
export const SIMPLYUR_BRAND = {
  simplyColor: "#243656",
  urColor: "#E8654F",
  coral: "#E8654F",
  navy: "#243656",
  navyHover: "#152C5C",
  bg: "#ECEEF2",
  bgSoft: "#F4F5F7",
  border: "#DDE1E8",
  navMuted: "#6B7280",
  tagline: "eSIM for international visitors to Korea",
  /** Approved 2026-10-24 (option A, eSIM luggage tag) — light-background variant, byte-identical copy of final/esim/simplyur-wordmark-light.svg */
  wordmarkImage: "/simplyur/brand/simplyur-esim-wordmark-light.svg",
  /** viewBox 1408.59 x 277.20 */
  wordmarkAspect: 1408.59 / 277.2,
  /** eSIM small mark (final/esim/favicon.svg) — sign-in / reset symbol + favicon */
  symbolImage: "/simplyur/brand/simplyur-esim-favicon.svg",
  faviconIco: "/simplyur/brand/simplyur-esim-favicon.ico",
  faviconSvg: "/simplyur/brand/simplyur-esim-favicon.svg",
  appleTouchIcon: "/simplyur/brand/simplyur-esim-apple-touch-icon.png",
  icon192: "/simplyur/brand/simplyur-esim-icon-192.png",
  icon512: "/simplyur/brand/simplyur-esim-icon-512.png",
  ogImage: "/simplyur/brand/simplyur-esim-og-image.png",
  /** legacy (old pin) — no longer referenced */
  iconImage: "/simplyur/brand/simplyur-icon.png",
} as const;

export type SimplyurWordmarkSize = "sm" | "md" | "lg" | "hero";
