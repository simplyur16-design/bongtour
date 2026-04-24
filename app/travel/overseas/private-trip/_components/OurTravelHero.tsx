'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import {
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

  /** 슬라이드는 CSS 트랜지션 없이 즉시 교체만 함 — OS「애니메이션 줄이기」로 인터벌을 꺼 두면 한 장에 고정되는 문제가 있어 인터벌은 항상 둠 */
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
    <section className="border-b border-bt-border bg-gradient-to-b from-white to-bt-surface">
      <div className="mx-auto min-w-0 max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
        <div className="relative min-w-0 overflow-hidden rounded-xl border border-bt-border bg-bt-surface">
          <div className="relative h-[150px] bg-slate-900 sm:h-[175px] md:h-[200px] lg:h-[22vh] lg:min-h-[180px] lg:max-h-[260px]">
            <Image
              key={`our-travel-hero-${imgIdx}-${src}`}
              src={src}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, min(1152px, 100vw)"
              priority={imgIdx === 0}
              decoding={imgIdx === 0 ? 'sync' : 'async'}
              unoptimized={src.startsWith('data:')}
              onError={() => setBroken((prev) => ({ ...prev, [imgIdx]: true }))}
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent sm:from-black/75 sm:via-black/35 sm:to-transparent"
              aria-hidden
            />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-start">
              <div className="max-w-[min(100%,22rem)] space-y-1.5 px-3 sm:max-w-xl sm:space-y-2 sm:px-5">
                <h2 className="text-left text-lg font-bold leading-snug tracking-tight text-white drop-shadow-md sm:text-xl">
                  {OUR_TRAVEL_HERO_OVERLAY_TITLE}
                </h2>
                <p className="text-left text-sm font-medium leading-snug text-white/90 drop-shadow sm:text-[15px] sm:leading-snug">
                  {OUR_TRAVEL_HERO_OVERLAY_DESCRIPTION}
                </p>
              </div>
            </div>
            {slides.length > 1 ? (
              <div className="pointer-events-none absolute right-2 top-2 z-10 flex gap-1.5">
                {slides.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === imgIdx ? 'w-4 bg-white' : 'w-1.5 bg-white/60'}`}
                    aria-hidden
                  />
                ))}
              </div>
            ) : null}
          </div>
          <div className="border-t border-bt-border-soft bg-white px-3 py-3 sm:px-4 sm:py-4">
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              <Link
                href={privateQuoteHref}
                className="inline-flex min-h-[44px] min-w-[10rem] items-center justify-center rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors duration-75 hover:bg-teal-800"
              >
                우리견적 문의하기
              </Link>
              <Link
                href={customTopicHref}
                className="inline-flex min-h-[44px] min-w-[10rem] items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-colors duration-75 hover:border-teal-300 hover:bg-teal-50/60 hover:text-teal-900"
              >
                맞춤여행 상담 받기
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
