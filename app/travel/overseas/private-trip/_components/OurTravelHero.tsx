'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  OUR_TRAVEL_GROUP_TYPE_MENTS,
  OUR_TRAVEL_HERO_TITLES,
  OUR_TRAVEL_MANAGER_MENTS,
  OUR_TRAVEL_SHORT_OVERLAY_MENTS,
  OUR_TRAVEL_SUBTEXTS,
  stripOurTravelHeroBracketTags,
} from '@/app/travel/overseas/private-trip/_components/our-travel-hero-copy'

const STATIC_FALLBACK_IMAGE =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="480" viewBox="0 0 1280 480"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f1f5f9"/><stop offset="100%" stop-color="#e2e8f0"/></linearGradient></defs><rect width="1280" height="480" fill="url(#g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#64748b" font-family="system-ui,sans-serif" font-size="28">우리여행</text></svg>`,
  )

const N = OUR_TRAVEL_HERO_TITLES.length

function modeABundleIndex(slidesLength: number, imgIdx: number, slotPair: number): number {
  if (slidesLength > 1) return imgIdx % N
  return slotPair % N
}

type Props = {
  /** Supabase Storage 풀 URL만 (비어 있으면 정적 1장) */
  imageUrls: string[]
  inquiryHref: string
}

function modeAThirdLine(slotA: number): string {
  const useGroupType = slotA % 4 === 3
  if (useGroupType) {
    const gi = Math.floor(slotA / 4) % OUR_TRAVEL_GROUP_TYPE_MENTS.length
    return stripOurTravelHeroBracketTags(OUR_TRAVEL_GROUP_TYPE_MENTS[gi]!)
  }
  return OUR_TRAVEL_MANAGER_MENTS[slotA % OUR_TRAVEL_MANAGER_MENTS.length]!
}

export default function OurTravelHero({ imageUrls, inquiryHref }: Props) {
  const imageSetKey = imageUrls.join('\n')
  /** 동일 URL 중복이면 imgIdx만 바뀌고 화면은 그대로여서 “고정”처럼 보일 수 있음 → 제거 */
  const slides = useMemo(() => {
    const uniq = [...new Set(imageUrls.map((u) => u.trim()).filter(Boolean))]
    if (uniq.length === 0) return [STATIC_FALLBACK_IMAGE]
    return uniq
  }, [imageSetKey, imageUrls])

  const [rotationIndex, setRotationIndex] = useState(0)
  const [broken, setBroken] = useState<Record<number, boolean>>({})
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    setRotationIndex(0)
    setBroken({})
  }, [imageSetKey])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => setReduceMotion(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (reduceMotion) return
    const t = setInterval(() => {
      setRotationIndex((v) => v + 1)
    }, 5500)
    return () => clearInterval(t)
  }, [reduceMotion, slides.length])

  const imgIdx = rotationIndex % slides.length
  const isModeA = rotationIndex % 2 === 0
  const slotPair = Math.floor(rotationIndex / 2)
  const bundleIdx = modeABundleIndex(slides.length, imgIdx, slotPair)

  const title = OUR_TRAVEL_HERO_TITLES[bundleIdx]!
  const subtext = OUR_TRAVEL_SUBTEXTS[bundleIdx]!
  const modeAThird = modeAThirdLine(slotPair)
  const overlayShort = OUR_TRAVEL_SHORT_OVERLAY_MENTS[slotPair % OUR_TRAVEL_SHORT_OVERLAY_MENTS.length]!

  const safeImg = (i: number) => (broken[i] ? STATIC_FALLBACK_IMAGE : slides[i]!)
  const src = safeImg(imgIdx)

  const customTopicHref = `${inquiryHref}${inquiryHref.includes('?') ? '&' : '?'}topic=custom`

  return (
    <section className="border-b border-bt-border bg-gradient-to-b from-white to-bt-surface">
      <div className="mx-auto min-w-0 max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
        <div className="relative min-w-0 overflow-hidden rounded-xl border border-bt-border bg-bt-surface">
          <div className="relative h-[150px] sm:h-[175px] md:h-[200px] lg:h-[22vh] lg:min-h-[180px] lg:max-h-[260px]">
            <img
              key={`${imgIdx}-${src.slice(0, 120)}`}
              src={src}
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
              fetchPriority="high"
              decoding="async"
              onError={() => setBroken((prev) => ({ ...prev, [imgIdx]: true }))}
            />
            {!isModeA ? (
              <>
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent sm:from-black/75 sm:via-black/35 sm:to-transparent"
                  aria-hidden
                />
                <div className="pointer-events-none absolute inset-0 flex items-center">
                  <p className="max-w-[min(100%,22rem)] px-3 text-left text-sm font-semibold leading-snug text-white drop-shadow-sm sm:max-w-xl sm:px-5 sm:text-base sm:leading-snug">
                    {overlayShort}
                  </p>
                </div>
              </>
            ) : null}
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
            {isModeA ? (
              <div className="mx-auto max-w-3xl space-y-2 text-center sm:space-y-2.5">
                <h2 className="text-base font-bold leading-snug text-bt-title sm:text-lg">{title}</h2>
                <p className="text-sm leading-relaxed text-slate-600">{subtext}</p>
                <p className="text-xs leading-relaxed text-slate-700 sm:text-sm">{modeAThird}</p>
              </div>
            ) : null}
            <div
              className={`flex flex-wrap justify-center gap-2 sm:gap-3 ${isModeA ? 'mt-4' : 'mt-3'}`}
            >
              <Link
                href={inquiryHref}
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
