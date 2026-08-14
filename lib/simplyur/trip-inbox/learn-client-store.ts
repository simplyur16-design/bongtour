/**
 * Persist learned form parsers + source text (for correction → parser update).
 * REGRESSION-FREEZE[simplyur-trip-inbox-forms]: client form-parser store — manifest
 */
import type { TripFormParser } from "@/lib/simplyur/trip-inbox/types";

const FORMS_KEY = "simplyur.trip-inbox.forms.v1";
const SOURCES_KEY = "simplyur.trip-inbox.sources.v1";
const MAX_SOURCES = 24;
const MAX_SOURCE_CHARS = 80_000;

export function loadTripFormParsers(): TripFormParser[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FORMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { parsers?: TripFormParser[] };
    return Array.isArray(parsed.parsers) ? parsed.parsers : [];
  } catch {
    return [];
  }
}

export function saveTripFormParser(parser: TripFormParser | null | undefined): void {
  if (typeof window === "undefined" || !parser?.form_id) return;
  const rest = loadTripFormParsers().filter((p) => p.form_id !== parser.form_id && p.fingerprint !== parser.fingerprint);
  window.localStorage.setItem(FORMS_KEY, JSON.stringify({ parsers: [parser, ...rest].slice(0, 80) }));
}

export function rememberTripSource(tempId: string, text: string): void {
  if (typeof window === "undefined" || !tempId || !text) return;
  try {
    const raw = window.localStorage.getItem(SOURCES_KEY);
    const parsed = raw ? (JSON.parse(raw) as { map?: Record<string, string> }) : {};
    const map = parsed.map && typeof parsed.map === "object" ? parsed.map : {};
    map[tempId] = text.slice(0, MAX_SOURCE_CHARS);
    const keys = Object.keys(map);
    if (keys.length > MAX_SOURCES) {
      for (const k of keys.slice(0, keys.length - MAX_SOURCES)) delete map[k];
    }
    window.localStorage.setItem(SOURCES_KEY, JSON.stringify({ map }));
  } catch {
    /* quota */
  }
}

export function recallTripSource(tempId: string): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(SOURCES_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { map?: Record<string, string> };
    return parsed.map?.[tempId] ?? "";
  } catch {
    return "";
  }
}
