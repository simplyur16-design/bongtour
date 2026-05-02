/**
 * 해외 목적지 URL 슬러그 — 메가메뉴·browse 쿼리 공통.
 * (통합 트리·top-nav-resolve에서 공유)
 */

/** 영문 slug (URL에 사용) — 국가(또는 공급사식 권역) 라벨 */
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

export function citySlugFromTermsAndLabel(label: string, terms: string[]): string {
  const fromEn = slugFromEnglishTerm(terms)
  if (fromEn) return fromEn
  return label
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9가-힣-]+/g, '')
}
