'use client'

import { useEffect, useRef, useState } from 'react'
import {
  MAIN_HERO_BRAND_SLOGAN,
  MAIN_HERO_EYEBROW,
  MAIN_HERO_MAIN_COPY,
  MAIN_HERO_SUB_COPY,
} from '@/lib/main-hub-copy'

const HERO_LINES = [MAIN_HERO_MAIN_COPY, MAIN_HERO_SUB_COPY] as const
/** 첫 줄·둘째 줄 — 살짝 옅게 해서 한 줄씩일 때 부담 덜 느끼게 */
const HERO_LINE_COLORS = ['#475569', '#64748b'] as const

const HOLD_MS = 5200
const FADE_MS = 400

/** 밝은 배경용 Compact 브랜드 인트로 — 로고는 Header 전용, Hero는 카피 중심 */
export default function MainHero() {
  const [reduceMotion, setReduceMotion] = useState(false)
  const [lineIndex, setLineIndex] = useState(0)
  const [opacity, setOpacity] = useState(1)
  const holdTimerRef = useRef<number | null>(null)
  const fadeTimerRef = useRef<number | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const onChange = () => setReduceMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (reduceMotion) return

    let cancelled = false

    const clearTimers = () => {
      if (holdTimerRef.current != null) {
        clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null
      }
      if (fadeTimerRef.current != null) {
        clearTimeout(fadeTimerRef.current)
        fadeTimerRef.current = null
      }
    }

    const cycle = () => {
      holdTimerRef.current = window.setTimeout(() => {
        if (cancelled) return
        setOpacity(0)
        fadeTimerRef.current = window.setTimeout(() => {
          if (cancelled) return
          setLineIndex((i) => (i + 1) % HERO_LINES.length)
          setOpacity(1)
          cycle()
        }, FADE_MS)
      }, HOLD_MS)
    }

    cycle()
    return () => {
      cancelled = true
      clearTimers()
    }
  }, [reduceMotion])

  return (
    <div className="relative z-[1] w-full overflow-x-hidden">
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_85%_70%_at_50%_0%,rgba(56,189,248,0.14),transparent_58%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-8 left-0 z-0 w-[42%] max-w-xl bg-gradient-to-r from-sky-100/55 to-transparent sm:inset-y-10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-8 right-0 z-0 w-[42%] max-w-xl bg-gradient-to-l from-teal-100/45 to-transparent sm:inset-y-10"
        aria-hidden
      />

      <div className="relative z-[2] mx-auto max-w-3xl px-4 pb-3 pt-2 text-center sm:px-6 sm:pb-4 sm:pt-3 md:pb-4 md:pt-3 lg:max-w-4xl lg:pt-4 xl:max-w-5xl xl:pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-bt-card-title sm:text-xs sm:tracking-[0.3em] lg:text-[13px]">
          {MAIN_HERO_EYEBROW}
        </p>
        <h1 className="mt-0.5 text-lg font-semibold leading-[1.2] tracking-tight text-slate-900 sm:text-xl md:text-[1.45rem] md:leading-[1.18] lg:text-[1.6rem] xl:text-[1.7rem]">
          {MAIN_HERO_BRAND_SLOGAN}
        </h1>

        {reduceMotion ? (
          <div className="mx-auto mt-1.5 max-w-xl space-y-2 md:mt-2 md:max-w-2xl">
            <p
              className="text-[13px] font-normal leading-relaxed sm:text-sm md:text-[0.9375rem]"
              style={{ color: HERO_LINE_COLORS[0] }}
            >
              {MAIN_HERO_MAIN_COPY}
            </p>
            <p
              className="text-[12px] font-normal leading-relaxed sm:text-[13px] md:text-sm"
              style={{ color: HERO_LINE_COLORS[1] }}
            >
              {MAIN_HERO_SUB_COPY}
            </p>
          </div>
        ) : (
          <div
            className="mx-auto mt-1.5 flex min-h-[3.75rem] max-w-xl items-center justify-center sm:min-h-[3.5rem] md:mt-2 md:max-w-2xl md:min-h-[3.75rem]"
            aria-live="polite"
            aria-atomic="true"
          >
            <p
              className="max-w-xl px-1 text-[13px] font-normal leading-relaxed tracking-tight transition-opacity ease-in-out motion-reduce:transition-none sm:max-w-2xl sm:text-sm sm:leading-relaxed md:max-w-2xl md:text-[0.9375rem]"
              style={{
                color: HERO_LINE_COLORS[lineIndex],
                transitionDuration: `${FADE_MS}ms`,
              }}
            >
              {HERO_LINES[lineIndex]}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
