/**
 * 해외 등록 상품을 목적지 트리 순서대로 국가(또는 권역·기타) 단위로 묶는다.
 * @see matchProductToOverseasNode
 */
import { OVERSEAS_LOCATION_TREE_CLEAN } from '@/lib/overseas-location-tree'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'
import { toOverseasMatchInput, type BrowseScoredProduct } from '@/lib/products-browse-filter'

export type OverseasProductCountrySection = {
  sectionKey: string
  groupKey: string
  groupLabel: string
  /** 섹션 제목(국가명 또는 권역·기타) */
  headingLabel: string
  items: BrowseScoredProduct[]
}

/**
 * 상품별 최적 트리 매칭으로 버킷에 넣은 뒤, SSOT 트리 순서(권역 → 국가)로 섹션 배열을 만든다.
 * 국가까지 좁히지 못한 상품은 해당 권역의 「권역명 · 기타」에 둔다.
 * 매칭 불가는 마지막에 「국가 미분류」.
 */
export function groupBrowseScoredProductsByCountry(
  scored: BrowseScoredProduct[]
): OverseasProductCountrySection[] {
  const byKey = new Map<string, BrowseScoredProduct[]>()

  const push = (key: string, row: BrowseScoredProduct) => {
    const arr = byKey.get(key) ?? []
    arr.push(row)
    byKey.set(key, arr)
  }

  for (const row of scored) {
    const m = matchProductToOverseasNode(toOverseasMatchInput(row.product))
    if (!m) {
      push('__unclassified', row)
      continue
    }
    if (m.scope === 'leaf' || m.scope === 'country') {
      push(`${m.groupKey}::${m.countryKey}`, row)
      continue
    }
    push(`group-only::${m.groupKey}`, row)
  }

  const sections: OverseasProductCountrySection[] = []

  for (const g of OVERSEAS_LOCATION_TREE_CLEAN) {
    for (const c of g.countries) {
      const key = `${g.groupKey}::${c.countryKey}`
      const items = byKey.get(key)
      if (items?.length) {
        sections.push({
          sectionKey: key,
          groupKey: g.groupKey,
          groupLabel: g.groupLabel,
          headingLabel: c.countryLabel,
          items,
        })
      }
    }
    const gk = `group-only::${g.groupKey}`
    const groupOnly = byKey.get(gk)
    if (groupOnly?.length) {
      sections.push({
        sectionKey: gk,
        groupKey: g.groupKey,
        groupLabel: g.groupLabel,
        headingLabel: `${g.groupLabel} · 기타`,
        items: groupOnly,
      })
    }
  }

  const un = byKey.get('__unclassified')
  if (un?.length) {
    sections.push({
      sectionKey: '__unclassified',
      groupKey: '__unclassified',
      groupLabel: '기타',
      headingLabel: '국가 미분류',
      items: un,
    })
  }

  return sections
}
