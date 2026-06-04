import HomeReviewsGridClient from '@/app/components/home/HomeReviewsGridClient'
import type { GroupMeetingReviewCardModel } from '@/lib/group-meeting-reviews-csv'
import { groupMeetingReviewsToCardModels } from '@/lib/group-meeting-review-to-card'

type Props = {
  reviews: GroupMeetingReviewCardModel[]
}

/** CSV/DB 모임·단체 후기 — 패키지 후기와 동일한 정적 2열(모바일)·3열(PC) 카드 */
export default function GroupMeetingReviewsSection({ reviews }: Props) {
  const cards = groupMeetingReviewsToCardModels(reviews)

  return (
    <section
      id="group-meeting-reviews"
      className="scroll-mt-24 border-t border-bt-border bg-gradient-to-b from-bt-surface/80 to-bt-page py-14 sm:py-16"
      aria-labelledby="group-meeting-reviews-heading"
    >
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <h2
          id="group-meeting-reviews-heading"
          className="text-center text-2xl font-semibold tracking-tight text-bt-ink sm:text-3xl"
        >
          모임여행 후기
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-bt-muted">
          실제 모임·단체 고객들이 남긴 여행 후기입니다.
        </p>

        {cards.length > 0 ? (
          <div className="mt-10">
            <HomeReviewsGridClient reviews={cards} />
          </div>
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-bt-border bg-white/60 px-6 py-12 text-center">
            <p className="text-sm text-bt-muted">후기 데이터를 불러오지 못했습니다.</p>
          </div>
        )}
      </div>
    </section>
  )
}
