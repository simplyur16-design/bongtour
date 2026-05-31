'use client'

import { publicImageOverlayHasAny } from '@/lib/public-image-overlay-ssot'

type Props = {
  leftLabel?: string | null
  rightLabel?: string | null
  className?: string
}

const LABEL_CLS = 'text-xs leading-tight text-white drop-shadow-sm'

/**
 * 이미지 내부 하단: 좌 SEO 키워드 / 우 출처. 둘 다 없으면 null.
 * 배경 칩 없음 — 하단 그라데이션 fade + 흰색 텍스트 drop-shadow.
 */
export default function PublicImageBottomOverlay({ leftLabel, rightLabel, className = '' }: Props) {
  const left = (leftLabel ?? '').trim()
  const right = (rightLabel ?? '').trim()
  if (!publicImageOverlayHasAny(left, right)) return null

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-[15] ${className ?? ''}`.trim()}
    >
      <div
        className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent"
        aria-hidden
      />
      <div className="relative flex items-end justify-between gap-2 px-3 pb-2">
        {left ? (
          <span className={`line-clamp-1 min-w-0 max-w-[65%] ${LABEL_CLS}`}>{left}</span>
        ) : (
          <span className="min-w-0 flex-1" />
        )}
        {right ? <span className={`shrink-0 ${LABEL_CLS}`}>{right}</span> : null}
      </div>
    </div>
  )
}
