'use client'

import type { ReactNode } from 'react'

/**
 * 결과 영역 상단 보조 필터 슬롯 — 현재는 안내·확장용.
 * 추후 가격·일정·항공사 등과 연동 시 이 컴포넌트 안에 배치.
 */
export default function TravelResultFilterBar({
  children,
  title = '결과 필터',
}: {
  children?: ReactNode
  title?: string
}) {
  return (
    <div className="rounded-xl border border-bt-border/80 bg-white/90 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-bt-subtle">{title}</p>
      <div className="mt-2 text-sm text-bt-muted">
        {children ?? (
          <span className="text-xs">
            패키지·자유·공급사·가격·일정 길이 등은 상단 「조건 검색」과 아래 상품 유형 탭에서 조합할 수 있습니다.
          </span>
        )}
      </div>
    </div>
  )
}
