import HomeReviewsCarouselClient from '@/app/components/home/HomeReviewsCarouselClient'
import HomeReviewsGridClient from '@/app/components/home/HomeReviewsGridClient'
import { listOverseasHomeReviewSections } from '@/lib/reviews-db'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

export default async function CustomerReviewsSection() {
  const { packageReviews, groupReviews } = await listOverseasHomeReviewSections()
  if (packageReviews.length === 0 && groupReviews.length === 0) return null

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

        {packageReviews.length > 0 ? (
          <div className="mt-10">
            <h3 className="text-center text-base font-semibold text-bt-text-navy sm:text-lg">패키지 여행 후기</h3>
            <p className="mt-1 text-center text-xs text-bt-text-muted-lavender sm:text-sm">
              가족·부부·혼자·친구·부모님 동반 여행
            </p>
            <div className="mt-6">
              <HomeReviewsGridClient reviews={packageReviews} />
            </div>
          </div>
        ) : null}

        {groupReviews.length > 0 ? (
          <div className={packageReviews.length > 0 ? 'mt-12 border-t border-bt-border-soft/50 pt-10' : 'mt-10'}>
            <h3 className="text-center text-base font-semibold text-bt-text-navy sm:text-lg">모임여행 후기</h3>
            <p className="mt-1 text-center text-xs text-bt-text-muted-lavender sm:text-sm">
              단체·협회·산악회·시니어·동문 모임 등
            </p>
            <div className="mt-6">
              <HomeReviewsCarouselClient reviews={groupReviews} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
