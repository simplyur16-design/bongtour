import GroupMeetingReviewsMarquee from '@/app/components/travel/reviews/GroupMeetingReviewsMarquee'
import type { GroupMeetingReviewCardModel } from '@/lib/group-meeting-reviews-csv'

type Props = {
  reviews: GroupMeetingReviewCardModel[]
}

/**
 * CSV 기반 모임·단체 후기 — 무한 가로 롤링(호버 시 정지, reduced-motion 시 정적 그리드).
 */
export default function GroupMeetingReviewsSection({ reviews }: Props) {
  const n = reviews.length

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
        <p className="mx-auto mt-2 max-w-2xl text-center text-xs font-medium text-bt-muted sm:text-sm">
          공개 후기 {n}건
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-bt-muted">
          실제 모임·단체 고객들이 남긴 여행 후기입니다.
        </p>

        {n > 0 ? (
          <GroupMeetingReviewsMarquee reviews={reviews} />
        ) : (
          <div className="mt-10 rounded-2xl border border-dashed border-bt-border bg-white/60 px-6 py-12 text-center">
            <p className="text-sm text-bt-muted">후기 데이터를 불러오지 못했습니다.</p>
          </div>
        )}
      </div>
    </section>
  )
}
