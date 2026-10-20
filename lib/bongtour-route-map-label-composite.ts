/**
 * Gemini 지도에 정확한 한국어 도시명을 합성 (모델 한글 오타 방지).
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: compositeBongtourRouteMapCityLabels — manifest
 */

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import type { BongtourRouteMapGeminiDraft } from '@/lib/bongtour-route-map-gemini-types'

function resolveKoreanFontFileUrl(): string | null {
  const fromEnv = process.env.BONGTOUR_KR_FONT_PATH?.trim()
  const candidates = [
    fromEnv,
    'C:/Windows/Fonts/malgun.ttf',
    'C:/Windows/Fonts/malgunsl.ttf',
    '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    '/usr/share/fonts/opentype/noto/NotoSansCJKkr-Regular.otf',
    '/System/Library/Fonts/AppleSDGothicNeo.ttc',
  ].filter((x): x is string => Boolean(x))
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const abs = path.resolve(p).replace(/\\/g, '/')
        return `file:///${abs.replace(/^\/+/, '')}`
      }
    } catch {
      /* skip */
    }
  }
  return null
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * 지도 하단에 번호+정확한 한국어 도시명 바를 합성한다.
 */
export async function compositeBongtourRouteMapCityLabels(
  imageBuf: Buffer,
  draft: BongtourRouteMapGeminiDraft
): Promise<Buffer> {
  const ordered = draft.nodes.slice().sort((a, b) => a.order - b.order)
  if (ordered.length === 0) return imageBuf

  const meta = await sharp(imageBuf).metadata()
  const width = meta.width ?? 1280
  const height = meta.height ?? 720
  const barH = Math.max(56, Math.round(height * 0.13))
  const fontUrl = resolveKoreanFontFileUrl()
  const fontFace = fontUrl
    ? `@font-face{font-family:'BongtourMapKr';src:url('${fontUrl}');}`
    : ''
  const fontFamily = fontUrl
    ? `'BongtourMapKr','Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif`
    : `'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif`

  const gap = Math.min(18, Math.floor(width / (ordered.length * 8)))
  const itemW = Math.floor((width - 32 - gap * (ordered.length - 1)) / ordered.length)
  const fontSize = Math.max(13, Math.min(18, Math.floor(itemW / Math.max(4, ordered[0]!.city.length) * 1.1)))

  const items = ordered
    .map((n, i) => {
      const x = 16 + i * (itemW + gap)
      const cy = height - barH / 2
      const city = escapeXml(n.city)
      return [
        `<circle cx="${x + 11}" cy="${cy}" r="11" fill="#0b6bcb"/>`,
        `<text x="${x + 11}" y="${cy + 1}" text-anchor="middle" dominant-baseline="middle" fill="#fff" font-size="11" font-weight="800" font-family="${fontFamily}">${n.order}</text>`,
        `<text x="${x + 28}" y="${cy + 1}" dominant-baseline="middle" fill="#1a2332" font-size="${fontSize}" font-weight="700" font-family="${fontFamily}">${city}</text>`,
      ].join('')
    })
    .join('')

  const svg = Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>${fontFace}</style>
      <rect x="0" y="${height - barH}" width="${width}" height="${barH}" fill="rgba(255,252,245,0.94)"/>
      <line x1="0" y1="${height - barH}" x2="${width}" y2="${height - barH}" stroke="rgba(22,34,58,0.12)" stroke-width="1"/>
      ${items}
    </svg>`
  )

  return sharp(imageBuf)
    .composite([{ input: svg, top: 0, left: 0 }])
    .png()
    .toBuffer()
}
