/**
 * 등록된 국내 상품과 매칭되는 노드만 남긴 파생 트리.
 */
import { triageProductTitleForPickTab } from '@/lib/gallery-product-triage'
import { parseTravelScope } from '@/lib/product-listing-kind'
import {
  DOMESTIC_LOCATION_TREE_CLEAN,
  matchTokensForDomesticAreaShallow,
  matchTokensForDomesticLeaf,
  type DomesticAreaNode,
  type DomesticLeafNode,
  type DomesticRegionGroupNode,
} from '@/lib/domestic-location-tree'
import { productMatchesDomesticDestinationTerms, type DomesticProductMatchInput } from '@/lib/match-domestic-product'

export type { DomesticRegionGroupNode, DomesticAreaNode, DomesticLeafNode }

/**
 * 국내 허브 상품 풀.
 * 제목 휴리스틱만 쓰면 DB에 `travelScope=domestic`인데 상품명에 「제주」 등이 없으면 통째로 빠진다.
 * `travelScope`가 있으면 그것을 우선한다(반대로 `overseas`면 국내 허브에서 제외).
 */
export function filterProductsForDomesticDestinationTree<
  T extends { title: string; travelScope?: string | null } & DomesticProductMatchInput,
>(products: T[]): T[] {
  return products.filter((p) => {
    const ts = parseTravelScope(p.travelScope ?? undefined)
    if (ts === 'overseas') return false
    if (ts === 'domestic') return true
    return triageProductTitleForPickTab(p.title) === 'domestic'
  })
}

function leafHasProduct(area: DomesticAreaNode, leaf: DomesticLeafNode, products: DomesticProductMatchInput[]): boolean {
  const terms = matchTokensForDomesticLeaf(area, leaf)
  return products.some((p) => productMatchesDomesticDestinationTerms(p, terms))
}

function areaHasShallowMatch(area: DomesticAreaNode, products: DomesticProductMatchInput[]): boolean {
  const terms = matchTokensForDomesticAreaShallow(area)
  return products.some((p) => productMatchesDomesticDestinationTerms(p, terms))
}

export function buildActiveDomesticLocationTree(
  products: DomesticProductMatchInput[],
  sourceTree: DomesticRegionGroupNode[] = DOMESTIC_LOCATION_TREE_CLEAN
): DomesticRegionGroupNode[] {
  const out: DomesticRegionGroupNode[] = []

  for (const group of sourceTree) {
    const areasOut: DomesticAreaNode[] = []

    for (const area of group.areas) {
      const activeLeaves = area.children.filter((leaf) => leafHasProduct(area, leaf, products))
      const shallowOnly = areaHasShallowMatch(area, products)
      if (activeLeaves.length === 0 && !shallowOnly) continue

      areasOut.push({
        ...area,
        children: activeLeaves,
      })
    }

    if (areasOut.length === 0) continue

    out.push({
      ...group,
      areas: areasOut,
    })
  }

  return out
}
