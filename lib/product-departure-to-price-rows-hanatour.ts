/**
 * 하나투어 경로용 — 공개 상품 상세는 레거시 ProductPrice[] 를 직렬화해 쓰는데,
 * 신규 SSOT는 ProductDeparture — 둘을 맞춰 달력·요금이 보이게 한다.
 *
 * [모두투어 전용] `MergeProductPriceBodyTableOptions.modetourVaryingAdultChildLinkage`는 모두투어 본문 가격표
 * (아동=성인 동일 단가 + 유아 고정 등)와 달력 성인가 분리 패턴에만 맞춘 후처리다. page에서 modetour일 때만 전달.
 */
import type { ProductDeparture } from '@prisma/client'
import type { ProductPriceRow } from '@/app/components/travel/TravelProductDetail'
import type { BodyProductPriceTable } from '@/lib/public-product-extras'
import type { DepartureInput } from '@/lib/upsert-product-departures-hanatour'
import { normalizeCalendarDate } from '@/lib/date-normalize'

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

/** 0은 직렬화/DB placeholder로 두는 경우가 있어 미기입으로 본다 */
function positiveSlot(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v) || v <= 0) return null
  return v
}

/** 성인가와 다른 ‘실제’ 아동·유아 단가가 있는지 — 성인 복제 placeholder만 있으면 false */
function rowHasDistinctChildBedTier(r: ProductPriceRow): boolean {
  const ad = num(r.adult ?? r.priceAdult)
  const cb = positiveSlot(r.priceChildWithBed ?? r.childBed)
  return cb != null && ad > 0 && cb !== ad
}

function rowHasDistinctChildNoBedTier(r: ProductPriceRow): boolean {
  const ad = num(r.adult ?? r.priceAdult)
  const cnb = positiveSlot(r.priceChildNoBed ?? r.childNoBed)
  return cnb != null && ad > 0 && cnb !== ad
}

function rowHasDistinctInfantTier(r: ProductPriceRow): boolean {
  const ad = num(r.adult ?? r.priceAdult)
  const inf = positiveSlot(r.priceInfant ?? r.infant)
  return inf != null && ad > 0 && inf !== ad
}

/** 출발일마다 숫자는 다르지만 행마다 아동=성인 복제일 뿐이면 본문 단가표로 통일 덮어쓰기 허용 */
function childBedOnlyMirrorsAdultAcrossRows(rows: ProductPriceRow[]): boolean {
  if (!rows.length) return false
  return rows.every((r) => {
    const ad = num(r.adult ?? r.priceAdult)
    const cb = positiveSlot(r.priceChildWithBed ?? r.childBed)
    return cb == null || ad <= 0 || cb === ad
  })
}

function childNoBedOnlyMirrorsAdultAcrossRows(rows: ProductPriceRow[]): boolean {
  if (!rows.length) return false
  return rows.every((r) => {
    const ad = num(r.adult ?? r.priceAdult)
    const cnb = positiveSlot(r.priceChildNoBed ?? r.childNoBed)
    return cnb == null || ad <= 0 || cnb === ad
  })
}

function priceSlotSig(child: number | null | undefined, priceChild: number | null | undefined): string {
  const v = priceChild ?? child
  if (v == null) return '∅'
  return String(v)
}

/** 출발일별 성인가가 서로 다르면 성인 슬롯만 본문 표로 덮어쓰지 않음 */
function adultPriceVariesAcrossDepartures(rows: ProductPriceRow[]): boolean {
  const adultVals = rows.map((r) => num(r.adult ?? r.priceAdult))
  const distinctPositive = (arr: number[]) => new Set(arr.filter((n) => n > 0)).size
  return distinctPositive(adultVals) > 1
}

function slotSignatureVaries(rows: ProductPriceRow[], pick: (r: ProductPriceRow) => string): boolean {
  return new Set(rows.map(pick)).size > 1
}

/** `mergeProductPriceRowsWithBodyPriceTable` 옵션 — 모두투어 전용 플래그만 사용(다른 공급사는 미전달) */
export type MergeProductPriceBodyTableOptions = {
  /**
   * 모두투어 전용: 출발별 성인가가 다를 때
   * - 본문 표의 아동·노베드가 **성인 단가와 같은 숫자**면 행마다 그날 성인가를 아동 슬롯에 복제(modetourPost).
   * - 그렇지 않으면(실제 아동/노베드 단가) 본문 고정 단가를 모든 출발 행에 채움.
   * 유아는 행이 비어 있을 때 modetourPost에서 보강.
   */
  modetourVaryingAdultChildLinkage?: boolean
}

/** rawMeta 본문 가격표(연령별)가 있으면 출발일별 행에 덮어씀 — 달력은 Departure, 구간 단가는 본문 표 SSOT */
export function mergeProductPriceRowsWithBodyPriceTable(
  rows: ProductPriceRow[],
  table: BodyProductPriceTable | null | undefined,
  options?: MergeProductPriceBodyTableOptions
): ProductPriceRow[] {
  if (!table || !rows.length) return rows
  const hasAny =
    (table.adultPrice != null && table.adultPrice > 0) ||
    table.childExtraBedPrice != null ||
    table.childNoBedPrice != null ||
    table.infantPrice != null
  if (!hasAny) return rows

  const adultVaries = adultPriceVariesAcrossDepartures(rows)
  const childBedVaries = slotSignatureVaries(rows, (r) => priceSlotSig(r.childBed, r.priceChildWithBed))
  const childNoBedVaries = slotSignatureVaries(rows, (r) => priceSlotSig(r.childNoBed, r.priceChildNoBed))
  const infantVaries = slotSignatureVaries(rows, (r) => priceSlotSig(r.infant, r.priceInfant))

  const mergeAdult = !adultVaries && table.adultPrice != null && table.adultPrice > 0
  /** 성인가가 출발일마다 달라도, 해당 슬롯이 모든 행에서 비어 있으면 본문 표로 채움(추출만 되고 달력 행 미기입 케이스) */
  const anyRowHasChildBed = rows.some((r) => positiveSlot(r.priceChildWithBed ?? r.childBed) != null)
  const anyRowHasChildNoBed = rows.some((r) => positiveSlot(r.priceChildNoBed ?? r.childNoBed) != null)
  const anyRowHasInfant = rows.some((r) => positiveSlot(r.priceInfant ?? r.infant) != null)
  const anyRowHasRealChildBedTier = rows.some(rowHasDistinctChildBedTier)
  const anyRowHasRealChildNoBedTier = rows.some(rowHasDistinctChildNoBedTier)
  const anyRowHasRealInfantTier = rows.some(rowHasDistinctInfantTier)
  let mergeChildBed =
    table.childExtraBedPrice != null &&
    table.childExtraBedPrice > 0 &&
    (!childBedVaries || childBedOnlyMirrorsAdultAcrossRows(rows)) &&
    (!adultVaries || !anyRowHasChildBed || !anyRowHasRealChildBedTier)
  let mergeChildNoBed =
    table.childNoBedPrice != null &&
    table.childNoBedPrice > 0 &&
    (!childNoBedVaries || childNoBedOnlyMirrorsAdultAcrossRows(rows)) &&
    (!adultVaries || !anyRowHasChildNoBed || !anyRowHasRealChildNoBedTier)
  const mergeInfant =
    table.infantPrice != null &&
    table.infantPrice > 0 &&
    !infantVaries &&
    (!adultVaries || !anyRowHasInfant || !anyRowHasRealInfantTier)

  /**
   * 모두투어: 출발별 성인가만 다르고 본문 표의 아동(EXTRA BED)/노베드/유아는 상품 단위 고정인 경우가 많다.
   * 예전에는 adultVaries일 때 아동 병합을 전부 끄면, 본문에 실제 아동 단가가 있어도 화면에 안 나왔다.
   * 본문 표가 「아동=성인 동일가」일 때만 기존처럼 merge를 끄고 modetourPost에서 행별 성인가를 복제한다.
   */
  if (options?.modetourVaryingAdultChildLinkage && adultVaries) {
    const ta = table.adultPrice ?? null
    const tcb = table.childExtraBedPrice ?? null
    const tcnb = table.childNoBedPrice ?? null
    const bodyChildMirrorsTableAdult =
      ta != null && ta > 0 && tcb != null && tcb > 0 && tcnb != null && tcnb > 0 && tcb === ta && tcnb === ta

    if (bodyChildMirrorsTableAdult) {
      mergeChildBed = false
      mergeChildNoBed = false
    } else {
      mergeChildBed =
        tcb != null &&
        tcb > 0 &&
        (!childBedVaries || childBedOnlyMirrorsAdultAcrossRows(rows)) &&
        (!anyRowHasChildBed || !anyRowHasRealChildBedTier)
      mergeChildNoBed =
        tcnb != null &&
        tcnb > 0 &&
        (!childNoBedVaries || childNoBedOnlyMirrorsAdultAcrossRows(rows)) &&
        (!anyRowHasChildNoBed || !anyRowHasRealChildNoBedTier)
    }
  }

  const modetourPost =
    options?.modetourVaryingAdultChildLinkage === true && adultVaries && table != null

  if (!mergeAdult && !mergeChildBed && !mergeChildNoBed && !mergeInfant && !modetourPost) return rows

  let merged = rows.map((r) => {
    const next: ProductPriceRow = { ...r }
    if (mergeAdult) {
      next.adult = table.adultPrice!
      next.priceAdult = table.adultPrice!
    }
    if (mergeChildBed) {
      next.childBed = table.childExtraBedPrice!
      next.priceChildWithBed = table.childExtraBedPrice!
    }
    if (mergeChildNoBed) {
      next.childNoBed = table.childNoBedPrice!
      next.priceChildNoBed = table.childNoBedPrice!
    }
    if (mergeInfant) {
      next.infant = table.infantPrice!
      next.priceInfant = table.infantPrice!
    }
    return next
  })

  if (modetourPost) {
    const ta = table.adultPrice ?? null
    const tcb = table.childExtraBedPrice ?? null
    const tcnb = table.childNoBedPrice ?? null
    const tin = table.infantPrice ?? null
    const bodyChildMirrorsTableAdult =
      ta != null && ta > 0 && tcb === ta && tcnb === ta

    merged = merged.map((r) => {
      const next: ProductPriceRow = { ...r }
      if (bodyChildMirrorsTableAdult) {
        const ad = num(r.adult ?? r.priceAdult)
        if (ad > 0) {
          next.childBed = ad
          next.priceChildWithBed = ad
          next.childNoBed = ad
          next.priceChildNoBed = ad
        }
      }
      if (tin != null && tin > 0 && positiveSlot(next.priceInfant ?? next.infant) == null) {
        next.infant = tin
        next.priceInfant = tin
      }
      return next
    })
  }

  return merged
}

export function productDeparturesToProductPriceRows(departures: ProductDeparture[]): ProductPriceRow[] {
  if (!departures?.length) return []
  const sorted = [...departures].sort(
    (a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime()
  )
  let prevTotal = 0
  return sorted.map((d) => {
    const adult = d.adultPrice ?? 0
    const childBed = d.childBedPrice ?? null
    const childNoBed = d.childNoBedPrice ?? null
    const infant = d.infantPrice ?? null
    const total = adult + (childBed ?? 0) + (childNoBed ?? 0) + (infant ?? 0)
    const priceGap = prevTotal > 0 ? total - prevTotal : 0
    prevTotal = total
    const dateStr =
      d.departureDate instanceof Date
        ? d.departureDate.toISOString().slice(0, 10)
        : String(d.departureDate).slice(0, 10)

    let status: string | undefined
    if (d.statusRaw?.trim()) status = d.statusRaw.trim()
    else if (d.statusLabelsRaw?.trim()) {
      try {
        const arr = JSON.parse(d.statusLabelsRaw) as unknown
        if (Array.isArray(arr) && arr[0] != null) status = String(arr[0])
      } catch {
        /* ignore */
      }
    }

    const seatsStatusRaw = d.seatsStatusRaw?.trim() || undefined

    return {
      id: d.id,
      productId: d.productId,
      date: dateStr,
      adult,
      childBed,
      childNoBed,
      infant,
      localPrice: d.localPriceText ?? null,
      priceGap,
      priceAdult: adult,
      priceChildWithBed: childBed,
      priceChildNoBed: childNoBed,
      priceInfant: infant,
      status,
      availableSeats: d.seatCount ?? undefined,
      /** 출발행 좌석·예약 표기 원문(하나투어 등) — 공개 예약인원 행 보조 */
      seatsStatusRaw,
    }
  })
}

/** 등록 확정 시 `parsed.prices` 가 비어 있어도 ProductPrice 행을 채워 레거시 조회·목록과 맞춘다. */
export function departureInputsToProductPriceCreateMany(
  productId: string,
  inputs: DepartureInput[]
): Array<{
  productId: string
  date: Date
  adult: number
  childBed: number
  childNoBed: number
  infant: number
  localPrice: string | null
  priceGap: number
}> {
  if (!inputs?.length) return []
  const sorted = [...inputs].sort((a, b) => {
    const sa =
      a.departureDate instanceof Date
        ? a.departureDate.toISOString().slice(0, 10)
        : normalizeCalendarDate(String(a.departureDate)) ?? String(a.departureDate).slice(0, 10)
    const sb =
      b.departureDate instanceof Date
        ? b.departureDate.toISOString().slice(0, 10)
        : normalizeCalendarDate(String(b.departureDate)) ?? String(b.departureDate).slice(0, 10)
    return sa.localeCompare(sb)
  })
  let prevTotal = 0
  return sorted.map((d) => {
    const adult = d.adultPrice ?? 0
    const childBed = d.childBedPrice ?? 0
    const childNoBed = d.childNoBedPrice ?? 0
    const infant = d.infantPrice ?? 0
    const total = adult + childBed + childNoBed + infant
    const priceGap = prevTotal > 0 ? total - prevTotal : 0
    prevTotal = total
    const ymd =
      d.departureDate instanceof Date
        ? d.departureDate.toISOString().slice(0, 10)
        : normalizeCalendarDate(String(d.departureDate)) ?? String(d.departureDate).slice(0, 10)
    return {
      productId,
      date: new Date(`${ymd}T00:00:00.000Z`),
      adult,
      childBed,
      childNoBed,
      infant,
      localPrice: d.localPriceText ?? null,
      priceGap,
    }
  })
}
