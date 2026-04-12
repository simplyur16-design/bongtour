'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PublicImageBottomOverlay from '@/app/components/ui/PublicImageBottomOverlay'
import { warnLegacyGeminiUploadPath } from '@/lib/legacy-gemini-upload-path'
import { resolvePublicImageSourceUserLabel } from '@/lib/public-image-overlay-ssot'
import { resolveCarouselDaySlideLeftLabel } from '@/lib/public-product-carousel-day-slide-left-label'

type DaySlide = {
  day: number
  imageUrl: string | null | undefined
  imageDisplayName?: string | null
  title?: string | null
  imageKeyword?: string | null
  city?: string | null
}

type Slide = {
  src: string
  alt: string
  leftLabel: string | null
  rightLabel: string | null
}

type Props = {
  heroUrl: string | null
  /** 일정 day 대표 이미지(순서대로, hero와 동일 URL은 스킵) */
  daySlides: DaySlide[]
  /** 접근성·브라우저 alt 전용(오버레이 좌·우 문구와 분리) */
  productTitle?: string
  className?: string
  /** Product.bgImageSource — 히어로 첫 슬라이드 출처 우선 */
  heroImageSourceType?: string | null
  /** Product.bgImageIsGenerated */
  heroImageIsGenerated?: boolean | null
  /** 대표 슬라이드 전용: 상품 SEO 한 줄(등록 저장값·휴리스틱 resolve 결과) */
  heroImageSeoKeywordOverlay?: string | null
  /** DAY 슬라이드 좌측 문구 fallback용 — 상품 SEO와 분리 */
  primaryDestination?: string | null
  destination?: string | null
}

export default function ProductHeroCarousel({
  heroUrl,
  daySlides,
  productTitle,
  className = '',
  heroImageSourceType,
  heroImageIsGenerated,
  heroImageSeoKeywordOverlay,
  primaryDestination,
  destination,
}: Props) {
  const heroSeoLeft = (heroImageSeoKeywordOverlay ?? '').trim() || null

  const slides = useMemo((): Slide[] => {
    const out: Slide[] = []
    const heroTrim = heroUrl?.trim() ?? ''
    const titleBase = (productTitle ?? '').trim()
    let slideIdx = 0

    if (heroTrim) {
      slideIdx += 1
      const right = resolvePublicImageSourceUserLabel({
        dbSource: heroImageSourceType,
        dbIsGenerated: heroImageIsGenerated,
        imageUrl: heroTrim,
      })
      out.push({
        src: heroTrim,
        alt: titleBase ? `${titleBase} 대표 이미지` : '여행 상품 대표 이미지',
        leftLabel: heroSeoLeft,
        rightLabel: right,
      })
    }
    const seen = new Set<string>(heroTrim ? [heroTrim] : [])
    for (const d of daySlides) {
      const s = d.imageUrl?.trim()
      if (!s || seen.has(s)) continue
      seen.add(s)
      slideIdx += 1
      const dayLeft = resolveCarouselDaySlideLeftLabel({
        day: d.day,
        imageDisplayName: d.imageDisplayName,
        title: d.title,
        imageKeyword: d.imageKeyword,
        city: d.city,
        primaryDestination: primaryDestination ?? null,
        destination: destination ?? null,
      })
      out.push({
        src: s,
        alt: titleBase ? `${titleBase} 일정 이미지 ${slideIdx}` : `여행 상품 일정 이미지 ${slideIdx}`,
        leftLabel: dayLeft,
        rightLabel: resolvePublicImageSourceUserLabel({ imageUrl: s }),
      })
    }
    return out
  }, [
    heroUrl,
    daySlides,
    productTitle,
    heroSeoLeft,
    heroImageSourceType,
    heroImageIsGenerated,
    primaryDestination,
    destination,
  ])

  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [slides.length])

  useEffect(() => {
    warnLegacyGeminiUploadPath(heroUrl, 'ProductHeroCarousel.heroUrl')
  }, [heroUrl])

  const len = slides.length
  const go = useCallback(
    (delta: number) => {
      if (len <= 1) return
      setIndex((i) => (i + delta + len) % len)
    },
    [len]
  )

  useEffect(() => {
    if (len <= 1) return
    const t = window.setInterval(() => go(1), 6500)
    return () => window.clearInterval(t)
  }, [len, go])

  if (len === 0) {
    return (
      <div
        className={`flex aspect-[16/10] w-full items-center justify-center rounded-2xl border border-bt-border-strong bg-bt-surface-alt text-sm text-bt-muted ${className}`}
      >
        등록된 대표 이미지가 없습니다.
      </div>
    )
  }

  const current = slides[index]!

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-bt-border-strong bg-bt-title shadow-lg ${className}`}>
      <div className="relative aspect-[16/10] w-full">
        {slides.map((s, i) => (
          <img
            key={s.src + i}
            src={s.src}
            alt={s.alt}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
              i === index ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
        <PublicImageBottomOverlay leftLabel={current.leftLabel} rightLabel={current.rightLabel} />
      </div>
      {len > 1 && (
        <>
          <button
            type="button"
            aria-label="이전 이미지"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/35 text-lg text-white backdrop-blur-sm transition hover:bg-black/50"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="다음 이미지"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-black/35 text-lg text-white backdrop-blur-sm transition hover:bg-black/50"
          >
            ›
          </button>
          {/* 하단 SEO/출처 오버레이(z-15)와 겹치지 않도록 슬라이드 점을 위로 */}
          <div className="absolute bottom-12 left-0 right-0 z-20 flex justify-center gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`슬라이드 ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/45'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
