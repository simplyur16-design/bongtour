'use client'

import SafeImage from '@/app/components/SafeImage'
import { useMemo } from 'react'
import type { ReviewCardModel } from '@/lib/reviews-types'

type Props = { reviews: ReviewCardModel[] }

export function HomeReviewGridCard({ review: r }: { review: ReviewCardModel }) {
  const dest = [r.destination_city, r.destination_country].filter(Boolean).join(' · ')

  return (
    <article className="flex h-full flex-col rounded-xl border border-bt-border-soft/50 bg-white p-4 shadow-sm">
      {r.thumbnail_url ? (
        <div className="relative mb-3 aspect-[2/1] w-full overflow-hidden rounded-lg bg-slate-100">
          <SafeImage
            src={r.thumbnail_url}
            alt=""
            fill
            className="object-cover"
            sizes="(max-width:640px) 50vw, (max-width:1024px) 33vw, 320px"
          />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {r.rating_label ? (
          <p className="inline-flex items-baseline gap-1 text-sm font-bold text-[#d9a81e]" aria-label={`평점 ${r.rating_label}`}>
            <span>{r.rating_label}</span>
            <span className="text-[10px] font-medium text-bt-text-muted-lavender">/ 5.0</span>
          </p>
        ) : null}
      </div>
      <h3 className="mt-1 line-clamp-2 text-sm font-bold text-bt-text-navy">{r.title}</h3>
      {dest ? <p className="mt-0.5 text-xs text-teal-800">{dest}</p> : null}
      <p className="mt-2 line-clamp-4 flex-1 text-xs leading-relaxed text-slate-700">{r.excerpt}</p>
    </article>
  )
}

/** 메인 고객 후기 — 2~3열 그리드로 다수 동시 노출 */
export default function HomeReviewsGridClient({ reviews }: Props) {
  const safe = useMemo(() => reviews.filter((r) => r.id && r.title && r.excerpt), [reviews])

  if (safe.length === 0) return null

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
      {safe.map((r) => (
        <li key={r.id} className="min-h-0">
          <HomeReviewGridCard review={r} />
        </li>
      ))}
    </ul>
  )
}
