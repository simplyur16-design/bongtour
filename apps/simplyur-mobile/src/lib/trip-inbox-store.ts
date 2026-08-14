/**
 * Persist Trip Inbox timeline on device (pre-DB).
 * REGRESSION-FREEZE[simplyur-trip-inbox-ssot]: mobile SecureStore timeline — manifest
 */
import * as SecureStore from 'expo-secure-store';

import type { TripParsedSegment } from '@/src/api/trip-inbox';

const STORAGE_KEY = 'simplyur_trip_inbox_v1';

export async function loadTripInboxSegments(): Promise<TripParsedSegment[]> {
  try {
    const raw = (await SecureStore.getItemAsync(STORAGE_KEY)) ?? '';
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { segments?: TripParsedSegment[] };
    return Array.isArray(parsed.segments) ? parsed.segments : [];
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

  return [...byKey.values(), ...noKey].sort((a, b) => {
    const ta = a.sort_at ? Date.parse(a.sort_at) : Number.POSITIVE_INFINITY;
    const tb = b.sort_at ? Date.parse(b.sort_at) : Number.POSITIVE_INFINITY;
    return ta - tb;
  });
}
