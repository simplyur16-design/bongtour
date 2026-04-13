'use client'

import type { ReactNode } from 'react'
import { SITE_CONTENT_CLASS } from '@/lib/site-content-layout'

type Props = {
  /** null이면 상단 페이지 헤더(브레드크럼·제목·설명·건수) 슬롯 생략 — 히어로가 있는 허브 전용 */
  summary?: ReactNode | null
  chips: ReactNode
  sidebar: ReactNode
  toolbar: ReactNode
  results: ReactNode
  mobileFilterBar: ReactNode
}

/**
 * 데스크톱: 좌측 필터(고정 폭) + 우측 결과.
 * 모바일: 상단 요약·칩·정렬 + 필터 버튼 바 + 결과(필터는 드로어).
 */
export default function ProductsPageLayout({
  summary,
  chips,
  sidebar,
  toolbar,
  results,
  mobileFilterBar,
}: Props) {
  const verticalPad = summary != null ? 'py-6' : 'pt-3 pb-6 sm:pt-4'
  return (
    <div className={`${SITE_CONTENT_CLASS} ${verticalPad}`}>
      <div className="lg:hidden">{mobileFilterBar}</div>

      {summary != null ? <div className="mb-4">{summary}</div> : null}
      <div className="mb-3">{chips}</div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <aside className="hidden w-[300px] shrink-0 lg:block">
          <div className="sticky top-20 max-h-[calc(100vh-5.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {sidebar}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {toolbar}
          {results}
        </div>
      </div>
    </div>
  )
}
