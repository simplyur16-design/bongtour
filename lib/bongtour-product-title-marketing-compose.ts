/**
 * 봉투어 노출 상품명 — 마케팅 「국가/권역 + 도시 + 핵심명소(1~2) + N박M일」 조합(결정론 폴백).
 * 6공급사 등록 confirm 의 Product.title 은 bongtour-product-title-generator 경로만 사용.
 * REGRESSION-FREEZE[bongtour-product-title-r5]: 도시만 N박M일보다 원문 명소 1~2 보강 — manifest
 */
import {
  sanitizeBongtourProductTitle,
  titleHasDayCountToken,
} from '@/lib/bongtour-product-title-tone-ssot'
import { isSupplierListingTitleUnacceptable } from '@/lib/supplier-listing-title-unacceptable'

export type MarketingProductTitleComposeInput = {
  originalProductTitle: string
  destination?: string | null
  duration?: string | null
}

const DURATION_BM_RE = /(\d+)\s*박\s*(\d+)\s*일/u
const DURATION_DAY_RE = /(?<!\d)(\d+)\s*일(?!\d)/u

export function normalizeMarketingDurationToken(
  duration: string | null | undefined,
  originalProductTitle: string,
): string {
  const d = String(duration ?? '').trim()
  const bmFromD = d.match(DURATION_BM_RE)
  if (bmFromD) return `${bmFromD[1]}박 ${bmFromD[2]}일`
  const dayFromD = d.match(DURATION_DAY_RE)
  if (dayFromD) return `${dayFromD[1]}일`

  const orig = String(originalProductTitle ?? '').trim()
  const bmFromO = orig.match(DURATION_BM_RE)
  if (bmFromO) return `${bmFromO[1]}박 ${bmFromO[2]}일`
  const dayFromO = orig.match(DURATION_DAY_RE)
  if (dayFromO) return `${dayFromO[1]}일`
  return ''
}

function stripLeadingBadges(s: string): string {
  return s.replace(/^(\[[^\]\n]{1,120}\]\s*)+/, '').trim()
}

function stripHashtags(s: string): string {
  return s.replace(/#[^\s#·+[\]]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractAirlineBracketSuffix(s: string): { core: string; bracket: string } {
  const brackets = [...s.matchAll(/\[([^\]]{2,80})\]/g)]
  if (!brackets.length) return { core: s, bracket: '' }
  const last = brackets[brackets.length - 1]!
  const inner = last[1]!.trim()
  if (!/(항공|KE|OZ|TW|직항|경유|출발|인솔|BUSINESS|비즈니스|NO옵션|노팁|노옵션)/i.test(inner)) {
    return { core: s.replace(/\[[^\]]+\]/g, ' ').replace(/\s+/g, ' ').trim(), bracket: '' }
  }
  const core = s.replace(/\[[^\]]+\]/g, ' ').replace(/\s+/g, ' ').trim()
  return { core, bracket: `[${inner}]` }
}

function extractRegionToken(core: string): string {
  const t = core.trim()
  const multi = t.match(
    /^([가-힣A-Za-z0-9\s~\-]+?(?:\d+\s*국|\d+\s*~?\s*\d+\s*개국|[가-힣]{2,8}\s*일주))(?:\s*[·+]|\s|$)/u,
  )
  if (multi?.[1]) return multi[1].replace(/\s+/g, ' ').trim()
  const regionWord = t.match(/^(동유럽|서유럽|북유럽|중동|아프리카|북미|남미|오세아니아|코카서스|발칸|스칸디나비아)/u)
  if (regionWord?.[1]) return regionWord[1].trim()
  return ''
}

function extractCityTokens(core: string, region: string, destination: string): string[] {
  let rest = core
  if (region) rest = rest.replace(region, '').trim()
  rest = rest
    .replace(DURATION_BM_RE, ' ')
    .replace(DURATION_DAY_RE, ' ')
    .replace(/\([^)]{0,120}\)/g, ' ')
    .replace(/[▶➢➤]/g, ' ')
    .trim()

  const parts = rest
    .split(/\s*[·+]\s*/u)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 2)
    .filter((p) => !/^(NO|THE|NEW|PREMIUM|PRIVATE|TOUR|OPTION)/i.test(p))
    .filter((p) => !/\d+\s*국|\d+\s*박|\d+\s*일|일주/u.test(p))

  const cities: string[] = []
  const seen = new Set<string>()
  for (const p of parts) {
    const key = p.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    cities.push(p)
    if (cities.length >= 2) break
  }

  if (!cities.length && destination && destination !== '미지정') {
    cities.push(destination)
  }
  return cities
}

/** 원문 브래킷·▶ 뒤 핵심 명소/일정 키워드 1~2 (특전·배지 제외) */
export function extractMarketingHighlightTokens(
  original: string,
  cities: readonly string[],
): string[] {
  const skipRe =
    /^(?:KE|OZ|TW|LJ|대한항공|아시아나|진에어|제주항공|롯데관광|롯데|NO\s*쇼핑|노쇼핑|단독|인솔|직항|경유|나다운|떠난다면)/i
  const perkRe = /미슐랭|프리미엄|엄선|NO옵션|노옵션|노팁|WORLD|체인호텔|특전/i
  const out: string[] = []
  const cityKeys = cities.map((c) => c.replace(/\s+/g, '').toLowerCase())
  const seen = new Set(cityKeys)

  const push = (raw: string) => {
    let t = String(raw ?? '').replace(/\s+/g, ' ').trim()
    t = t
      .replace(/\d+\s*돔.*$/u, '')
      .replace(/&.*/u, '')
      .replace(/\s*2돔.*$/u, '')
      .replace(/^[▶·+\s]+|[▶·+\s]+$/g, '')
      .trim()
    if (t.length < 2 || t.length > 28) return
    if (skipRe.test(t) || perkRe.test(t)) return
    if (DURATION_BM_RE.test(t) || DURATION_DAY_RE.test(t)) return
    const key = t.replace(/\s+/g, '').toLowerCase()
    if (seen.has(key)) return
    if (cityKeys.some((ck) => ck && (key === ck || key.includes(ck) || ck.includes(key)))) return
    seen.add(key)
    out.push(t)
  }

  for (const m of original.matchAll(/\[([^\]]{2,40})\]/g)) {
    push(m[1]!)
    if (out.length >= 2) return out
  }
  const afterArrow = original.split(/▶/)[1]
  if (afterArrow) {
    for (const part of afterArrow.split(/[\[\]·+,/]/).map((x) => x.trim()).filter(Boolean)) {
      push(part)
      if (out.length >= 2) return out
    }
  }
  return out
}

/** LLM이 키워드만 남기고 축약한 경우 마케팅 조합을 우선 */
export function shouldPreferMarketingComposeOverLlm(
  llmTitle: string,
  originalProductTitle: string,
  duration: string | null | undefined,
): boolean {
  const llm = String(llmTitle ?? '').trim()
  const orig = String(originalProductTitle ?? '').trim()
  if (!llm) return true

  const durHay = `${duration ?? ''} ${orig}`
  const needsBm = DURATION_BM_RE.test(durHay)
  if (needsBm && !DURATION_BM_RE.test(llm) && DURATION_DAY_RE.test(llm)) return true

  const afterLastBracket = llm.includes(']') ? (llm.split(']').pop() ?? '') : llm
  if ((afterLastBracket.match(/·/g) || []).length >= 3) return true

  if (orig.length >= 40 && llm.length <= 22 && !orig.includes(llm.slice(0, 8))) return true

  return false
}

/** 마케팅 국가/권역 + 도시(1~2) + 핵심명소(0~2) + N박M일 — 과도한 특전 나열 없음 */
export function composeMarketingProductTitle(input: MarketingProductTitleComposeInput): string {
  const originalRaw = String(input.originalProductTitle ?? '').trim()
  if (isSupplierListingTitleUnacceptable(originalRaw)) return '해외여행'
  const original = stripHashtags(stripLeadingBadges(originalRaw))
  const destination = String(input.destination ?? '').trim()
  const durationToken = normalizeMarketingDurationToken(input.duration, original)

  const { core, bracket } = extractAirlineBracketSuffix(original)
  let coreNoDur = core
    .replace(DURATION_BM_RE, ' ')
    .replace(DURATION_DAY_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const region = extractRegionToken(coreNoDur)
  const cities = extractCityTokens(coreNoDur, region, destination)
  const highlights = extractMarketingHighlightTokens(original, cities)

  const headParts: string[] = []
  if (region) headParts.push(region)
  if (cities.length) headParts.push(cities.join('·'))
  else if (destination && destination !== '미지정') headParts.push(destination)
  else if (coreNoDur.length >= 4) headParts.push(coreNoDur.slice(0, 36))
  if (highlights.length) headParts.push(highlights.join('·'))

  let out = headParts.filter(Boolean).join(' ').trim()
  if (durationToken) out = out ? `${out} ${durationToken}` : durationToken
  if (bracket && out) {
    const candidate = `${out} ${bracket}`.trim()
    if ([...candidate].length <= 90) out = candidate
  }

  const sanitized = sanitizeBongtourProductTitle(out || original.slice(0, 80))
  if (titleHasDayCountToken(sanitized)) return sanitized
  if (durationToken && sanitized) return `${sanitized} ${durationToken}`.trim()
  return sanitized || '해외여행'
}
