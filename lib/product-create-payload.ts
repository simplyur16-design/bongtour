/**
 * 하나투어/모두투어 판독 매뉴얼 기반 Prisma Product 등록용 payload.
 * - bgImageUrl 은 절대 포함하지 않음 (에러 방지).
 * - destination: 레거시. 신규는 destinationRaw/primaryDestination 중심.
 */
import type { ParsedProductForDB } from './parsed-product-types'

export type ProductCreatePayloadForPrisma = {
  originSource: string
  originCode: string
  title: string
  destination: string
  destinationRaw: string | null
  primaryDestination: string | null
  supplierGroupId: string | null
  priceFrom: number | null
  priceCurrency: string | null
  duration: string | null
  airline: string | null
  schedule: string | null
  isFuelIncluded: boolean
  isGuideFeeIncluded: boolean
  includedText: string | null
  excludedText: string | null
  mandatoryLocalFee: number | null
  mandatoryCurrency: string | null
}

/** ParsedProductForDB에 일정표 JSON 문자열을 붙인 확장 타입 */
export type ParsedProductWithSchedule = ParsedProductForDB & {
  schedule?: string | null
}

/**
 * ParsedProductForDB → Prisma product.create data.
 * bgImageUrl 제외, 매뉴얼에서 정의한 가용 필드만 반환.
 */
export function toProductCreatePayload(
  parsed: ParsedProductForDB | ParsedProductWithSchedule
): ProductCreatePayloadForPrisma {
  const withSchedule = parsed as ParsedProductWithSchedule
  return {
    originSource: parsed.originSource?.trim() || '직접입력',
    originCode: parsed.originCode.trim(),
    title: parsed.title?.trim() || '상품명 없음',
    destination: parsed.destination?.trim() || '미지정',
    destinationRaw: parsed.destinationRaw?.trim() || parsed.destination?.trim() || null,
    primaryDestination: parsed.primaryDestination?.trim() || parsed.destination?.trim() || null,
    supplierGroupId: parsed.supplierGroupId?.trim() || null,
    priceFrom: parsed.priceFrom != null ? parsed.priceFrom : null,
    priceCurrency: parsed.priceCurrency?.trim() || null,
    duration: (parsed.duration ?? '').trim() || null,
    airline: parsed.airline?.trim() || null,
    schedule: withSchedule.schedule ?? null,
    isFuelIncluded: parsed.isFuelIncluded !== false,
    isGuideFeeIncluded: parsed.isGuideFeeIncluded === true,
    includedText: parsed.includedText ?? null,
    excludedText: parsed.excludedText ?? null,
    mandatoryLocalFee: parsed.mandatoryLocalFee ?? null,
    mandatoryCurrency: parsed.mandatoryCurrency ?? null,
  }
}

/**
 * schedule JSON 배열 문자열로 payload의 schedule 필드 설정.
 * 일정표 파싱 결과를 그대로 넣을 때 사용.
 */
export function withSchedule(
  payload: ProductCreatePayloadForPrisma,
  scheduleJson: string | null
): ProductCreatePayloadForPrisma {
  return { ...payload, schedule: scheduleJson ?? null }
}
