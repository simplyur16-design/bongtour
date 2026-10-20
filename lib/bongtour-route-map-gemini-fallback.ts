/**
 * Gemini 없이 A체인+교통추론으로 draft 구성.
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: buildBongtourRouteMapGeminiFallback — manifest
 */

import {
  BONGTOUR_ROUTE_MAP_GEMINI_VERSION,
  type BongtourRouteMapGeminiDraft,
  type BongtourRouteMapGeminiScheduleDay,
} from '@/lib/bongtour-route-map-gemini-types'
import {
  formatBongtourRouteMapTransportSummary,
  inferBongtourRouteMapTransport,
} from '@/lib/bongtour-route-map-transport-ssot'

export function buildBongtourRouteMapGeminiFallback(
  cities: readonly string[],
  opts?: {
    schedule?: readonly BongtourRouteMapGeminiScheduleDay[]
    sourceText?: string | null
  }
): BongtourRouteMapGeminiDraft | null {
  const list = cities.map((c) => c.normalize('NFC').trim()).filter(Boolean)
  if (list.length < 2) return null

  const transport = inferBongtourRouteMapTransport(list, opts?.schedule ?? [], {
    sourceText: opts?.sourceText,
  })

  return {
    version: BONGTOUR_ROUTE_MAP_GEMINI_VERSION,
    layout: 'geographic',
    nodes: list.map((city, i) => ({ order: i + 1, city })),
    edges: transport.map((e) => ({
      from: e.from,
      to: e.to,
      mode: e.mode,
      label: e.label,
    })),
    routeSummary: formatBongtourRouteMapTransportSummary(list, transport),
  }
}
