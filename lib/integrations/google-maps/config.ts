/**
 * Google Maps integration config — embed + deep links.
 * Used by simplyur trip helpers and Bong Tour destination pages.
 */

export const GOOGLE_MAPS_EMBED_ENV = "NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY" as const;

/** Mobile native Maps SDK key (future). */
export const GOOGLE_MAPS_MOBILE_ENV = "EXPO_PUBLIC_GOOGLE_MAPS_API_KEY" as const;

export function getGoogleMapsEmbedKey(): string | null {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY?.trim();
  return key || null;
}

export function isGoogleMapsEmbedConfigured(): boolean {
  return getGoogleMapsEmbedKey() != null;
}

/** Feature gate for simplyur map UI (trip planning — not yet shipped). */
export const SIMPLYUR_MAPS_ENABLED = false as const;
