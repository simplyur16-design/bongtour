/**
 * 운영자 URL 배치 live gate — hard fail 규칙 SSOT (네트워크 없는 단위 테스트용).
 *
 * REGRESSION-FREEZE[register-user-url-batch-live-gate-hard]: 2030 중간일 bare city + flightStructured — manifest
 */
import { isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'
import { isHanatour2030ProductTitle } from '@/lib/product-adult-only-2030'
import { registerFlightCollectLooksComplete } from '@/lib/register-detail-collect-flight-apply'
import {
  isAirportTransferOrCityHubOnlyMiddleRoute,
  isScheduleHubMovementKeywordRow,
} from '@/lib/register-schedule-trip-image-keyword-dedupe'

export function isRegisterBatch2030ProductTitle(title: string | null | undefined): boolean {
  return isHanatour2030ProductTitle(title)
}

function isHubOnlyMiddleDay(args: {
  day: number
  maxDay: number
  routeText: string
  title: string
  description: string
}): boolean {
  const route = args.routeText
  return (
    isAirportTransferOrCityHubOnlyMiddleRoute(route) ||
    isScheduleHubMovementKeywordRow(
      { routeText: route, title: args.title, description: args.description },
      args.day,
      args.maxDay,
    ) ||
    /(?:공항|Airport|라운지|lounge|출발\s*\(|귀국|체크\s*인)/i.test(route) ||
    /^(?:크루즈|대극장)(?:\s*-\s*(?:크루즈|대극장))?$/u.test(route.replace(/\s+/g, ' ').trim()) ||
    /바다와\s*사막이\s*공존|3시간의\s*여정|모험의\s*땅/u.test(route) ||
    /대극장|파인\s*아트|Palace\s*of\s*Fine|PACIFIC\s*ISLANDS\s*CLUB|PIC\s*SAIPAN|새섬/i.test(route) ||
    /체크아웃\s*준비|리조트\s*체크아웃|다음날\s*체크아웃/i.test(route) ||
    /아일랜드\s*호핑|island\s*hopping|KK\s*스타\s*라운지|스타\s*라운지/i.test(route) ||
    (!route && /라운지|lounge|호핑|hopping|자유|호텔/i.test(`${args.title} ${args.description}`))
  )
}

/**
 * 2030 상품 — 중간일 primary imageKeyword가 bare 방문도시면 hard fail.
 * (emptyKw만 통과·도시 soft-dup으로 ok 치던 구멍 봉쇄. 출발·귀국 edge bare는 허용.)
 */
export function collectRegisterBatch2030MiddleBareCityHardIssues(args: {
  productTitle: string | null | undefined
  day: number
  maxDay: number
  routeText?: string | null
  title?: string | null
  description?: string | null
  imageKeyword?: string | null
}): string[] {
  if (!isRegisterBatch2030ProductTitle(args.productTitle)) return []
  const day = args.day
  const maxDay = args.maxDay
  if (day <= 1 || day >= maxDay) return []
  const kw = String(args.imageKeyword ?? '').trim()
  if (!kw || !isBareCityOrCountryKeyword(kw)) return []
  const routeText = String(args.routeText ?? '').trim()
  const title = String(args.title ?? '').trim()
  const description = String(args.description ?? '').trim()
  if (isHubOnlyMiddleDay({ day, maxDay, routeText, title, description })) return []
  // REGRESSION-FREEZE[register-user-url-batch-live-gate-hard]: 2030 middle bare city hard — manifest
  return [`중간일 imageKeyword bare city "${kw}" (2030·랜드마크 필요)`]
}

type ParsedFlightShape = {
  airlineName?: string | null
  outboundFlightNo?: string | null
  inboundFlightNo?: string | null
  detailBodyStructured?: {
    flightStructured?: {
      airlineName?: string | null
      outbound?: { flightNo?: string | null; departureTime?: string | null }
      inbound?: { flightNo?: string | null; departureTime?: string | null }
    } | null
  } | null
}

/**
 * 패키지 등록 배치 — 항공사 + 왕복 편명(·시각) structured 필수.
 * prefetch가 fact legs를 안 붙이면 여기서 hard fail.
 */
export function collectRegisterBatchFlightStructuredHardIssues(
  parsed: ParsedFlightShape | null | undefined,
  opts?: { travelScope?: string | null },
): string[] {
  const scope = String(opts?.travelScope ?? 'package').trim().toLowerCase()
  if (scope && scope !== 'package' && scope !== 'pkg') return []
  if (registerFlightCollectLooksComplete(parsed ?? {})) return []
  const fs = parsed?.detailBodyStructured?.flightStructured
  const airline = String(parsed?.airlineName ?? fs?.airlineName ?? '').trim()
  const ob = String(parsed?.outboundFlightNo ?? fs?.outbound?.flightNo ?? '').trim()
  const ib = String(parsed?.inboundFlightNo ?? fs?.inbound?.flightNo ?? '').trim()
  const missing: string[] = []
  if (!airline) missing.push('airlineName')
  if (!ob) missing.push('outboundFlightNo')
  if (!ib) missing.push('inboundFlightNo')
  // REGRESSION-FREEZE[register-user-url-batch-live-gate-hard]: flightStructured required — manifest
  if (missing.length === 0) {
    // 편명은 있으나 시각 누락 — collectLooksComplete 실패와 동일하게 hard
    return ['항공 flightStructured 불완전 (편명·시각)']
  }
  return [`항공 flightStructured 누락 (${missing.join(', ')})`]
}
