'use client'

import { Children, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

const PAGE_SIZE = 4

function chunkChildren(nodes: ReactNode[], size: number): ReactNode[][] {
  const out: ReactNode[][] = []
  for (let i = 0; i < nodes.length; i += size) {
    out.push(nodes.slice(i, i + size))
  }
  return out
}

type Props = {
  children: ReactNode
  /** 접근성 — 권역·국가 섹션 제목 */
  ariaLabel: string
  pageSize?: number
}

/**
 * 모바일(md 미만) — 한 화면에 2×2(4장), 옆 페이지가 살짝 보이는 가로 스냅.
 * md+ 에서는 부모가 기존 가로 스크롤/그리드를 사용한다.
 */
export default function ProductResultsMobilePagedCarousel({
  children,
  ariaLabel,
  pageSize = PAGE_SIZE,
}: Props) {
  const items = Children.toArray(children).filter(Boolean)
  const pages = useMemo(() => chunkChildren(items, pageSize), [items, pageSize])
  const [activePage, setActivePage] = useState(0)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = scrollRef.current
    if (!root || pages.length <= 1) return
    const slides = root.querySelectorAll<HTMLElement>('[data-product-page]')
    const io = new IntersectionObserver(
      (entries) => {
        let bestIdx = 0
        let bestRatio = 0
        for (const entry of entries) {
          if (entry.intersectionRatio > bestRatio) {
            bestRatio = entry.intersectionRatio
            bestIdx = Number(entry.target.getAttribute('data-product-page') ?? 0)
          }
        }
        if (bestRatio >= 0.45) setActivePage(bestIdx)
      },
      { root, threshold: [0.45, 0.6, 0.85] },
    )
    slides.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [pages.length])

  if (items.length === 0) return null

  return (
    <div className="mt-6 md:hidden">
      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto overscroll-x-contain pb-2 pt-0.5 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden -mx-0.5 px-0.5"
        aria-label={ariaLabel}
      >
        {pages.map((page, pageIndex) => (
          <div
            key={`page-${pageIndex}`}
            data-product-page={pageIndex}
            className="w-[calc(100%-1.25rem)] max-w-[22.5rem] shrink-0 snap-start"
          >
            <ul className="grid grid-cols-2 gap-2.5" role="list">
              {page}
            </ul>
          </div>
        ))}
      </div>
      {pages.length > 1 ? (
        <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
          {pages.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === activePage ? 'w-4 bg-teal-600' : 'w-1.5 bg-slate-300'
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
