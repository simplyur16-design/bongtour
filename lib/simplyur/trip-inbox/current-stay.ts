/**
 * Current hotel stay from timeline segments.
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: pickCurrentHotelStay — manifest
 */
import type { TripHotelSegmentPayload, TripParsedSegment } from "@/lib/simplyur/trip-inbox/types";

function parseMs(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** Hotel where check_in ≤ now < check_out (local wall times treated as absolute). */
export function pickCurrentHotelStay(
  segments: TripParsedSegment[],
  nowMs: number = Date.now(),
): TripParsedSegment | null {
  const hotels = segments.filter((s) => s.payload.type === "hotel");
  let best: TripParsedSegment | null = null;
  let bestIn = Number.NEGATIVE_INFINITY;

  for (const seg of hotels) {
    const p = seg.payload as TripHotelSegmentPayload;
    const inAt = parseMs(p.check_in_at);
    const outAt = parseMs(p.check_out_at);
    if (inAt == null || outAt == null) continue;
    if (inAt <= nowMs && nowMs < outAt && inAt >= bestIn) {
      best = seg;
      bestIn = inAt;
    }
  }
  return best;
}

/** Next upcoming hotel when not currently staying. */
export function pickUpcomingHotelStay(
  segments: TripParsedSegment[],
  nowMs: number = Date.now(),
): TripParsedSegment | null {
  let best: TripParsedSegment | null = null;
  let bestIn = Number.POSITIVE_INFINITY;
  for (const seg of segments) {
    if (seg.payload.type !== "hotel") continue;
    const inAt = parseMs(seg.payload.check_in_at);
    if (inAt == null || inAt <= nowMs) continue;
    if (inAt < bestIn) {
      best = seg;
      bestIn = inAt;
    }
  }
  return best;
}
