import ProductResultCardsClient from '@/app/components/home/ProductResultCardsClient'
import { getCachedSeasonProductGridItems } from '@/lib/season-product-grid-data'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

export default async function SeasonProductGrid() {
  const items = await getCachedSeasonProductGridItems()
  if (items.length === 0) return null

  return (
    <section
      aria-label="시즌 연결 상품"
      className="border-b border-bt-border-soft/50 bg-white/95 py-8 sm:py-10"
    >
      <div className={`mx-auto max-w-6xl px-3 sm:px-5 ${SITE_CONTENT_CLASS}`}>
        <ProductResultCardsClient items={items} layout="grid" />
      </div>
    </section>
  )
}
