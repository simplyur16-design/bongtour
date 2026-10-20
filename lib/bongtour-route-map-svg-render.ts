/**
 * 동선지도 SVG → PNG — 터키 베이스라인(route-map-turkiye-baseline.jpg)과 동일 플랫 인포그래픽.
 * 민트 국토 실루엣 + 파란 일정 캡슐 + 한글 도시명 + 녹색점선(항공)/파란실선(육로) + 소요시간 라벨.
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: renderBongtourRouteMapSvgPng — manifest
 */

import sharp from 'sharp'
import { resolveBongtourRouteMapCityCoord } from '@/lib/bongtour-route-map-city-coords'
import {
  resolveBongtourRouteMapLandRings,
  ringBounds,
  type LonLat,
} from '@/lib/bongtour-route-map-land-silhouettes'
import type { BongtourRouteMapGeminiDraft } from '@/lib/bongtour-route-map-gemini-types'
import type { BongtourRouteMapTransportMode } from '@/lib/bongtour-route-map-transport-ssot'

type Pt = { order: number; city: string; x: number; y: number }

type ViewBox = {
  width: number
  height: number
  padX: number
  padY: number
  x0: number
  x1: number
  y0: number
  y1: number
}

const LAND_FILL = '#c5d6b4'
const LAND_STROKE = '#6b8f6a'
const BG = '#ffffff'
const CAPSULE_BLUE = '#1a6fd4'
const ROUTE_FLIGHT = '#2e7d32'
const ROUTE_LAND = '#42a5f5'
const COUNTRY_LABEL = '#c8cdc8'

function buildViewBox(draft: BongtourRouteMapGeminiDraft, width: number, height: number): ViewBox {
  const ordered = draft.nodes.slice().sort((a, b) => a.order - b.order)
  const cities = ordered.map((n) => n.city)
  const rings = resolveBongtourRouteMapLandRings(cities)
  const landB = ringBounds(rings)

  const coords = ordered.map((n, i) => {
    const c = resolveBongtourRouteMapCityCoord(n.city)
    return {
      lat: c?.lat ?? 48 + i * 0.4,
      lng: c?.lng ?? 14 + i * 0.8,
    }
  })
  const lats = coords.map((c) => c.lat)
  const lngs = coords.map((c) => c.lng)

  let minLat = Math.min(...lats)
  let maxLat = Math.max(...lats)
  let minLng = Math.min(...lngs)
  let maxLng = Math.max(...lngs)
  if (landB) {
    minLat = Math.min(minLat, landB.minLat)
    maxLat = Math.max(maxLat, landB.maxLat)
    minLng = Math.min(minLng, landB.minLng)
    maxLng = Math.max(maxLng, landB.maxLng)
  }

  const padFrac = 0.1
  const dLat = Math.max(maxLat - minLat, 0.8)
  const dLng = Math.max(maxLng - minLng, 1.0)
  return {
    width,
    height,
    padX: 88,
    padY: 72,
    y0: minLat - dLat * padFrac,
    y1: maxLat + dLat * padFrac,
    x0: minLng - dLng * padFrac,
    x1: maxLng + dLng * padFrac,
  }
}

function projectLonLat(lng: number, lat: number, v: ViewBox): { x: number; y: number } {
  const { width, height, padX, padY, x0, x1, y0, y1 } = v
  return {
    x: padX + ((lng - x0) / (x1 - x0)) * (width - padX * 2),
    y: padY + ((y1 - lat) / (y1 - y0)) * (height - padY * 2),
  }
}

function projectCities(draft: BongtourRouteMapGeminiDraft, v: ViewBox): Pt[] {
  return draft.nodes
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((n, i) => {
      const c = resolveBongtourRouteMapCityCoord(n.city)
      const lng = c?.lng ?? 14 + i * 0.8
      const lat = c?.lat ?? 48 + i * 0.4
      const { x, y } = projectLonLat(lng, lat, v)
      return { order: n.order, city: n.city, x, y }
    })
}

export function isFlightMode(mode: string | undefined): boolean {
  return mode === 'flight' || mode === 'domestic_flight'
}

function edgeBetween(
  edges: BongtourRouteMapGeminiDraft['edges'],
  fromOrder: number,
  toOrder: number
): BongtourRouteMapGeminiDraft['edges'][number] | undefined {
  return edges.find((e) => e.from === fromOrder && e.to === toOrder)
}

/** 버스·기차 등 = 직선 L, 항공만 곡선 Q (회귀 가드 문자열 유지). */
function pathThrough(points: Pt[], edges: BongtourRouteMapGeminiDraft['edges']): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`
  let d = `M ${points[0]!.x} ${points[0]!.y}`
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    if (isFlightMode(edgeBetween(edges, a.order, b.order)?.mode)) {
      const mx = (a.x + b.x) / 2
      const my = (a.y + b.y) / 2 - Math.min(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.18)
      d += ` Q ${mx} ${my} ${b.x} ${b.y}`
    } else {
      d += ` L ${b.x} ${b.y}`
    }
  }
  return d
}

function ringToPath(ring: LonLat[], v: ViewBox): string {
  if (ring.length < 3) return ''
  const pts = ring.map((p) => projectLonLat(p.lng, p.lat, v))
  let d = `M ${pts[0]!.x} ${pts[0]!.y}`
  for (let i = 1; i < pts.length; i++) d += ` L ${pts[i]!.x} ${pts[i]!.y}`
  return `${d} Z`
}

function landPathFromPoints(points: Pt[], pad: number): string {
  if (points.length === 0) return ''
  const pts = points.map((p) => ({ x: p.x, y: p.y }))
  const sorted = [...pts].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))
  const cross = (o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: { x: number; y: number }[] = []
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: { x: number; y: number }[] = []
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0) upper.pop()
    upper.push(p)
  }
  upper.pop()
  lower.pop()
  const hull = lower.concat(upper)
  if (hull.length < 3) {
    const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length
    const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length
    const r = pad + 120
    return `M ${cx - r} ${cy} A ${r} ${r * 0.72} 0 1 0 ${cx + r} ${cy} A ${r} ${r * 0.72} 0 1 0 ${cx - r} ${cy} Z`
  }
  const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length
  const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length
  const expanded = hull.map((p) => {
    const dx = p.x - cx
    const dy = p.y - cy
    const len = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / len) * pad, y: p.y + (dy / len) * pad }
  })
  let d = `M ${expanded[0]!.x} ${expanded[0]!.y}`
  for (let i = 1; i < expanded.length; i++) d += ` L ${expanded[i]!.x} ${expanded[i]!.y}`
  return `${d} Z`
}

/** 영문 국명 — 터키 샘플 TURKIYE처럼 은은하게 */
export function resolveBongtourRouteMapCountryEnLabel(cities: string[]): string {
  const norm = (c: string) => c.normalize('NFC').replace(/\s+/g, '').trim()
  const set = new Set(cities.map(norm))
  const tr = ['이스탄불', '카파도키아', '안탈리아', '파묵칼레'].some((c) => set.has(c))
  if (tr) return 'TURKIYE'
  const vn = ['다낭', '호이안', '하노이', '호치민'].some((c) => set.has(c))
  if (vn) return 'VIETNAM'
  const ce = ['부다페스트', '브르노', '프라하', '할슈타트', '잘츠부르크', '비엔나', '빈', '체스키부데요비치'].some(
    (c) => set.has(c)
  )
  if (ce) return 'CENTRAL EUROPE'
  return ''
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** 일정 캡슐 텍스트 — 방문 순번 (상세 stay 범위는 추후 schedule 연결) */
function dayCapsuleText(order: number): string {
  return String(order)
}

function estimateTravelLabel(
  mode: BongtourRouteMapTransportMode | string | undefined,
  distKm: number
): string {
  if (isFlightMode(mode)) {
    if (distKm < 400) return '약 1시간'
    if (distKm < 800) return '약 1시간 30분'
    if (distKm < 1500) return '약 2시간'
    return '약 2시간 30분'
  }
  if (mode === 'rail') {
    if (distKm < 80) return '약 30분'
    if (distKm < 200) return '약 1시간 30분'
    return '약 2시간'
  }
  // coach / private_car / transfer
  if (distKm < 80) return '약 1시간'
  if (distKm < 160) return '약 2시간'
  if (distKm < 280) return '약 3시간 20분'
  return '약 4시간'
}

function haversineKm(a: Pt, b: Pt, draft: BongtourRouteMapGeminiDraft): number {
  const ca = resolveBongtourRouteMapCityCoord(a.city)
  const cb = resolveBongtourRouteMapCityCoord(b.city)
  if (!ca || !cb) {
    // 화면 거리 대략 환산
    return Math.hypot(b.x - a.x, b.y - a.y) * 0.15
  }
  const R = 6371
  const toR = (d: number) => (d * Math.PI) / 180
  const dLat = toR(cb.lat - ca.lat)
  const dLng = toR(cb.lng - ca.lng)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(ca.lat)) * Math.cos(toR(cb.lat)) * Math.sin(dLng / 2) ** 2
  void draft
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

function transportIconSvg(mode: string | undefined, x: number, y: number, color: string): string {
  if (isFlightMode(mode)) {
    // 단순 비행기
    return `<g transform="translate(${x},${y})" fill="${color}">
      <path d="M0,-5 L8,0 L0,5 L1,1 L-7,3 L-6,0 L-7,-3 L1,-1 Z"/>
    </g>`
  }
  // 버스
  return `<g transform="translate(${x},${y})" fill="${color}">
    <rect x="-7" y="-4" width="14" height="8" rx="2"/>
    <circle cx="-3" cy="5" r="1.6" fill="#fff"/>
    <circle cx="3" cy="5" r="1.6" fill="#fff"/>
  </g>`
}

function labelSide(p: Pt, points: Pt[], width: number): 'right' | 'left' {
  const avgX = points.reduce((s, q) => s + q.x, 0) / Math.max(1, points.length)
  if (p.x > avgX + 20) return 'left'
  if (p.x < width * 0.35) return 'right'
  return p.x < avgX ? 'right' : 'left'
}

export function buildBongtourRouteMapSvg(
  draft: BongtourRouteMapGeminiDraft,
  opts?: { width?: number; height?: number }
): string {
  const width = opts?.width ?? 1280
  const height = opts?.height ?? 720
  const v = buildViewBox(draft, width, height)
  const points = projectCities(draft, v)
  const rings = resolveBongtourRouteMapLandRings(draft.nodes.map((n) => n.city))
  const landD =
    rings[0] && rings[0].length >= 3
      ? ringToPath(rings[0], v)
      : landPathFromPoints(points, 95)

  const countryEn = resolveBongtourRouteMapCountryEnLabel(draft.nodes.map((n) => n.city))
  let landCx = width / 2
  let landCy = height / 2
  if (rings[0] && rings[0].length >= 3) {
    const projected = rings[0].map((p) => projectLonLat(p.lng, p.lat, v))
    landCx = projected.reduce((s, p) => s + p.x, 0) / projected.length
    landCy = projected.reduce((s, p) => s + p.y, 0) / projected.length
  }

  // 경로: 항공=녹색 점선(+약한 Q), 육로=파란 실선. 시간 라벨은 선 수직 오프셋으로 도시명과 분리.
  let routes = ''
  let midLabels = ''
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!
    const b = points[i]!
    const edge = edgeBetween(draft.edges, a.order, b.order)
    const flight = isFlightMode(edge?.mode)
    const color = flight ? ROUTE_FLIGHT : ROUTE_LAND
    if (flight) {
      const qx = (a.x + b.x) / 2
      const qy = (a.y + b.y) / 2 - Math.min(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.18)
      routes += `<path d="M ${a.x} ${a.y} Q ${qx} ${qy} ${b.x} ${b.y}" fill="none" stroke="${color}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="9 7"/>`
    } else {
      routes += `<path d="M ${a.x} ${a.y} L ${b.x} ${b.y}" fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
    }

    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const sideFlip = i % 2 === 0 ? 1 : -1
    const mx = (a.x + b.x) / 2 + nx * 22 * sideFlip
    const my = (a.y + b.y) / 2 + ny * 22 * sideFlip - (flight ? 10 : 0)
    const time = estimateTravelLabel(edge?.mode, haversineKm(a, b, draft))
    const pillW = 108 + time.length * 4
    const pillH = 26
    midLabels += `
      <rect x="${mx - pillW / 2}" y="${my - pillH / 2}" width="${pillW}" height="${pillH}" rx="13" fill="#ffffff" stroke="#d0d5d0" stroke-width="1.2"/>
      ${transportIconSvg(edge?.mode, mx - pillW / 2 + 16, my, color)}
      <text x="${mx + 8}" y="${my + 1}" text-anchor="middle" dominant-baseline="middle" fill="${color}" font-size="12" font-weight="700" font-family="Malgun Gothic,Apple SD Gothic Neo,Noto Sans KR,sans-serif">${escapeXml(time)}</text>
    `
  }

  // 거점: 흰 점 + 파란 캡슐(일정) + 한글 도시명 (가까운 점은 위/아래 교차)
  let markers = ''
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!
    const side = labelSide(p, points, width)
    const day = dayCapsuleText(p.order)
    const dayW = 28 + day.length * 8
    const gap = 14
    const near = points.some(
      (q, j) => j !== i && Math.hypot(q.x - p.x, q.y - p.y) < 55
    )
    const yOff = near ? (i % 2 === 0 ? -18 : 18) : 0
    const capX = side === 'right' ? p.x + gap : p.x - gap - dayW
    const cityX = side === 'right' ? capX + dayW + 8 : capX - 8
    const cityAnchor = side === 'right' ? 'start' : 'end'
    const ly = p.y + yOff
    markers += `
      <circle cx="${p.x}" cy="${p.y}" r="5" fill="#ffffff" stroke="${CAPSULE_BLUE}" stroke-width="2.5"/>
      <rect x="${capX}" y="${ly - 12}" width="${dayW}" height="24" rx="12" fill="${CAPSULE_BLUE}"/>
      <text x="${capX + dayW / 2}" y="${ly + 1}" text-anchor="middle" dominant-baseline="middle" fill="#ffffff" font-size="13" font-weight="800" font-family="Malgun Gothic,Apple SD Gothic Neo,Noto Sans KR,sans-serif">${escapeXml(day)}</text>
      <text x="${cityX}" y="${ly + 1}" text-anchor="${cityAnchor}" dominant-baseline="middle" fill="#1a1a1a" font-size="16" font-weight="700" font-family="Malgun Gothic,Apple SD Gothic Neo,Noto Sans KR,sans-serif">${escapeXml(p.city)}</text>
    `
  }

  const countryLabel = countryEn
    ? `<text x="${landCx}" y="${landCy + 8}" text-anchor="middle" dominant-baseline="middle" fill="${COUNTRY_LABEL}" font-size="16" font-weight="600" letter-spacing="3" font-family="Arial,Helvetica,sans-serif">${escapeXml(countryEn)}</text>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${BG}"/>
  ${landD ? `<path d="${landD}" fill="${LAND_FILL}" stroke="${LAND_STROKE}" stroke-width="2"/>` : ''}
  ${countryLabel}
  ${routes}
  ${midLabels}
  ${markers}
</svg>`
}

export async function renderBongtourRouteMapSvgPng(draft: BongtourRouteMapGeminiDraft): Promise<Buffer> {
  const svg = buildBongtourRouteMapSvg(draft, { width: 1280, height: 720 })
  return sharp(Buffer.from(svg)).png().toBuffer()
}

/** 핀 오버레이(레거시 composite용) — 동일 pathThrough L/Q 계약 */
export function buildBongtourRouteMapPinOverlaySvg(
  draft: BongtourRouteMapGeminiDraft,
  width: number,
  height: number
): string {
  const v = buildViewBox(draft, width, height)
  const points = projectCities(draft, v)
  const routeD = pathThrough(points, draft.edges)
  const nodes = points
    .map(
      (p) => `
        <circle cx="${p.x}" cy="${p.y}" r="5" fill="#fff" stroke="${CAPSULE_BLUE}" stroke-width="2.5"/>
        <text x="${p.x}" y="${p.y - 18}" text-anchor="middle" dominant-baseline="middle" fill="${CAPSULE_BLUE}" font-size="13" font-weight="800" font-family="Arial,sans-serif">${p.order}</text>
      `
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <path d="${routeD}" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
  <path d="${routeD}" fill="none" stroke="#2563eb" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
  ${nodes}
</svg>`
}

export async function compositeBongtourRouteMapRoutePins(
  baseImage: Buffer,
  draft: BongtourRouteMapGeminiDraft
): Promise<Buffer> {
  const meta = await sharp(baseImage).metadata()
  const width = meta.width || 1280
  const height = meta.height || 720
  const overlay = Buffer.from(buildBongtourRouteMapPinOverlaySvg(draft, width, height))
  return sharp(baseImage)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer()
}
