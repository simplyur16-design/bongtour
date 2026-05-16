import HomeReviewsGridClient from '@/app/components/home/HomeReviewsGridClient'
import { listOverseasPublishedReviewCards } from '@/lib/reviews-db'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

/** 메인 고객 후기 — DB 조회 상한 */
const HOME_CUSTOMER_REVIEWS_FETCH_LIMIT = 16
/** 그리드 동시 노출 장수 (2열×4행 ~ 3열×4행) */
const HOME_CUSTOMER_REVIEWS_DISPLAY_LIMIT = 12

export default async function CustomerReviewsSection() {
  const reviews = await listOverseasPublishedReviewCards(HOME_CUSTOMER_REVIEWS_FETCH_LIMIT)
  if (reviews.length === 0) return null

  const grid = reviews.slice(0, HOME_CUSTOMER_REVIEWS_DISPLAY_LIMIT)

  return (
    <section
      aria-labelledby="home-customer-reviews-heading"
      className="border-t border-bt-border-soft/60 bg-gradient-to-b from-bt-bg-lavender-soft via-bt-bg-lavender/45 to-bt-bg-lavender/55 py-10 sm:py-12"
    >
      <div className={`mx-auto max-w-6xl ${SITE_CONTENT_CLASS}`}>
        <h2
          id="home-customer-reviews-heading"
          className="text-center text-xl font-bold tracking-tight text-bt-text-navy sm:text-2xl"
        >
          고객 후기
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-center text-sm text-bt-text-muted-lavender">
          해외 여행을 다녀오신 고객님의 의견입니다.
        </p>
        <div className="mt-8">
          <HomeReviewsGridClient reviews={grid} />
        </div>
      </div>
    </section>
  )
}
