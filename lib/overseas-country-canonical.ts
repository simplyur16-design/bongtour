/**
 * 해외 상품 country/city SSOT 보조 — 트리 라벨은 메가메뉴용이라 Product 컬럼에 그대로 쓰면 안 됨.
 * `lib/overseas-location-tree.data.ts`는 수정하지 않고, 여기서만 분류·캐논 한글을 유도한다.
 */
import { OVERSEAS_LOCATION_TREE_CLEAN } from '@/lib/overseas-location-tree'
import type { OverseasCountryNode, OverseasLeafNode, OverseasRegionGroupNode } from '@/lib/overseas-location-tree.types'

/** browse/운영자 혼선 방지: dbCountryValues에 들어가 있어도 Product.country로 쓰면 안 되는 거시 권역 */
const DB_COUNTRY_VALUE_IGNORE = new Set([
  '동유럽',
  '북유럽',
  '서유럽',
  '남유럽',
  '중유럽',
  '동남아',
  '동남아시아',
  '중동',
  '중동·아프리카',
  '아프리카',
  '북미',
  '남미',
  '남태평양',
  '대양주',
  '오세아니아',
  '중앙아시아',
  '중국권',
  '남태평양·대양주',
  '유럽',
  '아시아',
])

export type TreeCountryClass = 'single_sovereign' | 'multi_country' | 'region_menu' | 'theme_or_other'
export type TreeCityClass = 'single_city' | 'multi_city' | 'country_wide' | 'theme_route'

export type CountryKeyMeta = {
  countryKey: string
  treeLabel: string
  class: TreeCountryClass
  /** 단일 국가만 — multi/테마는 null */
  canonicalCountryKo: string | null
}

export type NodeKeyMeta = {
  nodeKey: string
  countryKey: string
  treeLabel: string
  class: TreeCityClass
  canonicalCityKo: string | null
  /** 한글 별칭·라벨 */
  aliasHangul: string[]
  /** 소문자 로마자 토큰 (aliases·nodeKey에서 추출) */
  aliasAsciiLower: string[]
}

function splitLabelSegments(label: string): string[] {
  return label
    .split(/\s*[·\/]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 국가 노드: · / 로 묶인 복수 국가명 */
export function isMultiCountryTreeLabel(label: string): boolean {
  return splitLabelSegments(label).length > 1
}

/** 리프: · / 로 묶인 복수 도시·권역 */
export function isMultiCityTreeLabel(label: string): boolean {
  return splitLabelSegments(label).length > 1
}

function useDbCountryForRegionMenu(label: string, db: string | undefined): db is string {
  if (!db || DB_COUNTRY_VALUE_IGNORE.has(db)) return false
  if (db === label.trim()) return false
  return (
    /주요|\(.+\)|간사이|간토|규슈|홋카이도|시코쿠|주고쿠|중부|호쿠리쿠|도호쿠|오키나와|선박|내몽|몽골|주요\s*도시|다국가|연계|성지|트레킹|발칸/i.test(
      label,
    ) || /일본\(/.test(label)
  )
}

function classifyCountryNode(c: OverseasCountryNode): CountryKeyMeta {
  const treeLabel = c.countryLabel.trim()
  if (/\d+국/.test(treeLabel) || /코카서스.*국/.test(treeLabel)) {
    return { countryKey: c.countryKey, treeLabel, class: 'multi_country', canonicalCountryKo: null }
  }
  if (/^미국\s+(서부|동부)$/.test(treeLabel)) {
    return { countryKey: c.countryKey, treeLabel, class: 'region_menu', canonicalCountryKo: '미국' }
  }
  if (c.children.length > 0 && c.children.every((ch) => ch.nodeType === 'theme' || ch.nodeType === 'route')) {
    return {
      countryKey: c.countryKey,
      treeLabel,
      class: 'theme_or_other',
      canonicalCountryKo: null,
    }
  }
  if (c.children.some((ch) => ch.nodeType === 'theme') && /성지|순례|트레킹|다국가/i.test(treeLabel)) {
    return {
      countryKey: c.countryKey,
      treeLabel,
      class: 'theme_or_other',
      canonicalCountryKo: null,
    }
  }
  if (isMultiCountryTreeLabel(treeLabel)) {
    return { countryKey: c.countryKey, treeLabel, class: 'multi_country', canonicalCountryKo: null }
  }
  const dbv = c.dbCountryValues?.find((x) => x && !DB_COUNTRY_VALUE_IGNORE.has(x))
  if (dbv && useDbCountryForRegionMenu(treeLabel, dbv)) {
    return {
      countryKey: c.countryKey,
      treeLabel,
      class: 'region_menu',
      canonicalCountryKo: dbv,
    }
  }
  return {
    countryKey: c.countryKey,
    treeLabel,
    class: 'single_sovereign',
    canonicalCountryKo: treeLabel,
  }
}

function collectAliasHangul(leaf: OverseasLeafNode): string[] {
  const out: string[] = []
  const push = (s: string | undefined) => {
    const t = (s ?? '').trim()
    if (t && /[가-힣]/.test(t) && !out.includes(t)) out.push(t)
  }
  push(leaf.nodeLabel)
  leaf.aliases?.forEach(push)
  leaf.supplierKeywords?.forEach(push)
  leaf.supplierOnlyLabels?.forEach(push)
  if (leaf.dbCityValue) push(leaf.dbCityValue)
  return out
}

function collectAliasAsciiLower(leaf: OverseasLeafNode): string[] {
  const out: string[] = []
  const add = (s: string | undefined) => {
    const t = (s ?? '').trim().toLowerCase()
    if (!t || !/[a-z]/.test(t)) return
    for (const w of t.split(/[^a-z0-9]+/)) {
      if (w.length >= 2) out.push(w)
    }
  }
  add(leaf.nodeKey)
  leaf.aliases?.forEach(add)
  leaf.supplierKeywords?.forEach(add)
  leaf.supplierOnlyLabels?.forEach(add)
  return [...new Set(out)]
}

/** multi_country 국가 노드 바로 아래 "국가 단위" 리프(노르웨이, 조지아 등) — city SSOT 아님 */
const MULTI_PARENT_SUBCOUNTRY_BUCKET_NODE_KEYS = new Set([
  'norway',
  'finland',
  'denmark',
  'sweden',
  'iceland',
  'baltic3',
  'georgia',
  'azerbaijan',
  'armenia',
  'india',
  'nepal',
  'srilanka',
  'bhutan',
  'brunei',
  'kenya',
  'tanzania',
  'south-africa',
  'mauritius',
  'jordan',
  'saudi',
  'oman',
  'qatar',
  'tunisia',
])

function classifyLeaf(
  leaf: OverseasLeafNode,
  parentCanonicalCountry: string | null,
  parentCountryClass: TreeCountryClass,
  multiCountrySegments: string[],
): NodeKeyMeta {
  const treeLabel = leaf.nodeLabel.trim()
  const aliasHangul = collectAliasHangul(leaf)
  const aliasAsciiLower = collectAliasAsciiLower(leaf)

  if (
    parentCountryClass === 'multi_country' &&
    MULTI_PARENT_SUBCOUNTRY_BUCKET_NODE_KEYS.has(leaf.nodeKey)
  ) {
    return {
      nodeKey: leaf.nodeKey,
      countryKey: '',
      treeLabel,
      class: 'country_wide',
      canonicalCityKo: null,
      aliasHangul,
      aliasAsciiLower,
    }
  }

  if (parentCountryClass === 'multi_country' && multiCountrySegments.includes(treeLabel)) {
    return {
      nodeKey: leaf.nodeKey,
      countryKey: '',
      treeLabel,
      class: 'country_wide',
      canonicalCityKo: null,
      aliasHangul,
      aliasAsciiLower,
    }
  }

  if (leaf.nodeType === 'theme' || leaf.nodeType === 'route') {
    return {
      nodeKey: leaf.nodeKey,
      countryKey: '',
      treeLabel,
      class: 'theme_route',
      canonicalCityKo: null,
      aliasHangul,
      aliasAsciiLower,
    }
  }
  if (isMultiCityTreeLabel(treeLabel)) {
    return {
      nodeKey: leaf.nodeKey,
      countryKey: '',
      treeLabel,
      class: 'multi_city',
      canonicalCityKo: null,
      aliasHangul,
      aliasAsciiLower,
    }
  }
  if (parentCanonicalCountry && treeLabel === parentCanonicalCountry) {
    return {
      nodeKey: leaf.nodeKey,
      countryKey: '',
      treeLabel,
      class: 'country_wide',
      canonicalCityKo: null,
      aliasHangul,
      aliasAsciiLower,
    }
  }
  if (leaf.dbCityValue?.trim()) {
    return {
      nodeKey: leaf.nodeKey,
      countryKey: '',
      treeLabel,
      class: 'single_city',
      canonicalCityKo: leaf.dbCityValue.trim(),
      aliasHangul,
      aliasAsciiLower,
    }
  }
  return {
    nodeKey: leaf.nodeKey,
    countryKey: '',
    treeLabel,
    class: 'single_city',
    canonicalCityKo: treeLabel,
    aliasHangul,
    aliasAsciiLower,
  }
}

function walkTree(): { countries: CountryKeyMeta[]; nodes: NodeKeyMeta[] } {
  const countries: CountryKeyMeta[] = []
  const nodes: NodeKeyMeta[] = []

  const visitGroup = (g: OverseasRegionGroupNode) => {
    for (const c of g.countries) {
      const cm = classifyCountryNode(c)
      countries.push(cm)
      const parentKo = cm.canonicalCountryKo
      const multiSegments = cm.class === 'multi_country' ? splitLabelSegments(cm.treeLabel) : []
      for (const leaf of c.children) {
        const nm = classifyLeaf(leaf, parentKo, cm.class, multiSegments)
        nodes.push({
          ...nm,
          countryKey: c.countryKey,
        })
      }
    }
  }

  for (const g of OVERSEAS_LOCATION_TREE_CLEAN) visitGroup(g)
  return { countries, nodes }
}

const _cache = (() => {
  const { countries, nodes } = walkTree()
  const countryByKey = new Map(countries.map((c) => [c.countryKey, c]))
  const nodeByKey = new Map(nodes.map((n) => [n.nodeKey, n]))
  return { countries, nodes, countryByKey, nodeByKey }
})()

export function getTreeLabelClassificationStats(): {
  country: Record<TreeCountryClass, number>
  city: Record<TreeCityClass, number>
  singleCountryMappingCount: number
  singleCityMappingCount: number
} {
  const country: Record<TreeCountryClass, number> = {
    single_sovereign: 0,
    multi_country: 0,
    region_menu: 0,
    theme_or_other: 0,
  }
  for (const c of _cache.countries) country[c.class]++

  const city: Record<TreeCityClass, number> = {
    single_city: 0,
    multi_city: 0,
    country_wide: 0,
    theme_route: 0,
  }
  for (const n of _cache.nodes) city[n.class]++

  return {
    country,
    city,
    singleCountryMappingCount: _cache.countries.filter((c) => c.canonicalCountryKo != null).length,
    singleCityMappingCount: _cache.nodes.filter((n) => n.canonicalCityKo != null).length,
  }
}

export function getCountryKeyMeta(countryKey: string): CountryKeyMeta | undefined {
  return _cache.countryByKey.get(countryKey)
}

export function getNodeKeyMeta(nodeKey: string): NodeKeyMeta | undefined {
  return _cache.nodeByKey.get(nodeKey)
}

/**
 * Product.country 후보: 단일 국가만 반환. multi/테마/키 없음 → null.
 */
export function canonicalCountryKoForProduct(countryKey: string | null | undefined): string | null {
  const ck = (countryKey ?? '').trim()
  if (!ck) return null
  const m = _cache.countryByKey.get(ck)
  return m?.canonicalCountryKo ?? null
}

/**
 * Product.city 후보: 단일 도시만. multi/국가전역 리프/테마 → null (ASCII 보정은 hangulCityFromAsciiForNode).
 */
export function canonicalCityKoForProduct(nodeKey: string | null | undefined): string | null {
  const nk = (nodeKey ?? '').trim()
  if (!nk) return null
  const m = _cache.nodeByKey.get(nk)
  if (!m || m.class !== 'single_city') return null
  return m.canonicalCityKo
}

/** 트리 alias에 없는 소수 로마자 도시 (리프별 보강) */
const NODE_ASCII_TO_HANGUL: Record<string, Record<string, string>> = {
  india: { delhi: '델리' },
}

/**
 * ASCII city 슬러그 → 리프 alias 중 한글 (country_wide·multi_city에서도, 로마 별칭이 있으면).
 */
export function hangulCityFromAsciiForNode(nodeKey: string | null | undefined, asciiCity: string | null | undefined): string | null {
  const m = _cache.nodeByKey.get((nodeKey ?? '').trim())
  if (!m) return null
  const raw = (asciiCity ?? '').trim()
  if (!raw || !isLikelyAsciiSlug(raw)) return null
  const lower = raw.toLowerCase()
  const patched = NODE_ASCII_TO_HANGUL[m.nodeKey]?.[lower]
  if (patched) return patched
  if (m.class === 'country_wide') return null
  if (!m.aliasAsciiLower.includes(lower)) return null

  if (m.class === 'single_city' && m.canonicalCityKo) return m.canonicalCityKo

  const hangulCandidates = m.aliasHangul.filter((h) => /[가-힣]/.test(h) && !isMultiCityTreeLabel(h))
  if (hangulCandidates.length === 1) return hangulCandidates[0]!

  const preferred: Record<string, string> = {
    paris: '파리',
    qingdao: '칭다오',
    shizuoka: '시즈오카',
  }
  if (preferred[lower]) {
    if (hangulCandidates.includes(preferred[lower]!)) return preferred[lower]!
    if (lower === 'qingdao' && hangulCandidates.includes('청도')) return '칭다오'
  }

  const twoChar = hangulCandidates.filter((h) => h.length <= 4)
  return twoChar[0] ?? hangulCandidates[0] ?? null
}

const ASCII_SLUG = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/i
function isLikelyAsciiSlug(s: string): boolean {
  return ASCII_SLUG.test(s.trim())
}

export function isLikelyAsciiLocationSlug(s: string | null | undefined): boolean {
  if (!s || !s.trim()) return false
  return ASCII_SLUG.test(s.trim())
}

/** DB country 문자열이 트리의 다국가 라벨과 동일한지 */
export function countryTextMatchesMultiCountryLabel(countryKey: string | null | undefined, countryText: string | null | undefined): boolean {
  const m = getCountryKeyMeta((countryKey ?? '').trim())
  if (!m || m.class !== 'multi_country') return false
  return (countryText ?? '').trim() === m.treeLabel
}

/** DB city가 다도시·복합 리프 라벨과 동일 */
export function cityTextMatchesMultiCityLabel(nodeKey: string | null | undefined, cityText: string | null | undefined): boolean {
  const meta = getNodeKeyMeta((nodeKey ?? '').trim())
  if (!meta || meta.class !== 'multi_city') return false
  return (cityText ?? '').trim() === meta.treeLabel
}
