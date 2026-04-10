'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type Props = {
  children: ReactNode
  /** Outer spacing, e.g. `mt-3` */
  className?: string
}

export function HubExploreHorizontalScrollRow({
  children,
  className = '',
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScroll = scrollWidth - clientWidth
    const eps = 2
    const overflow = scrollWidth > clientWidth + eps
    setHasOverflow(overflow)
    setCanScrollLeft(overflow && scrollLeft > eps)
    setCanScrollRight(overflow && scrollLeft < maxScroll - eps)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    updateScrollState()
    const onScroll = () => updateScrollState()
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => updateScrollState())
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
    }
  }, [updateScrollState])

  const scrollByDirection = (dir: -1 | 1) => {
    const el = scrollerRef.current
    if (!el) return
    const amount = Math.round(
      Math.max(240, el.clientWidth * 0.72) * dir
    )
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }

  /** Desktop-only chevrons; mobile uses touch scroll */
  const navBtnClass =
    'pointer-events-auto absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-bt-border/80 bg-white/95 text-bt-ink shadow-md backdrop-blur-sm transition hover:border-bt-accent/35 hover:bg-white hover:shadow-lg disabled:pointer-events-none disabled:opacity-35 md:flex'

  return (
    <div className={`relative ${className}`.trim()}>
      <div
        ref={scrollerRef}
        className="flex flex-nowrap gap-3 overflow-x-auto pb-2 pl-0 pr-0 [-webkit-overflow-scrolling:touch] overscroll-x-contain md:pl-10 md:pr-10"
      >
        {children}
      </div>
      {hasOverflow ? (
        <>
          <button
            type="button"
            aria-label="이전 카드"
            disabled={!canScrollLeft}
            className={`${navBtnClass} left-1`}
            onClick={() => scrollByDirection(-1)}
          >
            <ChevronLeft className="h-5 w-5 shrink-0" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="다음 카드"
            disabled={!canScrollRight}
            className={`${navBtnClass} right-1`}
            onClick={() => scrollByDirection(1)}
          >
            <ChevronRight className="h-5 w-5 shrink-0" aria-hidden />
          </button>
        </>
      ) : null}
    </div>
  )
}
