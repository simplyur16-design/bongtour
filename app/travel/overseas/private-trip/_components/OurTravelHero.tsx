'use client'

import Link from 'next/link'
import SafeImage from '@/app/components/SafeImage'
import { useEffect, useMemo, useState } from 'react'
import {
  OUR_TRAVEL_HERO_CTA_CUSTOM_CONSULT,
  OUR_TRAVEL_HERO_CTA_PRIVATE_INQUIRY,
  OUR_TRAVEL_HERO_OVERLAY_DESCRIPTION,
  OUR_TRAVEL_HERO_OVERLAY_TITLE,
} from '@/app/travel/overseas/private-trip/_components/our-travel-hero-copy'

const STATIC_FALLBACK_IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="480" viewBox="0 0 1280 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f1f5f9"/><stop offset="100%" stop-color="#e2e8f0"/></linearGradient></defs><rect width="1280" height="480" fill="url(#g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="system-ui,sans-serif" font-size="28">우리여행</text></svg>`,
  )

type Props = {
  /** Supabase Storage 풀 URL만 (비어 있으면 정적 1장) */
  imageUrls: string[]
  /** 우리견적 — `PrivateQuoteFormEntry` (`/quote/private`) */
  privateQuoteHref: string
  /** 일반 여행 상담 — `TravelInquiryForm` (`/inquiry?type=travel`) */
  travelConsultHref: string
}

export default function OurTravelHero({ imageUrls, privateQuoteHref, travelConsultHref }: Props) {
  const imageSetKey = imageUrls.join('\n')
  const slides = useMemo(() => {
    const uniq = [...new Set(imageUrls.map((u) => u.trim()).filter(Boolean))]
    if (uniq.length === 0) return [STATIC_FALLBACK_IMAGE]
    return uniq
  }, [imageSetKey, imageUrls])

  const [rotationIndex, setRotationIndex] = useState(0)
  const [broken, setBroken] = useState<Record<number, boolean>>({})

  useEffect(() => {
    setRotationIndex(0)
    setBroken({})
  }, [imageSetKey])

  useEffect(() => {
    if (slides.length <= 1) return
    const t = setInterval(() => {
      setRotationIndex((v) => v + 1)
    }, 5500)
    return () => clearInterval(t)
  }, [slides.length])

  const imgIdx = rotationIndex % slides.length
  const safeImg = (i: number) => (broken[i] ? STATIC_FALLBACK_IMAGE : slides[i]!)
  const src = safeImg(imgIdx)
  const customTopicHref = `${travelConsultHref}${travelConsultHref.includes('?') ? '&' : '?'}topic=custom`

  return (
    <section className="border-b border-bt-border bg-bt-surface">
      <div className="relative w-full overflow-hidden min-h-[min(440px,62vh)] sm:min-h-[min(480px,65vh)]">
        <SafeImage
          key={`our-travel-hero-${imgIdx}-${src}`}
          src={src}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority={imgIdx === 0}
          decoding={imgIdx === 0 ? 'sync' : 'async'}
          unoptimized={src.startsWith('data:')}
          onError={() => setBroken((prev) => ({ ...prev, [imgIdx]: true }))}
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/15"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 pt-8 sm:px-6 sm:pt-10">
          <div className="mx-auto max-w-xl space-y-2 text-center">
            <h2 className="text-xl font-bold leading-snug tracking-tight text-white drop-shadow-md sm:text-2xl">
              {OUR_TRAVEL_HERO_OVERLAY_TITLE}
            </h2>
            <p className="text-sm font-medium leading-snug text-white/90 drop-shadow sm:text-base">
              {OUR_TRAVEL_HERO_OVERLAY_DESCRIPTION}
            </p>
          </div>
        </div>
        {slides.length > 1 ? (
          <div className="pointer-events-none absolute right-3 top-3 z-10 flex gap-1.5 sm:right-4 sm:top-4">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${i === imgIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
                aria-hidden
              />
            ))}
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 z-20 px-4 pb-5 pt-20 sm:px-6 sm:pb-6">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-2 sm:gap-3">
            <Link
              href={privateQuoteHref}
              className="inline-flex min-h-[44px] min-w-[10rem] items-center justify-center rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors duration-75 hover:bg-teal-800"
            >
              {OUR_TRAVEL_HERO_CTA_PRIVATE_INQUIRY}
            </Link>
            <Link
              href={customTopicHref}
              className="inline-flex min-h-[44px] min-w-[10rem] items-center justify-center rounded-xl border border-white/30 bg-white/95 px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-lg backdrop-blur-sm transition-colors duration-75 hover:border-teal-200 hover:bg-white"
            >
              {OUR_TRAVEL_HERO_CTA_CUSTOM_CONSULT}
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
