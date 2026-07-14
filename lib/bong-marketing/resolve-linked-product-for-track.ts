/**
 * 콘텐츠 자동화 → 블로그/카드뉴스 linkedProductId — 트랙 게이트.
 *
 * REGRESSION-FREEZE[marketing-content-track-product-gate]: linkedProductId track gate — manifest
 */
import { prisma } from '@/lib/prisma'
import {
  filterProductIdsByMarketingTrack,
  pickLinkedProductIdForMarketingTrack,
  type MarketingContentTrack,
} from '@/lib/bong-marketing/marketing-content-track-product'

export async function resolveLinkedProductIdsForMarketingTrack(args: {
  productIds: readonly string[]
  track: MarketingContentTrack
  /** 트랙별 ID가 있으면 우선 (추천 카드 SSOT) */
  trackScopedIds?: readonly string[] | null
}): Promise<{ linkedProductId: string | null; matchingProductIds: string[] }> {
  const preferred =
    args.trackScopedIds && args.trackScopedIds.length > 0
      ? [...args.trackScopedIds]
      : [...args.productIds]
  if (!preferred.length) return { linkedProductId: null, matchingProductIds: [] }

  const rows = await prisma.product.findMany({
    where: { id: { in: preferred } },
    select: { id: true, listingKind: true, productType: true },
  })
  const byId = new Map(rows.map((r) => [r.id, r] as const))
  const matchingProductIds = filterProductIdsByMarketingTrack(preferred, byId, args.track)
  const linkedProductId = pickLinkedProductIdForMarketingTrack(preferred, byId, args.track)
  return { linkedProductId, matchingProductIds }
}
