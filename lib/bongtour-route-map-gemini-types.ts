/**
 * 동선지도 Gemini 산출 — geographic + transport mode.
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: types — manifest
 * @see docs/design/bongtour-route-map-gemini-v1.md
 */

import type { BongtourRouteMapTransportMode } from '@/lib/bongtour-route-map-transport-ssot'

export const BONGTOUR_ROUTE_MAP_GEMINI_VERSION = 'route-map-gemini-v1' as const

export type BongtourRouteMapGeminiLayout = 'geographic'

export type BongtourRouteMapGeminiNode = {
  order: number
  city: string
}

export type BongtourRouteMapGeminiEdge = {
  from: number
  to: number
  mode: BongtourRouteMapTransportMode
  label: string
}

export type BongtourRouteMapGeminiDraft = {
  version: typeof BONGTOUR_ROUTE_MAP_GEMINI_VERSION
  layout: BongtourRouteMapGeminiLayout
  nodes: BongtourRouteMapGeminiNode[]
  edges: BongtourRouteMapGeminiEdge[]
  routeSummary: string
}

export type BongtourRouteMapGeminiScheduleDay = {
  day: number
  title: string
  routeText: string
  description?: string
}

export type BongtourRouteMapGeminiInput = {
  productId?: string
  heroShortTitle: string
  cities: string[]
  schedule: BongtourRouteMapGeminiScheduleDay[]
  /** transfer 등 보강이 필요한 from 번호 */
  edgesNeedingMode?: number[]
}

export type BongtourRouteMapGeminiValidateOk = {
  ok: true
  draft: BongtourRouteMapGeminiDraft
}

export type BongtourRouteMapGeminiValidateFail = {
  ok: false
  reason: string
  detail?: string
}

export type BongtourRouteMapGeminiValidateResult =
  | BongtourRouteMapGeminiValidateOk
  | BongtourRouteMapGeminiValidateFail
