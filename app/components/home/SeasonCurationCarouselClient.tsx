'use client'

import Link from 'next/link'
import { prefetchPropForHref } from '@/lib/route-prefetch-policy'
import SafeImage from '@/app/components/SafeImage'
import CinemaHeroImage from '@/app/components/CinemaHeroImage'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeHomeSeasonSlidesForClient, type HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import { CINEMA_HERO_FRAME_CLASS } from '@/lib/cinema-hero-frame-class'
import { MAIN_CURATION_EYEBROW, MAIN_CURATION_LEAD, MAIN_CURATION_TITLE } from '@/lib/main-hub-copy'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

const AUTO_MS = 5600
const PAUSE_AFTER_MS = 12_000

/** PC 히어로 — HomeHubFourClientCard와 동일 사진 톤(#27) */
export const SEASON_CURATION_PHOTO_FILTER =
  'transition-[filter] duration-200 ease-out [filter:brightness(0.98)_saturate(1.04)] group-hover:[filter:brightness(1.0)_saturate(1.08)]'

type Props = {
  slides: HomeSeasonPickDTO[]
  /** PC: `app/page.tsx` 앵커용 */
  sectionId?: string
}

/** PC 메인 시즌 캐러셀 — 모바일은 `SeasonCurationMobileBriefingClient` */
export default function SeasonCurationCarouselClient({ slides, sectionId }: Props) {
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
    if (n <= 1) return
    const id = window.setInterval(() => {
      if (Date.now() < resumeAt.current) return
      setIndex((i) => (i + 1) % n)
    }, AUTO_MS)
    return () => window.clearInterval(id)
  }, [n])

  if (n === 0) return null

  const slide = safe[index]!

  return (
    <section
      id={sectionId}
      aria-label="시즌 추천 여행 캐러셀"
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
              aria-label={`${i + 1}번째 슬라이드`}
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
  mobileBriefing = false,
}: {
  slide: HomeSeasonPickDTO
  compact: boolean
  hero?: boolean
  /** 모바일 메인 브리핑 — 풀폭·세로 비율 확대 */
  mobileBriefing?: boolean
}) {
  const href = (slide.ctaHref ?? '/travel/overseas').trim() || '/travel/overseas'
  const title = slide.title.trim()
  const subtitle = (slide.subtitle ?? '').trim()
  const excerpt = (slide.excerpt ?? '').trim()
  const img = (slide.imageUrl ?? '').trim()
  const cta = (slide.ctaLabel ?? '\uC790\uC138\uD788 \uBCF4\uAE30').trim() || '\uC790\uC138\uD788 \uBCF4\uAE30'
  const isExternal = /^https?:\/\//i.test(href)

  const inner = (
    <>
      <div
        className={`relative w-full overflow-hidden bg-slate-100 ${
          hero
            ? CINEMA_HERO_FRAME_CLASS
            : mobileBriefing
              ? '@container-size/mb aspect-[4/5] min-h-[min(14rem,35vh)] w-full max-h-[39vh]'
              : compact
                ? 'aspect-[16/11]'
                : 'aspect-[21/9] sm:aspect-[24/9]'
        }`}
      >
        <div className={`absolute inset-0 z-[1] ${hero ? '' : SEASON_CURATION_PHOTO_FILTER}`}>
          {img ? (
            hero ? (
              <div className={`absolute inset-0 ${SEASON_CURATION_PHOTO_FILTER}`}>
                <CinemaHeroImage src={img} sizes="100vw" loading="lazy" />
              </div>
            ) : (
              <SafeImage
                src={img}
                alt=""
                fill
                className="object-cover object-center"
                sizes={
                  mobileBriefing
                    ? '100vw'
                    : compact
                      ? '(max-width:768px) 85vw, 320px'
                      : '(max-width:1280px) 100vw, 1152px'
                }
                loading="lazy"
              />
            )
          ) : (
            <div
              className="absolute inset-0 bg-gradient-to-br from-bt-bg-lavender-soft via-white to-bt-bg-lavender/40"
              aria-hidden
            />
          )}
        </div>
        <div
          className={
            mobileBriefing
              ? 'pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[42%] bg-gradient-to-tl from-black/75 via-black/25 to-transparent'
              : 'pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-[55%] bg-gradient-to-t from-black/65 via-black/18 to-transparent'
          }
          aria-hidden
        />
        {mobileBriefing ? (
          // REGRESSION-FREEZE[season-mobile-briefing-br-overlay]: CTA 우측 하단 고정 · 공간 부족 시 제목 숨김 — manifest
          <div className="absolute bottom-0 right-0 z-[3] flex max-w-[min(72%,15.5rem)] flex-col items-end p-3 pb-3.5 pr-3.5 text-right sm:max-w-[min(62%,17rem)] sm:p-4">
            <div className="mb-2.5 hidden w-full flex-col items-end @[min-height:17.5rem]/mb:flex">
              {slide.monthKey ? (
                <p className="mb-0.5 text-[clamp(0.62rem,2.4vw,0.72rem)] font-semibold uppercase tracking-wider text-white/85">
                  {slide.monthKey}
                </p>
              ) : null}
              {title ? (
                <h3 className="line-clamp-3 text-[clamp(0.95rem,4.1vw,1.25rem)] font-bold leading-snug tracking-tight text-white drop-shadow">
                  {title}
                </h3>
              ) : null}
              {subtitle ? (
                <p className="mt-1 line-clamp-2 text-[clamp(0.72rem,3vw,0.88rem)] leading-snug text-white/90 drop-shadow">
                  {subtitle}
                </p>
              ) : excerpt ? (
                <p className="mt-1 line-clamp-2 text-[clamp(0.72rem,3vw,0.88rem)] leading-snug text-white/90 drop-shadow">
                  {excerpt}
                </p>
              ) : null}
            </div>
            <span className="inline-flex w-fit items-center rounded-full bg-white/95 px-[clamp(0.75rem,3.2vw,1rem)] py-[clamp(0.35rem,1.6vw,0.55rem)] text-[clamp(0.68rem,2.7vw,0.8125rem)] font-bold text-bt-text-navy shadow">
              {cta}
            </span>
          </div>
        ) : (
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
                hero
                  ? 'text-3xl sm:text-4xl lg:text-5xl'
                  : compact
                      ? 'text-lg'
                      : 'text-2xl sm:text-3xl'
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
                hero
                  ? 'max-w-3xl text-base sm:text-lg line-clamp-3'
                  : compact
                      ? 'text-sm line-clamp-2'
                      : 'line-clamp-2 text-base'
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
        )}
      </div>
    </>
  )

  const cardClass = hero
    ? 'group block w-full overflow-hidden rounded-none border-y border-bt-border-soft/80 shadow-lg outline-none ring-bt-text-navy/0 transition hover:ring-2 hover:ring-bt-text-navy/15'
    : mobileBriefing
      ? 'group block w-full overflow-hidden rounded-2xl border border-bt-border-soft/80 shadow-sm outline-none ring-bt-text-navy/0 transition hover:ring-2 hover:ring-bt-text-navy/15'
      : 'group block overflow-hidden rounded-2xl border border-bt-border-soft/80 shadow-sm outline-none ring-bt-text-navy/0 transition hover:ring-2 hover:ring-bt-text-navy/15'

  const a11yLabel = [title, cta].filter(Boolean).join(' — ') || undefined

  if (isExternal) {
    return (
      <a href={href} className={cardClass} rel="noopener noreferrer" aria-label={mobileBriefing ? a11yLabel : undefined}>
        {inner}
      </a>
    )
  }
  return (
    <Link
      href={href}
      prefetch={prefetchPropForHref(href)}
      className={cardClass}
      aria-label={mobileBriefing ? a11yLabel : undefined}
    >
      {inner}
    </Link>
  )
}
