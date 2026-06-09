'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SeasonCurationCardLink } from '@/app/components/home/SeasonCurationCarouselClient'
import { normalizeHomeSeasonSlidesForClient, type HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import { HOME_MOBILE_HUB_SECTION_TITLE_CLASS } from '@/lib/home-mobile-hub-section-typography'
import { MAIN_CURATION_EYEBROW, MAIN_CURATION_TITLE } from '@/lib/main-hub-copy'

const AUTO_MS = 5600
const PAUSE_AFTER_MS = 12_000

type Props = {
  slides: HomeSeasonPickDTO[]
}

/** 모바일 메인 — 풀폭 브리핑 카드 1장 + 자동 전환 (별도 모듈로 HMR/캐시 꼬임 방지) */
export default function SeasonCurationMobileBriefingClient({ slides }: Props) {
  const safe = useMemo(() => normalizeHomeSeasonSlidesForClient(slides), [slides])
  const n = safe.length
  const [index, setIndex] = useState(0)
  const resumeAt = useRef(0)
  const touchStartX = useRef<number | null>(null)

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

  const go = useCallback(
    (dir: -1 | 1) => {
      bumpPause()
      setIndex((i) => (i + dir + n) % n)
    },
    [bumpPause, n],
  )

  if (n === 0) return null

  const activeSlide = safe[index] ?? safe[0]

  return (
    <section
      aria-label="시즌 추천 여행 캐러셀"
      aria-roledescription={n > 1 ? 'carousel' : undefined}
      className="rounded-2xl border border-bt-border-soft/80 bg-white/90 p-4 shadow-sm ring-1 ring-bt-bg-lavender/25"
    >
      <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-bt-text-muted-lavender">
        {MAIN_CURATION_EYEBROW}
      </p>
      <h2 className={`${HOME_MOBILE_HUB_SECTION_TITLE_CLASS} mt-1 text-bt-text-navy`}>{MAIN_CURATION_TITLE}</h2>
      <div
        className="relative mt-3 w-full overflow-hidden rounded-2xl"
        onTouchStart={(e) => {
          if (n <= 1) return
          bumpPause()
          touchStartX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          if (n <= 1) return
          const start = touchStartX.current
          touchStartX.current = null
          if (start == null) return
          const end = e.changedTouches[0]?.clientX
          if (end == null) return
          const dx = end - start
          if (dx < -48) go(1)
          else if (dx > 48) go(-1)
        }}
        onPointerDown={() => {
          if (n > 1) bumpPause()
        }}
      >
        {activeSlide ? (
          <SeasonCurationCardLink slide={activeSlide} compact={false} mobileBriefing />
        ) : null}
      </div>
      {n > 1 ? (
        <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="시즌 추천 슬라이드">
          {safe.map((s, i) => (
            <button
              key={`dot-${s.id}`}
              type="button"
              role="tab"
              aria-label={`${i + 1}번째 브리핑`}
              aria-selected={i === index}
              className={
                i === index
                  ? 'h-2 w-6 rounded-full bg-bt-text-navy transition'
                  : 'h-2 w-2 rounded-full bg-slate-300'
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
