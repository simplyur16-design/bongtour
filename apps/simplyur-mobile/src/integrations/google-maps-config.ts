/** Mobile Google Maps — sync with lib/integrations/google-maps/config.ts */
export const SIMPLYUR_MAPS_ENABLED = false as const;

export function getGoogleMapsMobileApiKey(): string | null {
  const key = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  return key || null;
}

export function isGoogleMapsMobileConfigured(): boolean {
  return getGoogleMapsMobileApiKey() != null;
}
