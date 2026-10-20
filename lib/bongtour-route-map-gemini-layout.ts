/**
 * 지오코드 실패 시 SVG 폴백 레이아웃 (지리맵 우선).
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: layoutBongtourRouteMapStoryboard — manifest
 */

import type { BongtourRouteMapGeminiDraft } from '@/lib/bongtour-route-map-gemini-types'
import type { BongtourRouteMapTransportMode } from '@/lib/bongtour-route-map-transport-ssot'

export type BongtourRouteMapStoryboardPoint = {
  order: number
  city: string
  x: number
  y: number
  dayHint: string | null
  blurb: string | null
}

export type BongtourRouteMapStoryboardEdge = {
  from: number
  to: number
  x1: number
  y1: number
  x2: number
  y2: number
  cx: number
  cy: number
  label: string | null
  kind: BongtourRouteMapTransportMode | null
}

export type BongtourRouteMapStoryboardLayout = {
  width: number
  height: number
  storyCaption: string
  points: BongtourRouteMapStoryboardPoint[]
  edges: BongtourRouteMapStoryboardEdge[]
  pathD: string
}

const Y_BASE = 78
const Y_HIGH = 42

function yForIncoming(mode: BongtourRouteMapTransportMode | null | undefined, index: number): number {
  if (mode === 'cable_car' || mode === 'flight' || mode === 'domestic_flight') return Y_HIGH
  return index % 2 === 0 ? Y_BASE : 56
}

export function layoutBongtourRouteMapStoryboard(
  draft: BongtourRouteMapGeminiDraft,
  opts?: { width?: number; height?: number; padX?: number }
): BongtourRouteMapStoryboardLayout {
  const width = opts?.width ?? 320
  const height = opts?.height ?? 140
  const padX = opts?.padX ?? 36
  const n = draft.nodes.length
  const span = Math.max(width - padX * 2, 1)
  const edgeByTo = new Map(draft.edges.map((e) => [e.to, e]))

  const points: BongtourRouteMapStoryboardPoint[] = draft.nodes.map((node, i) => {
    const x = padX + (n <= 1 ? span / 2 : (i * span) / (n - 1))
    const incoming = edgeByTo.get(node.order)
    const y = yForIncoming(incoming?.mode ?? null, i)
    return {
      order: node.order,
      city: node.city,
      x,
      y,
      dayHint: null,
      blurb: null,
    }
  })

  const byOrder = new Map(points.map((p) => [p.order, p]))
  const edges: BongtourRouteMapStoryboardEdge[] = draft.edges.map((e) => {
    const a = byOrder.get(e.from)!
    const b = byOrder.get(e.to)!
    return {
      from: e.from,
      to: e.to,
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      cx: (a.x + b.x) / 2,
      cy: Math.min(a.y, b.y) - 18,
      label: e.label ?? null,
      kind: e.mode ?? null,
    }
  })

  const pathD =
    points.length === 0
      ? ''
      : points
          .map((p, i) => {
            if (i === 0) return `M ${p.x} ${p.y}`
            const prev = points[i - 1]!
            const c1x = prev.x + (p.x - prev.x) * 0.35
            const c1y = prev.y - 28
            const c2x = prev.x + (p.x - prev.x) * 0.65
            const c2y = p.y - 28
            return `C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p.x} ${p.y}`
          })
          .join(' ')

  return {
    width,
    height,
    storyCaption: draft.routeSummary,
    points,
    edges,
    pathD,
  }
}
