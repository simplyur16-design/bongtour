/**
 * 여정지도 — 코드 SVG 편집형 (자동 생성).
 * 스티커 칩·두꺼운 동화 윤곽 대신: 조용한 실루엣 + 타이포 헤일로 + 얇은 동선.
 */

import sharp from 'sharp'
import type { ItineraryRouteMapHub, ItineraryRouteMapLeg } from '@/lib/itinerary-route-map-types'
import {
  loadRouteMapRegionAsset,
  padBbox,
  projectLonLat,
  resolveHubLonLats,
  resolveRouteMapRegionId,
  type RouteMapRegionAsset,
} from '@/lib/itinerary-route-map-geo'

/** 편집형 팔레트 — 낮은 채도, 종이 위 인포그래픽 */
const C = {
  canvas: '#F3F1EC',
  sea: '#C9D8E3',
  land: '#E4DDD0',
  landStroke: '#8B8478',
  lake: '#6A9B96',
  lakeStroke: '#4F7873',
  route: '#2C5F4E',
  ink: '#1C2430',
  inkSoft: '#5C6670',
  day: '#1C2430',
  transitBg: 'rgba(255,255,255,0.92)',
  font: 'Apple SD Gothic Neo, Pretendard, Malgun Gothic, Noto Sans KR, sans-serif',
} as const

const W = 1200
const H = 900
const PAD = 40

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function shortCityLabel(cityKo: string): string {
  return (
    cityKo
      .replace(/\s*옛도시\s*/g, '')
      .replace(/\s*시내\s*/g, '')
      .replace(/\s*시\s*$/g, '')
      .replace(/\s+/g, ' ')
      .trim() || cityKo.trim()
  )
}

function transitPlain(leg: ItineraryRouteMapLeg): string {
  const mode =
    leg.icon === '✈️'
      ? '항공'
      : leg.icon === '⛴️'
        ? '페리'
        : leg.icon === '🚌'
          ? '버스'
          : leg.icon === '🚇'
            ? '전철'
            : leg.icon === '🚄'
              ? '기차'
              : '이동'
  const dur = leg.durationLabel.replace(/^약\s*/, '약 ')
  return `${mode} ${dur}`
}

function ringToPath(ring: number[][], bbox: [number, number, number, number]): string {
  if (ring.length < 2) return ''
  const parts: string[] = []
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i]!
    const { x, y } = projectLonLat(lon, lat, bbox, W, H, PAD)
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  parts.push('Z')
  return parts.join(' ')
}

/** 가독용 흰 헤일로 텍스트 */
function haloText(
  x: number,
  y: number,
  text: string,
  opts: { size: number; weight?: number; fill?: string; anchor?: string; opacity?: number },
): string {
  const fill = opts.fill ?? C.ink
  const weight = opts.weight ?? 600
  const anchor = opts.anchor ?? 'middle'
  const opacity = opts.opacity ?? 1
  const common = `x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-family="${C.font}" font-size="${opts.size}" font-weight="${weight}"`
  return [
    `<text ${common} fill="#FFFFFF" stroke="#FFFFFF" stroke-width="5" stroke-linejoin="round" paint-order="stroke" opacity="${opacity}">${esc(text)}</text>`,
    `<text ${common} fill="${fill}" opacity="${opacity}">${esc(text)}</text>`,
  ].join('')
}

function fallbackLandAsset(
  hubs: Array<ItineraryRouteMapHub & { lon: number; lat: number }>,
): RouteMapRegionAsset {
  const lons = hubs.map((h) => h.lon)
  const lats = hubs.map((h) => h.lat)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const padLon = Math.max(0.35, (maxLon - minLon) * 0.8)
  const padLat = Math.max(0.3, (maxLat - minLat) * 0.8)
  const bbox: [number, number, number, number] = [
    minLon - padLon,
    minLat - padLat,
    maxLon + padLon,
    maxLat + padLat,
  ]
  const cx = (bbox[0] + bbox[2]) / 2
  const cy = (bbox[1] + bbox[3]) / 2
  const rx = (bbox[2] - bbox[0]) * 0.38
  const ry = (bbox[3] - bbox[1]) * 0.32
  const ring: number[][] = []
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * Math.PI * 2
    ring.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry])
  }
  return { id: 'fallback', bbox, landRings: [ring], lakeRings: [], featureLabels: [] }
}

function mergeHubMarkers(
  hubs: Array<ItineraryRouteMapHub & { lon: number; lat: number; x: number; y: number }>,
) {
  const out: Array<{
    cityKo: string
    cityEn: string
    dayLabel: string
    x: number
    y: number
  }> = []
  for (const h of hubs) {
    const hit = out.find(
      (m) =>
        m.cityEn.toLowerCase() === h.cityEn.toLowerCase() &&
        Math.hypot(m.x - h.x, m.y - h.y) < 28,
    )
    if (hit) {
      const days = new Set(
        [...hit.dayLabel.split('·'), h.dayLabel].map((s) => s.trim()).filter(Boolean),
      )
      hit.dayLabel = [...days].join('·')
      continue
    }
    out.push({
      cityKo: shortCityLabel(h.cityKo),
      cityEn: h.cityEn,
      dayLabel: h.dayLabel,
      x: h.x,
      y: h.y,
    })
  }
  return out
}

/** 마커끼리 겹치면 라벨을 위/아래로 살짝 밀어 읽히게 */
function labelOffsets(markers: Array<{ x: number; y: number }>): number[] {
  const dy = markers.map(() => 22)
  for (let i = 0; i < markers.length; i++) {
    for (let j = i + 1; j < markers.length; j++) {
      const d = Math.hypot(markers[j]!.x - markers[i]!.x, markers[j]!.y - markers[i]!.y)
      if (d < 70) {
        dy[i] = 18
        dy[j] = 36
      }
    }
  }
  return dy
}

export function buildItineraryRouteMapSvg(input: {
  hubs: ItineraryRouteMapHub[]
  legs: ItineraryRouteMapLeg[]
  countryEn?: string
}): string {
  const regionId = resolveRouteMapRegionId(input.hubs, input.countryEn)
  let asset = loadRouteMapRegionAsset(regionId)
  const hubLlPreview = resolveHubLonLats(input.hubs, asset?.bbox ?? [100, 0, 140, 40])
  if (!asset) asset = fallbackLandAsset(hubLlPreview)

  const bbox = padBbox(asset.bbox, 0.05)
  const hubLl = resolveHubLonLats(input.hubs, bbox)
  const projected = hubLl.map((h) => {
    const p = projectLonLat(h.lon, h.lat, bbox, W, H, PAD)
    return { ...h, ...p }
  })
  const markers = mergeHubMarkers(projected)
  const cityKoSet = new Set(markers.map((m) => m.cityKo))
  const labelDy = labelOffsets(markers)

  const parts: string[] = []
  parts.push(
    `<defs>`,
    `<clipPath id="mapClip"><rect x="${PAD - 8}" y="${PAD - 8}" width="${W - (PAD - 8) * 2}" height="${H - (PAD - 8) * 2}" rx="12"/></clipPath>`,
    `</defs>`,
    `<rect width="${W}" height="${H}" fill="${C.canvas}"/>`,
    // 지도 판 — 테두리 없이 면만
    `<rect x="${PAD - 8}" y="${PAD - 8}" width="${W - (PAD - 8) * 2}" height="${H - (PAD - 8) * 2}" rx="12" fill="${C.sea}"/>`,
    `<g clip-path="url(#mapClip)">`,
  )

  for (const ring of asset.landRings) {
    const d = ringToPath(ring, bbox)
    if (!d) continue
    parts.push(
      `<path d="${d}" fill="${C.land}" stroke="${C.landStroke}" stroke-width="1.1" stroke-linejoin="round" opacity="0.98"/>`,
    )
  }
  for (const ring of asset.lakeRings ?? []) {
    const d = ringToPath(ring, bbox)
    if (!d) continue
    parts.push(
      `<path d="${d}" fill="${C.lake}" stroke="${C.lakeStroke}" stroke-width="1" stroke-linejoin="round"/>`,
    )
  }

  // 도시 권역 — 옅은 타원 + 큰 구역명 (핀과 별개로 “여기가 오사카/교토” 인식)
  for (const area of asset.areaLabels ?? []) {
    const rxDeg = area.rx ?? 0.16
    const ryDeg = area.ry ?? 0.11
    const c = projectLonLat(area.lon, area.lat, bbox, W, H, PAD)
    const e = projectLonLat(area.lon + rxDeg, area.lat, bbox, W, H, PAD)
    const n = projectLonLat(area.lon, area.lat + ryDeg, bbox, W, H, PAD)
    const rxPx = Math.max(36, Math.abs(e.x - c.x))
    const ryPx = Math.max(28, Math.abs(c.y - n.y))
    const visited =
      cityKoSet.has(area.ko) ||
      [...cityKoSet].some((v) => area.ko.includes(v) || v.includes(area.ko))
    const fillOp = visited ? 0.22 : 0.1
    const textOp = visited ? 0.55 : 0.38
    parts.push(
      `<ellipse cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" rx="${rxPx.toFixed(1)}" ry="${ryPx.toFixed(1)}" fill="${C.route}" opacity="${fillOp}"/>`,
      `<text x="${c.x.toFixed(1)}" y="${(c.y + 6).toFixed(1)}" text-anchor="middle" font-family="${C.font}" font-size="${visited ? 28 : 22}" font-weight="700" letter-spacing="0.14em" fill="${C.ink}" opacity="${textOp}">${esc(area.ko)}</text>`,
    )
  }

  // 보조 지명 — 작고 옅게 (바다·호수·반도). 권역명과 겹치면 스킵
  const areaKo = new Set((asset.areaLabels ?? []).map((a) => a.ko))
  const labels = [...(asset.featureLabels ?? [])]
  if (asset.seaLabel) labels.push({ ...asset.seaLabel, kind: 'sea' as const })
  for (const lab of labels) {
    if (areaKo.has(lab.ko)) continue
    const { x, y } = projectLonLat(lab.lon, lab.lat, bbox, W, H, PAD)
    const fs = lab.kind === 'sea' ? 15 : 13
    parts.push(
      `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-family="${C.font}" font-size="${fs}" font-weight="500" letter-spacing="0.08em" fill="${C.inkSoft}" opacity="0.72">${esc(lab.ko)}</text>`,
    )
  }

  // 동선 — 얇은 점선, 왕복 1회
  const drawn = new Set<string>()
  for (let i = 0; i < input.legs.length; i++) {
    const leg = input.legs[i]!
    const from = projected[i]
    const to = projected[i + 1]
    if (!from || !to) continue
    const pair = [from.cityEn.toLowerCase(), to.cityEn.toLowerCase()].sort().join('|')
    if (drawn.has(pair)) continue
    drawn.add(pair)

    const mx = (from.x + to.x) / 2
    const my = (from.y + to.y) / 2
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len
    const ny = dx / len
    const bend = Math.min(14, len * 0.05)
    const d = `M ${from.x.toFixed(1)} ${from.y.toFixed(1)} Q ${(mx + nx * bend).toFixed(1)} ${(my + ny * bend).toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`
    const isBlue = leg.lineStyle === 'solid_blue'
    parts.push(
      `<path d="${d}" fill="none" stroke="${isBlue ? '#3B6EA5' : C.route}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="${isBlue ? '0' : '7 7'}" opacity="0.9"/>`,
    )

    const label = transitPlain(leg)
    const fs = 12.5
    const tw = Math.min(200, Math.max(88, [...label].length * fs * 0.58 + 20))
    const th = 22
    const lx = mx + nx * 22
    const ly = my + ny * 22
    parts.push(
      `<g transform="translate(${lx.toFixed(1)},${ly.toFixed(1)})">`,
      `<rect x="${-tw / 2}" y="${-th / 2}" width="${tw}" height="${th}" rx="4" fill="${C.transitBg}"/>`,
      `<text x="0" y="${fs * 0.34}" text-anchor="middle" font-family="${C.font}" font-size="${fs}" font-weight="600" fill="${C.inkSoft}">${esc(label)}</text>`,
      `</g>`,
    )
  }

  // 거점 — 점 + 일차(작은 원) + 도시명(헤일로). 흰 박스 스택 제거.
  for (let i = 0; i < markers.length; i++) {
    const m = markers[i]!
    const x = Math.min(W - 100, Math.max(100, m.x))
    const y = Math.min(H - 80, Math.max(70, m.y))
    const offsetY = labelDy[i] ?? 22

    parts.push(`<g transform="translate(${x.toFixed(1)},${y.toFixed(1)})">`)
    // 위치 점
    parts.push(`<circle cx="0" cy="0" r="6.5" fill="${C.day}"/>`)
    parts.push(`<circle cx="0" cy="0" r="3" fill="#FFFFFF"/>`)

    // 일차 — 점 위 작은 원
    const dayFs = 11
    const dayR = Math.max(11, [...m.dayLabel].length * 3.8 + 8)
    parts.push(
      `<circle cx="0" cy="${-18}" r="${dayR}" fill="${C.day}"/>`,
      `<text x="0" y="${-18 + dayFs * 0.35}" text-anchor="middle" font-family="${C.font}" font-size="${dayFs}" font-weight="700" fill="#FFFFFF">${esc(m.dayLabel)}</text>`,
    )

    // 도시명
    parts.push(haloText(0, offsetY + 8, m.cityKo, { size: 18, weight: 700, fill: C.ink }))
    parts.push(`</g>`)
  }

  parts.push(`</g>`)
  return `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`
}

export async function renderItineraryRouteMapPng(input: {
  hubs: ItineraryRouteMapHub[]
  legs: ItineraryRouteMapLeg[]
  countryEn?: string
}): Promise<Buffer> {
  const svg = buildItineraryRouteMapSvg(input)
  return sharp(Buffer.from(svg)).png().toBuffer()
}
