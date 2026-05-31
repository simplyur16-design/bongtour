'use client'

import { publicImageOverlayHasAny } from '@/lib/public-image-overlay-ssot'

type Props = {
  leftLabel?: string | null
  rightLabel?: string | null
  className?: string
}

const LEFT_CHIP_CLS =
  'rounded bg-black/55 px-2 py-0.5 text-xs leading-tight text-white shadow-sm'

const RIGHT_CHIP_CLS = LEFT_CHIP_CLS

const PEXELS_RIGHT_CLS = 'text-xs leading-tight text-white'

const PEXELS_TEXT_SHADOW = '0 1px 4px rgba(0,0,0,0.7)'

function isPexelsStockSourceLabel(label: string): boolean {
  return /Pexels\s*스톡\s*이미지/i.test(label.trim())
}

/**
 * 이미지 내부 하단: 좌 SEO 키워드 / 우 출처. 둘 다 없으면 null.
 */
export default function PublicImageBottomOverlay({ leftLabel, rightLabel, className = '' }: Props) {
  const left = (leftLabel ?? '').trim()
  const right = (rightLabel ?? '').trim()
  if (!publicImageOverlayHasAny(left, right)) return null

  const rightIsPexels = isPexelsStockSourceLabel(right)

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-2 z-[15] flex justify-between gap-2 px-3 ${className ?? ''}`.trim()}
    >
      {left ? (
        <span className={`line-clamp-1 min-w-0 max-w-[65%] ${LEFT_CHIP_CLS}`}>{left}</span>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      {right ? (
        rightIsPexels ? (
          <span className={`shrink-0 ${PEXELS_RIGHT_CLS}`} style={{ textShadow: PEXELS_TEXT_SHADOW }}>
            {right}
          </span>
        ) : (
          <span className={`shrink-0 ${RIGHT_CHIP_CLS}`}>{right}</span>
        )
      ) : null}
    </div>
  )
}
