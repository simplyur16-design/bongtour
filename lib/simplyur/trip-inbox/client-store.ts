/**
 * Client-side Trip Inbox store (pre-DB). Merge by merge_key / temp_id.
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: local timeline store — manifest
 */
import type { TripParsedSegment } from "@/lib/simplyur/trip-inbox/types";
import { sortTripSegmentsNearestNow } from "@/lib/simplyur/trip-inbox/timeline-sort";

const STORAGE_KEY = "simplyur.trip-inbox.v1";

export function loadTripInboxSegments(): TripParsedSegment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { segments?: TripParsedSegment[] };
    return Array.isArray(parsed.segments) ? parsed.segments : [];
  } catch {
    return [];
  }
}

export function saveTripInboxSegments(segments: TripParsedSegment[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ segments, updatedAt: Date.now() }));
}

export function mergeTripInboxSegments(
  existing: TripParsedSegment[],
  incoming: TripParsedSegment[],
): TripParsedSegment[] {
  const byKey = new Map<string, TripParsedSegment>();
  const noKey: TripParsedSegment[] = [];

  const put = (s: TripParsedSegment) => {
    if (s.merge_key) {
      const prev = byKey.get(s.merge_key);
      if (!prev || s.confidence >= prev.confidence) byKey.set(s.merge_key, s);
      return;
    }
    const idx = noKey.findIndex((x) => x.temp_id === s.temp_id);
    if (idx >= 0) noKey[idx] = s;
    else noKey.push(s);
  };

  for (const s of existing) put(s);
  for (const s of incoming) put(s);

  return sortTripSegmentsNearestNow([...byKey.values(), ...noKey]);
}
