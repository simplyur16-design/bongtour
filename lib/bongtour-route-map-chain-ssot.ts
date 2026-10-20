/**
 * 동선지도 탭용 도시 체인 SSOT — 지리적 좌표 없이 순서 라벨만.
 * 등록 상품이면 id/slug 무관하게 동일 규칙으로 추출 (상품 특화 분기 없음).
 * REGRESSION-FREEZE[bongtour-route-map-chain-ssot]: buildBongtourRouteMapChain — manifest
 */

export const BONGTOUR_ROUTE_MAP_CHAIN_VERSION = 'v1-2026-10-15'

/** 스토리보드·Gemini 입력 상한 — 과다 노드는 JSON 절단(MAX_TOKENS)·레이아웃 붕괴 */
export const BONGTOUR_ROUTE_MAP_MAX_CITIES = 6

/** 허브·이동만 있는 세그먼트는 체인에서 제외 */
const HUB_ONLY = new Set([
  '인천',
  '김포',
  '부산',
  '대구',
  '제주',
  '청주',
  '공항',
  '출발',
  '도착',
  '이동',
  '경유',
  '호텔',
  '리조트',
  '자유',
  '선택',
  '귀국',
  '기내',
  '기내박',
  '선내',
])

export type BongtourRouteMapDay = {
  day?: number | null
  title?: string | null
  routeText?: string | null
}

export type BongtourRouteMapProductLike = {
  schedule?: readonly BongtourRouteMapDay[] | null
  destination?: string | null
  destinationRaw?: string | null
}

export type BongtourRouteMapChain = {
  cities: string[]
  /** 캡 전 원시 후보 (디버그) */
  citiesRaw: string[]
  /** UI: 0–1이면 탭 숨김 또는 플레이스홀더 */
  showMapTab: boolean
}

function splitSegments(raw: string): string[] {
  return raw
    .split(/\s*[-–—>~→／/|,·]\s*/u)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

/** 일정 제목 꼬리·괄호 제거 → 도시성 라벨 */
export function normalizeBongtourRouteMapCityLabel(raw: string): string {
  let t = raw.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!t) return ''
  t = t.replace(/\s*\([^)]*\)\s*$/u, '').trim()
  t = t.replace(
    /\s*(야경|시내\s*관광|시내|관광|출발|도착|향발|경유|자유시간|선택관광|등)\s*$/u,
    ''
  )
  t = t.replace(/(수도원|대성당|양조장|박물관|미술관|맥주|록|식물원)$/u, '')
  t = t.replace(/\s+/g, ' ').trim()
  return t.slice(0, 16)
}

function isHubOnly(label: string): boolean {
  const t = label.trim()
  if (!t) return true
  if (HUB_ONLY.has(t)) return true
  if (/공항|호텔|리조트|자유시간|선택관광|이동일|숙박\s*없음|귀국|기내박|인솔자\s*:/.test(t)) {
    return true
  }
  if (/^[A-Za-z]$/.test(t)) return true
  return false
}

/** 명소·광장만 있고 도시가 아닌 토큰 (도시명 단독은 유지) */
function isPoiNotCity(label: string): boolean {
  const t = label.trim()
  if (t.length <= 2) return false
  if (t.length > 12) return true
  if (
    /(광장|왕궁|궁전|요새|타워|전망대|거리|입구|별장|온천욕|헬기|크루즈|카지노|사원|교회|그린|아트|맥주)$/u.test(
      t
    ) ||
    /^(세계|최고|낭만|영웅|붉은|노란|팔레스|갈레\s*페이스)/u.test(t)
  ) {
    return true
  }
  return false
}

function acceptCityLabel(raw: string): string | null {
  const t = normalizeBongtourRouteMapCityLabel(raw)
  if (!t || isHubOnly(t) || isPoiNotCity(t)) return null
  return t
}

/** 일차 title/route에서 도시성 토큰들 (허브·POI 제외, 일차 내 등장 순) */
function citiesFromDay(day: BongtourRouteMapDay): string[] {
  const out: string[] = []
  const push = (raw: string) => {
    const c = acceptCityLabel(raw)
    if (c) out.push(c)
  }

  const route = String(day.routeText || '').trim()
  if (route) {
    for (const seg of splitSegments(route)) push(seg)
  }
  if (out.length === 0) {
    const title = String(day.title || '').trim()
    if (title && !/일차|일정|안내/.test(title)) {
      for (const seg of splitSegments(title)) push(seg)
    }
  }
  return out
}

/**
 * 일정 일차 순서로 도시 라벨 체인. 전역 중복 제거(첫 등장만) · 상한 캡.
 * 좌표 DB 없음 → 스토리보드·Gemini 입력.
 */
export function buildBongtourRouteMapChain(
  product: BongtourRouteMapProductLike | null | undefined
): BongtourRouteMapChain {
  const days = product?.schedule ?? []
  const citiesRaw: string[] = []
  const seen = new Set<string>()

  for (const day of days) {
    for (const c of citiesFromDay(day)) {
      if (seen.has(c)) continue
      seen.add(c)
      citiesRaw.push(c)
    }
  }

  if (citiesRaw.length === 0) {
    const dest = String(product?.destination || product?.destinationRaw || '')
      .split(/[,，/·]/u)[0]
      ?.trim()
    const c = dest ? acceptCityLabel(dest) : null
    if (c) citiesRaw.push(c)
  }

  const cities = citiesRaw.slice(0, BONGTOUR_ROUTE_MAP_MAX_CITIES)
  return {
    cities,
    citiesRaw,
    showMapTab: cities.length >= 2,
  }
}
