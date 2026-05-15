'use client'

import { overseasSubNavTabIdle } from '@/components/top-nav/overseas-sub-nav-styles'

type Props = {
  onHoverMegaEnter: () => void
  onFocusMega: () => void
}

/**
 * PC 해외 허브 메가메뉴 열기 전용 — 헤더 1차 네비와 겹치는
 * 「여행상품 / 우리끼리 / 항공+호텔」 3탭 행을 대체한다.
 * 호버·포커스 시 권역/국가 패널만 연다 (메모리 #27).
 */
export default function OverseasMegaMenuHoverTrigger({ onHoverMegaEnter, onFocusMega }: Props) {
  return (
    <button
      type="button"
      className={`${overseasSubNavTabIdle} flex w-full max-w-none flex-col items-center justify-center`}
      onMouseEnter={onHoverMegaEnter}
      onFocus={onFocusMega}
      aria-haspopup="dialog"
      aria-label="권역·국가·도시로 해외 패키지 상품 찾기"
    >
      <span className="text-[13px] font-semibold sm:text-[14px] md:text-[15px]">권역·국가·도시로 상품 찾기</span>
      <span className="mt-0.5 block text-[11px] font-normal text-slate-500 sm:text-xs">
        유럽·동남아·일본 등 — 마우스를 올리면 목록이 펼쳐집니다
      </span>
    </button>
  )
}
