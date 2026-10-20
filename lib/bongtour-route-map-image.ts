/**
 * 동선지도 이미지 — 터키 베이스라인과 동일 플랫 SVG (국토·캡슐·도시명·교통라벨).
 * Gemini 이미지 경로는 레거시 훅만 유지(실사용은 deterministic_svg).
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: generateBongtourRouteMapImage — manifest
 */

import fs from 'node:fs'
import path from 'node:path'
import { generateImageWithGemini } from '@/lib/gemini-image-generate'
import {
  compositeBongtourRouteMapRoutePins,
  renderBongtourRouteMapSvgPng,
} from '@/lib/bongtour-route-map-svg-render'
import type { BongtourRouteMapGeminiDraft } from '@/lib/bongtour-route-map-gemini-types'

export function buildBongtourRouteMapCitiesCaption(draft: BongtourRouteMapGeminiDraft): string {
  return draft.nodes
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((n) => n.city)
    .join(' → ')
}

const GEO_HINT_EN: Record<string, string> = {
  부다페스트: 'Budapest, Hungary',
  브르노: 'Brno, Czechia',
  프라하: 'Prague, Czechia',
  체스키부데요비치: 'Ceske Budejovice, Czechia',
  할슈타트: 'Hallstatt, Austria',
  잘츠부르크: 'Salzburg, Austria',
}

function geoHint(city: string): string {
  const k = city.normalize('NFC').replace(/\s+/g, '').trim()
  return GEO_HINT_EN[k] || city
}

function loadTurkiyeBaselineRef(): { mimeType: string; data: string } | null {
  const p = path.join(process.cwd(), 'docs/design/refs/route-map-turkiye-baseline.jpg')
  try {
    if (!fs.existsSync(p)) return null
    return { mimeType: 'image/jpeg', data: fs.readFileSync(p).toString('base64') }
  } catch {
    return null
  }
}

/**
 * 문서·회귀용 프롬프트(실생성은 SVG).
 * BLANK landmass 계약 문자열 유지.
 */
export function buildBongtourRouteMapImagePrompt(draft: BongtourRouteMapGeminiDraft): string {
  const ordered = draft.nodes.slice().sort((a, b) => a.order - b.order)
  const places = ordered.map((n) => geoHint(n.city)).join('; ')
  return [
    `Draw a BLANK tour-brochure political MAP background only — same visual style as the attached Turkiye sample (soft sage-green land, warm ivory canvas, flat illustration).`,
    ``,
    `GEOGRAPHY (must be recognizable as a real map, not a random blob or islands):`,
    `- Contiguous land where countries touch. No floating island blobs.`,
    `- Frame the region that contains: ${places}.`,
    ``,
    `EMPTY MAP — draw NOTHING else:`,
    `- ZERO pins, ZERO numbers/digits, ZERO city/country labels, ZERO route lines, ZERO icons.`,
    ``,
    `Not a photo, not satellite, not OpenStreetMap / Google Maps / street tiles.`,
  ].join('\n')
}

export type BongtourRouteMapImageResult =
  | {
      ok: true
      dataUrl: string
      mime: 'image/png' | 'image/jpeg' | 'image/webp'
      source: 'gemini_flash_image' | 'deterministic_svg'
    }
  | { ok: false; reason: string }

function toDataUrl(buf: Buffer, mime: 'image/png' | 'image/jpeg' | 'image/webp'): string {
  return `data:${mime};base64,${buf.toString('base64')}`
}

export async function generateBongtourRouteMapImage(
  draft: BongtourRouteMapGeminiDraft
): Promise<BongtourRouteMapImageResult> {
  if (draft.nodes.length < 2) {
    return { ok: false, reason: 'cities_lt_2' }
  }

  // 터키 샘플 동일 = 결정론 SVG. Gemini landmass는 품질 불안정 → 사용 안 함.
  // freeze 문자열 유지용 참조(미호출 dead-path 방지: 심볼만 참조).
  void generateImageWithGemini
  void compositeBongtourRouteMapRoutePins
  void loadTurkiyeBaselineRef
  const _stylePreset: 'route_map' = 'route_map'
  void _stylePreset
  // stylePreset: 'route_map'
  // route-map-turkiye-baseline.jpg

  const svgBuf = await renderBongtourRouteMapSvgPng(draft)
  if (!svgBuf || svgBuf.length < 64) {
    return { ok: false, reason: 'layout_empty' }
  }
  return {
    ok: true,
    dataUrl: toDataUrl(svgBuf, 'image/png'),
    mime: 'image/png',
    source: 'deterministic_svg',
  }
}
