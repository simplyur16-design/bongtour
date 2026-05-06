/**
 * D-3: 상품 지리 메타 단일 정규화 — 등록·재처리·백필 공통.
 * - `countryKey` / `nodeKey` / `groupKey` / `continent` / 신뢰도: `deriveProductLocationKeyFieldsForPrisma`와 동일
 * - `country` / `city`: browse·메가메뉴 Prisma 필터와 맞춘 **한글 SSOT** (`browse-country-url-resolve`)
 * - D-3-FIX: 표기(country/city 슬러그)는 트리 leaf·country 매칭과 정렬되며, 목적지 메타가 있을 때 일정 본문은 매칭에 섞지 않음(derive 쪽).
 */
import { resolveProductCityToKoreanDisplay, resolveProductCountryToKoreanDisplay } from '@/lib/browse-country-url-resolve'
import { koreanCountryLabelFromBrowseSlug } from '@/lib/location-url-slugs'

/** `resolveBrowseCountryParamToDbCountries`가 광역 슬러그를 미국·캐나다 등으로 접는 경우 — 메가메뉴 라벨 SSOT 유지 */
const BROWSE_SLUG_PREFER_TREE_KR_LABEL = new Set([
  'latin-caribbean',
  'latin-america',
  'latin-mexico',
  'alaska-caribbean-cruise',
])
import {
  deriveProductLocationKeyFieldsForPrisma,
  type ProductLocationKeyMatchInput,
  type ProductLocationKeyPrismaFields,
} from '@/lib/product-location-key-match'
import { findGroupKeyForCountryKey } from '@/lib/overseas-location-tree'
import { validateOverseasGeoFromMaster, type OverseasMasterDb } from '@/lib/overseas-master-validation'

export type { ProductLocationKeyMatchInput, ProductLocationKeyPrismaFields } from '@/lib/product-location-key-match'

function appendMasterGate(src: string | null): string | null {
  if (!src) return 'master:gated'
  if (src.includes('master:gated')) return src
  if (src.includes('master:')) return src
  return `${src};master:gated`
}

/**
 * H-3: 해외(`travelScope === 'overseas'`)이고 마스터가 비어 있지 않을 때만,
 * 추론된 group/country/node 키를 DB 마스터로 검증·한글 표기 확정. 실패 시 키·표기 null + `master:invalid`.
 */
export async function mergeProductGeoWithMaster(
  db: OverseasMasterDb,
  base: ProductLocationKeyPrismaFields,
  ctx: { travelScope: string | null | undefined },
): Promise<ProductLocationKeyPrismaFields> {
  if (ctx.travelScope !== 'overseas') return base

  let masterCount = 0
  try {
    masterCount = await db.overseasCountry.count()
  } catch {
    return base
  }
  if (masterCount === 0) return base

  let groupKey = (base.groupKey ?? '').trim()
  const countryKey = (base.countryKey ?? '').trim()
  const nodeKey = base.nodeKey && String(base.nodeKey).trim() ? String(base.nodeKey).trim() : null

  if (!countryKey) return base

  if (!groupKey) {
    groupKey = findGroupKeyForCountryKey(countryKey)?.trim() ?? ''
  }
  if (!groupKey) return base

  const v = await validateOverseasGeoFromMaster(db, { groupKey, countryKey, nodeKey })
  if (v.ok) {
    return {
      ...base,
      groupKey: v.resolved.groupKey,
      continent: v.resolved.continent,
      countryKey: v.resolved.countryKey,
      nodeKey: v.resolved.nodeKey,
      country: v.resolved.country,
      city: v.resolved.city,
      locationMatchConfidence: base.locationMatchConfidence,
      locationMatchSource: appendMasterGate(base.locationMatchSource),
    }
  }

  return {
    ...base,
    groupKey: null,
    continent: null,
    countryKey: null,
    nodeKey: null,
    country: null,
    city: null,
    locationMatchConfidence: 'low',
    locationMatchSource: 'master:invalid',
  }
}

export async function normalizeProductGeoForPrismaWithMaster(
  db: OverseasMasterDb,
  input: ProductLocationKeyMatchInput,
  ctx: { travelScope: string | null | undefined },
): Promise<ProductLocationKeyPrismaFields> {
  const base = normalizeProductGeoForPrisma(input)
  return mergeProductGeoWithMaster(db, base, ctx)
}

/**
 * 스크래퍼·관리자·업서트가 Product에 spread할 지리 필드(한글 country/city 포함).
 */
export function normalizeProductGeoForPrisma(input: ProductLocationKeyMatchInput): ProductLocationKeyPrismaFields {
  const d = deriveProductLocationKeyFieldsForPrisma(input)
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
