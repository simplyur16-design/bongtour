/**
 * A-5 상세 — 상단 '선택 출발일 항공사' + 버튼 2개(출발일 변경해서 보기 / 다른 항공사 찾기) 순수 로직.
 * - 현재 항공사 = `?airline=` 선택 → 없으면 지금 선택된 출발 회차(id → 날짜 단일 항공사 → 같은 날짜 중 facts 항공사) 기준.
 * - 다른 항공사 목록 = 같은 상품의 공개 가격행에서 만든 항공사 옵션만. 가격은 그 항공사 실제 가격행 최저 성인가,
 *   가격행 없거나 0/비정상이면 가격 표시 안 함(추측·추정 금지).
 *
 * REGRESSION-FREEZE[a5-two-buttons-1030]: 다른 항공사 가격은 기존 가격행 최저가만 · 항공사 1곳이면 버튼 2 숨김 — manifest
 */
import type { AirlineDepartureOption, ProductAirlineFilterData } from '@/lib/airline-variant-group'

export type CurrentDepartureRef = {
  rowId: string | null
  ymd: string | null
  factsAirline: string | null
}

function normLabel(s: string | null | undefined): string {
  return String(s ?? '').replace(/\s+/g, '').trim()
}

/** 상단에 보여줄 '지금 출발일의 항공사' 옵션 — 모르면 null(추측 금지) */
export function resolveCurrentDepartureAirlineOption(
  data: ProductAirlineFilterData | null | undefined,
  selected: AirlineDepartureOption | null | undefined,
  current: CurrentDepartureRef | null | undefined,
): AirlineDepartureOption | null {
  if (selected) return selected
  const options = data?.options ?? []
  if (options.length === 0 || !current) return null
  if (current.rowId) {
    const byId = options.find((o) => o.rows.some((r) => r[0] === current.rowId))
    if (byId) return byId
  }
  const ymd = current.ymd ? String(current.ymd).slice(0, 10) : null
  if (!ymd) return null
  const onDate = options.filter((o) => o.rows.some((r) => r[1] === ymd))
  if (onDate.length === 1) return onDate[0]!
  const fa = normLabel(current.factsAirline)
  if (fa && onDate.length > 1) {
    const hit = onDate.filter((o) => normLabel(o.label) === fa)
    if (hit.length === 1) return hit[0]!
  }
  return null
}

/** 그 항공사 실제 가격행 최저 성인가(원). 가격행 없음·0·비정상 → null */
export function lowestPublicPriceFromRows(option: AirlineDepartureOption | null | undefined): number | null {
  const prices = (option?.rows ?? []).map((r) => r[2]).filter((n) => typeof n === 'number' && Number.isFinite(n) && n > 0)
  return prices.length ? Math.min(...prices) : null
}

export type OtherAirlineRow = {
  label: string
  param: string
  /** null = 가격 표시 안 함 */
  lowestPriceKrw: number | null
  departureCount: number
}

/** '다른 항공사 찾기' 목록 — 현재 항공사 제외, 출발 회차 없는 항공사 제외, 가격 오름차순(가격 없음은 뒤) */
export function otherAirlineRows(
  data: ProductAirlineFilterData | null | undefined,
  currentLabel: string | null | undefined,
): OtherAirlineRow[] {
  const cur = normLabel(currentLabel)
  return (data?.options ?? [])
    .filter((o) => o.rows.length > 0 && normLabel(o.label) !== cur)
    .map((o) => ({
      label: o.label,
      param: o.param,
      lowestPriceKrw: lowestPublicPriceFromRows(o),
      departureCount: o.rows.length,
    }))
    .sort((a, b) => {
      if (a.lowestPriceKrw == null && b.lowestPriceKrw == null) return a.label.localeCompare(b.label, 'ko')
      if (a.lowestPriceKrw == null) return 1
      if (b.lowestPriceKrw == null) return -1
      return a.lowestPriceKrw - b.lowestPriceKrw || a.label.localeCompare(b.label, 'ko')
    })
}

/** 버튼 2 노출 — 이 상품에 출발 회차 있는 항공사가 2곳 이상일 때만 */
export function shouldShowOtherAirlineButton(data: ProductAirlineFilterData | null | undefined): boolean {
  return (data?.options ?? []).filter((o) => o.rows.length > 0).length >= 2
}

export const A5_TWO_BUTTON_LABELS = {
  currentAirlinePrefix: '선택한 출발일 항공사',
  changeDeparture: '출발일 변경해서 보기',
  otherAirline: '다른 항공사 찾기',
  noPrice: '요금 문의',
  unknownAirline: '출발일을 선택하면 항공사가 표시돼요.',
  otherListTitle: '같은 상품 · 다른 항공사 (성인 1인 기준, 예약 가능한 출발일 중 가장 낮은 요금)',
  showAll: '항공사 구분 없이 전체 출발일 보기',
} as const
