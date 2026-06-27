/**
 * 등록·재처리 공통 — LLM destination 문자열 → 메가메뉴 SSOT geo + 다국가 판정.
 * REGRESSION-FREEZE[supplier-register-mega-menu-geo]: 전 공급사 orchestration은 이 모듈만 호출 — manifest
 * 공급사별 geo 분기 금지.
 */
import type { Prisma } from '@prisma/client'
import { normalizeProductGeoForPrisma } from '@/lib/normalize-product-geo'
import {
  detectMultiCountryAutoPlan,
  multiCountryNeedsOperatorReview,
  type MultiCountryAutoPlan,
} from '@/lib/normalize-product-geo-master'
import type {
  ProductLocationKeyMatchInput,
  ProductLocationKeyPrismaFields,
} from '@/lib/product-location-key-match'

export type RegisterMegaMenuGeoInput = ProductLocationKeyMatchInput

export type RegisterMegaMenuGeoResult = {
  geo: ProductLocationKeyPrismaFields
  masterRegistrationOk: boolean
  multiPlan: MultiCountryAutoPlan
  /** pending 유지 여부 — low confidence 다국가·마스터 미달 */
  needsOperatorReview: boolean
}

export function registerGeoTagSyncOpts(
  input: RegisterMegaMenuGeoInput,
  scheduleHaystack?: string | null,
): {
  title: string
  primaryDestination: string | null
  destinationRaw: string | null
  scheduleHaystack: string | null
} {
  const destRaw = input.destinationRaw?.trim() || null
  const sched = scheduleHaystack?.trim() || null
  return {
    title: (input.title ?? '').trim(),
    primaryDestination: input.primaryDestination?.trim() || null,
    destinationRaw: destRaw,
    scheduleHaystack: sched,
  }
}

/**
 * 상품 등록 confirm 직전 geo 확정 — normalize + 다국가 auto plan.
 */
export async function resolveMegaMenuGeoForRegister(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  input: RegisterMegaMenuGeoInput,
): Promise<RegisterMegaMenuGeoResult> {
  const { geo, masterRegistrationOk } = await normalizeProductGeoForPrisma(db, input)
  const tagOpts = registerGeoTagSyncOpts(input)
  const multiPlan = await detectMultiCountryAutoPlan(db, tagOpts, geo.countryKey)
  const needsOperatorReview = !masterRegistrationOk || multiCountryNeedsOperatorReview(multiPlan)
  return { geo, masterRegistrationOk, multiPlan, needsOperatorReview }
}
