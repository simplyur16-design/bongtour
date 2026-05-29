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

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-[15] flex flex-row items-end justify-between gap-2 border-t border-white/40 bg-white/92 px-2.5 py-1.5 backdrop-blur-sm sm:px-3 sm:py-2 ${className ?? ''}`.trim()}
    >
      {left ? (
        <p className="line-clamp-1 min-w-0 flex-1 text-left text-[11px] font-semibold leading-tight text-slate-800 sm:text-xs">
          {left}
        </p>
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      {right ? (
        <span className="shrink-0 self-end rounded-full border border-slate-200/80 bg-slate-100/95 px-2 py-0.5 text-right text-[10px] font-medium leading-tight text-slate-600">
          {right}
        </span>
      ) : null}
    </div>
  )
}
