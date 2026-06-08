/**
 * 출발일 잔여좌석·판매완료 SSOT — 달력·목록 카드·등록 upsert 공용.
 */
import { getPriceAdult } from '@/lib/price-utils'

export type DepartureSeatRowLike = {
  adult?: number | null
  priceAdult?: number | null
  adultBase?: number | null
  adultFuel?: number | null
  availableSeats?: number | null
  seatCount?: number | null
  seatsStatusRaw?: string | null
  status?: string | null
  statusRaw?: string | null
  isBookable?: boolean | null
}

const SOLD_OUT_TEXT = /마감|만석|매진|판매\s*완료|판매\s*종료|sold\s*out|예약\s*불가/i

/** LLM·파싱 JSON — 미기입은 undefined, 0은 실제 0 */
export function parseOptionalSeatCount(raw: unknown): number | undefined {
  if (raw == null || raw === '') return undefined
  const n = Math.floor(Number(raw))
  return Number.isFinite(n) ? n : undefined
}

function seatStatusBlob(row: DepartureSeatRowLike): string {
  return `${row.status ?? ''} ${row.statusRaw ?? ''} ${row.seatsStatusRaw ?? ''}`.trim()
}

/**
 * 하나투어 등 `예약 : 0명 좌석 : 20석` — **좌석·잔여 라벨**만 잔여석으로 본다.
 * `예약 : 0`은 현재예약 인원이지 잔여 0이 아니다.
 */
export function parseLabeledRemainingSeatCountFromText(text: string): number | null {
  const t = text.trim()
  if (!t) return null
  const labeled = t.match(/좌석\s*[:：]\s*(\d+)\s*석?/i)
  if (labeled) return Math.floor(Number(labeled[1]))
  const remain = t.match(/잔여\s*(\d+)\s*석?/i)
  if (remain) return Math.floor(Number(remain[1]))
  return null
}

/** `seatCount`·`availableSeats`·`seatsStatusRaw`·`status`에서 잔여석 숫자 복원 */
export function deriveRemainingSeatCount(row: DepartureSeatRowLike): number | null {
  const blob = seatStatusBlob(row)

  for (const part of [row.seatsStatusRaw, row.statusRaw, row.status]) {
    const fromLabel = parseLabeledRemainingSeatCountFromText(String(part ?? ''))
    if (fromLabel != null) return fromLabel
  }

  const explicit = row.availableSeats ?? row.seatCount
  if (explicit != null && Number.isFinite(Number(explicit))) {
    const n = Math.floor(Number(explicit))
    // 레거시: seatCount=0 placeholder만 있고 마감·잔여0 문구 없으면 미수집으로 본다
    if (n === 0 && !SOLD_OUT_TEXT.test(blob) && !/잔여\s*0/i.test(blob)) {
      return null
    }
    return n
  }

  return null
}

/**
 * 판매완료 — **성인가가 있고** 잔여석이 **숫자로 0임이 확인**될 때만 true.
 * 가격 없음(미운영)·좌석 미수집(null)·마감 문구만 있는 경우는 판매완료가 아님.
 */
export function isDepartureSoldOut(row: DepartureSeatRowLike): boolean {
  if (departureRowAdultKrw(row) <= 0) return false
  const seats = deriveRemainingSeatCount(row)
  return seats != null && seats <= 0
}

/** 상품 본문·구조화 `remainingSeatsCount`로 달력 행 보강(에어텔 단일 출발 등) */
export function enrichPriceRowsWithProductRemainingSeats<
  T extends DepartureSeatRowLike & { date: string; id: string },
>(rows: T[], remainingSeatsCount: number | null | undefined): T[] {
  if (remainingSeatsCount == null || remainingSeatsCount <= 0) return rows
  return rows.map((row) => {
    const seats = deriveRemainingSeatCount(row)
    if (seats != null && seats > 0) return row
    if (isDepartureSoldOut(row)) return row
    return { ...row, availableSeats: remainingSeatsCount }
  })
}

/** ProductPriceRow `adult`·`priceAdult`·base/fuel 슬롯 통합 — `getPriceAdult` SSOT */
export function departureRowAdultKrw(row: DepartureSeatRowLike): number {
  return getPriceAdult(row as never)
}

/** 공개 달력·카드 — 성인가 있고 판매완료가 아님 */
export function isDepartureRowPublicBookable(row: DepartureSeatRowLike): boolean {
  return departureRowAdultKrw(row) > 0 && !isDepartureSoldOut(row)
}

/** 등록 파싱 — `availableSeats`·`seatsStatusRaw` → DB `seatCount`·원문 */
export function seatFieldsFromParsedCalendarPrice(p: {
  availableSeats?: number | null
  seatsStatusRaw?: string | null
  status?: string | null
}): { seatCount?: number; seatsStatusRaw?: string } {
  const rawAvail =
    p.availableSeats != null && Number.isFinite(Number(p.availableSeats))
      ? Math.floor(Number(p.availableSeats))
      : undefined
  const seatsRawIn = p.seatsStatusRaw != null && String(p.seatsStatusRaw).trim() ? String(p.seatsStatusRaw).trim() : ''
  const fromLabel = parseLabeledRemainingSeatCountFromText(
    `${seatsRawIn} ${p.status ?? ''}`.trim(),
  )
  const fromAvail = rawAvail != null && rawAvail > 0 ? rawAvail : undefined
  const seatCountResolved =
    fromAvail ?? fromLabel ?? (rawAvail === 0 ? undefined : rawAvail) ?? undefined
  const soldOutHint =
    (rawAvail === 0 && (SOLD_OUT_TEXT.test(`${seatsRawIn} ${p.status ?? ''}`) || /잔여\s*0/i.test(seatsRawIn))) ||
    false
  const seatsStatusRaw =
    seatCountResolved != null
      ? `잔여${seatCountResolved}`
      : seatsRawIn || (soldOutHint ? '잔여0' : undefined)
  const seatCount =
    seatCountResolved ??
    deriveRemainingSeatCount({ seatsStatusRaw, status: p.status }) ??
    undefined
  return {
    ...(seatCount != null ? { seatCount } : {}),
    ...(seatsStatusRaw ? { seatsStatusRaw } : {}),
  }
}

/** ProductDeparture → ProductPriceRow `availableSeats` 보강 */
export function availableSeatsForPriceRow(d: {
  seatCount?: number | null
  seatsStatusRaw?: string | null
  statusRaw?: string | null
}): number | undefined {
  const n = deriveRemainingSeatCount({
    seatCount: d.seatCount,
    seatsStatusRaw: d.seatsStatusRaw,
    statusRaw: d.statusRaw,
  })
  return n != null ? n : undefined
}
