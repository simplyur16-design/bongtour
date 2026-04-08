import brandsJson from './brands.json'

export type BrandInfo = {
  name: string
  logoUrl: string
  officialSite: string
  /** 본사 상품 URL. {code}, {group} 치환. 스크래퍼용 */
  productUrlTemplate?: string
}

const BRANDS = brandsJson as BrandInfo[]

/** lib/brands.json 기준 30여 개 업체. 상세페이지에서 brandName에 맞춰 로고·면피·공식사이트 동적 출력 */
export function getBrandByName(name: string | null | undefined): BrandInfo | undefined {
  if (!name?.trim()) return undefined
  const n = name.trim()
  return BRANDS.find((b) => b.name === n || b.name.includes(n) || n.includes(b.name))
}

export function getAllBrandNames(): string[] {
  return BRANDS.map((b) => b.name).filter((n) => n !== '기타')
}

/** 법적 면피 문구 (고정) — 업체명만 치환 */
export function getCommonDisclaimer(organizerName: string | null | undefined): string {
  const name = organizerName?.trim() || '해당 여행사'
  return `본 상품은 ${name} 주관 상품이며, 실제 행사는 해당 여행사 및 현지 랜드사 규정을 따릅니다. Bong투어는 상품 정보 검수 및 예약 대행 서비스를 제공합니다.`
}

/**
 * 본사 브랜드 선택 옵션 (레거시/폼용).
 */
export const HQ_BRANDS = [
  { value: 'hanatour', label: '하나투어' },
  { value: 'modetour', label: '모두투어' },
  { value: 'ybtour', label: '노랑풍선' },
  { value: 'verygoodtour', label: '참좋은여행사' },
  { value: 'gyowontour', label: '교원투어' },
  { value: 'other', label: '기타' },
] as const

export type HqBrandKey = (typeof HQ_BRANDS)[number]['value']

export function getBrandLabel(key: string | null | undefined): string {
  if (!key) return ''
  const k = key.trim().toLowerCase()
  if (k === 'verygoodtour') return '참좋은여행사'
  if (k === 'yellowballoon' || k === 'ybtour') return '노랑풍선'
  const found = HQ_BRANDS.find((b) => b.value === key || (k === 'yellowballoon' && b.value === 'ybtour'))
  return found ? found.label : key
}

/** 로고 이미지 경로. /public/logos/ 기준. '기타'는 로고 없음 → null */
export function getBrandLogoPath(key: string | null | undefined): string | null {
  if (!key || key === 'other') return null
  const k = key.trim().toLowerCase()
  const file = k === 'ybtour' || k === 'yellowballoon' ? 'yellowballoon' : key
  return `/logos/${file}.png`
}

/** 상세페이지 하단 면피 문구 (자동 생성) */
export function getBrandDisclaimer(key: string | null | undefined): string {
  const label = getBrandLabel(key) || '제휴사'
  return `본 상품은 ${label}의 상품이며, Bong투어는 해당 상품의 독소조항(쇼핑, 옵션 등)을 사전 검수하여 안내해 드립니다.`
}

/** 업체명(표시명) → 로고. brands.json에 없을 때 fallback (레거시) */
const ORGANIZER_NAME_TO_LOGO_FALLBACK: Record<string, string> = {
  하나투어: '/logos/hanatour.png',
  모두투어: '/logos/modetour.png',
  노랑풍선: '/logos/yellowballoon.png',
  참좋은여행: '/logos/verygoodtour.png',
  참좋은여행사: '/logos/verygoodtour.png',
  교원투어: '/logos/gyowontour.png',
}

export function getLogoPathForDisplayName(organizerName: string | null | undefined): string | null {
  const fromJson = getBrandByName(organizerName)?.logoUrl
  if (fromJson?.trim()) return fromJson.trim()
  if (!organizerName?.trim()) return null
  return ORGANIZER_NAME_TO_LOGO_FALLBACK[organizerName.trim()] ?? null
}

/**
 * 브랜드별 AI(Gemini) 추출 가이드 — 해당 여행사 말투·양식에 맞춰 추출 정확도 향상.
 * 스크래핑 로봇은 Product.brand_name을 보고 어느 본사 사이트로 접속할지 판단할 수 있음.
 */
export function getBrandPromptHint(brandKey: string | null | undefined): string {
  if (!brandKey) return ''
  const ybtourBrandHint = `[브랜드: 노랑풍선]
- 노랑풍선 특유의 일정·옵션 표기 방식을 참고하여 가이드경비, 쇼핑 횟수/품목, 현지옵션(원문 표기)을 그대로 추출하세요.`
  const hints: Record<string, string> = {
    hanatour: `[브랜드: 하나투어]
- 하나투어는 "가이드/기사 경비" 또는 "가이드·기사 경비"로 표기하는 경우가 많습니다. 이는 guideFeeNote(가이드경비 안내)로 추출하세요.
- 일정표·가격표 양식이 하나투어 패턴이므로 해당 형식에 맞춰 day, title, items와 dailyPrices를 채우세요.`,
    modetour: `[브랜드: 모두투어]
- 모두투어는 "가이드 경비"로 표기하는 경우가 많습니다. 기사 경비가 따로 있으면 별도 문구로 나올 수 있으니 원문을 확인해 guideFeeNote에 반영하세요.
- 일정표·현지옵션(공급사는 '선택관광' 등으로 표기할 수 있음) 표기가 모두투어 형식이므로 그에 맞춰 추출하세요.`,
    ybtour: ybtourBrandHint,
    yellowballoon: ybtourBrandHint,
    verygoodtour: `[브랜드: 참좋은여행사]
- 참좋은여행사 상품 상세 양식(가이드경비, 쇼핑, 현지옵션 표기)에 맞춰 필드를 채우세요.`,
    gyowontour: `[브랜드: 교원투어]
- 교원투어의 상품 페이지 말투와 일정표·가격표 양식을 참고하여 가이드경비, 쇼핑, 현지옵션, 일정을 추출하세요.`,
    other: `[브랜드: 기타]
- 원문에 나온 표현(가이드경비·쇼핑·현지옵션·일정)을 그대로 추출하세요.`,
  }
  return hints[brandKey] ?? ''
}
