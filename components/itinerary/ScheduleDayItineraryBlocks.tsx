'use client'

import { useCallback, useEffect, useState } from 'react'
import SafeImage from '@/app/components/SafeImage'
import { formatMealDisplay, formatScheduleDayHotelLine } from '@/lib/hotel-meal-display'
import { Bed, UtensilsCrossed, X } from 'lucide-react'

const CATEGORY = {
  hotel: { color: '#C9C2E3', icon: Bed, chipBg: '#EFEDF8', chipText: '#534AB7', iconColor: '#534AB7', label: '숙소' },
  meal: { color: '#d9a81e', icon: UtensilsCrossed, chipBg: '#FAEEDA', chipText: '#85510B', iconColor: 'white', label: '식사' },
} as const

export type ScheduleDayItineraryBlocksDay = {
  day: number
  title?: string | null
  description?: string | null
  imageUrl?: string | null
  imageUrl2?: string | null
  imageDisplayName?: string | null
  imageDisplayName2?: string | null
  hotelText?: string | null
  breakfastText?: string | null
  lunchText?: string | null
  dinnerText?: string | null
  mealSummaryText?: string | null
  meals?: string | null
}

type Props = {
  day: ScheduleDayItineraryBlocksDay
  hotelNames?: string[] | null
  hotelSummaryText?: string | null
  isLastScheduleRow?: boolean
}

function ScheduleDayImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string
  alt: string
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="일정 사진 확대"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-[#1F1B2D] shadow"
        aria-label="닫기"
      >
        <X size={22} />
      </button>
      <div
        className="relative max-h-[85vh] max-w-[min(960px,100%)] w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <SafeImage
          src={src}
          alt={alt}
          width={1200}
          height={800}
          className="max-h-[85vh] w-full rounded-lg object-contain"
        />
      </div>
    </div>
  )
}

function DayThumb({
  src,
  alt,
  onOpen,
}: {
  src: string
  alt: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-[#DAD4EE] bg-[#F5F2EA] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#85510B]"
    >
      <SafeImage src={src} alt={alt} fill className="object-cover transition group-hover:scale-[1.02]" sizes="160px" />
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 to-transparent px-2 py-1.5 text-left text-[10px] font-medium text-white line-clamp-2">
        {alt}
      </span>
    </button>
  )
}

export function ScheduleDayItineraryBlocks({ day, hotelNames, hotelSummaryText, isLastScheduleRow }: Props) {
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)
  const closeLightbox = useCallback(() => setLightbox(null), [])

  const hotelLine = formatScheduleDayHotelLine({
    hotelNames: hotelNames ?? null,
    hotelSummaryText: hotelSummaryText ?? null,
    dayHotelText: day.hotelText ?? null,
    isLastScheduleRow: Boolean(isLastScheduleRow),
    dayDescription: day.description ?? null,
  })
  const mealLines = formatMealDisplay({
    breakfastText: day.breakfastText,
    lunchText: day.lunchText,
    dinnerText: day.dinnerText,
    mealSummaryText: day.mealSummaryText,
    mealsLegacy: day.meals ?? null,
  })
  const mealLine = mealLines.length > 0 ? mealLines.join(', ') : null
  const hotelCat = CATEGORY.hotel
  const mealCat = CATEGORY.meal
  const HotelIcon = hotelCat.icon
  const MealIcon = mealCat.icon

  const url1 = day.imageUrl?.trim() || null
  const url2 = day.imageUrl2?.trim() || null
  const thumbs: { src: string; alt: string }[] = []
  if (url1) thumbs.push({ src: url1, alt: day.imageDisplayName?.trim() || `Day ${day.day} photo 1` })
  if (url2 && url2 !== url1) {
    thumbs.push({ src: url2, alt: day.imageDisplayName2?.trim() || `Day ${day.day} photo 2` })
  }

  return (
    <>
      <div className="space-y-3">
        {day.description ? (
          <article className="flex gap-3 rounded-2xl bg-white border border-[#DAD4EE] p-4">
            <div className="rounded-xl bg-[#1F1B2D] text-white w-12 h-12 flex items-center justify-center text-xl shrink-0">
              📋
            </div>
            <div className="flex-1 min-w-0">
              <span className="inline-block rounded-full bg-[#EFEDF8] px-2.5 py-0.5 text-xs font-semibold fit-tx-primary mb-2">
                일정 요약
              </span>
              <p className="text-sm fit-tx-primary whitespace-pre-line leading-relaxed">{day.description}</p>
            </div>
          </article>
        ) : null}

        {(hotelLine || mealLine || thumbs.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-stretch">
            <div className="space-y-3 min-w-0">
            {hotelLine ? (
              <article className="flex gap-2.5 rounded-2xl bg-white border border-[#DAD4EE] p-3 min-h-[5.5rem]">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: hotelCat.color }}
                >
                  <HotelIcon size={18} color={hotelCat.iconColor} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium mb-1 tracking-wide"
                    style={{ background: hotelCat.chipBg, color: hotelCat.chipText }}
                  >
                    {hotelCat.label}
                  </span>
                  <p className="text-xs sm:text-sm fit-tx-primary leading-snug line-clamp-4">{hotelLine}</p>
                </div>
              </article>
            ) : null}
            {mealLine ? (
              <article className="flex gap-2.5 rounded-2xl bg-white border border-[#DAD4EE] p-3 min-h-[5.5rem]">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: mealCat.color }}
                >
                  <MealIcon size={18} color={mealCat.iconColor} strokeWidth={1.8} />
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium mb-1 tracking-wide"
                    style={{ background: mealCat.chipBg, color: mealCat.chipText }}
                  >
                    {mealCat.label}
                  </span>
                  <p className="text-xs sm:text-sm fit-tx-primary leading-snug line-clamp-4">{mealLine}</p>
                </div>
              </article>
            ) : null}
            </div>
            {thumbs.length > 0 ? (
              <div className={`grid gap-3 h-full ${thumbs.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                {thumbs.map((t) => (
                  <DayThumb key={t.src} src={t.src} alt={t.alt} onOpen={() => setLightbox(t)} />
                ))}
              </div>
            ) : (
              <div className="hidden sm:block" aria-hidden />
            )}
          </div>
        )}
      </div>

      {lightbox ? <ScheduleDayImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={closeLightbox} /> : null}
    </>
  )
}
