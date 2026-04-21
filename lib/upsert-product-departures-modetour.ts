/**
 * 모두투어 경로용 — ProductDeparture MVP: 출발일/가격/상태 동기화 적재.
 * (productId, departureDate) 기준 upsert. 날짜 정규화·raw 보존·파생은 보수적으로.
 */
import type { PrismaClient } from '@prisma/client'
import { normalizeCalendarDate } from './date-normalize'
import { deriveHanatourConfirmationFlags, parseStatusLabelsJson } from './hanatour-normalize'

const MAX_RAW = 2000

/** 아동: 명시 숫자만 반영, 없으면 DB. 유아: 0은 미전달(기존 유지) */
function pickPreservedChildPriceModetour(
  incoming: number | null | undefined,
  existing: number | null | undefined
): number | null {
  if (incoming !== undefined && incoming !== null && Number.isFinite(incoming)) {
    return incoming
  }
  if (existing !== undefined && existing !== null && Number.isFinite(existing)) {
    return existing
  }
  return null
}

function pickPreservedInfantPriceModetour(
  incoming: number | null | undefined,
  existing: number | null | undefined
): number | null {
  if (incoming !== undefined && incoming !== null && Number.isFinite(incoming) && incoming > 0) {
    return incoming
  }
  if (existing !== undefined && existing !== null && Number.isFinite(existing) && existing > 0) {
    return existing
  }
  return null
}

/**
 * 스키마에 교통 컬럼이 있어도 `prisma generate`가 실패(Windows에서 query_engine DLL 잠금 등)하면
 * 런타임 클라이언트가 옛 DMMF를 쓰며 `Unknown argument transportType` 이 난다. 한 번 코어만으로 재시도.
 */
function isStaleProductDepartureTransportClientError(e: unknown): boolean {
  if (e == null || typeof e !== 'object') return false
  const name = 'name' in e && typeof (e as { name: unknown }).name === 'string' ? (e as { name: string }).name : ''
  const msg =
    'message' in e && typeof (e as { message: unknown }).message === 'string' ? (e as { message: string }).message : ''
  return (
    name === 'PrismaClientValidationError' &&
    msg.includes('Unknown argument') &&
    msg.includes('transportType')
  )
}

/** 출발일 1건 입력. 있는 값만 넣고 나머지는 null 허용. */
export type DepartureInput = {
  /** YYYY-MM-DD 또는 파싱 가능한 날짜 문자열/Date */
  departureDate: string | Date
  adultPrice?: number | null
  childBedPrice?: number | null
  childNoBedPrice?: number | null
  infantPrice?: number | null
  localPriceText?: string | null
  /** 공급사가 해당 출발일 행에 붙인 상태·진행 문구 원문(마감·확정·예약가능 등). 좌석 수치와 구분. */
  statusRaw?: string | null
  /** 잔여석·예약석·좌석 마감 등 좌석/예약 관련 표기 원문. statusRaw 와 별도 필드. */
  seatsStatusRaw?: string | null
  minPax?: number | null
  /** 항공·미팅 (출발 회차별). 터미널 안내는 출발공항+carrierName을 최종 항공 입력·구조화 값 기준으로 생성. */
  carrierName?: string | null
  outboundFlightNo?: string | null
  outboundDepartureAirport?: string | null
  outboundDepartureAt?: string | Date | null
  outboundArrivalAirport?: string | null
  outboundArrivalAt?: string | Date | null
  inboundFlightNo?: string | null
  inboundDepartureAirport?: string | null
  inboundDepartureAt?: string | Date | null
  inboundArrivalAirport?: string | null
  inboundArrivalAt?: string | Date | null
  meetingInfoRaw?: string | null
  meetingPointRaw?: string | null
  meetingTerminalRaw?: string | null
  meetingGuideNoticeRaw?: string | null
  meetingDateRaw?: string | null

  /** JSON 배열 문자열: ["출발확정","항공예정",...] */
  statusLabelsRaw?: string | null
  reservationCount?: number | null
  seatCount?: number | null
  fuelSurchargeIncluded?: boolean | null
  taxIncluded?: boolean | null
  isDepartureConfirmed?: boolean | null
  isAirConfirmed?: boolean | null
  isScheduleConfirmed?: boolean | null
  isHotelConfirmed?: boolean | null
  isPriceConfirmed?: boolean | null
  supplierDepartureCodeCandidate?: string | null
  matchingTraceRaw?: string | null

  /** AIR | SHIP | BUS | TRAIN | SELF | MIXED | ETC — 회차별 */
  transportType?: string | null
  boardingPlace?: string | null
  departureTimeText?: string | null
  returnTimeText?: string | null
  vehicleNote?: string | null
  transportSegmentRaw?: string | null
  supplierPriceKey?: string | null
}

/**
 * ISO8601 또는 '2026.04.01 16:05' 형식 등 → Date. 불명확하면 null.
 */
export function parseDepartureDateTime(input: string | Date | null | undefined): Date | null {
  if (input == null) return null
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input
  }
  const s = String(input).trim()
  if (!s) return null
  const t = new Date(s)
  if (!Number.isNaN(t.getTime())) return t
  const m = s.match(
    /^(\d{4})[.\-/](\d{2})[.\-/](\d{2})(?:[T\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  )
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2]) - 1
    const dd = Number(m[3])
    const hh = m[4] != null ? Number(m[4]) : 0
    const mm = m[5] != null ? Number(m[5]) : 0
    const ss = m[6] != null ? Number(m[6]) : 0
    const d = new Date(y, mo, dd, hh, mm, ss)
    return Number.isNaN(d.getTime()) ? null : d
  }
  return null
}

function trimRaw(s: string | null | undefined, max = MAX_RAW): string | null {
  if (s == null) return null
  const t = String(s).trim()
  return t ? t.slice(0, max) : null
}

/**
 * 날짜를 UTC 자정(YYYY-MM-DD 00:00:00Z)으로 정규화.
 * 같은 캘린더 날짜는 항상 동일한 DateTime이 되도록 함.
 */
export function normalizeDepartureDate(input: string | Date): Date | null {
  let yyyy: number, mm: number, dd: number
  if (typeof input === 'string') {
    const s = String(input).trim()
    const normalized = normalizeCalendarDate(s) || (s.length >= 10 ? s.slice(0, 10) : null)
    if (!normalized || !/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return null
    yyyy = parseInt(normalized.slice(0, 4), 10)
    mm = parseInt(normalized.slice(5, 7), 10)
    dd = parseInt(normalized.slice(8, 10), 10)
  } else {
    const d = input as Date
    if (Number.isNaN(d.getTime())) return null
    yyyy = d.getFullYear()
    mm = d.getMonth() + 1
    dd = d.getDate()
  }
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  const date = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0, 0))
  return date
}

/**
 * statusRaw / seatsStatusRaw → isConfirmed, isBookable.
 * 명확할 때만 채우고, 애매하면 null.
 */
export function deriveDepartureFlags(
  statusRaw?: string | null,
  seatsStatusRaw?: string | null
): { isConfirmed: boolean | null; isBookable: boolean | null } {
  const raw = (statusRaw ?? '').trim()
  const seats = (seatsStatusRaw ?? '').trim()
  let isConfirmed: boolean | null = null
  let isBookable: boolean | null = null

  if (raw) {
    if (/출발\s*확정|확정\s*출발/i.test(raw)) isConfirmed = true
    else if (/마감|불가|취소/i.test(raw)) {
      isConfirmed = false
      isBookable = false
    }
  }
  if (isBookable === null && (raw || seats)) {
    if (/대기\s*예약|대기/i.test(raw)) isBookable = null
    else if (/예약\s*가능|예약가능|가능/i.test(raw) || /예약\s*가능|잔여|좌석/i.test(seats)) isBookable = true
    else if (/마감|불가|대기/i.test(raw) || /마감|불가/i.test(seats)) isBookable = false
  }

  return { isConfirmed, isBookable }
}

function mergeHanatourDerivedFlags(
  statusLabelsRaw: string | null | undefined,
  statusRaw: string | null | undefined,
  explicit: Partial<Pick<
    DepartureInput,
    | 'isDepartureConfirmed'
    | 'isAirConfirmed'
    | 'isScheduleConfirmed'
    | 'isHotelConfirmed'
    | 'isPriceConfirmed'
  >>
) {
  const labels = parseStatusLabelsJson(statusLabelsRaw ?? undefined)
  const derived = deriveHanatourConfirmationFlags(labels, statusRaw)
  const pick = <K extends keyof typeof derived>(k: K): boolean | null => {
    const e = explicit[k]
    return typeof e === 'boolean' ? e : derived[k]
  }
  return {
    isDepartureConfirmed: pick('isDepartureConfirmed'),
    isAirConfirmed: pick('isAirConfirmed'),
    isScheduleConfirmed: pick('isScheduleConfirmed'),
    isHotelConfirmed: pick('isHotelConfirmed'),
    isPriceConfirmed: pick('isPriceConfirmed'),
  }
}

/**
 * 출발일 배열을 ProductDeparture로 upsert.
 * - 빈 배열이면 스킵.
 * - 잘못된 날짜는 해당 row 스킵.
 * - 같은 (productId, departureDate)는 갱신.
 */
export async function upsertProductDepartures(
  prisma: PrismaClient,
  productId: string,
  departures: DepartureInput[]
): Promise<number> {
  if (!departures?.length) return 0

  const now = new Date()

  const pairs: { dep: DepartureInput; departureDate: Date }[] = []
  for (const d of departures) {
    const departureDate = normalizeDepartureDate(d.departureDate)
    if (departureDate) pairs.push({ dep: d, departureDate })
  }
  if (pairs.length === 0) return 0

  const existingRows = await prisma.productDeparture.findMany({
    where: { productId, departureDate: { in: pairs.map((p) => p.departureDate) } },
    select: {
      departureDate: true,
      childBedPrice: true,
      childNoBedPrice: true,
      infantPrice: true,
    },
  })
  const existingChildByUtc = new Map<
    number,
    { childBedPrice: number | null; childNoBedPrice: number | null; infantPrice: number | null }
  >()
  for (const row of existingRows) {
    existingChildByUtc.set(row.departureDate.getTime(), {
      childBedPrice: row.childBedPrice,
      childNoBedPrice: row.childNoBedPrice,
      infantPrice: row.infantPrice,
    })
  }

  for (const { dep: d, departureDate } of pairs) {
    const { isConfirmed, isBookable } = deriveDepartureFlags(d.statusRaw, d.seatsStatusRaw)

    const previous = existingChildByUtc.get(departureDate.getTime())
    const adultPrice = d.adultPrice != null && !Number.isNaN(d.adultPrice) ? d.adultPrice : null
    const childBedRaw = pickPreservedChildPriceModetour(d.childBedPrice, previous?.childBedPrice)
    const childBedPrice = childBedRaw ?? adultPrice
    const childNoBedRaw = pickPreservedChildPriceModetour(d.childNoBedPrice, previous?.childNoBedPrice)
    const childNoBedPrice = childNoBedRaw ?? adultPrice
    const infantPrice = pickPreservedInfantPriceModetour(d.infantPrice, previous?.infantPrice)
    const minPax = d.minPax != null && !Number.isNaN(d.minPax) ? d.minPax : null
    const localPriceText = d.localPriceText != null && String(d.localPriceText).trim() ? String(d.localPriceText).trim().slice(0, 200) : null
    const statusRaw = d.statusRaw != null && String(d.statusRaw).trim() ? String(d.statusRaw).trim().slice(0, 200) : null
    const seatsStatusRaw = d.seatsStatusRaw != null && String(d.seatsStatusRaw).trim() ? String(d.seatsStatusRaw).trim().slice(0, 200) : null

    const carrierName = trimRaw(d.carrierName)
    const outboundFlightNo = trimRaw(d.outboundFlightNo, 80)
    const outboundDepartureAirport = trimRaw(d.outboundDepartureAirport, 120)
    const outboundArrivalAirport = trimRaw(d.outboundArrivalAirport, 120)
    const inboundFlightNo = trimRaw(d.inboundFlightNo, 80)
    const inboundDepartureAirport = trimRaw(d.inboundDepartureAirport, 120)
    const inboundArrivalAirport = trimRaw(d.inboundArrivalAirport, 120)
    const meetingInfoRaw = trimRaw(d.meetingInfoRaw)
    const meetingPointRaw = trimRaw(d.meetingPointRaw)
    const meetingTerminalRaw = trimRaw(d.meetingTerminalRaw)
    const meetingGuideNoticeRaw = trimRaw(d.meetingGuideNoticeRaw)
    const meetingDateRaw = trimRaw(d.meetingDateRaw)
    const statusLabelsRaw = d.statusLabelsRaw != null && String(d.statusLabelsRaw).trim()
      ? String(d.statusLabelsRaw).trim().slice(0, 2000)
      : null
    const reservationCount =
      d.reservationCount != null && !Number.isNaN(d.reservationCount) ? d.reservationCount : null
    const seatCount = d.seatCount != null && !Number.isNaN(d.seatCount) ? d.seatCount : null
    const fuelSurchargeIncluded =
      typeof d.fuelSurchargeIncluded === 'boolean' ? d.fuelSurchargeIncluded : null
    const taxIncluded = typeof d.taxIncluded === 'boolean' ? d.taxIncluded : null
    const supplierDepartureCodeCandidate = trimRaw(d.supplierDepartureCodeCandidate, 200)
    const matchingTraceRaw =
      d.matchingTraceRaw != null && String(d.matchingTraceRaw).trim()
        ? String(d.matchingTraceRaw).trim().slice(0, 8000)
        : null

    const transportType = trimRaw(d.transportType, 32)
    const boardingPlace = trimRaw(d.boardingPlace, 500)
    const departureTimeText = trimRaw(d.departureTimeText, 120)
    const returnTimeText = trimRaw(d.returnTimeText, 120)
    const vehicleNote = trimRaw(d.vehicleNote, 800)
    const transportSegmentRaw = trimRaw(d.transportSegmentRaw, MAX_RAW)
    const supplierPriceKey = trimRaw(d.supplierPriceKey, 200)

    const hanatourFlags = mergeHanatourDerivedFlags(statusLabelsRaw, statusRaw, {
      isDepartureConfirmed: d.isDepartureConfirmed,
      isAirConfirmed: d.isAirConfirmed,
      isScheduleConfirmed: d.isScheduleConfirmed,
      isHotelConfirmed: d.isHotelConfirmed,
      isPriceConfirmed: d.isPriceConfirmed,
    })

    const outboundDepartureAt = parseDepartureDateTime(d.outboundDepartureAt ?? undefined)
    const outboundArrivalAt = parseDepartureDateTime(d.outboundArrivalAt ?? undefined)
    const inboundDepartureAt = parseDepartureDateTime(d.inboundDepartureAt ?? undefined)
    const inboundArrivalAt = parseDepartureDateTime(d.inboundArrivalAt ?? undefined)

    const where = { productId_departureDate: { productId, departureDate } }
    const corePayload = {
      adultPrice,
      childBedPrice,
      childNoBedPrice,
      infantPrice,
      localPriceText,
      statusRaw,
      seatsStatusRaw,
      isConfirmed,
      isBookable,
      minPax,
      syncedAt: now,
      carrierName,
      outboundFlightNo,
      outboundDepartureAirport,
      outboundDepartureAt,
      outboundArrivalAirport,
      outboundArrivalAt,
      inboundFlightNo,
      inboundDepartureAirport,
      inboundDepartureAt,
      inboundArrivalAirport,
      inboundArrivalAt,
      meetingInfoRaw,
      meetingPointRaw,
      meetingTerminalRaw,
      meetingGuideNoticeRaw,
      meetingDateRaw,
      statusLabelsRaw,
      reservationCount,
      seatCount,
      fuelSurchargeIncluded,
      taxIncluded,
      ...hanatourFlags,
      supplierDepartureCodeCandidate,
      matchingTraceRaw,
    }
    const transportPayload = {
      transportType,
      boardingPlace,
      departureTimeText,
      returnTimeText,
      vehicleNote,
      transportSegmentRaw,
      supplierPriceKey,
    }

    try {
      await prisma.productDeparture.upsert({
        where,
        update: { ...corePayload, ...transportPayload },
        create: { productId, departureDate, ...corePayload, ...transportPayload },
      })
    } catch (e) {
      if (!isStaleProductDepartureTransportClientError(e)) throw e
      await prisma.productDeparture.upsert({
        where,
        update: corePayload,
        create: { productId, departureDate, ...corePayload },
      })
    }
  }
  return pairs.length
}

/**
 * ParsedProductPrice[] → DepartureInput[] 변환.
 * register-parse / travel-parse / mapToParsedProduct 흐름에서 사용.
 */
export function parsedPricesToDepartureInputs(prices: Array<{
  date: string
  adultBase?: number
  adultFuel?: number
  childBedBase?: number
  childNoBedBase?: number
  childFuel?: number
  infantBase?: number
  infantFuel?: number
  status?: string
  availableSeats?: number
  localPrice?: string | null
  carrierName?: string | null
  outboundFlightNo?: string | null
  outboundDepartureAirport?: string | null
  outboundDepartureAt?: string | null
  outboundArrivalAirport?: string | null
  outboundArrivalAt?: string | null
  inboundFlightNo?: string | null
  inboundDepartureAirport?: string | null
  inboundDepartureAt?: string | null
  inboundArrivalAirport?: string | null
  inboundArrivalAt?: string | null
  meetingInfoRaw?: string | null
  meetingPointRaw?: string | null
  meetingTerminalRaw?: string | null
  meetingGuideNoticeRaw?: string | null
}>): DepartureInput[] {
  if (!prices?.length) return []
  return prices.map((p) => {
    const adultPrice = (Number(p.adultBase) || 0) + (Number(p.adultFuel) || 0) || null
    const fuel = Number(p.childFuel) || 0
    /** 출발일 행에 아동·유아 breakdown이 없으면 필드를 생략 → upsert 시 DB 기존값 유지 */
    const cb = p.childBedBase != null ? (Number(p.childBedBase) || 0) + fuel : undefined
    const cnb = p.childNoBedBase != null ? (Number(p.childNoBedBase) || 0) + fuel : undefined
    const inf =
      p.infantBase != null || p.infantFuel != null
        ? (Number(p.infantBase) || 0) + (Number(p.infantFuel) || 0)
        : undefined
    const statusRaw = p.status && String(p.status).trim() ? String(p.status).trim() : null
    const seatsStatusRaw = p.availableSeats != null ? `잔여${p.availableSeats}` : null
    return {
      departureDate: p.date,
      adultPrice: adultPrice || undefined,
      ...(cb !== undefined ? { childBedPrice: cb } : {}),
      ...(cnb !== undefined ? { childNoBedPrice: cnb } : {}),
      ...(inf !== undefined ? { infantPrice: inf } : {}),
      localPriceText: (p as { localPrice?: string | null }).localPrice ?? undefined,
      statusRaw: statusRaw ?? undefined,
      seatsStatusRaw: seatsStatusRaw ?? undefined,
      carrierName: p.carrierName ?? undefined,
      outboundFlightNo: p.outboundFlightNo ?? undefined,
      outboundDepartureAirport: p.outboundDepartureAirport ?? undefined,
      outboundDepartureAt: p.outboundDepartureAt ?? undefined,
      outboundArrivalAirport: p.outboundArrivalAirport ?? undefined,
      outboundArrivalAt: p.outboundArrivalAt ?? undefined,
      inboundFlightNo: p.inboundFlightNo ?? undefined,
      inboundDepartureAirport: p.inboundDepartureAirport ?? undefined,
      inboundDepartureAt: p.inboundDepartureAt ?? undefined,
      inboundArrivalAirport: p.inboundArrivalAirport ?? undefined,
      inboundArrivalAt: p.inboundArrivalAt ?? undefined,
      meetingInfoRaw: p.meetingInfoRaw ?? undefined,
      meetingPointRaw: p.meetingPointRaw ?? undefined,
      meetingTerminalRaw: p.meetingTerminalRaw ?? undefined,
      meetingGuideNoticeRaw: p.meetingGuideNoticeRaw ?? undefined,
    }
  })
}
