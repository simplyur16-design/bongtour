'use client'

import SafeImage from '@/app/components/SafeImage'
import { useEffect, useMemo, useState } from 'react'
import type { ReviewCardModel } from '@/lib/reviews-types'

const ROTATE_MS = 6000

function starsFromLabel(label: string | null): number {
  if (!label) return 0
  const m = label.match(/(\d+(?:\.\d+)?)/)
  if (!m) return 0
  const n = Number(m[1])
  if (!Number.isFinite(n)) return 0
  return Math.min(5, Math.max(0, Math.round(n)))
}

type Props = { reviews: ReviewCardModel[] }

export default function HomeReviewsCarouselClient({ reviews }: Props) {
  const safe = useMemo(() => reviews.filter((r) => r.id && r.title && r.excerpt), [reviews])
  const n = safe.length
  const [i, setI] = useState(0)

  useEffect(() => {
    if (i >= n && n > 0) setI(0)
  }, [i, n])

  useEffect(() => {
    if (n <= 1) return
    const id = window.setInterval(() => setI((x) => (x + 1) % n), ROTATE_MS)
    return () => window.clearInterval(id)
  }, [n])

  if (n === 0) return null

  const r = safe[i]!
  const stars = starsFromLabel(r.rating_label)
  const dest = [r.destination_city, r.destination_country].filter(Boolean).join(' · ')

  return (
    <div className="relative mx-auto max-w-lg">
      {n > 1 ? (
        <div className="mb-3 flex justify-center gap-1.5">
          {safe.map((_, k) => (
            <button
              key={`rv-dot-${k}`}
              type="button"
              aria-label={`${k + 1}번째 후기`}
              aria-current={k === i}
              className={
                k === i ? 'h-2 w-6 rounded-full bg-bt-text-navy' : 'h-2 w-2 rounded-full bg-white/70 hover:bg-white'
              }
              onClick={() => setI(k)}
            />
          ))}
        </div>
      ) : null}

      <article className="rounded-2xl border border-bt-border-soft/50 bg-white p-5 shadow-md sm:p-6">
        {r.thumbnail_url ? (
          <div className="relative mb-4 aspect-[16/9] w-full overflow-hidden rounded-xl bg-slate-100">
            <SafeImage src={r.thumbnail_url} alt="" fill className="object-cover" sizes="(max-width:768px) 100vw, 480px" />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {stars > 0 ? (
            <p className="text-amber-500" aria-label={`별점 ${stars}점`}>
              {'★'.repeat(stars)}
              <span className="sr-only">{stars}점</span>
            </p>
          ) : r.rating_label ? (
            <span className="text-sm font-medium text-bt-text-muted-lavender">{r.rating_label}</span>
          ) : null}
        </div>
        <h3 className="mt-2 text-lg font-bold text-bt-text-navy">{r.title}</h3>
        {dest ? <p className="mt-1 text-sm text-teal-800">{dest}</p> : null}
        <p className="mt-3 text-sm leading-relaxed text-slate-700">{r.excerpt}</p>
      </article>
    </div>
  )
}
