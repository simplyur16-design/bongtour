/**
 * D-3: 상품 지리 메타 단일 정규화 — 등록·재처리·백필 공통.
 * - `countryKey` / `nodeKey` / `groupKey` / `continent` / 신뢰도: `deriveProductLocationKeyFieldsForPrisma`와 동일
 * - I-6: 마스터(Continent/Country/City) 조회로 `country`·`city` 한글 SSOT = **마스터 koreanLabel** 강제,
 *   `continentKey`·`cityKey`(단일 도시)·canonical `countryKey` 보강 (`lib/normalize-product-geo-master.ts`).
 */
import type { Prisma } from '@prisma/client'
import { resolveProductCityToKoreanDisplay, resolveProductCountryToKoreanDisplay } from '@/lib/browse-country-url-resolve'
import { BROWSE_SLUG_PREFER_TREE_KR_LABEL, koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'
import { enrichPrismaGeoWithMasterLabels, masterGeoMeetsRegistrationBar } from '@/lib/normalize-product-geo-master'
import {
  deriveProductLocationKeyFieldsForPrisma,
  type ProductLocationKeyMatchInput,
  type ProductLocationKeyPrismaFields,
} from '@/lib/product-location-key-match'
export type { ProductLocationKeyMatchInput, ProductLocationKeyPrismaFields } from '@/lib/product-location-key-match'

function applyBrowseDisplayLabelsToDerived(d: ProductLocationKeyPrismaFields): ProductLocationKeyPrismaFields {
  const slugForKr = (d.countryKey ?? d.country ?? '').trim().toLowerCase()
  const fromResolve =
    resolveProductCountryToKoreanDisplay(d.country) ??
    resolveProductCountryToKoreanDisplay(d.countryKey)
  const treeLabelOverride =
    slugForKr && BROWSE_SLUG_PREFER_TREE_KR_LABEL.has(slugForKr)
      ? koreanCountryLabelFromBrowseSlug(slugForKr)
      : null
  const countryKr = treeLabelOverride ?? fromResolve ?? d.country
  const cityKr = resolveProductCityToKoreanDisplay(d.city) ?? d.city
  return {
    ...d,
    country: countryKr,
    city: cityKr,
  }
}

/**
 * 트리 SSOT + browse 한글 표기만 (마스터 FK·라벨 강제 없음). F-1 geo-audit 목록의 「D-3-FIX 추천(트리)」 패널용.
 */
export function normalizeProductGeoTreePreview(input: ProductLocationKeyMatchInput): ProductLocationKeyPrismaFields {
  const d = deriveProductLocationKeyFieldsForPrisma(input)
  return applyBrowseDisplayLabelsToDerived(d)
}

export type NormalizeProductGeoResult = {
  geo: ProductLocationKeyPrismaFields
  /** I-7: false면 신규 등록·재처리 시 pending 유지(마스터 정합 실패) */
  masterRegistrationOk: boolean
}

/**
 * 스크래퍼·관리자·업서트가 Product에 spread할 지리 필드(한글 country/city = 마스터 라벨).
 */
export async function normalizeProductGeoForPrisma(
  db: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  input: ProductLocationKeyMatchInput,
): Promise<NormalizeProductGeoResult> {
  const tree = deriveProductLocationKeyFieldsForPrisma(input)
  const geo = await enrichPrismaGeoWithMasterLabels(db, tree, {
    primaryDestination: input.primaryDestination,
    title: input.title,
  })
  return {
    geo,
    masterRegistrationOk: masterGeoMeetsRegistrationBar(tree, geo),
  }
}
