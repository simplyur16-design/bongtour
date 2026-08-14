/**
 * Persist Trip Inbox timeline on device (pre-DB).
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: mobile SecureStore timeline — manifest
 */
import * as SecureStore from 'expo-secure-store';

import type { TripParsedSegment } from '@/src/api/trip-inbox';

const STORAGE_KEY = 'simplyur_trip_inbox_v1';

function tMs(seg: { sort_at?: string | null }): number {
  if (!seg.sort_at) return Number.NaN;
  const n = Date.parse(seg.sort_at);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Keep in sync with lib/simplyur/trip-inbox/timeline-sort.ts — nearest now, then A→B→C… */
function sortNearestNow<T extends { sort_at?: string | null }>(segments: T[]): T[] {
  const now = Date.now();
  const dated: T[] = [];
  const undated: T[] = [];
  for (const seg of segments) {
    if (Number.isFinite(tMs(seg))) dated.push(seg);
    else undated.push(seg);
  }
  dated.sort((a, b) => tMs(a) - tMs(b));
  if (dated.length <= 1) return [...dated, ...undated];

  let start = 0;
  let best = Number.isFinite(tMs(dated[0])) ? Math.abs(tMs(dated[0]) - now) : Number.POSITIVE_INFINITY;
  for (let i = 1; i < dated.length; i++) {
    const t = tMs(dated[i]);
    const d = Number.isFinite(t) ? Math.abs(t - now) : Number.POSITIVE_INFINITY;
    if (d < best) {
      best = d;
      start = i;
    } else if (d === best && t >= now && tMs(dated[start]) < now) {
      start = i;
    }
  }
  return [...dated.slice(start), ...dated.slice(0, start), ...undated];
}

export async function loadTripInboxSegments(): Promise<TripParsedSegment[]> {
  try {
    const raw = (await SecureStore.getItemAsync(STORAGE_KEY)) ?? '';
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { segments?: TripParsedSegment[] };
    return sortNearestNow(Array.isArray(parsed.segments) ? parsed.segments : []);
  } catch {
    return [];
  }
}

export async function saveTripInboxSegments(segments: TripParsedSegment[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ segments, updatedAt: Date.now() }));
  } catch {
    /* SecureStore size / unavailable — keep in-memory only */
  }
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

  return sortNearestNow([...byKey.values(), ...noKey]);
}
