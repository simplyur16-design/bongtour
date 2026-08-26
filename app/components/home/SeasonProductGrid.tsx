import ProductResultCardsClient from '@/app/components/home/ProductResultCardsClient'
import { getCachedSeasonProductGridItems } from '@/lib/season-product-grid-data'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

export default async function SeasonProductGrid() {
  let items: Awaited<ReturnType<typeof getCachedSeasonProductGridItems>> = []
  try {
    items = await getCachedSeasonProductGridItems()
  } catch (e) {
    console.error('[SeasonProductGrid]', e)
    return null
  }
  if (items.length === 0) return null

  return (
    <section
      aria-labelledby="season-linked-products-heading"
      className="border-b border-bt-border-soft/50 bg-white/95 py-8 sm:py-10"
    >
      <div className={`mx-auto max-w-6xl px-3 sm:px-5 ${SITE_CONTENT_CLASS}`}>
        {/* REGRESSION-FREEZE[home-hero-lcp-and-section-titles]: 시즌 연결 상품 가시 제목 — manifest */}
        <h2
          id="season-linked-products-heading"
          className="text-center text-xl font-bold tracking-tight text-bt-text-navy sm:text-2xl"
        >
          시즌 연결 상품
        </h2>
        <div className="mt-6">
          {/* REGRESSION-FREEZE[overseas-hub-package-fit-split]: 시즌 그리드 패키지/자유여행 뱃지 — manifest */}
          <ProductResultCardsClient items={items} layout="grid" />
        </div>
      </div>
    </section>
  )
}
