import ProductResultCardsClient from '@/app/components/home/ProductResultCardsClient'
import { getCachedSeasonProductGridItems } from '@/lib/season-product-grid-data'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

export default async function SeasonProductGrid() {
  const items = await getCachedSeasonProductGridItems()
  if (items.length === 0) return null

  return (
    <section
      aria-labelledby="season-product-grid-heading"
      className="border-b border-bt-border-soft/50 bg-white/95 py-8 sm:py-10"
    >
      <div className={`mx-auto max-w-6xl px-3 sm:px-5 ${SITE_CONTENT_CLASS}`}>
        <h2
          id="season-product-grid-heading"
          className="text-center text-xl font-bold tracking-tight text-bt-text-navy sm:text-2xl"
        >
          시즌에서 이어지는 일정
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-bt-text-muted-lavender">
          큐레이션에 연결된 상품과 같은 지역·국가의 등록 일정입니다.
        </p>
        <div className="mt-6">
          <ProductResultCardsClient items={items} layout="grid" />
        </div>
      </div>
    </section>
  )
}
