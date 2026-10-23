'use client'

/**
 * 히어로 우측 정보카드 — 스크롤/드래그 금지, 상품명 폰트를 카드 높이에 맞춤.
 * REGRESSION-FREEZE[public-detail-hero-sticky-fit-title]: no overflow-y scroll; title auto-fit — manifest
 */
import { useLayoutEffect, useRef, type ReactNode } from 'react'

const TITLE_MAX_PX = 28
const TITLE_MIN_PX = 13
const ASIDE_CLASS =
  'absolute right-6 top-1/2 z-[30] hidden max-h-[calc(100%-3rem)] w-[420px] -translate-y-1/2 overflow-hidden rounded-2xl bg-white p-5 shadow-xl lg:block xl:right-12 xl:w-[460px]'

function fitTitleToAside(aside: HTMLElement): void {
  const title = aside.querySelector<HTMLElement>('[data-hero-sticky-title]')
  const body = aside.querySelector<HTMLElement>('[data-hero-sticky-body]')
  if (body) {
    body.style.transform = ''
    body.style.width = ''
  }
  if (!title) return

  let lo = TITLE_MIN_PX
  let hi = TITLE_MAX_PX
  let best = TITLE_MIN_PX
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    title.style.fontSize = `${mid}px`
    if (aside.scrollHeight <= aside.clientHeight + 1) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  title.style.fontSize = `${best}px`

  // 제목만으로 부족하면 본문 전체를 카드 높이에 맞게 축소 (스크롤 금지)
  if (body && aside.scrollHeight > aside.clientHeight + 1) {
    const scale = Math.max(0.82, aside.clientHeight / aside.scrollHeight)
    body.style.transformOrigin = 'top center'
    body.style.transform = `scale(${scale})`
    body.style.width = `${100 / scale}%`
  }
}

export default function HeroStickyInfoAside({
  children,
  fitKey,
}: {
  children: ReactNode
  /** 제목·가격 등 내용 바뀌면 재측정 */
  fitKey?: string
}) {
  const ref = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const aside = ref.current
    if (!aside) return
    const run = () => fitTitleToAside(aside)
    run()
    const ro = new ResizeObserver(run)
    ro.observe(aside)
    return () => ro.disconnect()
  }, [fitKey, children])

  return (
    <aside ref={ref} className={ASIDE_CLASS}>
      <div data-hero-sticky-body>{children}</div>
    </aside>
  )
}
