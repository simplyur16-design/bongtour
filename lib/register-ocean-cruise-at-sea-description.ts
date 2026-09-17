/**
 * 선박 크루즈 전일해상 — description·route SSOT.
 * 랜드마크「둘러봅니다」합성 금지. 공급사 본문·포함문구에 있는 선상 액티비티만 반영.
 * REGRESSION-FREEZE[register-ocean-cruise-at-sea-description]: 전일해상 선상 액티 description — manifest
 */
import { isOceanCruiseAtSeaRoute } from '@/lib/register-ocean-cruise-product'

const LAND_TOUR_AT_SEA_RE =
  /전일\s*해상(?:을|에서)?\s*둘러|전일\s*해상에서\s*주변을\s*이어서\s*둘러/i

const AT_SEA_CORE_RE = /선상|선내|항해|해상|크루즈|on\s*board|at\s*sea/i

const ONBOARD_ACT_SPECS = [
  { re: /무대\s*공연|공연|쇼우|\b쇼\b|theater|show/i, label: '공연' },
  { re: /스파|\bspa\b/i, label: '스파' },
  { re: /카지노|casino/i, label: '카지노' },
  { re: /면세점|duty\s*free/i, label: '면세점' },
  { re: /뷔페|buffet|정찬/i, label: '선내 식사' },
  { re: /수영장|풀장|\bpool\b/i, label: '수영장' },
  { re: /헬스|피트니스|gym|fitness/i, label: '피트니스' },
  { re: /키즈\s*클럽|kids?\s*club/i, label: '키즈클럽' },
  { re: /선상\s*프로그램|선내\s*(?:시설|프로그램)|온보드/i, label: '선상 프로그램' },
] as const

/** 전일해상 route — CMS 잘림·전날 잔여 세그먼트 제거 */
export function normalizeOceanCruiseAtSeaRouteText(
  routeText: string | null | undefined,
): string {
  const raw = String(routeText ?? '').trim()
  if (!raw) return raw
  if (!isOceanCruiseAtSeaRoute(raw)) return raw
  return '전일해상'
}

export function normalizeOceanCruiseAtSeaDayTitle(
  title: string | null | undefined,
  routeText?: string | null,
): string {
  const t = String(title ?? '').trim()
  const route = String(routeText ?? '').trim()
  if (!t && !route) return t
  if (!isOceanCruiseAtSeaRoute(route || t) && !/전일\s*해상/i.test(t)) return t
  return '전일해상'
}

export function extractOceanCruiseOnboardActivityLabels(
  haystack: string | null | undefined,
): string[] {
  const hay = String(haystack ?? '')
  if (!hay.trim()) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const spec of ONBOARD_ACT_SPECS) {
    if (!spec.re.test(hay)) continue
    if (seen.has(spec.label)) continue
    seen.add(spec.label)
    out.push(spec.label)
  }
  return out
}

/** 「전일해상을 둘러봅니다」류 — 랜드마크 합성 실패 */
export function isOceanCruiseAtSeaLandTourDescription(
  description: string | null | undefined,
): boolean {
  return LAND_TOUR_AT_SEA_RE.test(String(description ?? ''))
}

export function isValidOceanCruiseAtSeaDescription(
  description: string | null | undefined,
): boolean {
  const t = String(description ?? '').trim()
  if (t.length < 20) return false
  if (isOceanCruiseAtSeaLandTourDescription(t)) return false
  return AT_SEA_CORE_RE.test(t)
}

function extractSupplierAtSeaParagraph(hay: string): string | null {
  const m = hay.match(
    /전일\s*해상[\s\S]{0,120}?(?:선상\s*프로그램|선내\s*시설|공연\s*\/\s*행사|무대\s*공연)[\s\S]{0,500}/i,
  )
  if (!m?.[0]) return null
  let t = m[0]
    .replace(/내용\s*전체\s*열기/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|nbsp|quot|#39);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  // HTML/네비·일차 잔여 잘라내기
  t = t.split(/(?:호텔\s*코스타|식사\s*조식|\d+일차|선택관광)/i)[0]?.trim() ?? t
  t = t.replace(/^전일\s*해상\s*/i, '전일해상. ').replace(/\s+/g, ' ').trim()
  if (t.length < 40 || t.length > 420) return null
  if (!AT_SEA_CORE_RE.test(t)) return null
  if (!/[.。]|다\./.test(t) && t.length < 60) return null
  if (!/[.。!?]$/.test(t)) t = `${t.replace(/[.。,\s]+$/u, '')}.`
  return t.slice(0, 420)
}

/**
 * 전일해상 description — 공급사 본문 우선, 없으면 증거 기반 템플릿.
 * REGRESSION-FREEZE[register-ocean-cruise-at-sea-description]: 전일해상 선상 액티 description — manifest
 */
export function composeOceanCruiseAtSeaDescription(opts: {
  haystack?: string | null
  existingDescription?: string | null
  routeText?: string | null
  title?: string | null
}): string {
  const existing = String(opts.existingDescription ?? '').trim()
  if (isValidOceanCruiseAtSeaDescription(existing) && !/내용\s*전체\s*열기/i.test(existing)) {
    return existing
  }

  const hay = [opts.haystack, opts.title, opts.routeText, existing].filter(Boolean).join('\n')

  const acts = extractOceanCruiseOnboardActivityLabels(hay).filter((a) => a !== '선상 프로그램')
  const lead = '선상에서 전일 항해하며 여유로운 하루를 보냅니다.'
  // 증거 템플릿을 우선 — raw HTML 발췌는 UI 잔여가 섞이기 쉬움
  if (acts.length >= 2) {
    return `${lead} ${acts.slice(0, 4).join('·')} 등 선내 시설과 프로그램을 이용할 수 있습니다. 일부는 유료일 수 있습니다.`
  }
  if (acts.length === 1) {
    return `${lead} ${acts[0]} 등 선내 시설을 이용하며 자유롭게 시간을 보냅니다.`
  }
  if (/선상\s*프로그램|선내\s*시설/i.test(hay)) {
    return `${lead} 선상 프로그램과 선내 시설을 이용하며 자유롭게 시간을 보냅니다.`
  }

  const fromSupplier = extractSupplierAtSeaParagraph(hay)
  if (
    fromSupplier &&
    isValidOceanCruiseAtSeaDescription(fromSupplier) &&
    !/내용\s*전체\s*열기/i.test(fromSupplier)
  ) {
    return fromSupplier
  }

  return `${lead} 선내 시설을 이용하거나 선상 프로그램에 참여하며 자유롭게 시간을 보냅니다.`
}

export function scrubOceanCruiseAtSeaScheduleRow<
  T extends {
    title?: string | null
    routeText?: string | null
    description?: string | null
    imageKeyword?: string | null
    imageKeyword2?: string | null
  },
>(row: T, haystack?: string | null): T {
  const route = String(row.routeText ?? '').trim()
  const title = String(row.title ?? '').trim()
  if (!isOceanCruiseAtSeaRoute(route) && !isOceanCruiseAtSeaRoute(title) && !/전일\s*해상/i.test(title)) {
    return row
  }
  const nextRoute = normalizeOceanCruiseAtSeaRouteText(route || title)
  const nextTitle = normalizeOceanCruiseAtSeaDayTitle(title, nextRoute)
  const nextDesc = composeOceanCruiseAtSeaDescription({
    haystack,
    existingDescription: row.description,
    routeText: nextRoute,
    title: nextTitle,
  })
  return {
    ...row,
    routeText: nextRoute,
    title: nextTitle || row.title,
    description: nextDesc,
    // 전일해상은 랜드마크 키워드 비강제 — 기항 도시 bleed 제거
    imageKeyword: '',
    imageKeyword2: null,
  }
}
