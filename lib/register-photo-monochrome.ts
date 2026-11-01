/**
 * 흑백 사진 판정 (사장님 11/01: 대표사진은 흑백 금지, 일차 칸 흑백은 허용).
 * 작은 미리보기(가로 64px)를 받아 화소별 채도(max−min)를 본다. CDN 미리보기만 받으므로 검색 API 호출 수에 들지 않는다.
 * 받기·해석 실패면 판단 보류(false = 흑백 아님) — 사진을 막지 않는다.
 */
import sharp from 'sharp'

/** 화소 채도 평균이 이 값 미만이고 대부분 화소가 무채색이면 흑백 */
export const MONO_MEAN_CHROMA_MAX = 10
export const MONO_PIXEL_CHROMA = 24
export const MONO_COLORED_PIXEL_RATIO_MAX = 0.03

export function isMonochromeRgb(rgb: Uint8Array | Buffer, channels = 3): boolean {
  const n = Math.floor(rgb.length / channels)
  if (n <= 0) return false
  let sum = 0
  let colored = 0
  for (let i = 0; i < n; i++) {
    const r = rgb[i * channels]!, g = rgb[i * channels + 1]!, b = rgb[i * channels + 2]!
    const c = Math.max(r, g, b) - Math.min(r, g, b)
    sum += c
    if (c >= MONO_PIXEL_CHROMA) colored++
  }
  return sum / n < MONO_MEAN_CHROMA_MAX && colored / n <= MONO_COLORED_PIXEL_RATIO_MAX
}

/** 대체 문구에 흑백이라고 적힌 사진 */
export function altSaysMonochrome(alt: string | null | undefined): boolean {
  return /\b(black[\s-]*and[\s-]*white|b\s*&\s*w|monochrome|monochromatic|grayscale|greyscale|sepia)\b/i.test(String(alt ?? ''))
}

/** Pexels·Unsplash 미리보기 주소(가로 64px) */
export function stockThumbnailUrl(url: string): string {
  try {
    const u = new URL(url)
    if (u.hostname === 'images.unsplash.com' || u.hostname === 'images.pexels.com') {
      u.searchParams.set('w', '64')
      u.searchParams.delete('h')
      if (u.hostname === 'images.unsplash.com') u.searchParams.set('q', '50')
      else u.searchParams.set('auto', 'compress')
    }
    return u.toString()
  } catch {
    return url
  }
}

export async function isMonochromePhotoUrl(
  url: string,
  deps: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<boolean> {
  const f = deps.fetchImpl ?? fetch
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 8000)
    const res = await f(stockThumbnailUrl(url), { signal: ctrl.signal })
    clearTimeout(t)
    if (!res.ok) return false
    const buf = Buffer.from(await res.arrayBuffer())
    const { data, info } = await sharp(buf).resize(32, 32, { fit: 'inside' }).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    return isMonochromeRgb(data, info.channels)
  } catch {
    return false
  }
}
