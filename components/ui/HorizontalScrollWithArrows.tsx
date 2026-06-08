'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={22}
      height={22}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {direction === 'left' ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}
    </svg>
  )
}

type Props = {
  as?: 'ul' | 'div'
  scrollClassName?: string
  className?: string
  ariaLabel?: string
  scrollRole?: string
  children: ReactNode
  scrollRatio?: number
  onScrollContainer?: (el: HTMLElement) => void
}

const SCROLL_ARROW_CLASS =
  'pointer-events-auto absolute top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-800 shadow-lg transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600'

const SCROLL_EDGE_EPS = 4

/** 가로 스크롤 영역 — 불투명 좌우 화살표(끝에서 순환) */
export default function HorizontalScrollWithArrows({
  as = 'div',
  scrollClassName = '',
  className = '',
  ariaLabel,
  scrollRole,
  children,
  scrollRatio = 0.88,
  onScrollContainer,
}: Props) {
  const scrollRef = useRef<HTMLUListElement | HTMLDivElement>(null)
  const [hasOverflow, setHasOverflow] = useState(false)

  const syncArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setHasOverflow(max > SCROLL_EDGE_EPS)
    onScrollContainer?.(el)
  }, [onScrollContainer])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    syncArrows()
    el.addEventListener('scroll', syncArrows, { passive: true })
    const ro = new ResizeObserver(syncArrows)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', syncArrows)
      ro.disconnect()
    }
  }, [syncArrows, children])

  const scrollPage = (dir: -1 | 1) => {
    const el = scrollRef.current
    if (!el) return
    const max = Math.max(0, el.scrollWidth - el.clientWidth)
    const step = Math.max(160, Math.round(el.clientWidth * scrollRatio))

    if (dir === 1) {
      if (max <= SCROLL_EDGE_EPS || el.scrollLeft >= max - SCROLL_EDGE_EPS) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
        return
      }
      el.scrollBy({ left: step, behavior: 'smooth' })
      return
    }

    if (max <= SCROLL_EDGE_EPS || el.scrollLeft <= SCROLL_EDGE_EPS) {
      el.scrollTo({ left: max, behavior: 'smooth' })
      return
    }
    el.scrollBy({ left: -step, behavior: 'smooth' })
  }

  const ScrollTag = as

  return (
    <div className={`relative min-w-0 ${className}`.trim()}>
      <ScrollTag
        ref={scrollRef as never}
        className={scrollClassName}
        {...(as === 'ul'
          ? { role: 'list' as const, 'aria-label': ariaLabel }
          : { role: scrollRole, 'aria-label': ariaLabel })}
      >
        {children}
      </ScrollTag>
      {hasOverflow ? (
        <>
          <button
            type="button"
            className={`${SCROLL_ARROW_CLASS} left-1 sm:left-2`}
            aria-label="이전으로 스크롤 (처음이면 마지막으로)"
            onClick={(e) => {
              e.stopPropagation()
              scrollPage(-1)
            }}
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            className={`${SCROLL_ARROW_CLASS} right-1 sm:right-2`}
            aria-label="다음으로 스크롤 (끝이면 처음으로)"
            onClick={(e) => {
              e.stopPropagation()
              scrollPage(1)
            }}
          >
            <ChevronIcon direction="right" />
          </button>
        </>
      ) : null}
    </div>
  )
}
