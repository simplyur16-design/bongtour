import type { PrismaClient } from '@prisma/client'

import { isAirHotelProduct } from '@/lib/air-hotel-product-ssot'
import {
  futurePricedDepartureWhere,
  productHasFuturePricedDeparture,
} from '@/lib/future-priced-departure-guard'

export { futurePricedDepartureWhere }

/** modetour b2c-api SD1(단종) 연속 응답 → 은퇴 임계. modetour sales-policy 전용. */
export const MODETOUR_SD1_RETIRE_STREAK = 3

export const MODETOUR_SD1_AUTO_UNPUBLISH_REASON = 'modetour_sd1'

/** @deprecated API SD1 직후 stale DB 방어용 — API+E2E 검증 후에는 사용하지 않음. */
export type ModetourSd1AutoUnpublishOptions = {
  hasFuturePricedDeparture?: boolean
}

/**
 * API+E2E 수집 모두 실패한 뒤 auto_unpublished 대상 여부.
 *
 * 운영 정책:
 * - 자유여행(항공+호텔·에어텔)은 auto_unpublished 하지 않는다.
 * - DB에 stale 미래 출발이 남아 있어도 API·E2E로 검증 실패 시 비공개한다.
 *
 * @see lib/modetour-sweep.ts · lib/modetour-price-collect.ts
 */
export function isModetourSd1AutoUnpublishEligible(
  product: {
    listingKind?: string | null
    productType?: string | null
  },
  _options?: ModetourSd1AutoUnpublishOptions,
): boolean {
  if (isAirHotelProduct(product)) return false
  return true
}

/** @deprecated `isModetourSd1AutoUnpublishEligible` — modetour-sweep 회귀 테스트·호환 alias */
export function shouldModetourSweepRetireOnSd1(
  product: {
    listingKind?: string | null
    productType?: string | null
  },
  options?: ModetourSd1AutoUnpublishOptions,
): boolean {
  return isModetourSd1AutoUnpublishEligible(product, options)
}

/** @deprecated `productHasFuturePricedDeparture` — modetour sweep 호환 alias */
export async function modetourProductHasFuturePricedDeparture(
  prisma: PrismaClient,
  productId: string,
  todayYmd: string,
): Promise<boolean> {
  return productHasFuturePricedDeparture(prisma, productId, todayYmd)
}

/**
 * 실측 400 body (productNo=101580840):
 * `{ "errorMessages":[{"errorCode":"상품이 존재하지 않습니다. [SD1]","errorMessage":"..."}],"isOK":false }`
 * — errorCode 키 값은 리터럴 `'SD1'`이 아니라 문구 끝 `[SD1]` 포함.
 */
export type ModetourB2cErrorMessage = {
  errorCode?: string
  errorMessage?: string
}

export class ModetourB2cApiError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
    readonly bodyText: string,
    readonly bodyJson: unknown
  ) {
    super(`modetour api failed: HTTP ${status} (${url}) body=${bodyText.slice(0, 500)}`)
    this.name = 'ModetourB2cApiError'
  }
}

function modetourErrorEntryIsSoftNotFound(entry: unknown): boolean {
  if (typeof entry === 'string') {
    return (
      entry === 'SD1' ||
      entry === 'SD2' ||
      entry.includes('[SD1]') ||
      entry.includes('[SD2]')
    )
  }
  if (!entry || typeof entry !== 'object') return false
  const o = entry as ModetourB2cErrorMessage
  const code = String(o.errorCode ?? '')
  const msg = String(o.errorMessage ?? '')
  if (code === 'SD1' || msg === 'SD1' || code === 'SD2' || msg === 'SD2') return true
  if (
    code.includes('[SD1]') ||
    msg.includes('[SD1]') ||
    code.includes('[SD2]') ||
    msg.includes('[SD2]')
  ) {
    return true
  }
  return false
}

/** 400 + errorMessages[] SD1 (exact code 우선, `[SD1]` substring 폴백). */
export function modetourB2cBodyIndicatesSd1(bodyJson: unknown, bodyText: string): boolean {
  if (bodyJson && typeof bodyJson === 'object') {
    const msgs = (bodyJson as { errorMessages?: unknown }).errorMessages
    if (Array.isArray(msgs) && msgs.some(modetourErrorEntryIsSoftNotFound)) return true
  }
  return bodyText.includes('[SD1]') || bodyText.includes('[SD2]')
}

export function isModetourSd1NotFoundError(err: unknown): err is ModetourB2cApiError {
  if (!(err instanceof ModetourB2cApiError)) return false
  if (err.status !== 400) return false
  return modetourB2cBodyIndicatesSd1(err.bodyJson, err.bodyText)
}
