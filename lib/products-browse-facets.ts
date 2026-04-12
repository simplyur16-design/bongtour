/**
 * 목록 상단·필터 옵션용 집계 — 목적지·유형 등 “코어” 조건까지 적용한 집합에서
 * 공급사·항공사 분포를 계산한다(사이드바 필터 적용 전).
 */
import { AIRLINE_CATALOG, airlineStringMatchesCode, buildAirlineHaystack } from '@/lib/airline-catalog'
import { getBrandLabel } from '@/lib/brands'
import { OVERSEAS_SUPPLIER_LABEL } from '@/lib/normalize-supplier-origin'
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'
import { resolveProductBrandKey, type ProductBrowseFullRow } from '@/lib/products-browse-extended-filter'

export type BrandFacet = { brandKey: string; displayName: string; count: number }
export type AirlineFacet = { code: string; label: string; count: number }

/** 표시 전용 — canonical 4공급사 라벨은 `OVERSEAS_SUPPLIER_LABEL` SSOT. `yellowballoon`은 URL 필터 등 레거시 키 호환. */
const BRAND_LABEL: Record<string, string> = {
  hanatour: OVERSEAS_SUPPLIER_LABEL.hanatour,
  modetour: OVERSEAS_SUPPLIER_LABEL.modetour,
  verygoodtour: OVERSEAS_SUPPLIER_LABEL.verygoodtour,
  ybtour: OVERSEAS_SUPPLIER_LABEL.ybtour,
  yellowballoon: OVERSEAS_SUPPLIER_LABEL.ybtour,
  gyowontour: '교원투어',
  other: '기타',
}

function facetBrandDisplayName(p: ProductBrowseFullRow, brandKey: string): string {
  const db = (p.brand?.displayName ?? '').trim()
  const looksTechnical = db.length > 0 && /^[a-z][a-z0-9_-]*$/i.test(db)
  if (db && !looksTechnical) return db
  return (
    (BRAND_LABEL[brandKey] ?? getBrandLabel(brandKey) ?? formatOriginSourceForDisplay(p.originSource)) ||
    brandKey
  )
}

export function aggregateBrandFacets(rows: ProductBrowseFullRow[]): BrandFacet[] {
  const map = new Map<string, { displayName: string; count: number }>()
  for (const p of rows) {
    const k = resolveProductBrandKey(p)
    const displayName: string = facetBrandDisplayName(p, k)
    const cur = map.get(k) ?? { displayName, count: 0 }
    cur.count += 1
    map.set(k, cur)
  }
  return [...map.entries()]
    .map(([brandKey, v]) => ({ brandKey, displayName: v.displayName, count: v.count }))
    .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName, 'ko'))
}

export function aggregateAirlineFacets(rows: ProductBrowseFullRow[]): AirlineFacet[] {
  const map = new Map<string, number>()
  let otherCount = 0

  for (const p of rows) {
    const parts: string[] = []
    if (p.airline) parts.push(p.airline)
    for (const d of p.departures) {
      if (d.carrierName) parts.push(d.carrierName)
    }
    const hay = buildAirlineHaystack(parts)
    if (!hay.trim()) continue

    let matched = false
    for (const e of AIRLINE_CATALOG) {
      if (airlineStringMatchesCode(hay, e.code)) {
        map.set(e.code, (map.get(e.code) ?? 0) + 1)
        matched = true
        break
      }
    }
    if (!matched) otherCount += 1
  }

  const out: AirlineFacet[] = AIRLINE_CATALOG.map((e) => ({
    code: e.code,
    label: e.label,
    count: map.get(e.code) ?? 0,
  })).filter((x) => x.count > 0)

  if (otherCount > 0) {
    out.push({ code: 'other', label: '기타', count: otherCount })
  }
  return out
}
