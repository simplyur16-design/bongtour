/**
 * 등록·재처리 공통 — LLM destination 문자열 → 메가메뉴 SSOT geo + 다국가 판정.
 * REGRESSION-FREEZE[supplier-register-mega-menu-geo]: 전 공급사 orchestration은 이 모듈만 호출 — manifest
 * REGRESSION-FREEZE[register-mega-menu-auto-classify]: enrichRegisterGeoInput — manifest
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

/** confirm 직전 — 제목·목적지·일정을 bodyText에 합쳐 geo·태그 매칭 haystack을 키운다. */
export function enrichRegisterGeoInput(input: RegisterMegaMenuGeoInput): RegisterMegaMenuGeoInput {
  let title = (input.title ?? '').trim()
  const sched = (input.bodyText ?? '').trim()
  const parts = [
    title,
    input.primaryDestination?.trim(),
    input.destinationRaw?.trim(),
    input.destination?.trim(),
    sched,
  ].filter((s): s is string => Boolean(s))
  const uniqueParts = [...new Set(parts)]
  let bodyText = uniqueParts.join('\n').trim() || null
  let primaryDestination = input.primaryDestination?.trim() || null
  let destinationRaw = input.destinationRaw?.trim() || null
  if (bodyText && /(?:베이징|北京|자금성|천안문|Forbidden\s*City)/u.test(bodyText)) {
    bodyText = `${bodyText}\n베이징 중국`
    primaryDestination = primaryDestination || '중국 베이징'
    destinationRaw = destinationRaw || '중국'
  }
  if (bodyText && /(?:다롄|大连|Dalian|여순|旅顺)/u.test(bodyText)) {
    bodyText = `${bodyText}\n다롄 중국`
    primaryDestination = primaryDestination || '중국 다롄'
    destinationRaw = destinationRaw || '중국'
  }
  if (bodyText && /(?:타슈켄트|Tashkent|사마르칸트|Samarkand|우즈베키|Uzbekistan)/u.test(bodyText)) {
    bodyText = `${bodyText}\n우즈베키스탄 중앙아시아`
  }
  if (!title && sched) {
    const firstRouteLine =
      sched
        .split(/\n+/)
        .map((line) => line.trim())
        .find((line) => line.length >= 8 && /\s[-–—→]\s/u.test(line)) ?? ''
    if (firstRouteLine) title = firstRouteLine.slice(0, 120)
    else if (/[가-힣A-Za-z]{4,}/u.test(sched)) title = sched.split(/\n+/)[0]!.trim().slice(0, 120)
  }
  return { ...input, title, bodyText, primaryDestination, destinationRaw }
}

/**
 * 상품 등록 confirm 직전 geo 확정 — normalize + 다국가 auto plan.
 */
export async function resolveMegaMenuGeoForRegister(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  input: RegisterMegaMenuGeoInput,
): Promise<RegisterMegaMenuGeoResult> {
  const enriched = enrichRegisterGeoInput(input)
  const { geo, masterRegistrationOk } = await normalizeProductGeoForPrisma(db, enriched)
  const tagOpts = registerGeoTagSyncOpts(enriched, enriched.bodyText)
  const multiPlan = await detectMultiCountryAutoPlan(db, tagOpts, geo.countryKey)
  const needsOperatorReview = !masterRegistrationOk || multiCountryNeedsOperatorReview(multiPlan)
  return { geo, masterRegistrationOk, multiPlan, needsOperatorReview }
}
