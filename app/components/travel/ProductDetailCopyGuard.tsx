'use client'

import type { ReactNode } from 'react'

/**
 * `/products/[id]` 전용: 본문 텍스트 선택·기본 드래그·우클릭 메뉴 완화.
 * 공유(ShareActions)는 Web Share + 클립보드 fallback이므로 user-select:none과 충돌하지 않음.
 */
export default function ProductDetailCopyGuard({ children }: { children: ReactNode }) {
  return (
    <div
      className="product-detail-copy-guard"
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </div>
  )
}
