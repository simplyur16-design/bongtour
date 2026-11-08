export type MegaPointerType = 'mouse' | 'touch' | 'pen'

/** 같은 pointerdown~click 제스처만 기억한다. 제스처가 끝나면 null이라 다음 Tab focus는 키보드다. */
export type MegaGesturePointer = MegaPointerType | null

export type MegaMenuEvent =
  | { kind: 'pointerdown'; pointerType: MegaPointerType }
  | { kind: 'pointerenter'; pointerType: MegaPointerType; fineHover: boolean }
  | { kind: 'focus' }
  | { kind: 'click'; detail: number; fineHover: boolean }
  | { kind: 'pointerleave'; pointerType: MegaPointerType; fineHover: boolean }
  | { kind: 'escape' }

export type MegaMenuEffect = 'none' | 'open' | 'toggle' | 'arm-close'

export type MegaMenuDecision = {
  gesturePointer: MegaGesturePointer
  effect: MegaMenuEffect
}

export function pointerTypeFromEvent(value: string): MegaPointerType {
  if (value === 'touch' || value === 'pen') return value
  return 'mouse'
}

export function matchesFineHover(
  matchMedia: ((query: string) => { matches: boolean }) | undefined,
): boolean {
  if (!matchMedia) return false
  return matchMedia('(hover: hover) and (pointer: fine)').matches
}

/**
 * 데스크톱 마우스는 hover로 열고 click으로 토글하지 않는다.
 * 키보드 focus(제스처 없음, click detail 0)는 기기 종류와 상관없이 연다.
 * 터치/펜 focus는 click 전에 열지 않아 같은 탭의 토글이 바로 닫지 않는다.
 * Escape는 이 메뉴의 기존 동작대로 아무 일도 하지 않는다.
 * REGRESSION-FREEZE[seo-design-public-fixes]: mega input mode — manifest
 */
export function decideMegaMenu(gesturePointer: MegaGesturePointer, event: MegaMenuEvent): MegaMenuDecision {
  switch (event.kind) {
    case 'pointerdown':
      return { gesturePointer: event.pointerType, effect: 'none' }
    case 'pointerenter':
      if (event.pointerType === 'mouse' && event.fineHover) {
        return { gesturePointer, effect: 'open' }
      }
      return { gesturePointer, effect: 'none' }
    case 'focus':
      if (gesturePointer) return { gesturePointer, effect: 'none' }
      return { gesturePointer: null, effect: 'open' }
    case 'click': {
      const pointer = gesturePointer
      if (event.detail === 0) return { gesturePointer: null, effect: 'none' }
      if (pointer === 'touch' || pointer === 'pen') return { gesturePointer: null, effect: 'toggle' }
      if (pointer === 'mouse' && event.fineHover) return { gesturePointer: null, effect: 'none' }
      if (!event.fineHover) return { gesturePointer: null, effect: 'toggle' }
      return { gesturePointer: null, effect: 'none' }
    }
    case 'pointerleave':
      if (event.pointerType === 'mouse' && event.fineHover) {
        return { gesturePointer, effect: 'arm-close' }
      }
      return { gesturePointer, effect: 'none' }
    case 'escape':
      return { gesturePointer, effect: 'none' }
    default:
      return { gesturePointer, effect: 'none' }
  }
}
