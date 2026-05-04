/**
 * 교원이지(kyowontour) — ProductDeparture upsert + 가격 정책 (Phase 2-D).
 * 아동 = 출발일별 성인가 동일, 유아 = 기존 DB 우선.
 */
import type { PrismaClient } from '@prisma/client'
import {
  deriveDepartureFlags,
  normalizeDepartureDate,
  parseDepartureDateTime,
  type DepartureInput,
} from '@/lib/upsert-product-departures-modetour'

const MAX_RAW = 2000

/** @public 단위 테스트·정책 문서용 */
export type ProductDepartureInput = DepartureInput

/** 아동 가격: 출발일별 성인 가격 변동 따름 */
export function deriveKyowontourChildPriceFromAdult(adultPrice: number): number {
  return adultPrice
}

/** 유아 가격: 기존 DB 값 우선, 없으면 입력값 (0은 기존 미사용으로 간주) */
export function pickPreservedInfantPriceKyowontour(
  newInfantPrice: number | null | undefined,
  existingInfantPrice: number | null | undefined
): number | null {
  if (existingInfantPrice != null && existingInfantPrice > 0) {
    return existingInfantPrice
  }
  return newInfantPrice ?? null
}

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

function trimRaw(s: string | null | undefined, max = MAX_RAW): string | null {
  if (s == null) return null
  const t = String(s).trim()
  return t ? t.slice(0, max) : null
}

export type KyowontourUpsertOptions = {
  dryRun?: boolean
  /** 첫 Prisma 오류에서 전체 중단 (기본 false: 행 단위 계속) */
  abortOnFirstError?: boolean
  /** 직전 성인가 대비 급등락 경고 비율 (기본 0.35) */
  priceSpikeWarnRatio?: number
}

export type KyowontourDepartureUpsertResult = {
  created: number
  updated: number
  skipped: number
  errors: Array<{ departDate: string; error: string }>
  warnings: string[]
}

function isValidYmd(d: Date): boolean {
  return !Number.isNaN(d.getTime())
}

function ymdFromUtcDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dedupeInputsByDepartureDate(inputs: ProductDepartureInput[]): {
  list: ProductDepartureInput[]
  warnings: string[]
} {
  const warnings: string[] = []
  const map = new Map<string, ProductDepartureInput>()
  for (const row of inputs) {
    const nd = normalizeDepartureDate(row.departureDate)
    if (!nd) continue
    const key = String(nd.getTime())
    if (map.has(key)) {
      warnings.push(`중복 출발일 입력: ${ymdFromUtcDate(nd)} — 마지막 행으로 덮어씀`)
    }
    map.set(key, row)
  }
  return { list: [...map.values()], warnings }
}

/**
 * 캘린더·스크래퍼에서 채운 `ProductDepartureInput[]`를 DB에 반영.
 */
export async function upsertKyowontourDepartures(
  prisma: PrismaClient,
  productId: string,
  inputs: ProductDepartureInput[],
  options?: KyowontourUpsertOptions
): Promise<KyowontourDepartureUpsertResult> {
  const warnings: string[] = []
  const errors: Array<{ departDate: string; error: string }> = []
  let created = 0
  let updated = 0
  let skipped = 0

  if (!inputs?.length) {
    return { created: 0, updated: 0, skipped: 0, errors: [], warnings: [] }
  }

  const { list: deduped, warnings: dupWarn } = dedupeInputsByDepartureDate(inputs)
  warnings.push(...dupWarn)

  const pairs: { dep: ProductDepartureInput; departureDate: Date }[] = []
  for (const d of deduped) {
    const departureDate = normalizeDepartureDate(d.departureDate)
    if (!departureDate) {
      skipped += 1
      warnings.push(`출발일 파싱 실패로 스킵: ${String(d.departureDate)}`)
      continue
    }
    pairs.push({ dep: d, departureDate })
  }

  if (pairs.length === 0) {
    return { created: 0, updated: 0, skipped, errors, warnings }
  }

  const dates = pairs.map((p) => p.departureDate)
  const existingRows = await prisma.productDeparture.findMany({
    where: { productId, departureDate: { in: dates } },
    select: {
      id: true,
      departureDate: true,
      adultPrice: true,
      childBedPrice: true,
      childNoBedPrice: true,
      infantPrice: true,
    },
  })
  const existingByUtc = new Map<
    number,
    { adultPrice: number | null; childBedPrice: number | null; childNoBedPrice: number | null; infantPrice: number | null }
  >()
  for (const row of existingRows) {
    existingByUtc.set(row.departureDate.getTime(), {
      adultPrice: row.adultPrice,
      childBedPrice: row.childBedPrice,
      childNoBedPrice: row.childNoBedPrice,
      infantPrice: row.infantPrice,
    })
  }

  const spikeRatio = options?.priceSpikeWarnRatio ?? 0.35
  const now = new Date()
  const dryRun = options?.dryRun === true
  const abortOnFirstError = options?.abortOnFirstError === true

  const runOne = async (d: ProductDepartureInput, departureDate: Date) => {
    const ymd = ymdFromUtcDate(departureDate)
    const prev = existingByUtc.get(departureDate.getTime())
    const existedBefore = existingByUtc.has(departureDate.getTime())

    const adultRaw = d.adultPrice
    let adultPrice: number | null =
      adultRaw != null && Number.isFinite(Number(adultRaw)) ? Math.round(Number(adultRaw)) : null
    if (adultPrice != null && adultPrice <= 0) {
      warnings.push(`성인가 0 이하 무시: ${ymd}`)
      adultPrice = null
    }

    if (prev?.adultPrice != null && adultPrice != null && prev.adultPrice > 0) {
      const ratio = Math.abs(adultPrice - prev.adultPrice) / prev.adultPrice
      if (ratio >= spikeRatio) {
        warnings.push(`가격 급변(${ymd}): 이전=${prev.adultPrice} → 신규=${adultPrice}`)
      }
    }

    const childFromAdult =
      adultPrice != null && adultPrice > 0 ? deriveKyowontourChildPriceFromAdult(adultPrice) : null
    const childBedPrice = childFromAdult
    const childNoBedPrice = childFromAdult
    const infantPrice = pickPreservedInfantPriceKyowontour(d.infantPrice, prev?.infantPrice)

    const { isConfirmed, isBookable } = deriveDepartureFlags(d.statusRaw, d.seatsStatusRaw)
    const minPax = d.minPax != null && !Number.isNaN(d.minPax) ? d.minPax : null
    const localPriceText =
      d.localPriceText != null && String(d.localPriceText).trim()
        ? String(d.localPriceText).trim().slice(0, 200)
        : null
    const statusRaw =
      d.statusRaw != null && String(d.statusRaw).trim() ? String(d.statusRaw).trim().slice(0, 200) : null
    const seatsStatusRaw =
      d.seatsStatusRaw != null && String(d.seatsStatusRaw).trim()
        ? String(d.seatsStatusRaw).trim().slice(0, 200)
        : null

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
    const statusLabelsRaw =
      d.statusLabelsRaw != null && String(d.statusLabelsRaw).trim()
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
      isDepartureConfirmed: d.isDepartureConfirmed ?? null,
      isAirConfirmed: d.isAirConfirmed ?? null,
      isScheduleConfirmed: d.isScheduleConfirmed ?? null,
      isHotelConfirmed: d.isHotelConfirmed ?? null,
      isPriceConfirmed: d.isPriceConfirmed ?? null,
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

    if (dryRun) {
      if (existedBefore) updated += 1
      else created += 1
      return
    }

    const upsertCore = async () => {
      await prisma.productDeparture.upsert({
        where,
        update: { ...corePayload, ...transportPayload },
        create: { productId, departureDate, ...corePayload, ...transportPayload },
      })
    }

    try {
      await upsertCore()
    } catch (e) {
      if (!isStaleProductDepartureTransportClientError(e)) throw e
      await prisma.productDeparture.upsert({
        where,
        update: corePayload,
        create: { productId, departureDate, ...corePayload },
      })
    }

    if (existedBefore) updated += 1
    else created += 1
  }

  for (const { dep, departureDate } of pairs) {
    if (!isValidYmd(departureDate)) {
      skipped += 1
      errors.push({ departDate: String(dep.departureDate), error: 'invalid departureDate' })
      continue
    }
    try {
      await runOne(dep, departureDate)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push({ departDate: ymdFromUtcDate(departureDate), error: msg })
      if (abortOnFirstError) break
    }
  }

  return { created, updated, skipped, errors, warnings }
}
