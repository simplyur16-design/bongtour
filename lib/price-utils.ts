/**
 * Bong투어 가격 연산 (KRW) — 연령/침대 조건별 분리 요금
 * 총액 = (성인*priceAdult) + (아동베드*priceChildWithBed) + (아동노베드*priceChildNoBed) + (유아*priceInfant)
 * 새 필드가 없으면 기존 base+fuel로 폴백.
 */

export type PriceRowLike = {
  adultBase?: number
  adultFuel?: number
  childBedBase?: number | null
  childNoBedBase?: number | null
  childFuel?: number
  infantBase?: number | null
  infantFuel?: number
  priceAdult?: number
  priceChildWithBed?: number | null
  priceChildNoBed?: number | null
  priceInfant?: number | null
}

/** 성인 총액 = 기본가 + 유류세 */
export function adultTotal(row: PriceRowLike): number {
  return (row.adultBase ?? 0) + (row.adultFuel ?? 0)
}

/** 아동(베드) 총액 = 아동베드기본가 또는 성인기본가 + 유류세 */
export function childBedTotal(row: PriceRowLike): number {
  const base = row.childBedBase ?? row.adultBase ?? 0
  return base + (row.childFuel ?? 0)
}

/** 아동 노베드 총액 = (아동노베드기본가 또는 성인기본가) + 유류세 (차감액이 아닌 최종 결제액) */
export function childNoBedTotal(row: PriceRowLike): number {
  const base = row.childNoBedBase ?? row.adultBase ?? 0
  return base + (row.childFuel ?? 0)
}

/** 유아 총액 = 유아기본가 + 유아유류세 */
export function infantTotal(row: PriceRowLike): number {
  const base = row.infantBase ?? 0
  return base + (row.infantFuel ?? 0)
}

/** 원화 천 단위 콤마 표시 (DB는 Integer 유지) */
export function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

/**
 * 성인 1인 단가 (KRW).
 * DB `adult` / `priceAdult`가 0 이하면 **미운영·출발 없음**으로 간주하고 0만 반환(레거시 base+fuel 폴백 없음).
 */
export function getPriceAdult(row: PriceRowLike & { adult?: number }): number {
  const rawAdult = 'adult' in row ? row.adult : undefined
  if (rawAdult != null && rawAdult <= 0) return 0
  if (row.priceAdult != null && row.priceAdult <= 0) return 0
  if (row.priceAdult != null && row.priceAdult > 0) return row.priceAdult
  return adultTotal(row)
}

/** 달력·상세 일정표: 성인가가 0이면 예약 불가 슬롯 */
export function isScheduleAdultBookable(row: PriceRowLike & { adult?: number }): boolean {
  return getPriceAdult(row) > 0
}
function getPriceChildWithBed(row: PriceRowLike): number {
  if (row.priceChildWithBed != null) return row.priceChildWithBed
  return childBedTotal(row)
}
function getPriceChildNoBed(row: PriceRowLike): number {
  if (row.priceChildNoBed != null) return row.priceChildNoBed
  return childNoBedTotal(row)
}
function getPriceInfant(row: PriceRowLike): number {
  if (row.priceInfant != null) return row.priceInfant
  return infantTotal(row)
}

/** 한국 결제액 합산: (성인*priceAdult) + (아동베드*priceChildWithBed) + (아동노베드*priceChildNoBed) + (유아*priceInfant) */
export function computeKRWQuotation(
  row: PriceRowLike,
  pax: { adult: number; childBed: number; childNoBed: number; infant: number }
): { subtotal: number; surchargeTotal: number; total: number } {
  const subtotal =
    getPriceAdult(row) * pax.adult +
    getPriceChildWithBed(row) * pax.childBed +
    getPriceChildNoBed(row) * pax.childNoBed +
    getPriceInfant(row) * pax.infant
  return { subtotal, surchargeTotal: 0, total: subtotal }
}

/** 현지 지불액: (성인+아동베드+아동노베드) * mandatoryLocalFee. 유아 제외. */
export function computeLocalFeeTotal(
  mandatoryLocalFee: number | null | undefined,
  pax: { adult: number; childBed: number; childNoBed: number }
): number | null {
  if (mandatoryLocalFee == null) return null
  const paxCount = pax.adult + pax.childBed + pax.childNoBed
  return paxCount * mandatoryLocalFee
}

/** 공개 상세 전용: 아동·유아 단가는 DB/행에 있는 값만 (성인가 폴백·미기입 0 가정 없음) */
export type PublicProductPriceRow = PriceRowLike & {
  adult?: number
  childBed?: number | null
  childNoBed?: number | null
  infant?: number | null
}

export function getPublicPerPaxUnitKrw(
  row: PublicProductPriceRow,
  slot: 'adult' | 'childBed' | 'childNoBed' | 'infant'
): number | null {
  if (slot === 'adult') {
    const n = getPriceAdult(row)
    return n > 0 ? n : null
  }
  if (slot === 'childBed') {
    if (row.priceChildWithBed != null) return row.priceChildWithBed
    if (row.childBed != null) return row.childBed
    return null
  }
  if (slot === 'childNoBed') {
    if (row.priceChildNoBed != null) return row.priceChildNoBed
    if (row.childNoBed != null) return row.childNoBed
    return null
  }
  if (row.priceInfant != null) return row.priceInfant
  if (row.infant != null) return row.infant
  return null
}

/** 인원 중 한 슬롯이라도 단가 미확인이면 합계 null (잘못된 견적 노출 방지) */
export function computeKRWQuotationPublic(
  row: PublicProductPriceRow,
  pax: { adult: number; childBed: number; childNoBed: number; infant: number }
): { total: number | null } {
  let sum = 0
  if (pax.adult > 0) {
    const u = getPublicPerPaxUnitKrw(row, 'adult')
    if (u == null) return { total: null }
    sum += u * pax.adult
  }
  if (pax.childBed > 0) {
    const u = getPublicPerPaxUnitKrw(row, 'childBed')
    if (u == null) return { total: null }
    sum += u * pax.childBed
  }
  if (pax.childNoBed > 0) {
    const u = getPublicPerPaxUnitKrw(row, 'childNoBed')
    if (u == null) return { total: null }
    sum += u * pax.childNoBed
  }
  if (pax.infant > 0) {
    const u = getPublicPerPaxUnitKrw(row, 'infant')
    if (u == null) return { total: null }
    sum += u * pax.infant
  }
  return { total: sum }
}
