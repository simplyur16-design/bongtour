'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import SafeImage from '@/app/components/SafeImage'
import type { AirHotelSeasonHeroSlide } from '@/lib/air-hotel-season-curation-content'

const HERO_AUTO_MS = 10_000
const HERO_MANUAL_COOLDOWN_MS = 10_000

type Props = {
  slides: AirHotelSeasonHeroSlide[]
}

export default function AirHotelHero({ slides }: Props) {
  const [idx, setIdx] = useState(0)
  const [broken, setBroken] = useState<Record<string, boolean>>({})
  const [lastManualAt, setLastManualAt] = useState(0)
  const slideCountRef = useRef(0)

  useEffect(() => {
    setIdx(0)
  }, [slides.length])

  useEffect(() => {
    slideCountRef.current = slides.length
    if (slides.length <= 1) return
    const id = setInterval(() => {
      if (Date.now() - lastManualAt < HERO_MANUAL_COOLDOWN_MS) return
      setIdx((v) => {
        const n = slideCountRef.current
        if (n <= 1) return v
        return (v + 1) % n
      })
    }, HERO_AUTO_MS)
    return () => clearInterval(id)
  }, [slides.length, lastManualAt])

  if (slides.length === 0) return null

  const current = slides[idx % slides.length]!
  const imageSrc = broken[current.productId] ? '' : current.productImageUrl

  const shiftSlide = (delta: number) => {
    setLastManualAt(Date.now())
    setIdx((v) => {
      const n = slides.length
      if (n <= 1) return v
      return (v + delta + n) % n
    })
  }

  const goToSlide = (i: number) => {
    setLastManualAt(Date.now())
    setIdx(i)
  }

  return (
    <section className="relative border-b border-bt-border">
      <div className="relative w-full overflow-hidden min-h-[min(280px,46vh)] sm:min-h-[min(340px,50vh)]">
        <div className="absolute inset-0">
          {imageSrc ? (
            <SafeImage
              src={imageSrc}
              alt={current.productTitle}
              fill
              sizes="100vw"
              className="object-cover transition-opacity duration-500"
              priority={idx === 0}
              onError={() => setBroken((prev) => ({ ...prev, [current.productId]: true }))}
            />
          ) : (
            <div className="absolute inset-0 bg-bt-surface-soft" aria-hidden />
          )}
        </div>

        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/75 via-black/30 to-transparent"
          aria-hidden
        />

        {slides.length > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-2 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/45 text-2xl font-light text-white shadow-lg backdrop-blur-sm transition hover:bg-black/60 sm:left-4"
              aria-label="이전 슬라이드"
              onClick={() => shiftSlide(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/45 text-2xl font-light text-white shadow-lg backdrop-blur-sm transition hover:bg-black/60 sm:right-4"
              aria-label="다음 슬라이드"
              onClick={() => shiftSlide(1)}
            >
              ›
            </button>
            <div className="absolute right-2 top-2 z-20 flex max-w-[min(100%,20rem)] flex-wrap items-center justify-end gap-1.5">
              {slides.map((_, i) => (
                <button
                  key={`air-hotel-hero-dot-${i}`}
                  type="button"
                  onClick={() => goToSlide(i)}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                  }`}
                  aria-label={`슬라이드 ${i + 1}${i === idx ? ' (현재)' : ''}`}
                  aria-current={i === idx ? 'true' : undefined}
                  aria-pressed={i === idx}
                />
              ))}
            </div>
          </>
        ) : null}

        <div className="absolute inset-0 z-10 flex flex-col justify-end p-6 sm:p-10">
          {current.monthLabel ? (
            <p className="mb-1 text-xs text-bt-bg/80 drop-shadow sm:text-sm">{current.monthLabel}</p>
          ) : null}
          {current.message ? (
            <h2 className="mb-2 max-w-2xl text-lg font-bold text-bt-bg drop-shadow-md sm:text-2xl">
              {current.message}
            </h2>
          ) : null}
          <Link
            href={current.productHref}
            className="text-sm text-bt-bg underline-offset-4 drop-shadow hover:underline sm:text-base"
          >
            {current.productTitle}
          </Link>
        </div>
      </div>
    </section>
  )
}
