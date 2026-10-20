/**
 * Gemini 동선지도 초안 검증 — 도시 발명·좌표 거부, mode enum 필수.
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: validateBongtourRouteMapGeminiDraft — manifest
 */

import {
  BONGTOUR_ROUTE_MAP_GEMINI_VERSION,
  type BongtourRouteMapGeminiDraft,
  type BongtourRouteMapGeminiEdge,
  type BongtourRouteMapGeminiNode,
  type BongtourRouteMapGeminiValidateResult,
} from '@/lib/bongtour-route-map-gemini-types'
import {
  BONGTOUR_ROUTE_MAP_TRANSPORT_LABEL,
  isBongtourRouteMapTransportMode,
} from '@/lib/bongtour-route-map-transport-ssot'

const BANNED_FLUFF =
  /프리미엄|환상적|최고의|감동|힐링|럭셔리|특별한\s*추억|꿈같은|황홀|완벽한\s*여행/u

function normCity(s: string): string {
  return s.normalize('NFC').replace(/\s+/g, ' ').trim()
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  return v as Record<string, unknown>
}

function hasForbiddenCoords(rec: Record<string, unknown>): boolean {
  for (const k of Object.keys(rec)) {
    const lk = k.toLowerCase()
    if (
      lk === 'lat' ||
      lk === 'lng' ||
      lk === 'lon' ||
      lk === 'longitude' ||
      lk === 'latitude' ||
      lk === 'coords' ||
      lk === 'coordinates' ||
      lk === 'km' ||
      lk === 'distancekm'
    ) {
      const v = rec[k]
      if (v != null && v !== '') return true
    }
  }
  return false
}

function fluffHit(text: string | null | undefined): string | null {
  const t = String(text || '').trim()
  if (!t) return null
  const m = t.match(BANNED_FLUFF)
  return m ? m[0] : null
}

export function validateBongtourRouteMapGeminiDraft(
  inputCities: readonly string[],
  raw: unknown
): BongtourRouteMapGeminiValidateResult {
  const cities = inputCities.map(normCity).filter(Boolean)
  if (cities.length < 2) {
    return { ok: false, reason: 'cities_lt_2', detail: `n=${cities.length}` }
  }

  const root = asRecord(raw)
  if (!root) return { ok: false, reason: 'not_object' }
  if (hasForbiddenCoords(root)) return { ok: false, reason: 'root_has_coordinates' }

  const version = String(root.version ?? '').trim()
  if (version !== BONGTOUR_ROUTE_MAP_GEMINI_VERSION) {
    return { ok: false, reason: 'bad_version', detail: version || '(empty)' }
  }

  const layout = String(root.layout ?? '').trim()
  if (layout !== 'geographic') {
    return { ok: false, reason: 'bad_layout', detail: layout || '(empty)' }
  }

  const routeSummary = String(root.routeSummary ?? root.storyCaption ?? '')
    .trim()
    .slice(0, 160)
  if (!routeSummary) return { ok: false, reason: 'empty_route_summary' }
  const fluff = fluffHit(routeSummary)
  if (fluff) return { ok: false, reason: 'route_summary_fluff', detail: fluff }

  if (!Array.isArray(root.nodes)) return { ok: false, reason: 'nodes_not_array' }
  if (!Array.isArray(root.edges)) return { ok: false, reason: 'edges_not_array' }

  const nodes: BongtourRouteMapGeminiNode[] = []
  for (let i = 0; i < root.nodes.length; i++) {
    const r = asRecord(root.nodes[i])
    if (!r) return { ok: false, reason: 'bad_node', detail: `nodes[${i}]` }
    if (hasForbiddenCoords(r)) return { ok: false, reason: 'bad_node', detail: `coords@${i}` }
    const order = Math.trunc(Number(r.order))
    const city = normCity(String(r.city ?? ''))
    if (!Number.isFinite(order) || order < 1 || !city) {
      return { ok: false, reason: 'bad_node', detail: `nodes[${i}]` }
    }
    nodes.push({ order, city })
  }

  if (nodes.length !== cities.length) {
    return {
      ok: false,
      reason: 'city_count_mismatch',
      detail: `nodes=${nodes.length} cities=${cities.length}`,
    }
  }

  const byOrder = [...nodes].sort((a, b) => a.order - b.order)
  for (let i = 0; i < byOrder.length; i++) {
    if (byOrder[i]!.order !== i + 1) {
      return { ok: false, reason: 'order_not_contiguous', detail: `at ${i}` }
    }
    if (normCity(byOrder[i]!.city) !== cities[i]) {
      return {
        ok: false,
        reason: 'city_invent_or_delete',
        detail: `order ${i + 1}: got "${byOrder[i]!.city}" want "${cities[i]}"`,
      }
    }
  }

  const edges: BongtourRouteMapGeminiEdge[] = []
  for (let i = 0; i < root.edges.length; i++) {
    const r = asRecord(root.edges[i])
    if (!r) return { ok: false, reason: 'bad_edge', detail: `edges[${i}]` }
    if (hasForbiddenCoords(r)) return { ok: false, reason: 'bad_edge', detail: `coords@${i}` }
    const from = Math.trunc(Number(r.from))
    const to = Math.trunc(Number(r.to))
    if (!Number.isFinite(from) || !Number.isFinite(to) || to !== from + 1) {
      return { ok: false, reason: 'edge_not_adjacent', detail: `${from}->${to}` }
    }
    if (from < 1 || to > cities.length) {
      return { ok: false, reason: 'edge_out_of_range', detail: `${from}->${to}` }
    }
    // legacy kind → mode 매핑
    let modeRaw = r.mode ?? r.kind
    if (modeRaw === 'excursion' || modeRaw === 'other') modeRaw = 'transfer'
    if (!isBongtourRouteMapTransportMode(modeRaw)) {
      return { ok: false, reason: 'bad_mode', detail: String(modeRaw) }
    }
    const label =
      String(r.label ?? '').trim().slice(0, 24) || BONGTOUR_ROUTE_MAP_TRANSPORT_LABEL[modeRaw]
    if (fluffHit(label)) return { ok: false, reason: 'edge_label_fluff', detail: label }
    edges.push({ from, to, mode: modeRaw, label })
  }

  if (edges.length !== cities.length - 1) {
    return {
      ok: false,
      reason: 'edge_count_mismatch',
      detail: `edges=${edges.length} need=${cities.length - 1}`,
    }
  }
  const fromSet = new Set(edges.map((e) => e.from))
  for (let i = 1; i < cities.length; i++) {
    if (!fromSet.has(i)) return { ok: false, reason: 'edge_missing', detail: `from=${i}` }
  }

  const draft: BongtourRouteMapGeminiDraft = {
    version: BONGTOUR_ROUTE_MAP_GEMINI_VERSION,
    layout: 'geographic',
    nodes: byOrder,
    edges: [...edges].sort((a, b) => a.from - b.from),
    routeSummary,
  }
  return { ok: true, draft }
}
