import type { ReviewCardModel } from '@/lib/reviews-types'

export function formatReviewDestination(r: ReviewCardModel): string | null {
  const parts = [r.destination_country, r.destination_city].filter((x) => x && String(x).trim())
  return parts.length ? parts.join(' · ') : null
}

export function formatReviewWhen(r: ReviewCardModel): string | null {
  if (r.displayed_date) {
    const d = new Date(`${r.displayed_date}T12:00:00`)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
    }
  }
  if (r.travel_month) {
    const ym = r.travel_month.slice(0, 7)
    const [y, m] = ym.split('-')
    if (y && m) return `${y}년 ${Number(m)}월 여행`
  }
  return null
}
