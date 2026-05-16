'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeHomeSeasonSlidesForClient, type HomeSeasonPickDTO } from '@/lib/home-season-pick-shared'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'
import { SeasonCurationCardLink } from '@/app/components/home/SeasonCurationCarouselClient'

const AUTO_MS = 5000
const PAUSE_AFTER_MS = 12_000

type Props = {
  slides: HomeSeasonPickDTO[]
  sectionId?: string
}

/** PC 메인 상단 — 풀폭 히어로형 시즌 큐레이션(자동 5초). */
export default function SeasonCurationHeroClient({ slides, sectionId }: Props) {
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
      aria-label="시즌 큐레이션 히어로"
      aria-roledescription="carousel"
      className="w-full pb-2 pt-0 sm:pb-3"
    >
      <div className="relative w-full" onPointerDown={bumpPause}>
        {n > 1 ? (
          <div
            className={`pointer-events-none absolute inset-x-0 top-4 z-[5] ${SITE_CONTENT_CLASS} flex justify-end sm:top-6`}
          >
            <span className="rounded-full bg-slate-900/75 px-2.5 py-1 text-xs font-semibold text-white">
              {index + 1} / {n}
            </span>
          </div>
        ) : null}
        <SeasonCurationCardLink slide={slide} compact={false} hero />
      </div>

      {n > 1 ? (
        <div className="mt-4 flex w-full justify-center gap-2 px-3">
          {safe.map((s, i) => (
            <button
              key={`hero-dot-${s.id}`}
              type="button"
              aria-label={`${i + 1}번째`}
              aria-current={i === index}
              className={
                i === index
                  ? 'h-2.5 w-8 rounded-full bg-bt-text-navy transition'
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
