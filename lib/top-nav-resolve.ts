/**
 * 상단 메가메뉴 URL ↔ 목적지 매칭용 terms.
 * `lib/travel-landing-mega-menu-data`의 권역·국가·도시와 동일 slug로 역조회한다.
 */
import type { MegaMenuLeaf, MegaMenuRegion } from '@/lib/travel-landing-mega-menu-data'
import { OVERSEAS_MEGA_MENU_REGIONS } from '@/lib/travel-landing-mega-menu-data'

/** 메가메뉴에서 일반 권역만 (추천/자유/공급사 특수 탭 제외) */
export const TOP_NAV_MEGA_REGIONS: MegaMenuRegion[] = OVERSEAS_MEGA_MENU_REGIONS.filter(
  (r) => !r.special && r.countryGroups?.length
)

/** 영문 slug (URL에 사용) — 국가 라벨 */
const COUNTRY_SLUG_BY_LABEL: Record<string, string> = {
  서유럽: 'western-europe',
  동유럽: 'eastern-europe',
  남유럽: 'southern-europe',
  북유럽: 'northern-europe',
  중동: 'middle-east',
  아프리카: 'africa',
  태국: 'thailand',
  베트남: 'vietnam',
  필리핀: 'philippines',
  대만: 'taiwan',
  싱가포르: 'singapore',
  인도네시아: 'indonesia',
  라오스: 'laos',
  몰디브: 'maldives',
  '인도/네팔/스리랑카': 'india-nepal-sri-lanka',
  일본: 'japan',
  중국: 'china',
  '홍콩 · 마카오': 'hong-kong-macau',
  몽골: 'mongolia',
  '괌 · 사이판': 'guam-saipan',
  호주: 'australia',
  '뉴질랜드': 'new-zealand',
  하와이: 'hawaii',
  미국: 'usa',
  캐나다: 'canada',
  중남미: 'latin-america',
  '허니문 인기': 'honeymoon-picks',
  '동경/관동': 'tokyo-kanto',
  '오사카/간사이': 'osaka-kansai',
  알펜루트: 'alpine-route',
  '홍콩/마카오/심천': 'hk-mo-sz',
  '상해/북경': 'shanghai-beijing',
  '청도/위해/연태': 'qingdao-weihai-yantai',
  '계림/침주': 'guilin-chenzhou',
  '성도/구채구': 'chengdu-jiuzhaigou',
  하이난: 'hainan',
  '몽골/내몽고': 'mongolia-inner',
  말레이시아: 'malaysia',
  캄보디아: 'cambodia',
  '동남아 다국가여행': 'sea-multi',
  미서부: 'us-west',
  미동부: 'us-east',
  '중남미/멕시코': 'latin-mexico',
  '스포츠 테마': 'sports-theme',
  '국내 출발지': 'korea-departure',
  '골프 인기': 'golf-popular',
  '지중해·북유럽': 'cruise-med-north',
}

function slugFromEnglishTerm(terms: string[]): string {
  const en = terms.find((t) => /^[A-Za-z]/.test(t.trim()))
  if (en) {
    return en
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }
  return ''
}

export function countrySlugFromLabel(countryLabel: string): string {
  const mapped = COUNTRY_SLUG_BY_LABEL[countryLabel]
  if (mapped) return mapped
  return countryLabel
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function citySlugFromLeaf(leaf: MegaMenuLeaf): string {
  const fromEn = slugFromEnglishTerm(leaf.terms)
  if (fromEn) return fromEn
  return leaf.label
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]+/g, '')
}

export function buildProductsHref(opts: {
  type: string
  regionId: string
  countryLabel: string
  leaf: MegaMenuLeaf
}): string {
  const params = new URLSearchParams()
  params.set('type', opts.type)
  params.set('region', opts.regionId)
  params.set('country', countrySlugFromLabel(opts.countryLabel))
  params.set('city', citySlugFromLeaf(opts.leaf))
  return `/products?${params.toString()}`
}

export function buildProductsHrefCountryOnly(opts: {
  type: string
  regionId: string
  countryLabel: string
}): string {
  const params = new URLSearchParams()
  params.set('type', opts.type)
  params.set('region', opts.regionId)
  params.set('country', countrySlugFromLabel(opts.countryLabel))
  return `/products?${params.toString()}`
}

/**
 * URL 쿼리(region/country/city)로부터 상품 목적지 매칭용 terms.
 * city가 없으면 해당 국가 블록의 모든 도시 terms를 합친다.
 */
export function destinationTermsFromQuery(region: string | null, country: string | null, city: string | null): string[] {
  if (!region || !country) return []
  const reg = TOP_NAV_MEGA_REGIONS.find((r) => r.id === region)
  if (!reg?.countryGroups) return []
  const group = reg.countryGroups.find((g) => countrySlugFromLabel(g.countryLabel) === country)
  if (!group) return []
  if (!city) {
    return group.cities.flatMap((c) => c.terms)
  }
  const leaf = group.cities.find((c) => citySlugFromLeaf(c) === city)
  return leaf ? [...leaf.terms] : []
}
