'use client'

/**
 * 히어로 우측 정보카드 — 내부 스크롤 금지.
 * 제목은 패널에서 고정 크기 + line-clamp (폰트 자동 축소 금지).
 * REGRESSION-FREEZE[public-detail-hero-sticky-fit-title]: no overflow-y scroll; title line-clamp — manifest
 */
import type { ReactNode } from 'react'

const ASIDE_CLASS =
  'absolute right-6 top-1/2 z-[30] hidden max-h-[calc(100%-3rem)] w-[420px] -translate-y-1/2 overflow-hidden rounded-2xl bg-white p-5 shadow-xl lg:block xl:right-12 xl:w-[460px]'

export default function HeroStickyInfoAside({
  children,
  fitKey: _fitKey,
}: {
  children: ReactNode
  /** 이전 폰트 맞춤 키 — 호환용(미사용) */
  fitKey?: string
}) {
  return <aside className={ASIDE_CLASS}>{children}</aside>
}
