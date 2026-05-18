/** 공개 상품 URL 경로·검색어 추출 SSOT */

export function extractProductPathIdentifier(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  const lower = trimmed.toLowerCase()
  const markers = ['https://bongtour.com/products/', 'http://bongtour.com/products/', '/products/']
  for (const marker of markers) {
    const idx = lower.indexOf(marker)
    if (idx !== -1) {
      const rest = trimmed.slice(idx + marker.length)
      return rest.split(/[?#]/)[0]?.replace(/\/+$/, '').trim() ?? ''
    }
  }
  return trimmed
}

export function publicProductPath(product: { id: string; slug?: string | null }): string {
  const slug = product.slug?.trim()
  if (slug) return `/products/${slug}`
  return `/products/${product.id}`
}
