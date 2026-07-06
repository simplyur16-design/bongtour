import { getGoogleMapsEmbedKey } from "./config";

export type GoogleMapsPlaceQuery = {
  /** Free-text place name, e.g. "Gyeongbokgung Palace, Seoul" */
  query: string;
  /** Optional center for embed (lat,lng) */
  center?: { lat: number; lng: number };
  zoom?: number;
};

function encodeQuery(q: string): string {
  return encodeURIComponent(q.trim() || "South Korea");
}

/** Google Maps search deep link (works without API key). */
export function googleMapsSearchUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeQuery(query)}`;
}

/** Embed iframe src when NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY is set. */
export function googleMapsEmbedUrl(input: GoogleMapsPlaceQuery): string | null {
  const key = getGoogleMapsEmbedKey();
  if (!key) return null;
  const q = encodeQuery(input.query);
  if (input.center) {
    const { lat, lng } = input.center;
    const z = input.zoom ?? 14;
    return `https://www.google.com/maps/embed/v1/view?key=${key}&center=${lat},${lng}&zoom=${z}`;
  }
  return `https://www.google.com/maps/embed/v1/place?key=${key}&q=${q}`;
}
