'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
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

type ArrowPlacement = 'outside' | 'overlay'

type Props = {
  as?: 'ul' | 'div'
  scrollClassName?: string
  className?: string
  ariaLabel?: string
  scrollRole?: string
  children: ReactNode
  scrollRatio?: number
  /** outside: 카드 밖. overlay: 반투명 고스트 화살표가 카드 위에 겹침(기본) */
  arrowPlacement?: ArrowPlacement
  onScrollContainer?: (el: HTMLElement) => void
}

const SCROLL_EDGE_EPS = 4

/** 약간 불투명 + 블러 — 뒤 사진이 비치도록 (상품 히어로 고스트 화살표 톤) */
const GHOST_ARROW_BASE =
  'flex items-center justify-center rounded-full border border-white/55 bg-white/45 text-slate-800/90 shadow-sm backdrop-blur-[3px] transition hover:border-white/70 hover:bg-white/65 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600 active:scale-95'

const OUTSIDE_ARROW_CLASS = `h-9 w-9 shrink-0 ${GHOST_ARROW_BASE}`

const OVERLAY_ARROW_CLASS = `pointer-events-auto absolute top-1/2 z-20 h-9 w-9 -translate-y-1/2 opacity-90 hover:opacity-100 ${GHOST_ARROW_BASE}`

/** 가로 스크롤 영역 — 반투명 좌우 화살표(끝에서 순환) */
export default function HorizontalScrollWithArrows({
  as = 'div',
  scrollClassName = '',
  className = '',
  ariaLabel,
  scrollRole,
  children,
  scrollRatio = 0.88,
  arrowPlacement = 'overlay',
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

  const leftBtn = hasOverflow ? (
    <button
      type="button"
      className={arrowPlacement === 'outside' ? OUTSIDE_ARROW_CLASS : `${OVERLAY_ARROW_CLASS} left-1 sm:left-2`}
      aria-label="이전으로 스크롤 (처음이면 마지막으로)"
      onClick={(e) => {
        e.stopPropagation()
        scrollPage(-1)
      }}
    >
      <ChevronIcon direction="left" />
    </button>
  ) : null

  const rightBtn = hasOverflow ? (
    <button
      type="button"
      className={arrowPlacement === 'outside' ? OUTSIDE_ARROW_CLASS : `${OVERLAY_ARROW_CLASS} right-1 sm:right-2`}
      aria-label="다음으로 스크롤 (끝이면 처음으로)"
      onClick={(e) => {
        e.stopPropagation()
        scrollPage(1)
      }}
    >
      <ChevronIcon direction="right" />
    </button>
  ) : null

  if (arrowPlacement === 'outside') {
    return (
      <div className={`flex min-w-0 items-center gap-1.5 ${className}`.trim()}>
        {leftBtn}
        <ScrollTag
          ref={scrollRef as never}
          className={`min-w-0 flex-1 ${scrollClassName}`.trim()}
          {...(as === 'ul'
            ? { role: 'list' as const, 'aria-label': ariaLabel }
            : { role: scrollRole, 'aria-label': ariaLabel })}
        >
          {children}
        </ScrollTag>
        {rightBtn}
      </div>
    )
  }

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
      {leftBtn}
      {rightBtn}
    </div>
  )
}
