import type { ProductDetailPageLoadRow } from '@/lib/product-detail-page-include'
import {
  buildProductPublicDetailRenderModel,
  type FitMasterWithDays,
  type ProductDetailViewRow,
} from '@/lib/product-public-detail/build-render-model'
import { getOrBuildProductPublicDetailModel } from '@/lib/product-public-detail/get-or-build-model'
import { renderProductDetailFromModel } from '@/lib/product-public-detail/render-from-model'
import { loadSimilarItineraryDetailShelf } from '@/lib/similar-itinerary-detail-shelf'

export type { ProductDetailViewRow, FitMasterWithDays }
export { buildProductPublicDetailRenderModel }

export async function ProductDetailView({
  travelProduct,
  fitMaster,
  isMobile,
}: {
  travelProduct: ProductDetailPageLoadRow
  fitMaster: FitMasterWithDays | null
  isMobile: boolean
}) {
  const { model } = await getOrBuildProductPublicDetailModel(travelProduct, fitMaster)
  const view = model.viewProduct
  let similarItineraryShelf = null
  try {
    similarItineraryShelf = await loadSimilarItineraryDetailShelf({
      id: String(view.id),
      slug: view.slug ?? null,
      listingKind: view.listingKind ?? null,
      productType: view.productType ?? null,
    })
  } catch (err) {
    console.error('[similar-itinerary-detail] load failed', String(view.id), err instanceof Error ? err.message : '')
  }
  return renderProductDetailFromModel(model, travelProduct, isMobile, similarItineraryShelf)
}
