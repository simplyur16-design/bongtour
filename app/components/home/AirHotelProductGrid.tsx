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
          항공+호텔 허브와 동일한 등록 상품 목록입니다.{' '}
          <a href="/travel/air-hotel" className="font-medium text-bt-text-navy underline-offset-2 hover:underline">
            전체 보기
          </a>
        </p>
        <div className="mt-6">
          <ProductResultCardsClient items={items} layout="scroll" />
        </div>
      </div>
    </section>
  )
}
