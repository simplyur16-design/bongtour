/**
 * 동선지도 Gemini — 교통 mode 보강만 (좌표·도시 발명 금지).
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: buildBongtourRouteMapGeminiPrompt — manifest
 */

import { BONGTOUR_ROUTE_MAP_GEMINI_VERSION } from '@/lib/bongtour-route-map-gemini-types'
import type { BongtourRouteMapGeminiInput } from '@/lib/bongtour-route-map-gemini-types'
import { BONGTOUR_ROUTE_MAP_TRANSPORT_LABEL } from '@/lib/bongtour-route-map-transport-ssot'

export function buildBongtourRouteMapGeminiPrompt(input: BongtourRouteMapGeminiInput): string {
  const cities = input.cities.map((c) => c.trim()).filter(Boolean)
  if (cities.length < 2) throw new Error('buildBongtourRouteMapGeminiPrompt: cities.length < 2')

  const need = input.edgesNeedingMode?.length
    ? input.edgesNeedingMode
    : cities.slice(0, -1).map((_, i) => i + 1)

  const modes = Object.keys(BONGTOUR_ROUTE_MAP_TRANSPORT_LABEL).join('|')
  const nodeSkeleton = cities.map((city, i) => ({ order: i + 1, city }))
  const edgeSkeleton = cities.slice(0, -1).map((_, i) => ({
    from: i + 1,
    to: i + 2,
    mode: 'transfer',
    label: '이동',
  }))

  const scheduleLines = input.schedule
    .slice(0, 12)
    .map((d) => `- D${d.day} ${d.title} / ${d.routeText}`)
    .join('\n')

  const skeleton = JSON.stringify({
    version: BONGTOUR_ROUTE_MAP_GEMINI_VERSION,
    layout: 'geographic',
    nodes: nodeSkeleton,
    edges: edgeSkeleton,
    routeSummary: '',
  })

  return [
    '동선지도 JSON만. 좌표·km·펜스·설명문 금지.',
    `nodes.city·order는 skeleton과 동일. edges.from/to 동일.`,
    `보강 대상 from=${JSON.stringify(need)} — 일정·포함 원문에 있는 교통만 mode로.`,
    `mode=${modes}. 국내선이면 mode=domestic_flight label=국내선 이동.`,
    `대형버스/관광버스면 coach. 전용차량은 원문에 「전용차량」있을 때만. 추측 금지.`,
    `version=${BONGTOUR_ROUTE_MAP_GEMINI_VERSION} layout=geographic`,
    `hero=${input.heroShortTitle}`,
    input.productId ? `productId=${input.productId}` : null,
    `cities=${JSON.stringify(cities)}`,
    'skeleton=' + skeleton,
    'schedule:',
    scheduleLines || '(없음)',
  ]
    .filter((line) => line != null)
    .join('\n')
}
