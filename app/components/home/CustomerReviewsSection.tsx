import HomeReviewsCarouselClient from '@/app/components/home/HomeReviewsCarouselClient'
import { listOverseasPublishedReviewCards } from '@/lib/reviews-db'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

export default async function CustomerReviewsSection() {
  const reviews = await listOverseasPublishedReviewCards(50)
  if (reviews.length === 0) return null

  const carousel = reviews.slice(0, 12)

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
          <HomeReviewsCarouselClient reviews={carousel} />
        </div>
      </div>
    </section>
  )
}
