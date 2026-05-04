/**
 * 임시 stub — R-3 풀카피 재작성 시 삭제·`lib/{역할}-kyowontour.ts` 패턴으로 교체.
 * `lib/kyowontour/` 폐기(R-2) 동안 타입·API 경계만 유지한다.
 */
import { NextResponse } from 'next/server'
import type { PrismaClient } from '@prisma/client'
import type { DepartureInput } from '@/lib/upsert-product-departures-modetour'

export type ProductDepartureInput = DepartureInput

const R3_MSG = 'kyowontour 풀카피 재작성 중 (R-3)'

// --- Types (구 `orchestration.ts` / `register-llm.ts`와 동일 형태 — UI·타입 검사용) ---

export type KyowontourFlightSegment = {
  departureDateTime: string
  flightNo: string
  arrivalDateTime: string
}

export type KyowontourFlightFromBody = {
  airline: string
  outbound: KyowontourFlightSegment
  inbound: KyowontourFlightSegment
}

export type KyowontourOptionalTourFromBody = {
  name: string
  description: string
  priceAdult: number
  priceChild: number
  priceInfant: number
  currency: 'USD' | 'KRW'
  duration: string
  alternativeProgram: string
}

export type KyowontourShoppingItemFromBody = {
  itemName: string
  shopLocation: string
  duration: string
  refundable: string
}

export type KyowontourScheduleMeals = {
  breakfast: string
  lunch: string
  dinner: string
}

export type KyowontourScheduleFinal = {
  dayNumber: number
  title?: string
  activities: string[]
  hotel?: string
  meals: KyowontourScheduleMeals
}

export type KyowontourMeetingInfo = {
  location: string
  time: string
}

export type KyowontourFinalParsed = {
  productCode: string
  title: string
  durationLabel: string
  expectedDayCount: number
  priceAdult: number
  priceChild: number
  priceInfant: number
  fuelSurcharge?: number
  currency: 'KRW'
  flight: KyowontourFlightFromBody | null
  schedule: KyowontourScheduleFinal[]
  meetingInfo?: KyowontourMeetingInfo
  hotelGradeLabel?: string
  includedItems: string[]
  excludedItems: string[]
  optionalTours: KyowontourOptionalTourFromBody[]
  shoppingItems: KyowontourShoppingItemFromBody[]
  originalBodyText: string
  warnings: string[]
}

export type KyowontourCalendarRow = {
  departDate: string
  returnDate: string
  tourCode: string
  airline: string
  adultPriceFromCalendar: number
  status: 'available' | 'soldout' | 'closed' | 'unknown'
  rawJson: object
}

export type KyowontourCalendarRangeOptions = {
  timeoutMs?: number
  maxRetries?: number
  signal?: AbortSignal
  headers?: Record<string, string>
  log?: boolean
  logLabel?: string
  monthCount?: number
  startMonth?: Date
  tourCodeForE2EFallback?: string
  disableE2EFallback?: boolean
  e2eMasterCodeHint?: string | null
}

export type KyowontourDepartureUpsertResult = {
  created: number
  updated: number
  skipped: number
  errors: Array<{ departDate: string; error: string }>
  warnings: string[]
}

export type KyowontourUpsertOptions = {
  dryRun?: boolean
  abortOnFirstError?: boolean
  priceSpikeWarnRatio?: number
}

/** 관리자 등록 POST — R-3 전까지 503 */
export async function handleKyowontourRegisterRequest(_request: Request): Promise<Response> {
  return NextResponse.json(
    { success: false, error: R3_MSG, code: 'KyowontourMaintenance' },
    { status: 503, headers: { 'Content-Type': 'application/json' } }
  )
}

export async function collectKyowontourCalendarRange(
  _masterCode: string,
  _options?: KyowontourCalendarRangeOptions
): Promise<{ rows: KyowontourCalendarRow[]; warnings: string[] }> {
  throw new Error(R3_MSG)
}

export function mapKyowontourCalendarToDepartureInputs(
  _rows: KyowontourCalendarRow[],
  _productId: string
): ProductDepartureInput[] {
  return []
}

export async function upsertKyowontourDepartures(
  _prisma: PrismaClient,
  _productId: string,
  _inputs: ProductDepartureInput[],
  _options?: KyowontourUpsertOptions
): Promise<KyowontourDepartureUpsertResult> {
  throw new Error(R3_MSG)
}
