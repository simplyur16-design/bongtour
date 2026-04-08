/**
 * 공개 상품 화면: 대표 이미지 URL이 image_assets.public_url 과 같을 때
 * schedule 파생 캡션이 비어 있어도 SEO 메타(seo_title → title → alt)를 캡션/OG alt 보강에 사용.
 */

import { findImageAssetByPublicUrl, findImageAssetsByPublicUrls, type ImageAssetRow } from '@/lib/image-assets-db'

export function captionTextFromImageAssetRow(
  row: Pick<ImageAssetRow, 'seo_title_kr' | 'title_kr' | 'alt_kr'>
): string | null {
  const t = (row.seo_title_kr || row.title_kr || row.alt_kr || '').trim()
  return t || null
}

/** 조회 실패 시 null (예외 삼킴 — 공개 페이지는 계속 렌더) */
export async function tryCaptionFromPublicImageUrl(url: string | null | undefined): Promise<string | null> {
  const raw = String(url ?? '').trim()
  if (!raw) return null
  try {
    const asset = await findImageAssetByPublicUrl(raw)
    if (!asset) return null
    return captionTextFromImageAssetRow(asset)
  } catch {
    return null
  }
}

/** `findImageAssetByPublicUrl` 과 동일하게 query 제거·슬래시 변형으로 IN 목록 확장 */
function expandPublicUrlQueryVariants(urls: (string | null | undefined)[]): string[] {
  const out = new Set<string>()
  for (const u of urls) {
    const raw = String(u ?? '').trim().split('?')[0]
    if (!raw.startsWith('http')) continue
    out.add(raw)
    if (raw.endsWith('/')) out.add(raw.slice(0, -1))
    else out.add(`${raw}/`)
  }
  return [...out]
}

/**
 * 목록 API 등: 페이지 단위로 cover URL 묶음 → image_assets 1회 조회 → 캡션 맵.
 * 키는 query 제거·슬래시 유무 양쪽 모두 넣어 lookupCaptionFromMap 과 맞춘다.
 */
export async function buildCaptionLookupMapFromPublicUrls(
  urls: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const need = urls.map((u) => String(u ?? '').trim().split('?')[0]).filter((u) => u.startsWith('http'))
  const expanded = expandPublicUrlQueryVariants(need)
  if (expanded.length === 0) return new Map()
  const rows = await findImageAssetsByPublicUrls(expanded)
  const map = new Map<string, string>()
  for (const row of rows) {
    const cap = captionTextFromImageAssetRow(row)
    if (!cap) continue
    const pu = String(row.public_url).split('?')[0].trim()
    map.set(pu, cap)
    if (pu.endsWith('/')) map.set(pu.slice(0, -1), cap)
    else map.set(`${pu}/`, cap)
  }
  return map
}

export function lookupCaptionFromMap(map: Map<string, string>, url: string | null | undefined): string | null {
  const raw = String(url ?? '').trim().split('?')[0]
  if (!raw) return null
  return map.get(raw) ?? map.get(raw.endsWith('/') ? raw.slice(0, -1) : `${raw}/`) ?? null
}
