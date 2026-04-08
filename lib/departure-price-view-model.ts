/**
 * 상품 상세 — 출발일·요금 공통 뷰 모델 (공급사 어댑터 → 단일 UI)
 * @see lib/price-utils.ts isScheduleAdultBookable
 */
import type { ProductPriceRow } from '@/app/components/travel/TravelProductDetail'
import { formatKRW, getPriceAdult } from '@/lib/price-utils'
import type { OverseasSupplierKey } from '@/lib/normalize-supplier-origin'
import { normalizeSupplierOrigin, OVERSEAS_SUPPLIER_LABEL } from '@/lib/normalize-supplier-origin'

export type DeparturePriceCurrency = 'KRW'

/** 상세·달력·리스트 공통 슬롯 모델 */
export type DeparturePriceViewModel = {
  departureDate: string
  price: number | null
  currency: DeparturePriceCurrency
  isAvailable: boolean
  statusLabel: string
  supplierKey: OverseasSupplierKey
  rawPriceText: string | null
  seatStatus: string | null
  note: string | null
  /** 원본 행 id (키·앵커) */
  sourceRowId: string
}

function toDateKey(d: string): string {
  return d.startsWith('20') && d.length >= 10 ? d.slice(0, 10) : d
}

export function productPriceRowToDepartureView(
  row: ProductPriceRow,
  originSource: string
): DeparturePriceViewModel {
  const departureDate = toDateKey(row.date)
  const supplierKey = normalizeSupplierOrigin(originSource)
  const adultKrw = getPriceAdult(row)
  const isAvailable = adultKrw > 0
  const statusRaw = row.status?.trim()
  let statusLabel = '미운영'
  if (isAvailable) {
    statusLabel = statusRaw && statusRaw.length > 0 ? statusRaw : '예약가능'
  } else {
    statusLabel = statusRaw && /마감|불가|없음|미운영|대기/i.test(statusRaw) ? statusRaw : '출발없음'
  }
  const seats = row.availableSeats
  const seatStatus =
    seats != null && seats > 0 ? `잔여 ${seats}석` : seats === 0 ? '만석' : null

  return {
    departureDate,
    price: isAvailable ? adultKrw : null,
    currency: 'KRW',
    isAvailable,
    statusLabel,
    supplierKey,
    rawPriceText: row.localPrice?.trim() || null,
    seatStatus,
    note: statusRaw && statusRaw !== statusLabel ? statusRaw : null,
    sourceRowId: row.id,
  }
}

export function buildDepartureViewModels(
  rows: ProductPriceRow[],
  originSource: string
): DeparturePriceViewModel[] {
  return [...rows]
    .map((r) => productPriceRowToDepartureView(r, originSource))
    .sort((a, b) => a.departureDate.localeCompare(b.departureDate))
}

export function supplierLabelForView(key: OverseasSupplierKey): string {
  return OVERSEAS_SUPPLIER_LABEL[key] ?? '공급사'
}

export function formatDeparturePrice(vm: DeparturePriceViewModel): string {
  if (!vm.isAvailable || vm.price == null) return ''
  return formatKRW(vm.price)
}

/** 예약 가능 슬롯만 (최저가·기본 선택용) */
export function filterBookableDepartures(vms: DeparturePriceViewModel[]): DeparturePriceViewModel[] {
  return vms.filter((v) => v.isAvailable)
}

/** 월별(YYYY-MM) 최저 성인가 — 예약 가능만 */
export function minBookablePriceByMonth(vms: DeparturePriceViewModel[]): Record<string, number> {
  const byMonth: Record<string, number> = {}
  for (const v of vms) {
    if (!v.isAvailable || v.price == null) continue
    const month = v.departureDate.slice(0, 7)
    if (byMonth[month] == null || v.price < byMonth[month]) byMonth[month] = v.price
  }
  return byMonth
}

export function globalLowestBookable(vms: DeparturePriceViewModel[]): DeparturePriceViewModel | null {
  const bookable = filterBookableDepartures(vms)
  if (bookable.length === 0) return null
  return bookable.reduce((a, b) => (a.price! <= b.price! ? a : b))
}

/** 일정상 가장 이른 예약 가능 출발일 */
export function earliestBookableDeparture(vms: DeparturePriceViewModel[]): DeparturePriceViewModel | null {
  const bookable = filterBookableDepartures(vms)
  if (bookable.length === 0) return null
  return [...bookable].sort((a, b) => a.departureDate.localeCompare(b.departureDate))[0] ?? null
}
