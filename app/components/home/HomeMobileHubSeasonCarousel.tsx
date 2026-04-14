'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HomeSeasonPickDTO } from '@/lib/home-season-pick'
import { HOME_MOBILE_HUB_SECTION_TITLE_CLASS } from '@/lib/home-mobile-hub-section-typography'

const AUTO_MS = 5200
const PAUSE_AFTER_INTERACTION_MS = 12000

/** 이미지 비주얼 박스 — 높이·비율 고정(운영 확정값, 변경 금지) */
const IMAGE_H = 'h-[11.25rem]'
const TEXT_MIN = 'min-h-[12.25rem]'

function SeasonCtaLink({ href, label }: { href: string; label: string }) {
  const cls =
    'mt-auto inline-flex h-12 w-full shrink-0 items-center justify-center rounded-xl bg-teal-700 px-4 text-center text-base font-bold text-white shadow-md transition hover:bg-teal-800 active:scale-[0.99]'
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} className={cls} rel="noopener noreferrer">
        {label}
      </a>
    )
  }
  return (
    <Link href={href} className={cls}>
      {label}
    </Link>
  )
}

function SeasonSlideCard({
  slide,
  slideWidthPct,
}: {
  slide: HomeSeasonPickDTO
  slideWidthPct: number
}) {
  const [expanded, setExpanded] = useState(false)
  const img = slide.imageUrl
  const isRemoteImg = Boolean(img && /^https?:\/\//i.test(img))
  const imageUnoptimized = isRemoteImg || Boolean(img?.startsWith('/'))

  const needsMore = useMemo(() => {
    const full = slide.bodyFull.replace(/\s+/g, ' ').trim()
    if (!full) return false
    if (slide.excerpt.endsWith('…')) return true
    return full.length > slide.excerpt.replace(/…$/, '').trim().length + 2
  }, [slide.bodyFull, slide.excerpt])

  return (
    <div className="shrink-0" style={{ width: `${slideWidthPct}%` }}>
      <div
        className={`relative w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80 ${IMAGE_H}`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-teal-100/90 via-slate-100 to-slate-200/90" aria-hidden />
        {img ? (
          isRemoteImg ? (
            <img
              src={img}
              alt={slide.title}
              className="absolute inset-0 z-[1] h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <Image
              src={img}
              alt={slide.title}
              fill
              className="z-[1] object-cover"
              sizes="100vw"
              unoptimized={imageUnoptimized}
              priority={false}
            />
          )
        ) : (
          <div className="absolute inset-0 z-[1] flex items-center justify-center bg-gradient-to-br from-teal-600/20 via-slate-200/55 to-slate-300/45">
            <span className="px-3 text-center text-sm font-semibold leading-snug text-slate-700/95">
              시즌 안내 글
            </span>
          </div>
        )}
      </div>
      <div
        className={`flex flex-col border-t border-slate-100 bg-white px-4 pb-4 pt-3 ${TEXT_MIN}`}
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">읽을거리 · 짧은 안내</p>
        <h3 className="mt-1.5 text-lg font-bold leading-snug tracking-tight text-slate-900 sm:text-xl">{slide.title}</h3>
        {expanded ? (
          <p className="mt-2 max-h-[11rem] overflow-y-auto whitespace-pre-line text-[15px] font-medium leading-relaxed text-slate-800">
            {slide.bodyFull}
          </p>
        ) : (
          <p className="mt-2 line-clamp-3 text-[15px] font-medium leading-relaxed text-slate-800">{slide.excerpt}</p>
        )}
        {needsMore ? (
          <button
            type="button"
            className="mt-2 self-start text-[15px] font-bold text-teal-800 underline-offset-2 hover:underline"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? '본문 접기' : '본문 더보기'}
          </button>
        ) : (
          <span className="mt-2 h-[1.375rem]" aria-hidden />
        )}
        <SeasonCtaLink href={slide.ctaHref} label={slide.ctaLabel} />
      </div>
    </div>
  )
}

type Props = { slides: HomeSeasonPickDTO[] }

export default function HomeMobileHubSeasonCarousel({ slides }: Props) {
  const n = slides.length
  const [index, setIndex] = useState(0)
  const resumeAtRef = useRef(0)
  const touchStartX = useRef<number | null>(null)

  const bumpInteractionPause = useCallback(() => {
    resumeAtRef.current = Date.now() + PAUSE_AFTER_INTERACTION_MS
  }, [])

  useEffect(() => {
    if (n <= 1) return
    const t = window.setInterval(() => {
      if (Date.now() < resumeAtRef.current) return
      setIndex((i) => (i + 1) % n)
    }, AUTO_MS)
    return () => window.clearInterval(t)
  }, [n])

  const go = useCallback(
    (dir: -1 | 1) => {
      bumpInteractionPause()
      setIndex((i) => (i + dir + n) % n)
    },
    [bumpInteractionPause, n]
  )

  const onTouchStart = (e: React.TouchEvent) => {
    bumpInteractionPause()
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current
    touchStartX.current = null
    if (start == null || n <= 1) return
    const end = e.changedTouches[0]?.clientX
    if (end == null) return
    const dx = end - start
    if (dx < -48) go(1)
    else if (dx > 48) go(-1)
  }

  return (
    <section
      aria-label="시즌 추천"
      aria-roledescription="carousel"
      className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
    >
      <p className="text-center text-[11px] font-medium tracking-wide text-slate-500">추천 글 · 시즌 제안</p>
      <h2 className={`${HOME_MOBILE_HUB_SECTION_TITLE_CLASS} mt-1`}>시즌 추천</h2>
      <p className="mx-auto mt-1 max-w-md text-center text-[13px] leading-relaxed text-slate-600">
        아래 「주요 서비스」와 같은 메뉴 타일이 아니라, 운영이 올려 둔 짧은 안내·제안을 읽는 영역입니다.
      </p>

      <div
        className="relative mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onPointerDown={() => bumpInteractionPause()}
      >
        <div className="pointer-events-none absolute right-3 top-2 z-[2] rounded-full bg-slate-900/70 px-2 py-0.5 text-xs font-semibold text-white">
          {index + 1}/{n}
        </div>

        <div
          className="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{
            width: `${n * 100}%`,
            transform: `translateX(-${(100 / n) * index}%)`,
          }}
        >
          {slides.map((slide) => (
            <SeasonSlideCard key={slide.id} slide={slide} slideWidthPct={100 / n} />
          ))}
        </div>
      </div>

      {n > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-2" role="tablist" aria-label="시즌 추천 슬라이드">
          {slides.map((_, i) => (
            <button
              key={`season-dot-${i}-${slides[i]!.id}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`${i + 1}번째 안내`}
              className={
                i === index
                  ? 'h-2.5 w-6 rounded-full bg-teal-700 transition'
                  : 'h-2 w-2 rounded-full bg-slate-300 transition hover:bg-slate-400'
              }
              onClick={() => {
                bumpInteractionPause()
                setIndex(i)
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
