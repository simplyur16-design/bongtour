'use client'

/**
 * 히어로 우측 정보카드 — 내부 스크롤 금지.
 * 제목은 원 상품명 line-clamp. 날짜 변경·사실 비교 CTA는 상세 견적카드만.
 * REGRESSION-FREEZE[public-detail-hero-sticky-fit-title]: no overflow-y scroll; title line-clamp; info-only — manifest
 */
import type { ReactNode } from 'react'

const ASIDE_CLASS =
  'absolute right-6 top-1/2 z-[30] hidden max-h-[calc(100%-3rem)] w-[420px] -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-xl lg:flex xl:right-12 xl:w-[460px]'

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
