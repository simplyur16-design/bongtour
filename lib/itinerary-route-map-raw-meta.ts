import {
  ITINERARY_ROUTE_MAP_PROMPT_VERSION,
  ITINERARY_ROUTE_MAP_RAW_META_KEY,
  ITINERARY_ROUTE_MAP_SOURCE,
  type ItineraryRouteMapMeta,
} from '@/lib/itinerary-route-map-types'

function parseRawMetaObject(rawMeta: string | null | undefined): Record<string, unknown> {
  if (!rawMeta?.trim()) return {}
  try {
    const obj = JSON.parse(rawMeta) as unknown
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj as Record<string, unknown>
  } catch {
    /* ignore */
  }
  return {}
}

export function getItineraryRouteMapFromRawMeta(
  rawMeta: string | null | undefined,
): ItineraryRouteMapMeta | null {
  const obj = parseRawMetaObject(rawMeta)
  const v = obj[ITINERARY_ROUTE_MAP_RAW_META_KEY]
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const m = v as Record<string, unknown>
  const url = typeof m.url === 'string' ? m.url.trim() : ''
  if (!url) return null
  return {
    url,
    source: ITINERARY_ROUTE_MAP_SOURCE,
    promptVersion:
      typeof m.promptVersion === 'string' && m.promptVersion
        ? (m.promptVersion as typeof ITINERARY_ROUTE_MAP_PROMPT_VERSION)
        : ITINERARY_ROUTE_MAP_PROMPT_VERSION,
    generatedAt: typeof m.generatedAt === 'string' ? m.generatedAt : '',
    countryKo: typeof m.countryKo === 'string' ? m.countryKo : '',
    countryEn: typeof m.countryEn === 'string' ? m.countryEn : '',
    hubs: Array.isArray(m.hubs) ? (m.hubs as ItineraryRouteMapMeta['hubs']) : [],
    legs: Array.isArray(m.legs) ? (m.legs as ItineraryRouteMapMeta['legs']) : [],
  }
}

export function mergeItineraryRouteMapIntoRawMeta(
  rawMeta: string | null | undefined,
  mapMeta: ItineraryRouteMapMeta,
): string {
  const base = parseRawMetaObject(rawMeta)
  return JSON.stringify({
    ...base,
    [ITINERARY_ROUTE_MAP_RAW_META_KEY]: mapMeta,
  })
}

export function buildItineraryRouteMapMeta(input: {
  url: string
  countryKo: string
  countryEn: string
  hubs: ItineraryRouteMapMeta['hubs']
  legs: ItineraryRouteMapMeta['legs']
  generatedAt?: string
}): ItineraryRouteMapMeta {
  return {
    url: input.url,
    source: ITINERARY_ROUTE_MAP_SOURCE,
    promptVersion: ITINERARY_ROUTE_MAP_PROMPT_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    countryKo: input.countryKo,
    countryEn: input.countryEn,
    hubs: input.hubs,
    legs: input.legs,
  }
}
