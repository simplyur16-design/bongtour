/**
 * 등록된 해외 상품과 매칭되는 목적지 노드만 남긴 파생 트리.
 * 원본 OVERSEAS_LOCATION_TREE / OVERSEAS_LOCATION_TREE_CLEAN 은 SSOT로 유지.
 */
import { triageProductTitleForPickTab } from '@/lib/gallery-product-triage'
import { parseTravelScope } from '@/lib/product-listing-kind'
import { productMatchesOverseasDestinationTerms, type OverseasProductMatchInput } from '@/lib/match-overseas-product'
import {
  OVERSEAS_LOCATION_TREE_CLEAN,
  matchTokensForCountryShallow,
  matchTokensForLeaf,
  type OverseasCountryNode,
  type OverseasLeafNode,
  type OverseasRegionGroupNode,
} from '@/lib/overseas-location-tree'

export type { OverseasRegionGroupNode, OverseasCountryNode, OverseasLeafNode }

/**
 * 해외 허브 상품 풀.
 * 제목만 보면 `travelScope=overseas`인 패키지가 국내 키워드 없이 빠질 수 있어 DB 플래그를 우선한다.
 * `travelScope=domestic`이면 해외 허브에서 제외.
 */
export function filterProductsForOverseasDestinationTree<
  T extends { title: string; travelScope?: string | null } & OverseasProductMatchInput,
>(products: T[]): T[] {
  return products.filter((p) => {
    const ts = parseTravelScope(p.travelScope ?? undefined)
    if (ts === 'domestic') return false
    if (ts === 'overseas') return true
    const tab = triageProductTitleForPickTab(p.title)
    return tab === 'overseas_package' || tab === 'freeform'
  })
}

function leafHasMatchingProduct(
  country: OverseasCountryNode,
  leaf: OverseasLeafNode,
  products: OverseasProductMatchInput[]
): boolean {
  const terms = matchTokensForLeaf(country, leaf)
  return products.some((p) => productMatchesOverseasDestinationTerms(p, terms))
}

function countryHasShallowMatch(country: OverseasCountryNode, products: OverseasProductMatchInput[]): boolean {
  const terms = matchTokensForCountryShallow(country)
  return products.some((p) => productMatchesOverseasDestinationTerms(p, terms))
}

/**
 * leaf: 매칭 상품이 1건 이상일 때만 노출.
 * country: 활성 leaf가 있거나, 국가 shallow 토큰만 맞는 상품이 있을 때 노출(이때 leaf 칩은 비어 있을 수 있음 → 「국가 전체」만).
 * group: 활성 country가 1개 이상일 때만 노출.
 */
export function buildActiveOverseasLocationTree(
  products: OverseasProductMatchInput[],
  sourceTree: OverseasRegionGroupNode[] = OVERSEAS_LOCATION_TREE_CLEAN
): OverseasRegionGroupNode[] {
  const out: OverseasRegionGroupNode[] = []

  for (const group of sourceTree) {
    const countriesOut: OverseasCountryNode[] = []

    for (const country of group.countries) {
      const activeLeaves = country.children.filter((leaf) => leafHasMatchingProduct(country, leaf, products))
      const shallowOnly = countryHasShallowMatch(country, products)
      if (activeLeaves.length === 0 && !shallowOnly) continue

      countriesOut.push({
        ...country,
        children: activeLeaves,
      })
    }

    if (countriesOut.length === 0) continue

    out.push({
      ...group,
      countries: countriesOut,
    })
  }

  return out
}
