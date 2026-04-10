'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import PexelsSourceCaption from '@/app/components/detail/PexelsSourceCaption'
import { warnLegacyGeminiUploadPath } from '@/lib/legacy-gemini-upload-path'
import {
  productHeroAttributionBadgeFromImageUrl,
  productHeroAttributionBadgeText,
} from '@/lib/product-bg-image-attribution'
import { publicLocationCaptionFromImageUrl } from '@/lib/schedule-from-product'

type DaySlide = { day: number; imageUrl: string | null | undefined; imageDisplayName?: string | null }

type Props = {
  heroUrl: string | null
  /** 일정 day 대표 이미지(순서대로, hero와 동일 URL은 스킵) */
  daySlides: DaySlide[]
  destinationLabel?: string
  /** SEO·접근성: 이미지 대체 텍스트 접두(상품명) */
  productTitle?: string
  className?: string
  /** Product.bgImageSource — 수동 업로드 출처 타입 */
  heroImageSourceType?: string | null
  /** Product.bgImageIsGenerated */
  heroImageIsGenerated?: boolean | null
  /** schedule에 표시명이 없을 때 image_assets(seo_title/title/alt)로 첫 슬라이드 캡션 보강 */
  heroCaptionFromAsset?: string | null
}

export default function ProductHeroCarousel({
  heroUrl,
  daySlides,
  destinationLabel,
  productTitle,
  className = '',
  heroImageSourceType,
  heroImageIsGenerated,
  heroCaptionFromAsset,
}: Props) {
  const slides = useMemo(() => {
    const urls: { src: string; caption: string; attribution: string | null }[] = []
    const heroTrim = heroUrl?.trim() ?? ''
    const firstNamedDay = daySlides.find((d) => d.imageDisplayName?.trim())
    const heroDayMatch = heroTrim ? daySlides.find((d) => d.imageUrl?.trim() === heroTrim) : undefined
    if (heroTrim) {
      const topCaption =
        heroCaptionFromAsset?.trim() ||
        heroDayMatch?.imageDisplayName?.trim() ||
        publicLocationCaptionFromImageUrl(heroTrim) ||
        firstNamedDay?.imageDisplayName?.trim() ||
        (destinationLabel?.trim() ? destinationLabel.trim() : '대표 이미지')
      const attribution =
        productHeroAttributionBadgeText(heroImageSourceType, heroImageIsGenerated) ??
        productHeroAttributionBadgeFromImageUrl(heroTrim)
      urls.push({ src: heroTrim, caption: topCaption, attribution })
    }
    const seen = new Set<string>(heroTrim ? [heroTrim] : [])
    for (const d of daySlides) {
      const s = d.imageUrl?.trim()
      if (!s || seen.has(s)) continue
      seen.add(s)
      const display = d.imageDisplayName?.trim()
      const caption =
        display || publicLocationCaptionFromImageUrl(s) || `일정 ${String(d.day).padStart(2, '0')}`
      urls.push({
        src: s,
        caption,
        attribution: productHeroAttributionBadgeFromImageUrl(s),
      })
    }
    return urls
  }, [
    heroUrl,
    daySlides,
    destinationLabel,
    heroCaptionFromAsset,
    heroImageSourceType,
    heroImageIsGenerated,
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
      <PexelsSourceCaption className="block">
        <div className="relative aspect-[16/10] w-full">
          {slides.map((s, i) => (
            <img
              key={s.src + i}
              src={s.src}
              alt={
                productTitle?.trim()
                  ? `${productTitle.trim()} · ${s.caption}`
                  : s.caption
              }
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
                i === index ? 'opacity-100' : 'opacity-0'
              }`}
            />
          ))}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] flex flex-row items-end justify-between gap-2 bg-gradient-to-t from-black/75 via-black/25 to-transparent px-3 pb-3 pt-16 sm:gap-3 sm:px-4 sm:pb-4">
            <p className="line-clamp-2 min-w-0 flex-1 text-left text-sm font-bold text-white drop-shadow">
              {current.caption}
            </p>
            {current.attribution ? (
              <span
                className="shrink-0 self-end rounded-full bg-black/55 px-2 py-0.5 text-right text-[10px] font-medium leading-tight text-white backdrop-blur-[2px]"
                role="note"
              >
                {current.attribution}
              </span>
            ) : null}
          </div>
        </div>
      </PexelsSourceCaption>
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
          <div className="absolute bottom-3 left-0 right-0 z-10 flex justify-center gap-1.5">
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
