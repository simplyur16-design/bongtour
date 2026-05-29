'use client'

import { publicImageOverlayHasAny } from '@/lib/public-image-overlay-ssot'

type Props = {
  leftLabel?: string | null
  rightLabel?: string | null
  className?: string
}

/**
 * 이미지 내부 하단: 좌 SEO 키워드 / 우 출처. 둘 다 없으면 null.
 */
export default function PublicImageBottomOverlay({ leftLabel, rightLabel, className = '' }: Props) {
  const left = (leftLabel ?? '').trim()
  const right = (rightLabel ?? '').trim()
  if (!publicImageOverlayHasAny(left, right)) return null

  const chipCls =
    'rounded bg-black/55 px-2 py-0.5 text-xs leading-tight text-white shadow-sm'

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-2 z-[15] flex justify-between gap-2 px-3 ${className ?? ''}`.trim()}
    >
      {left ? (
        <span className={`line-clamp-1 min-w-0 max-w-[65%] ${chipCls}`}>{left}</span>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      {right ? <span className={`shrink-0 ${chipCls}`}>{right}</span> : null}
    </div>
  )
}
