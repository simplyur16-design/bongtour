/**
 * Pexels `w=` 쿼리는 그 CDN이 리사이즈한다. 작성된 w보다 큰 후보는 만들지 않는다.
 * Ncloud·로컬 경로는 여기서 srcset을 만들지 않는다(가드·호스트 정책 유지).
 * REGRESSION-FREEZE[speed-home-responsive-images]: pexels widths only — manifest
 */
export function pexelsResponsiveSrcSet(src: string): string | null {
  let url: URL
  try {
    url = new URL(src.trim())
  } catch {
    return null
  }
  if (url.hostname !== 'images.pexels.com') return null
  const authored = Number(url.searchParams.get('w') || '')
  if (!Number.isFinite(authored) || authored < 640) return null
  const widths = [480, 768, 1200].filter((n) => n < authored)
  widths.push(authored)
  const unique = [...new Set(widths)].sort((a, b) => a - b)
  if (unique.length < 2) return null
  return unique
    .map((n) => {
      const next = new URL(url.toString())
      next.searchParams.set('w', String(n))
      return `${next.toString()} ${n}w`
    })
    .join(', ')
}
