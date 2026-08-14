/**
 * Sort My Trip timeline: start at the item closest to now, then continue in
 * itinerary order (A→B→C→D→E→F). Past items wrap after the remaining trip.
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: nearest-to-now timeline — manifest
 */

function tMs(seg: { sort_at?: string | null }): number {
  if (!seg.sort_at) return Number.NaN;
  const n = Date.parse(seg.sort_at);
  return Number.isFinite(n) ? n : Number.NaN;
}

function distMs(seg: { sort_at?: string | null }, nowMs: number): number {
  const t = tMs(seg);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.abs(t - nowMs);
}

function compareChrono(
  a: { sort_at?: string | null },
  b: { sort_at?: string | null },
): number {
  const ta = tMs(a);
  const tb = tMs(b);
  const aOk = Number.isFinite(ta);
  const bOk = Number.isFinite(tb);
  if (aOk !== bOk) return aOk ? -1 : 1;
  if (!aOk) return 0;
  return ta - tb;
}

/** Closer to now wins; equal distance prefers the upcoming (future) item. */
export function compareTripSegmentsNearestNow(
  a: { sort_at?: string | null },
  b: { sort_at?: string | null },
  nowMs: number = Date.now(),
): number {
  const da = distMs(a, nowMs);
  const db = distMs(b, nowMs);
  if (da !== db) return da - db;
  const ta = tMs(a);
  const tb = tMs(b);
  const aOk = Number.isFinite(ta);
  const bOk = Number.isFinite(tb);
  if (aOk !== bOk) return aOk ? -1 : 1;
  if (!aOk) return 0;
  const aFuture = ta >= nowMs;
  const bFuture = tb >= nowMs;
  if (aFuture !== bFuture) return aFuture ? -1 : 1;
  return ta - tb;
}

export function sortTripSegmentsNearestNow<T extends { sort_at?: string | null }>(
  segments: T[],
  nowMs: number = Date.now(),
): T[] {
  const dated: T[] = [];
  const undated: T[] = [];
  for (const seg of segments) {
    if (Number.isFinite(tMs(seg))) dated.push(seg);
    else undated.push(seg);
  }
  dated.sort(compareChrono);
  if (dated.length <= 1) return [...dated, ...undated];

  let start = 0;
  for (let i = 1; i < dated.length; i++) {
    if (compareTripSegmentsNearestNow(dated[i]!, dated[start]!, nowMs) < 0) {
      start = i;
    }
  }
  return [...dated.slice(start), ...dated.slice(0, start), ...undated];
}
