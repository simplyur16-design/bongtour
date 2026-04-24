'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeHomeSeasonSlidesForClient, type HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import { HOME_MOBILE_HUB_SECTION_TITLE_CLASS } from '@/lib/home-mobile-hub-section-typography'
import { devWarnMobileHome } from '@/lib/mobile-home-dev-log'

const AUTO_MS = 5200
const PAUSE_AFTER_INTERACTION_MS = 12000

/** 이미지 비주얼 박스 — 높이 고정(변경 금지) */
const IMAGE_H = 'h-[11.25rem]'
const TEXT_MIN = 'min-h-[12.25rem]'

function SeasonCtaLink({ href, label }: { href: string; label: string }) {
  const safeHref = typeof href === 'string' && href.trim() ? href.trim() : '/travel/overseas'
  const safeLabel = typeof label === 'string' && label.trim() ? label.trim() : '자세히 보기'
  const cls =
    'mt-auto inline-flex h-12 w-full shrink-0 items-center justify-center rounded-xl bg-teal-700 px-4 text-center text-base font-bold text-white shadow-md transition hover:bg-teal-800 active:scale-[0.99]'
  if (/^https?:\/\//i.test(safeHref)) {
    return (
      <a href={safeHref} className={cls} rel="noopener noreferrer">
        {safeLabel}
      </a>
    )
  }
  return (
    <Link href={safeHref} className={cls}>
      {safeLabel}
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
  const bodyFull = String(slide?.bodyFull ?? '')
  const excerpt = String(slide?.excerpt ?? '')
  const title = String(slide?.title ?? '')
  const imgRaw = slide?.imageUrl
  const img = typeof imgRaw === 'string' ? imgRaw.trim() : ''

  const needsMore = useMemo(() => {
    try {
      const full = bodyFull.replace(/\s+/g, ' ').trim()
      if (!full) return false
      if (excerpt.endsWith('…')) return true
      return full.length > excerpt.replace(/…$/, '').trim().length + 2
    } catch (e) {
      devWarnMobileHome('season-slide-needsMore', e)
      return false
    }
  }, [bodyFull, excerpt])

  const desc = excerpt.trim()

  return (
    <div className="shrink-0" style={{ width: `${slideWidthPct}%` }}>
      <div
        className={`relative w-full overflow-hidden rounded-xl border border-slate-100 bg-slate-50/80 ${IMAGE_H}`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-teal-100/90 via-slate-100 to-slate-200/90" aria-hidden />
        {img ? (
          <Image
            src={img}
            alt={title}
            fill
            className="z-[1] object-cover"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 420px"
            loading="lazy"
          />
        ) : (
          <div
            className="absolute inset-0 z-[1] bg-gradient-to-br from-teal-600/20 via-slate-200/55 to-slate-300/45"
            aria-hidden
          />
        )}
      </div>
      <div
        className={`flex flex-col border-t border-slate-100 bg-white px-4 pb-4 pt-3 ${TEXT_MIN}`}
      >
        {title ? (
          <h3 className="text-lg font-bold leading-snug tracking-tight text-slate-900 sm:text-xl">{title}</h3>
        ) : null}
        {desc ? (
          expanded ? (
            <p
              className={`max-h-[11rem] overflow-y-auto whitespace-pre-line text-[15px] font-medium leading-relaxed text-slate-800 ${title ? 'mt-2' : ''}`}
            >
              {bodyFull}
            </p>
          ) : (
            <p
              className={`line-clamp-3 text-[15px] font-medium leading-relaxed text-slate-800 ${title ? 'mt-2' : ''}`}
            >
              {desc}
            </p>
          )
        ) : expanded && bodyFull.trim() ? (
          <p
            className={`max-h-[11rem] overflow-y-auto whitespace-pre-line text-[15px] font-medium leading-relaxed text-slate-800 ${title ? 'mt-2' : ''}`}
          >
            {bodyFull}
          </p>
        ) : null}
        {needsMore ? (
          <button
            type="button"
            className="mt-2 self-start text-[15px] font-bold text-teal-800 underline-offset-2 hover:underline"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            {expanded ? '접기' : '더보기'}
          </button>
        ) : (
          <span className="mt-2 h-[1.375rem]" aria-hidden />
        )}
        <SeasonCtaLink href={String(slide?.ctaHref ?? '')} label={String(slide?.ctaLabel ?? '')} />
      </div>
    </div>
  )
}

type Props = {
  slides: HomeSeasonPickDTO[]
  /** 해외 상품 목록 등에서 섹션 타이틀 생략 */
  hideHeading?: boolean
  /** 모바일 메인 홈 등: 이전/다음·점·슬라이드 인덱스 배지를 렌더하지 않음(자동 슬라이드만). */
  hideManualNav?: boolean
}

export default function HomeMobileHubSeasonCarousel({ slides, hideHeading = false, hideManualNav = false }: Props) {
  const safeSlides = useMemo(() => {
    const next = normalizeHomeSeasonSlidesForClient(slides)
    if (
      process.env.NODE_ENV === 'development' &&
      Array.isArray(slides) &&
      slides.length > 0 &&
      next.length === 0
    ) {
      devWarnMobileHome('season-slides-all-invalid', { incoming: slides.length })
    }
    return next
  }, [slides])

  const n = safeSlides.length
  const [index, setIndex] = useState(0)
  const resumeAtRef = useRef(0)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    if (index >= n && n > 0) setIndex(0)
  }, [index, n])

  if (n === 0) return null

  const bumpInteractionPause = useCallback(() => {
    resumeAtRef.current = Date.now() + PAUSE_AFTER_INTERACTION_MS
  }, [])

  useEffect(() => {
    if (n <= 1) return
    if (typeof window === 'undefined') return
    let id: number | undefined
    try {
      id = window.setInterval(() => {
        try {
          if (Date.now() < resumeAtRef.current) return
          setIndex((i) => (i + 1) % n)
        } catch (e) {
          devWarnMobileHome('carousel-tick', e)
        }
      }, AUTO_MS)
    } catch (e) {
      devWarnMobileHome('carousel-interval-init', e)
      return undefined
    }
    return () => {
      if (id != null) {
        try {
          window.clearInterval(id)
        } catch {
          /* ignore */
        }
      }
    }
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
    <section aria-label="시즌 추천" aria-roledescription="carousel" className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
      {!hideHeading ? <h2 className={HOME_MOBILE_HUB_SECTION_TITLE_CLASS}>시즌 추천</h2> : null}

      <div
        className={`relative overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50 ${hideHeading ? 'mt-2' : 'mt-3'}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onPointerDown={() => bumpInteractionPause()}
      >
        {!hideManualNav ? (
          <div className="pointer-events-none absolute right-3 top-2 z-[2] hidden rounded-full bg-slate-900/70 px-2 py-0.5 text-xs font-semibold text-white lg:block">
            {index + 1}/{n}
          </div>
        ) : null}

        <div
          className="flex transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{
            width: `${n * 100}%`,
            transform: `translateX(-${(100 / n) * index}%)`,
          }}
        >
          {safeSlides.map((slide) => (
            <SeasonSlideCard key={slide.id} slide={slide} slideWidthPct={100 / n} />
          ))}
        </div>
      </div>

      {n > 1 && !hideManualNav ? (
        <div className="mt-3 hidden flex-col items-center gap-2 lg:flex">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={() => go(-1)}
              aria-label="이전 추천"
            >
              이전
            </button>
            <button
              type="button"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
              onClick={() => go(1)}
              aria-label="다음 추천"
            >
              다음
            </button>
          </div>
          <div className="flex items-center justify-center gap-2" role="tablist" aria-label="시즌 추천 슬라이드">
            {safeSlides.map((dotSlide, i) => (
              <button
                key={`season-dot-${i}-${dotSlide.id}`}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${i + 1}번째`}
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
        </div>
      ) : null}
    </section>
  )
}
