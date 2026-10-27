import { fetchAirlineDepartureOptionsForProduct } from '@/lib/airline-variant-departures'
import ProductAirlinePricePanelClient from '@/app/components/detail/ProductAirlinePricePanelClient'

/**
 * 상품 상세 — 항공사별 가격·출발일 (`?airline=KE` 선택 반영).
 * 실제 예약가능 회차의 항공사만, 항공사를 모르는 회차는 표시하지 않음.
 * REGRESSION-FREEZE[airline-variant-group]: 상세 항공사별 가격 — manifest
 */
export default async function ProductAirlinePricePanel({ productId }: { productId: string }) {
  let options: Awaited<ReturnType<typeof fetchAirlineDepartureOptionsForProduct>> = []
  try {
    options = await fetchAirlineDepartureOptionsForProduct(productId)
  } catch {
    options = []
  }
  if (options.length === 0) return null
  return <ProductAirlinePricePanelClient options={options} />
}
