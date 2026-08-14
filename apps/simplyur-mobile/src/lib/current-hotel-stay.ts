import type { TripParsedSegment } from '@/src/api/trip-inbox';

function parseMs(iso: unknown): number | null {
  if (typeof iso !== 'string' || !iso.trim()) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: mobile pickCurrentHotelStay — manifest */
export function pickCurrentHotelStay(
  segments: TripParsedSegment[],
  nowMs: number = Date.now(),
): TripParsedSegment | null {
  let best: TripParsedSegment | null = null;
  let bestIn = Number.NEGATIVE_INFINITY;
  for (const seg of segments) {
    if (seg.payload.type !== 'hotel') continue;
    const inAt = parseMs(seg.payload.check_in_at);
    const outAt = parseMs(seg.payload.check_out_at);
    if (inAt == null || outAt == null) continue;
    if (inAt <= nowMs && nowMs < outAt && inAt >= bestIn) {
      best = seg;
      bestIn = inAt;
    }
  }
  return best;
}

export function pickUpcomingHotelStay(
  segments: TripParsedSegment[],
  nowMs: number = Date.now(),
): TripParsedSegment | null {
  let best: TripParsedSegment | null = null;
  let bestIn = Number.POSITIVE_INFINITY;
  for (const seg of segments) {
    if (seg.payload.type !== 'hotel') continue;
    const inAt = parseMs(seg.payload.check_in_at);
    if (inAt == null || inAt <= nowMs) continue;
    if (inAt < bestIn) {
      best = seg;
      bestIn = inAt;
    }
  }
  return best;
}

export function hotelDisplayNames(payload: Record<string, unknown>) {
  const nameUser =
    (typeof payload.property_name_user === 'string' && payload.property_name_user) ||
    (typeof payload.property_name === 'string' && payload.property_name) ||
    null;
  const nameDest =
    (typeof payload.property_name_dest === 'string' && payload.property_name_dest) || null;
  const addrUser =
    (typeof payload.address_user === 'string' && payload.address_user) || null;
  const addrDest =
    (typeof payload.address_dest === 'string' && payload.address_dest) || null;
  const destLang =
    typeof payload.dest_lang === 'string' && payload.dest_lang ? payload.dest_lang : 'ko';
  return { nameUser, nameDest, addrUser, addrDest, destLang };
}
