import { headers } from 'next/headers'
import { connection } from 'next/server'
import { notFound, permanentRedirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ProductDetailView } from '@/app/products/[idOrSlug]/product-detail-view'
import {
  loadProductDetailRowCached,
  consumeProductDetailUnstableCacheMiss,
} from '@/lib/product-detail-page-cache'
import { resolveProductPageAccess } from '@/lib/resolve-product-page-access'
import { runWithQueryLogScope } from '@/lib/prisma-query-log'
import { isMobileUserAgent } from '@/lib/product-detail-viewport-from-ua'
import {
  consumeProductDetailPerf,
  isProductDetailPerfLogEnabled,
  patchProductDetailPerf,
  resetProductDetailPerf,
} from '@/lib/product-detail-perf'
import ProductDetailServerReadySignal from '@/components/products/ProductDetailServerReadySignal'
import { isAirHotelFitItineraryProduct } from '@/lib/air-hotel-product-ssot'

const FIT_ITINERARY_MASTER_DETAIL_INCLUDE = {
  days: {
    orderBy: { dayNumber: 'asc' as const },
    include: {
      activities: {
        orderBy: { order: 'asc' as const },
        include: { validation: true },
      },
    },
  },
} as const

function loadFitItineraryMasterForProduct(
  productId: string,
  productType: string | null | undefined,
  listingKind: string | null | undefined,
) {
  if (!isAirHotelFitItineraryProduct({ productType, listingKind })) return Promise.resolve(null)
  return prisma.fitItineraryMaster.findUnique({
    where: { productId },
    include: FIT_ITINERARY_MASTER_DETAIL_INCLUDE,
  })
}

/** Suspense 경계 안 — 스트리밍·`loading.tsx` fallback과 함께 전환 중 스켈레톤 표시 */
export async function ProductDetailPageContent({ idOrSlug }: { idOrSlug: string }) {
  return runWithQueryLogScope(`/products/${idOrSlug}`, () => productDetailPageInner(idOrSlug))
}

async function productDetailPageInner(idOrSlug: string) {
  const perfPage = isProductDetailPerfLogEnabled()
  if (perfPage) resetProductDetailPerf()
  const t0 = perfPage ? Date.now() : 0

  const tResolved = perfPage ? Date.now() : 0
  const { resolved, allowAdminDraft } = await resolveProductPageAccess(idOrSlug)
  const resolveMs = perfPage ? Date.now() - tResolved : 0

  if (allowAdminDraft) await connection()

  if (resolved.kind === 'redirect') {
    permanentRedirect(`/products/${resolved.slug}`)
  }
  if (resolved.kind === 'not_found') {
    notFound()
  }

  const productId = resolved.productId

  const tProduct = perfPage ? Date.now() : 0
  const { row: travelProduct, selectKind } = await loadProductDetailRowCached(productId, allowAdminDraft)
  const productMs = perfPage ? Date.now() - tProduct : 0

  if (perfPage) {
    patchProductDetailPerf({ selectKind })
  }

  if (!travelProduct) {
    notFound()
  }

  const listingKind = 'listingKind' in travelProduct ? travelProduct.listingKind : null
  const productType = resolved.productType ?? travelProduct.productType
  const isFitItinerary = isAirHotelFitItineraryProduct({ productType, listingKind })
  // slim DTO hit여도 에어텔은 fitMaster 필요 — payload miss 시 getOrBuild가 full row로 재빌드
  const fitMaster =
    selectKind === 'slim' && !isFitItinerary
      ? null
      : await loadFitItineraryMasterForProduct(productId, productType, listingKind)

  const userAgent = (await headers()).get('user-agent')
  const isMobile = isMobileUserAgent(userAgent)

  const tView = perfPage ? Date.now() : 0
  const view = (
    <>
      <ProductDetailView
        travelProduct={travelProduct}
        fitMaster={fitMaster}
        isMobile={isMobile}
      />
      <ProductDetailServerReadySignal productId={productId} />
    </>
  )
  const viewMs = perfPage ? Date.now() - tView : 0

  if (perfPage) {
    patchProductDetailPerf({ viewMs })
    const cacheMiss = consumeProductDetailUnstableCacheMiss()
    const cacheLabel =
      allowAdminDraft ? 'draft-fresh' : cacheMiss === true ? 'miss' : cacheMiss === false ? 'hit' : 'unknown'
    const snap = consumeProductDetailPerf()
    console.log(
      `[product-detail-perf] slug=${idOrSlug} resolve=${resolveMs}ms product+fit=${productMs}ms view=${viewMs}ms total=${Date.now() - t0}ms cache=${cacheLabel} selectKind=${snap?.selectKind ?? selectKind} payload=${snap?.payloadSource ?? 'n/a'} parseMs=${snap?.parseMs ?? 'n/a'} payloadBytes=${snap?.payloadBytes ?? 0}`,
    )
  }

  return view
}
