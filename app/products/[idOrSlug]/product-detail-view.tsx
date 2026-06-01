import {
  buildProductPublicDetailRenderModel,
  type FitMasterWithDays,
  type ProductDetailViewRow,
} from '@/lib/product-public-detail/build-render-model'
import { getOrBuildProductPublicDetailModel } from '@/lib/product-public-detail/get-or-build-model'
import { renderProductDetailFromModel } from '@/lib/product-public-detail/render-from-model'

export type { ProductDetailViewRow, FitMasterWithDays }
export { buildProductPublicDetailRenderModel }

export async function ProductDetailView({
  travelProduct,
  fitMaster,
  isMobile,
}: {
  travelProduct: ProductDetailViewRow
  fitMaster: FitMasterWithDays | null
  isMobile: boolean
}) {
  const { model, source } = await getOrBuildProductPublicDetailModel(travelProduct, fitMaster)

  if (process.env.BONGTOUR_PERF_LOG === '1') {
    console.log(`[product-detail-perf] payload=${source} productId=${travelProduct.id}`)
  }

  return renderProductDetailFromModel(model, travelProduct, isMobile)
}
