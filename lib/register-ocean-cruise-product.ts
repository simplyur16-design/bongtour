/**
 * 해외 선박 크루즈(상품) vs 일정 중 유람선·강 크루즈(액티비티) 구분 SSOT.
 * 항공 패키지와 입력·검증이 다름 — 목적지·전일해상 키워드 규칙에 사용.
 * REGRESSION-FREEZE[register-ocean-cruise-product]: 선박 크루즈 dest·해상일 — manifest
 */

const ACTIVITY_CRUISE_RE =
  /(?:나일|템즈|하버|돌핀|도우|비치\s*클럽|선셋|강|유람선|디너|티\s*\(?Tea\)?)\s*크루즈|(?:크루즈)\s*(?:야경|디너|티)/i

const OCEAN_CRUISE_REGION_RE =
  /(?:서부|동부)?지중해\s*크루즈|알래스카\s*크루즈|캐리비안\s*크루즈|북유럽\s*크루즈|동아시아\s*크루즈|일본\s*크루즈|세계일주\s*크루즈/i

const OCEAN_CRUISE_SHIP_RE =
  /#?\s*코스타|로얄\s*캐리비안|프린세스(?:\s*크루즈)?|\bMSC\b|Celebrity|Norwegian|Carnival|토스카나\s*호|[가-힣A-Za-z0-9]+\s*호\s*$/i

/** 상품 단위 선박 크루즈 (나일·하버 등 일정 액티비티 제외) */
export function isOceanCruiseProductTitle(title: string | null | undefined): boolean {
  const t = String(title ?? '').trim()
  if (!t) return false
  if (OCEAN_CRUISE_REGION_RE.test(t)) return true
  if (OCEAN_CRUISE_SHIP_RE.test(t) && /크루즈/i.test(t)) return true
  if (/크루즈\s*\d+\s*개국/i.test(t)) return true
  if (ACTIVITY_CRUISE_RE.test(t) && !OCEAN_CRUISE_REGION_RE.test(t)) return false
  return false
}

/** 제목에서 선박 크루즈 목적지 (괄호 국가·권역 우선) */
export function inferOceanCruiseDestinationFromTitle(title: string | null | undefined): string {
  const t = String(title ?? '').trim()
  if (!t || !isOceanCruiseProductTitle(t)) return ''
  const paren = t.match(/\(([^)]{4,100})\)/)
  if (paren?.[1]) {
    const inner = paren[1]
      .replace(/\s*[\/／]\s*/g, ' · ')
      .replace(/\s+/g, ' ')
      .trim()
    if (inner.length >= 4 && /[가-힣A-Za-z]{2,}/.test(inner)) return inner.slice(0, 96)
  }
  if (/서부지중해/i.test(t)) return '서부지중해'
  if (/동부지중해/i.test(t)) return '동부지중해'
  if (/지중해\s*크루즈/i.test(t)) return '지중해'
  if (/알래스카\s*크루즈/i.test(t)) return '알래스카'
  if (/캐리비안\s*크루즈/i.test(t)) return '캐리비안'
  if (/북유럽\s*크루즈/i.test(t)) return '북유럽'
  if (/동아시아\s*크루즈|일본\s*크루즈/i.test(t)) return '동아시아'
  return ''
}

/** 전일 해상(기항 없음) — 랜드마크 키워드 강제 금지 */
export function isOceanCruiseAtSeaRoute(routeText: string | null | undefined): boolean {
  const t = String(routeText ?? '').trim()
  if (!t) return false
  // CMS가 「전일해상 · 발도르...」처럼 중간점을 쓰는 경우도 첫 토큰만 본다
  const first =
    t.split(/\s*[-–‑·|/]\s*/)[0]?.replace(/\s+/g, ' ').trim() ?? t
  return /^(?:전일\s*해상|해상(?:\s*일)?|at\s*sea|sea\s*day)$/iu.test(first)
}

/** 「서부」「동부」단독 — 미서부·서부지중해 잘린 값 */
export function isTruncatedCardinalRegionDestination(raw: string | null | undefined): boolean {
  return /^(?:서부|동부|남부)$/u.test(String(raw ?? '').trim())
}
