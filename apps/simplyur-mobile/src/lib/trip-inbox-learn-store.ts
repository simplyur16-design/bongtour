/**
 * Learned form parsers + source cache for correction → parser update.
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: mobile form-parser store — manifest
 */
import * as SecureStore from 'expo-secure-store';

import type { TripFormParser } from '@/src/api/trip-inbox';

const FORMS_KEY = 'simplyur_trip_forms_v1';
const SOURCES_KEY = 'simplyur_trip_sources_v1';

export async function loadTripFormParsers(): Promise<TripFormParser[]> {
  try {
    const raw = (await SecureStore.getItemAsync(FORMS_KEY)) ?? '';
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { parsers?: TripFormParser[] };
    return Array.isArray(parsed.parsers) ? parsed.parsers : [];
  } catch {
    return [];
  }
}

export async function saveTripFormParser(parser: TripFormParser | null | undefined): Promise<void> {
  if (!parser?.form_id) return;
  try {
    const rest = (await loadTripFormParsers()).filter(
      (p) => p.form_id !== parser.form_id && p.fingerprint !== parser.fingerprint,
    );
    await SecureStore.setItemAsync(FORMS_KEY, JSON.stringify({ parsers: [parser, ...rest].slice(0, 40) }));
  } catch {
    /* size / unavailable */
  }
}

const sourceMem = new Map<string, string>();

export function rememberTripSource(tempId: string, text: string): void {
  if (!tempId || !text) return;
  sourceMem.set(tempId, text.slice(0, 40_000));
  if (sourceMem.size > 20) {
    const first = sourceMem.keys().next().value;
    if (first) sourceMem.delete(first);
  }
  void persistSources();
}

export function recallTripSource(tempId: string): string {
  return sourceMem.get(tempId) ?? '';
}

async function persistSources(): Promise<void> {
  try {
    const map: Record<string, string> = {};
    for (const [k, v] of sourceMem) map[k] = v.slice(0, 8_000);
    await SecureStore.setItemAsync(SOURCES_KEY, JSON.stringify({ map }));
  } catch {
    /* ignore */
  }
}

export async function hydrateTripSources(): Promise<void> {
  try {
    const raw = (await SecureStore.getItemAsync(SOURCES_KEY)) ?? '';
    if (!raw) return;
    const parsed = JSON.parse(raw) as { map?: Record<string, string> };
    if (!parsed.map) return;
    for (const [k, v] of Object.entries(parsed.map)) sourceMem.set(k, v);
  } catch {
    /* ignore */
  }
}
