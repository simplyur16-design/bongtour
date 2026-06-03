import type { ProductDetailPageLoadRow } from '@/lib/product-detail-page-include'
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
  travelProduct: ProductDetailPageLoadRow
  fitMaster: FitMasterWithDays | null
  isMobile: boolean
}) {
  const { model } = await getOrBuildProductPublicDetailModel(travelProduct, fitMaster)
  return renderProductDetailFromModel(model, travelProduct, isMobile)
}
