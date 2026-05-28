/**
 * 참좋은여행(verygoodtour): 일차 imageKeyword(1순위)·imageKeyword2(2순위) — Pexels용 영문.
 * Plan A: 키워드 텍스트 소스 = LLM 영문 only. detRows 생짜 영문 추출 없음.
 * routeText(한국어)는 영문 키워드 소스로 사용하지 않는다.
 */
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'
import { normalizeSemanticPoiKey } from '@/lib/pexels-keyword'
import { finalizeScheduleImageKeyword, normalizeToPlaceName } from '@/lib/pexels-place-name-keyword'

export type VerygoodScheduleImageKeywordRow = {
  day: number
  title?: string
  description?: string
  routeText?: string | null
  imageKeyword?: string | null
  imageKeyword2?: string | null
}

export type VerygoodDayKind = 'flight' | 'touring' | 'free'

export type VerygoodScheduleImageKeywordOpts = {
  productDestination?: string | null
  detRows?: RegisterScheduleDay[]
  totalDays?: number
}

const DOMESTIC_HUB_KO_RE =
  /^(?:인천|김포|부산|대구|청주|김해|서울|제주)(?:\s*국제?\s*공항|\s*공항)?(?:\s*출발|\s*도착)?$/u

const DOMESTIC_HUB_EN_RE =
  /^(?:Incheon|Gimpo|Busan|Daegu|Cheongju|Gimhae|Seoul|Jeju|ICN|GMP|PUS|TAE|CJJ|CJU)$/i

const ASIA_PACIFIC_PRODUCT_DEST_RE =
  /인도|India|일본|Japan|동남아|규슈|큐슈|Kyushu|아시아|Asia|태국|Thailand|베트남|Vietnam|싱가포르|Singapore|홍콩|Hong\s*Kong|대만|Taiwan|중국|China|필리핀|Philippines|말레이|Malaysia|인도네시아|Indonesia|캄보디아|Cambodia|라오스|Laos|미얀마|Myanmar|네팔|Nepal|스리랑카|Sri\s*Lanka|몰디브|Maldives|괌|Guam|사이판|Saipan|하와이|Hawaii/i

const VERYGOOD_TOXIC_IMAGE_KEYWORD_RE =
  /\bscenic\s+asian\s+city\s+travel\s+skyline\s+dusk\b/i

const VERYGOOD_LLM_DAY_TRAVEL_RE = /^day\s*\d+\s*travel$/i

/** detRows 추출 입력에서 제외할 항공·좌석·수하물 노이즈 줄 */
const VERYGOOD_AVIATION_LINE_RE =
  /(?:seat\s*pitch|수하물|기내수화물|위탁\s*수|마일리지|boarding\s*pass|탑승권|항공권|기내식|미팅장소|미팅시간|액체류|VOD\s*엔터|entertainment\s*service|baggage|carry-on|check-in|e-ticket|board(?:ing)?\s*pass|LO\s*\d{2,4}\b|편\s*출발|편\s*도착|국제공항\s*출발|국제공항\s*도착)/i

/** Pexels 관광지가 아닌 항공·좌석 용어 */
const VERYGOOD_NON_LANDMARK_EN_RE = /\bseat\s*pitch\b/i

const CROSS_CONTINENT_HALLUCINATION_KW_RES: ReadonlyArray<RegExp> = [
  /\bParis\b/i,
  /\bEiffel\b/i,
  /\bLouvre\b/i,
  /Notre\s*Dame/i,
  /\bColosseum\b/i,
  /\bRome\b/i,
  /Forbidden(\s*City)?/i,
  /Big\s*Ben/i,
  /London\s*Eye/i,
  /Tower\s*of\s*London/i,
  /\bBarcelona\b/i,
  /Sagrada\s*Familia/i,
  /\bAmsterdam\b/i,
  /\bVenice\b/i,
  /Brandenburg/i,
  /\bMunich\b/i,
  /Arc\s*de\s*Triomphe/i,
  /Versailles/i,
]

function normKey(s: string): string {
  return normalizeSemanticPoiKey(s)
}

function keysEqual(a: string, b: string): boolean {
  if (!a || !b) return false
  return normKey(a) === normKey(b)
}

function dayHaystack(description: string, title: string): string {
  return [description, title].filter(Boolean).join('\n')
}

/** 인천·부산·대구·청주·김포·ICN/GMP 등 — imageKeyword 후보에서 제외 */
export function isVerygoodDomesticHubToken(token: string): boolean {
  const t = String(token ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (DOMESTIC_HUB_KO_RE.test(t)) return true
  if (DOMESTIC_HUB_EN_RE.test(t)) return true
  if (/^인천(?:국제)?공항$/u.test(t)) return true
  if (/^김포(?:국제)?공항$/u.test(t)) return true
  if (/^부산(?:국제)?공항$/u.test(t)) return true
  if (/^대구(?:국제)?공항$/u.test(t)) return true
  if (/^청주(?:국제)?공항$/u.test(t)) return true
  return false
}

/** 아시아·태평양 목적지 상품에서 LLM이 헛생성한 타대륙 유명 랜드마크 */
export function isVerygoodCrossContinentHallucinationKeyword(
  keyword: string,
  productDestination: string | null | undefined,
): boolean {
  const dest = String(productDestination ?? '').trim()
  if (!dest || !ASIA_PACIFIC_PRODUCT_DEST_RE.test(dest)) return false
  const raw = String(keyword ?? '').trim()
  if (!raw) return false
  const fin = normalizeToPlaceName(raw)
  const haystacks = fin && fin !== raw ? [raw, fin] : [raw]
  return CROSS_CONTINENT_HALLUCINATION_KW_RES.some((re) => haystacks.some((h) => re.test(h)))
}

function isVerygoodLlmImageKeywordFormatOk(kw: string): boolean {
  const k = kw.trim()
  if (!k || k.length < 2 || k.length > 120) return false
  if (/[\uAC00-\uD7AF]/.test(k)) return false
  if (VERYGOOD_TOXIC_IMAGE_KEYWORD_RE.test(k)) return false
  if (VERYGOOD_LLM_DAY_TRAVEL_RE.test(k)) return false
  if (/\b(hotel|resort|buffet|breakfast|lunch|dinner|brunch)\b/i.test(k)) return false
  if (/\d{1,2}\/\d{1,2}/.test(k) || /\d{1,2}-\d{1,2}\b/.test(k)) return false
  const words = k.split(/\s+/).filter(Boolean).length
  if (words < 1 || words > 10) return false
  return /^[A-Za-z0-9\s,.'-]+$/.test(k)
}

function tryAcceptVerygoodLlmImageKeyword(
  raw: string | null | undefined,
  productDestination: string | null | undefined,
): string {
  const llmRaw = String(raw ?? '').trim()
  if (!llmRaw) return ''
  const candidate = normalizeToPlaceName(llmRaw) || llmRaw
  if (!isVerygoodLlmImageKeywordFormatOk(candidate)) return ''
  if (VERYGOOD_NON_LANDMARK_EN_RE.test(candidate)) return ''
  if (isVerygoodDomesticHubToken(candidate)) return ''
  if (isVerygoodCrossContinentHallucinationKeyword(candidate, productDestination)) return ''
  try {
    return finalizeScheduleImageKeyword(candidate)
  } catch {
    return ''
  }
}

function isVerygoodAviationSectionHeader(header: string): boolean {
  const h = String(header ?? '').replace(/\s+/g, ' ').trim()
  if (!h) return false
  if (isVerygoodDomesticHubToken(h)) return true
  if (/공항|airport|항공|flight|터미널|T\d\b/i.test(h)) return true
  return false
}

function stripVerygoodAviationNoiseLines(block: string): string {
  return block
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      if (!t) return true
      if (VERYGOOD_AVIATION_LINE_RE.test(t)) return false
      if (/^\[?(?:통제대상|항공\s*위탁|폴란드\s*항공\s*마일리지)/u.test(t)) return false
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * detRows description/rawDayBody에서 항공·국내 허브 #### 블록을 제거해 일정 본문만 남긴다.
 */
export function stripVerygoodAviationBlocksForImageKeywordExtract(raw: string): string {
  const text = String(raw ?? '').replace(/\r/g, '').trim()
  if (!text) return ''

  const parts = text.split(/\n(?=####\s+)/)
  const kept: string[] = []
  for (const part of parts) {
    const t = part.trim()
    if (!t) continue
    const headerMatch = t.match(/^####\s*([^\n]+)/)
    if (headerMatch) {
      const header = headerMatch[1]!.trim()
      if (isVerygoodAviationSectionHeader(header)) continue
      kept.push(stripVerygoodAviationNoiseLines(t))
      continue
    }
    kept.push(stripVerygoodAviationNoiseLines(t))
  }
  return kept.join('\n').trim()
}

/** description에 국내 허브·항공 #### 블록 또는 항공 본문 시그널 존재 */
function hasVerygoodDomesticHubOrAviationBlock(description: string, title: string): boolean {
  const text = dayHaystack(description, title)
  if (!text.trim()) return false

  const parts = text.split(/\n(?=####\s+)/)
  for (const part of parts) {
    const t = part.trim()
    if (!t) continue
    const headerMatch = t.match(/^####\s*([^\n]+)/)
    if (headerMatch && isVerygoodAviationSectionHeader(headerMatch[1]!.trim())) return true
  }

  if (/(?:인천|김포|부산|대구|청주|ICN|GMP|PUS|TAE|CJJ)(?:국제)?\s*공항/u.test(text) && /(?:출발|도착|탑승|귀국|입국)/u.test(text)) {
    return true
  }
  if (/국제\s*선|기내식|수하물|탑승권|항공권|LO\s*\d{2,4}\b/i.test(text)) return true
  return false
}

/**
 * description의 #### {지역} 블록에서 따옴표 '…' 명소를 이동 순서대로(한글 그대로, 번역 X).
 * 게이트·보고용.
 */
export function extractVerygoodOrderedDayPoi(description: string, title: string): string[] {
  const text = stripVerygoodAviationBlocksForImageKeywordExtract(String(description ?? ''))
  if (!text.trim()) return []

  const out: string[] = []
  const seen = new Set<string>()
  const parts = text.split(/\n(?=####\s+)/)

  for (const part of parts) {
    const t = part.trim()
    if (!t) continue
    let body = t
    const headerMatch = t.match(/^####\s*([^\n]+)/)
    if (headerMatch) {
      if (isVerygoodAviationSectionHeader(headerMatch[1]!.trim())) continue
      body = t.replace(/^####\s*[^\n]+\n?/, '')
    }
    const cleaned = stripVerygoodAviationNoiseLines(body)
    for (const m of cleaned.matchAll(/'([^']{2,80})'/gu)) {
      const poi = m[1]!.replace(/\s+/g, ' ').trim()
      if (!poi || seen.has(poi)) continue
      seen.add(poi)
      out.push(poi)
    }
  }

  if (out.length === 0) {
    for (const m of text.matchAll(/'([^']{2,80})'/gu)) {
      const poi = m[1]!.replace(/\s+/g, ' ').trim()
      if (!poi || seen.has(poi)) continue
      seen.add(poi)
      out.push(poi)
    }
  }

  void title
  return out
}

/** routeText 게이트 전용 — ' - ' 세그먼트 중 국내 허브 제외 개수(KO→EN·키워드 생성 없음). */
function countVerygoodNonHubRouteTextSegments(routeText: string | null | undefined): number {
  const raw = String(routeText ?? '').trim()
  if (!raw) return 0
  const parts = raw
    .split(/\s+-\s+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 2)
  let count = 0
  for (const p of parts) {
    if (isVerygoodDomesticHubToken(p)) continue
    count++
  }
  return count
}

export function classifyVerygoodDayKind(
  description: string,
  title: string,
  dayIndex: number,
  totalDays: number,
  routeText?: string | null,
): VerygoodDayKind {
  if (hasVerygoodDomesticHubOrAviationBlock(description, title)) return 'flight'

  const pois = extractVerygoodOrderedDayPoi(description, title)
  if (pois.length >= 1) return 'touring'

  if (countVerygoodNonHubRouteTextSegments(routeText) >= 3) return 'touring'

  void dayIndex
  void totalDays
  return 'free'
}

/** LLM imageKeyword only — dayKind 분기. det 생짜 추출 없음. */
export function resolveVerygoodPrimaryKeyword(
  row: VerygoodScheduleImageKeywordRow,
  dayKind: VerygoodDayKind,
  productDestination: string | null | undefined,
): string {
  void dayKind
  return tryAcceptVerygoodLlmImageKeyword(row.imageKeyword, productDestination)
}

/** LLM imageKeyword2 only — dayKind 분기. det 생짜 추출 없음. */
export function resolveVerygoodSecondaryKeyword(
  row: VerygoodScheduleImageKeywordRow,
  primary: string,
  dayKind: VerygoodDayKind,
  productDestination: string | null | undefined,
): string | null {
  if (dayKind !== 'touring') return null

  const fromLlm = tryAcceptVerygoodLlmImageKeyword(row.imageKeyword2, productDestination)
  if (!fromLlm) return null
  if (primary && keysEqual(fromLlm, primary)) return null
  return fromLlm
}

export function polishVerygoodRegisterScheduleImageKeywords(
  schedule: RegisterScheduleDay[],
  detRows: RegisterScheduleDay[],
  productDestination?: string | null,
): RegisterScheduleDay[] {
  return applyVerygoodScheduleImageKeywordsToRows(schedule, {
    detRows,
    productDestination: productDestination ?? null,
    totalDays: schedule.length,
  })
}

export function applyVerygoodScheduleImageKeywordsToRows<
  T extends VerygoodScheduleImageKeywordRow,
>(rows: T[], opts?: VerygoodScheduleImageKeywordOpts): T[] {
  if (!rows?.length) return rows
  const detByDay = new Map<number, RegisterScheduleDay>()
  for (const r of opts?.detRows ?? []) {
    const d = Number(r.day) || 0
    if (d > 0) detByDay.set(d, r)
  }
  const productDestination = opts?.productDestination ?? null
  const totalDays =
    opts?.totalDays && opts.totalDays > 0
      ? opts.totalDays
      : Math.max(...rows.map((r) => Number(r.day) || 0), rows.length)

  return rows.map((row) => {
    const day = Number(row.day) || 0
    const det = detByDay.get(day)
    const description = String(det?.description ?? row.description ?? '')
    const title = String(det?.title ?? row.title ?? '').trim()
    const routeText = row.routeText ?? det?.routeText ?? null
    const dayKind = classifyVerygoodDayKind(description, title, day, totalDays, routeText)
    const primary = resolveVerygoodPrimaryKeyword(row, dayKind, productDestination)
    const secondary = resolveVerygoodSecondaryKeyword(row, primary, dayKind, productDestination)
    return {
      ...row,
      imageKeyword: primary,
      imageKeyword2: secondary,
    }
  }) as T[]
}
