import type { ReviewCardModel } from '@/lib/reviews-types'
import { reviewTypeLabel } from '@/lib/review-type-labels'
import { formatReviewDestination, formatReviewWhen } from '@/app/components/travel/reviews/travel-review-utils'

type Props = {
  review: ReviewCardModel
}

export default function TravelReviewCard({ review }: Props) {
  const where = formatReviewDestination(review)
  const when = formatReviewWhen(review)
  const typeLabel = reviewTypeLabel(review.review_type)

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-bt-border bg-white/90 shadow-sm ring-1 ring-black/[0.03] transition hover:border-bt-accent/35 hover:shadow-md">
      {review.thumbnail_url ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-bt-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={review.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-bt-muted">
          {typeLabel ? (
            <span className="rounded-full bg-bt-accent/10 px-2.5 py-0.5 font-semibold text-bt-accent">{typeLabel}</span>
          ) : null}
          {review.customer_type ? (
            <span className="rounded-full bg-bt-surface px-2.5 py-0.5 font-medium text-bt-ink">{review.customer_type}</span>
          ) : null}
          {where ? <span className="text-bt-subtle">{where}</span> : null}
          {when ? <span className="text-bt-subtle">{when}</span> : null}
        </div>
        {review.rating_label ? (
          <p className="mt-2 text-[11px] font-medium text-bt-accent">{review.rating_label}</p>
        ) : null}
        <h3 className="mt-2 text-base font-semibold leading-snug tracking-tight text-bt-ink">{review.title}</h3>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-bt-muted">{review.excerpt}</p>
        {review.tags.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="태그">
            {review.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-md border border-bt-border/80 bg-bt-page px-2 py-0.5 text-[10px] font-medium text-bt-subtle"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  )
}
