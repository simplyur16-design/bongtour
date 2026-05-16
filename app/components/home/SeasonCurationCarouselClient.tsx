'use client'

import Link from 'next/link'
import SafeImage from '@/app/components/SafeImage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeHomeSeasonSlidesForClient, type HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import { HOME_MOBILE_HUB_SECTION_TITLE_CLASS } from '@/lib/home-mobile-hub-section-typography'
import { MAIN_CURATION_EYEBROW, MAIN_CURATION_LEAD, MAIN_CURATION_TITLE } from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

const AUTO_MS = 5600
const PAUSE_AFTER_MS = 12_000

/** PC ??? ?? ??HomeHubFourClientCard ?? ??? ??????#27) */
export const SEASON_CURATION_PHOTO_FILTER =
  'transition-[filter] duration-200 ease-out [filter:brightness(0.92)_saturate(1.08)] group-hover:[filter:brightness(1.0)_saturate(1.15)]'

type Props = {
  slides: HomeSeasonPickDTO[]
  variant: 'desktop' | 'mobile'
  /** PC: `app/page.tsx` ?????*/
  sectionId?: string
}

export default function SeasonCurationCarouselClient({ slides, variant, sectionId }: Props) {
  const safe = useMemo(() => normalizeHomeSeasonSlidesForClient(slides), [slides])
  const n = safe.length
  const [index, setIndex] = useState(0)
  const resumeAt = useRef(0)

  useEffect(() => {
    if (index >= n && n > 0) setIndex(0)
  }, [index, n])

  const bumpPause = useCallback(() => {
    resumeAt.current = Date.now() + PAUSE_AFTER_MS
  }, [])

  useEffect(() => {
    if (n <= 1 || variant !== 'desktop') return
    const id = window.setInterval(() => {
      if (Date.now() < resumeAt.current) return
      setIndex((i) => (i + 1) % n)
    }, AUTO_MS)
    return () => window.clearInterval(id)
  }, [n, variant])

  if (n === 0) return null

  if (variant === 'mobile') {
    return (
      <section
        id={sectionId}
        aria-label="??????? ????? ??"
        className="rounded-2xl border border-bt-border-soft/80 bg-white/90 p-4 shadow-sm ring-1 ring-bt-bg-lavender/25"
      >
        <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-bt-text-muted-lavender">
          {MAIN_CURATION_EYEBROW}
        </p>
        <h2 className={`${HOME_MOBILE_HUB_SECTION_TITLE_CLASS} mt-1 text-bt-text-navy`}>{MAIN_CURATION_TITLE}</h2>
        <ul className="mt-3 flex gap-3 overflow-x-auto pb-1 pt-0.5 [-webkit-overflow-scrolling:touch] snap-x snap-mandatory">
          {safe.map((slide) => (
            <li
              key={slide.id}
              className="w-[min(18.5rem,calc(100vw-3rem))] shrink-0 snap-start"
            >
              <SeasonCurationCardLink slide={slide} compact />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  const slide = safe[index]!

  return (
    <section
      id={sectionId}
      aria-label="??????? ????? ??"
      aria-roledescription="carousel"
      className="mx-auto max-w-6xl px-3 pb-8 pt-2 sm:px-5"
    >
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-bt-text-muted-lavender">
          {MAIN_CURATION_EYEBROW}
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-bt-text-navy sm:text-[26px]">{MAIN_CURATION_TITLE}</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-bt-text-muted-lavender">{MAIN_CURATION_LEAD}</p>
      </div>

      <div
        className="relative mt-6 overflow-hidden rounded-2xl border border-bt-border-soft/80 shadow-md"
        onPointerDown={bumpPause}
      >
        {n > 1 ? (
          <div className="pointer-events-none absolute right-3 top-3 z-[4] rounded-full bg-slate-900/70 px-2.5 py-0.5 text-xs font-semibold text-white">
            {index + 1} / {n}
          </div>
        ) : null}
        <SeasonCurationCardLink slide={slide} compact={false} />
      </div>

      {n > 1 ? (
        <div className="mt-4 flex justify-center gap-2">
          {safe.map((s, i) => (
            <button
              key={`dot-${s.id}`}
              type="button"
              aria-label={`${i + 1}??`}
              aria-current={i === index}
              className={
                i === index
                  ? 'h-2.5 w-7 rounded-full bg-bt-text-navy transition'
                  : 'h-2 w-2 rounded-full bg-slate-300 hover:bg-slate-400'
              }
              onClick={() => {
                bumpPause()
                setIndex(i)
              }}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

export function SeasonCurationCardLink({
  slide,
  compact,
  hero = false,
}: {
  slide: HomeSeasonPickDTO
  compact: boolean
  hero?: boolean
}) {
  const href = (slide.ctaHref ?? '/travel/overseas').trim() || '/travel/overseas'
  const title = slide.title.trim()
  const subtitle = (slide.subtitle ?? '').trim()
  const excerpt = (slide.excerpt ?? '').trim()
  const img = (slide.imageUrl ?? '').trim()
  const cta = (slide.ctaLabel ?? '???????').trim() || '???????'
  const isExternal = /^https?:\/\//i.test(href)

  const inner = (
    <>
      <div
        className={`relative w-full overflow-hidden bg-slate-100 ${
          hero
            ? 'min-h-[min(28rem,58vh)] sm:min-h-[min(32rem,62vh)]'
            : compact
              ? 'aspect-[16/11]'
              : 'aspect-[21/9] sm:aspect-[24/9]'
        }`}
      >
        <div className={`absolute inset-0 z-[1] ${SEASON_CURATION_PHOTO_FILTER}`}>
          {img ? (
            <SafeImage
              src={img}
              alt=""
              fill
              className="object-cover object-center"
              sizes={
                hero
                  ? '100vw'
                  : compact
                    ? '(max-width:768px) 85vw, 320px'
                    : '(max-width:1280px) 100vw, 1152px'
              }
              loading="lazy"
            />
          ) : (
            <div
              className="absolute inset-0 bg-gradient-to-br from-bt-bg-lavender-soft via-white to-bt-bg-lavender/40"
              aria-hidden
            />
          )}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[55%] bg-gradient-to-t from-black/65 via-black/18 to-transparent"
          aria-hidden
        />
        <div
          className={`absolute inset-0 z-[3] flex flex-col ${
            hero
              ? 'items-end justify-end pb-8 pr-4 pt-0 sm:pb-12 sm:pr-6'
              : compact
                ? 'justify-end p-4'
                : 'justify-end p-6 sm:p-8'
          }`}
        >
          <div
            className={
              hero
                ? `${SITE_CONTENT_CLASS} flex w-full flex-col items-end justify-end text-right`
                : 'h-full w-full'
            }
          >
          {slide.monthKey ? (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/85">{slide.monthKey}</p>
          ) : null}
          {title ? (
            <h3
              className={`font-bold leading-tight tracking-tight text-white drop-shadow ${
                hero ? 'text-3xl sm:text-4xl lg:text-5xl' : compact ? 'text-lg' : 'text-2xl sm:text-3xl'
              }`}
            >
              {title}
            </h3>
          ) : null}
          {subtitle ? (
            <p
              className={`mt-1 text-white/90 drop-shadow ${
                hero
                  ? 'max-w-3xl text-lg sm:text-xl'
                  : compact
                    ? 'text-sm line-clamp-2'
                    : 'text-base sm:text-lg'
              }`}
            >
              {subtitle}
            </p>
          ) : excerpt ? (
            <p
              className={`mt-1 text-white/90 drop-shadow ${
                hero ? 'max-w-3xl text-base sm:text-lg line-clamp-3' : compact ? 'text-sm line-clamp-2' : 'line-clamp-2 text-base'
              }`}
            >
              {excerpt}
            </p>
          ) : null}
          <span
            className={`mt-5 inline-flex w-fit items-center rounded-full bg-white/95 px-5 py-2.5 font-bold text-bt-text-navy shadow ${
              hero ? 'text-base sm:text-lg' : compact ? 'text-xs' : 'text-sm'
            }`}
          >
            {cta}
          </span>
          </div>
        </div>
      </div>
    </>
  )

  const cardClass = hero
    ? 'group block w-full overflow-hidden rounded-none border-y border-bt-border-soft/80 shadow-lg outline-none ring-bt-text-navy/0 transition hover:ring-2 hover:ring-bt-text-navy/15'
    : 'group block overflow-hidden rounded-2xl border border-bt-border-soft/80 shadow-sm outline-none ring-bt-text-navy/0 transition hover:ring-2 hover:ring-bt-text-navy/15'

  if (isExternal) {
    return (
      <a href={href} className={cardClass} rel="noopener noreferrer">
        {inner}
      </a>
    )
  }
  return (
    <Link href={href} className={cardClass}>
      {inner}
    </Link>
  )
}
