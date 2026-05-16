import ProductResultCardsClient from '@/app/components/home/ProductResultCardsClient'
import { getCachedAirHotelProductGridItems } from '@/lib/air-hotel-product-grid-data'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

export default async function AirHotelProductGrid() {
  const items = await getCachedAirHotelProductGridItems()
  if (items.length === 0) return null

  return (
    <section
      aria-labelledby="air-hotel-product-grid-heading"
      className="border-b border-bt-border-soft/50 bg-bt-bg-lavender-soft/40 py-8 sm:py-10"
    >
      <div className={`mx-auto max-w-6xl px-3 sm:px-5 ${SITE_CONTENT_CLASS}`}>
        <h2
          id="air-hotel-product-grid-heading"
          className="text-center text-xl font-bold tracking-tight text-bt-text-navy sm:text-2xl"
        >
          항공+호텔 (자유여행)
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-bt-text-muted-lavender">
          등록된 항공권+호텔(자유여행) 상품입니다. 세부는 상담에서 확인해 주세요.
        </p>
        <div className="mt-6">
          <ProductResultCardsClient items={items} layout="scroll" />
        </div>
      </div>
    </section>
  )
}
