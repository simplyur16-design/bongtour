/**
 * D-3: 상품 지리 메타 단일 정규화 — 등록·재처리·백필 공통.
 * - `countryKey` / `nodeKey` / `groupKey` / `continent` / 신뢰도: `deriveProductLocationKeyFieldsForPrisma`와 동일
 * - `country` / `city`: browse·메가메뉴 Prisma 필터와 맞춘 **한글 SSOT** (`browse-country-url-resolve`)
 */
import { resolveProductCityToKoreanDisplay, resolveProductCountryToKoreanDisplay } from '@/lib/browse-country-url-resolve'
import {
  deriveProductLocationKeyFieldsForPrisma,
  type ProductLocationKeyMatchInput,
  type ProductLocationKeyPrismaFields,
} from '@/lib/product-location-key-match'

export type { ProductLocationKeyMatchInput, ProductLocationKeyPrismaFields } from '@/lib/product-location-key-match'

/**
 * 스크래퍼·관리자·업서트가 Product에 spread할 지리 필드(한글 country/city 포함).
 */
export function normalizeProductGeoForPrisma(input: ProductLocationKeyMatchInput): ProductLocationKeyPrismaFields {
  const d = deriveProductLocationKeyFieldsForPrisma(input)
  const countryKr = resolveProductCountryToKoreanDisplay(d.country) ?? d.country
  const cityKr = resolveProductCityToKoreanDisplay(d.city) ?? d.city
  return {
    ...d,
    country: countryKr,
    city: cityKr,
  }
}
