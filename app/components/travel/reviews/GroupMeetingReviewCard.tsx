import { Star } from 'lucide-react'
import type { GroupMeetingReviewCardModel } from '@/lib/group-meeting-reviews-csv'

type Props = {
  review: GroupMeetingReviewCardModel
}

function destinationLine(r: GroupMeetingReviewCardModel): string {
  const p = [r.destination_country, r.destination_city].filter((x) => x?.trim())
  return p.join(' ')
}

export default function GroupMeetingReviewCard({ review }: Props) {
  const dest = destinationLine(review)
  const metaParts = [
    review.customer_type?.trim(),
    review.purposeLabel,
    dest || null,
    review.dateLabel,
  ].filter(Boolean) as string[]

  const ratingShow =
    review.ratingValue != null ? String(review.ratingValue.toFixed(1)) : review.ratingLabel?.trim() || null

  return (
    <article
      className="flex h-[308px] w-[min(100vw-2rem,286px)] shrink-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white px-4 pb-3 pt-3.5 shadow-sm ring-1 ring-slate-900/[0.03] sm:w-[286px]"
      aria-label={review.title}
    >
      <p className="line-clamp-2 min-h-[2.5rem] text-[11px] leading-snug text-slate-500">
        {metaParts.join(' · ')}
      </p>
      {ratingShow ? (
        <div className="mt-1.5 flex items-center gap-1 text-amber-700/85">
          <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-500" strokeWidth={0} aria-hidden />
          <span className="text-[11px] font-medium tabular-nums tracking-tight text-slate-500">{ratingShow}</span>
        </div>
      ) : (
        <div className="mt-1.5 h-4" aria-hidden />
      )}
      <h3 className="mt-2 line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-snug tracking-tight text-slate-900">
        {review.title}
      </h3>
      <p className="mt-2 line-clamp-3 min-h-[3.75rem] flex-1 text-[13px] leading-relaxed text-slate-600">
        {review.bodyLines}
      </p>
      <div className="mt-2 flex h-7 w-full min-w-0 items-center gap-1.5">
        {review.displayTags.slice(0, 3).map((tag) => (
          <span
            key={`${review.id}-${tag}`}
            className="min-w-0 flex-1 truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-center text-[10px] font-medium text-slate-600"
            title={tag}
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  )
}
