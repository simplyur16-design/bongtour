/**
 * 상품 상세 → `/inquiry` travel 딥링크 SSOT.
 * productId + 스냅샷 쿼리는 폼 hidden·서버 검증(`POST /api/inquiries`)과 정합.
 */

export type TravelProductInquiryLinkInput = {
  id: string
  title?: string | null
  originCode?: string | null
}

export type BuildTravelProductInquiryHrefOptions = {
  /** `sourcePagePath` 추적용 — 예: `/travel/overseas` */
  source?: string
  snapshotCardLabel?: string | null
}

export function buildTravelProductInquiryHref(
  product: TravelProductInquiryLinkInput,
  opts?: BuildTravelProductInquiryHrefOptions,
): string {
  const p = new URLSearchParams()
  p.set('type', 'travel')
  p.set('productId', product.id)

  const title = (product.title ?? '').trim()
  if (title) p.set('snapshotProductTitle', title.slice(0, 500))

  const code = (product.originCode ?? '').trim()
  if (code) p.set('snapshotOriginCode', code.slice(0, 200))

  const label = opts?.snapshotCardLabel?.trim()
  if (label) p.set('snapshotCardLabel', label.slice(0, 500))

  if (opts?.source?.trim()) p.set('source', opts.source.trim().slice(0, 500))

  return `/inquiry?${p.toString()}`
}
