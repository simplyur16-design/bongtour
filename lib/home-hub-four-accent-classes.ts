import type { HubFourAccent } from '@/lib/main-hub-copy'

/** v5 시안 — 카드 면 색·보더 (메모리 #27 톤 위에 시안 고정 hex 일부 사용) */
export function hubFourAccentCardSurfaceClass(accent: HubFourAccent): string {
  switch (accent) {
    case 'package':
      return 'bg-[#FAEED4] border border-bt-border-soft/90'
    case 'air-hotel':
      return 'bg-white border-2 border-bt-bg-lavender'
    case 'private':
      return 'bg-[#FBEDF1] border border-[#e8c4cf]/80'
    case 'biz':
      return 'bg-white border-2 border-bt-bg-lavender'
  }
}

export const HUB_FOUR_V5_HOVER_RING_CLASS =
  'transition-[box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md hover:ring-1 hover:ring-[#d9a81e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bt-link/60 focus-visible:ring-1 focus-visible:ring-[#d9a81e]'
