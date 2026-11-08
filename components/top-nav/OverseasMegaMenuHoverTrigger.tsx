'use client'

import { overseasSubNavTabIdle } from '@/components/top-nav/overseas-sub-nav-styles'
import {
  matchesFineHover,
  pointerTypeFromEvent,
  type MegaMenuEvent,
} from '@/lib/mega-menu-interaction'

type Props = {
  expanded: boolean
  onDecide: (event: MegaMenuEvent) => void
}

/**
 * PC 해외 허브 메가메뉴 열기 전용 — 헤더 1차 네비와 겹치는
 * 「여행상품 / 우리끼리 / 항공+호텔」 3탭 행을 대체한다.
 * 입력 종류는 `decideMegaMenu`가 가른다 (메모리 #27).
 */
export default function OverseasMegaMenuHoverTrigger({ expanded, onDecide }: Props) {
  const fineHover = () => matchesFineHover(typeof window === 'undefined' ? undefined : (query) => window.matchMedia(query))
  return (
    <button
      type="button"
      className={`${overseasSubNavTabIdle} flex min-h-11 w-full max-w-none flex-col items-center justify-center`}
      onPointerDown={(event) => onDecide({ kind: 'pointerdown', pointerType: pointerTypeFromEvent(event.pointerType) })}
      onPointerEnter={(event) =>
        onDecide({
          kind: 'pointerenter',
          pointerType: pointerTypeFromEvent(event.pointerType),
          fineHover: fineHover(),
        })
      }
      onFocus={() => onDecide({ kind: 'focus' })}
      onClick={(event) => onDecide({ kind: 'click', detail: event.detail, fineHover: fineHover() })}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onDecide({ kind: 'escape' })
      }}
      aria-expanded={expanded}
      aria-haspopup="dialog"
      aria-label="권역·국가·도시로 해외 패키지 상품 찾기"
    >
      <span className="text-[13px] font-semibold sm:text-[14px] md:text-[15px]">권역·국가·도시로 상품 찾기</span>
      <span className="mt-0.5 block text-[11px] font-normal text-slate-500 sm:text-xs">유럽·동남아·일본 등</span>
    </button>
  )
}
