/**
 * 출발일 예약상태 정규화 — ProductDeparture.statusRaw / 파서·어드민 synthetic 공용.
 * 하드코딩 '예약가능' 대신 원문에서 허용 라벨만 채택.
 * REGRESSION-FREEZE[departure-onsale-import-filter]: 마감만 수집·upsert·공개 제외, 대기예약 유지 — manifest
 */

export type DepartureBookingStatusLabel = '출발확정' | '예약가능' | '대기예약' | '마감'

const STATUS_LABELS: DepartureBookingStatusLabel[] = ['출발확정', '예약가능', '대기예약', '마감']

/** 원문 → 허용 라벨. 불명이면 null (호출측이 기본값을 넣지 않도록). */
export function normalizeDepartureBookingStatus(
  raw: string | null | undefined,
): DepartureBookingStatusLabel | null {
  const t = String(raw ?? '').trim()
  if (!t) return null
  if (/출발\s*확정|확정\s*출발/i.test(t)) return '출발확정'
  if (/대기\s*예약/i.test(t)) return '대기예약'
  if (/예약\s*마감|예약마감|마감|매진|sold\s*out|불가|취소/i.test(t)) return '마감'
  if (/예약\s*가능|예약가능/i.test(t)) return '예약가능'
  for (const label of STATUS_LABELS) {
    if (t === label) return label
  }
  return null
}

/**
 * 성인가 셀이 출발 없음('-', '—', 빈칸 등)인지.
 * 숫자 0 / null 은 "가격 미확인"과 혼동될 수 있어 문자열 표기만 본다.
 */
export function isAdultPriceAbsentMarker(raw: unknown): boolean {
  if (raw == null) return false
  const t = String(raw).trim()
  if (!t) return true
  if (t === '-' || t === '—' || t === '–' || t === '−') return true
  if (/^(없음|미정|출발\s*없음)$/i.test(t)) return true
  return false
}

/** 공개 수집·upsert 대상: 마감 제외. 대기예약·예약가능·출발확정·상태 불명(가격 있음)은 유지. */
export function isDepartureOnSaleForImport(statusRaw: string | null | undefined): boolean {
  const label = normalizeDepartureBookingStatus(statusRaw)
  if (label === '마감') return false
  return true
}

/** upsert/수집 입력 — statusRaw 우선, 없으면 status. 마감만 제외. */
export function filterDeparturesOnSaleForImport<
  T extends { statusRaw?: string | null; status?: string | null },
>(rows: readonly T[]): T[] {
  return rows.filter((r) => isDepartureOnSaleForImport(r.statusRaw ?? r.status))
}
