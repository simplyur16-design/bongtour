import { Building2, UtensilsCrossed } from 'lucide-react'
import type { HotelMealLabels } from '@/lib/hotel-meal-display'

// REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: 일정 숙소·식사 Lucide SVG (문자 이모지 금지) — manifest

type Props = {
  hotelLine: string | null
  mealLines: string[]
  labels: HotelMealLabels
  className?: string
}

const SUBCARD =
  'flex min-h-0 flex-col items-start rounded-lg border border-bt-border-soft bg-bt-surface/90 px-3 py-2.5 text-left'

const ICO_WELL =
  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-bt-card-accent-soft text-bt-card-accent-strong ring-1 ring-bt-card-accent-border/70'

/**
 * 일정 day 본문 아래 — 예정호텔 / 식사 가로 2열(모바일 1열).
 * 아이콘은 Lucide stroke SVG (문자 이모지·이모티콘 금지).
 */
export default function ScheduleDayHotelMealCard({ hotelLine, mealLines, labels, className = '' }: Props) {
  const showHotel = Boolean(hotelLine?.trim())
  const lines = mealLines.filter((x) => x.trim().length > 0)
  const mealOneLine = lines.length > 0 ? lines.join(' ').trim() : '식사 - 불포함'

  return (
    <div
      className={`mt-4 rounded-xl border border-bt-card-accent-border bg-bt-card-accent-soft px-3 py-3 text-xs text-bt-body sm:text-sm ${className}`}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-start">
        {showHotel ? (
          <div className={SUBCARD}>
            <div className="inline-flex items-center gap-2">
              <span className={ICO_WELL} aria-hidden>
                <Building2 className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
              <p className="bt-card-kicker tracking-[0.12em]">{labels.hotelBlockTitle}</p>
            </div>
            <p className="bt-wrap mt-1.5 text-xs sm:text-sm font-medium leading-snug text-bt-title">
              {hotelLine!.trim()}
            </p>
          </div>
        ) : null}
        <div className={SUBCARD}>
          <div className="inline-flex items-center gap-2">
            <span className={ICO_WELL} aria-hidden>
              <UtensilsCrossed className="h-3.5 w-3.5" strokeWidth={2.25} />
            </span>
            <p className="bt-card-kicker tracking-[0.12em]">{labels.mealBlockTitle}</p>
          </div>
          <p className="bt-wrap mt-1.5 text-xs sm:text-sm font-medium leading-relaxed text-bt-title">
            {mealOneLine}
          </p>
        </div>
      </div>
    </div>
  )
}
