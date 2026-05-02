import {
  buildPublicProductHeroSeoKeywordOverlay,
  compactDurationLabelForProductSeo,
} from '@/lib/public-product-hero-seo-keyword'
import { isProductHeroListingSeoContaminated } from '@/lib/product-hero-listing-seo-contamination'
import {
  extractHashtagLabelsFromText,
  harvestBodySectionLinesAfterHeaders,
  splitKoreanHighlightFragments,
} from '@/lib/register-hero-seo-title-body-harvest'
import {
  isEligibleScheduleImageKeywordForLastResortSeo,
  mergeScheduleImageKeywordSources,
} from '@/lib/register-hero-seo-schedule-auxiliary'

/** 공개 오버레이와 동일 상한(자 근접 시 …) */
const LINE_MAX = 24

const SUPPLIER_NAME_BAN =
  /하나투어|모두투어|참좋은|노랑|옐로우\s*balloon|very\s*good|vb투어|yb투어|예스투어|제주항공|진에어|티웨이|에어부산|대한항공|아시아나/i

const PHRASE_BAN =
  /상담|안내|대표\s*이미지|입니다|합니다|예약|문의|확인해|자세한|패키지\s*상세|포함\s*사항|유의\s*사항|www\.|https?:\/\//i

/** 제목 일부 복붙 회피: 한 줄이 상품명 앞부분과 거의 같으면 제외 */
function lineLooksLikeTitlePrefix(line: string, title: string): boolean {
  const norm = (s: string) =>
    s
      .replace(/\s+/g, '')
      .replace(/[[(（【][^[\]()（）】]*[\]）)\]】]/g, '')
      .toLowerCase()
  const L = norm(line)
  const T = norm(title)
  if (T.length < 14 || L.length < 10) return false
  const n = Math.min(20, L.length, T.length)
  return T.slice(0, n) === L.slice(0, n) || L.slice(0, n) === T.slice(0, n)
}

function truncateLine(s: string, max: number): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function isMechanicalDurationOnly(line: string): boolean {
  const c = line.replace(/\s/g, '')
  return /^(\d+박\d+일|\d+일차|\d+박\s*\d+일)$/.test(c) || /^[\d\s~·박일차\-–—]+$/.test(c)
}

function themeChunkFromCommaList(raw: string | null | undefined): string | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  const parts = s
    .split(/[,，、]+/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 2 && x.length <= 10)
  if (parts.length === 0) return null
  const joined = parts.slice(0, 2).join('·')
  if (SUPPLIER_NAME_BAN.test(joined) || PHRASE_BAN.test(joined)) return null
  if (joined.length > 14) return null
  return `${joined} 코스`
}

function multiCityHeadline(primary: string | null, destination: string | null): string | null {
  const dest = (destination ?? primary ?? '').trim()
  if (!dest) return null
  const tokens = dest
    .split(/[,，、/|·]+/)
    .map((x) => x.trim())
    .filter(Boolean)
  if (tokens.length < 3) return null
  const bundle = dest.replace(/\s/g, '')
  if (/이탈리아|스위스|프랑스/.test(bundle) && bundle.includes('이탈리아')) {
    return truncateLine('서유럽 핵심 루트', LINE_MAX)
  }
  if (/도쿄|오사카/.test(bundle) && (/교토|京都/.test(bundle) || bundle.includes('교토'))) {
    return truncateLine('관동·간사이 핵심', LINE_MAX)
  }
  if (/다낭|호이안/.test(bundle) || (/방콕|파타야/.test(bundle) && /방콕/.test(bundle))) {
    return truncateLine('동남아 휴양·미식', LINE_MAX)
  }
  if (/베트남|캄보디아/.test(bundle) && /앙코르|시엠립/.test(bundle)) {
    return truncateLine('동남아 유적·휴양', LINE_MAX)
  }
  if (/유럽|동유럽|북유럽|서유럽/.test(bundle)) {
    return truncateLine('유럽 핵심 일주', LINE_MAX)
  }
  return truncateLine('다중 도시 핵심 루트', LINE_MAX)
}

/** `현지` 단독은 "현지옵션" 등 운영 문구 오탐을 유발하므로 제외 */
const STRONG_THEME_RE =
  /관광|미식|일주|온천|크루즈|리조트|핵심|휴양|트레킹|트래킹|골프|야경|설원|드라이브|루트|감성|테마|특급|자유일정|명소|세계유산|국립공원|사원|사찰|크리스마스|벚꽃|올레|온센|알짜|일정|비치|일출|일몰|워킹|산책|스파|동물원|특식|시암|마켓|플로팅|산호섬|마사지/

const REGISTER_KEYWORD_POLLUTED_COMPACT = [
  '현지옵션',
  '선택관광',
  '쇼핑',
  '포함사항',
  '불포함사항',
  '포함내역',
  '불포함내역',
  '출발',
  '도착',
  '이동',
  '미팅',
  '항공',
  '탑승',
  '기내',
  '숙박',
  '호텔',
  '조식',
  '중식',
  '석식',
  '자유시간',
  '가이드',
  '기사',
  '팁',
] as const

const REGISTER_KEYWORD_POLLUTED_RES: readonly RegExp[] = [
  /\bpexels\b/i,
  /\bistock\b/i,
  /\.(jpe?g|png|webp)(\b|[\s?#]|$)/i,
  /https?:\/\//i,
  /\b\d{5,}\b/,
]

/** 상품 카드·목록 UI 배지·코드(관광지 키워드로 오인 방지) */
const LISTING_META_CONTAMINATION_RE =
  /상품번호|상품코드|리뷰\s*\d|리뷰\s*건|\(\s*리뷰|리뷰\s*0건|리뷰\s*\d+건|\/\s*5\s*\(|\/\s*5\s*$|\d+(?:\.\d+)?\s*\/\s*5\b|[-–—]\s*\/\s*5\b/i

/** 공급사 마케팅 칩(단독 토큰) */
const STANDALONE_MARKETING_LABEL_RE = /^해외패키지$/u

/** CEG3060, CEP1002-260Z, FAQP14Z0IC 등 — 공백 제거 후 판별(순수 8자+ 영문만은 제외해 지명 오탐 완화) */
function looksLikeSupplierProductCodeToken(s: string): boolean {
  const compact = s.replace(/\s+/g, '').replace(/[…\.]+$/g, '')
  if (compact.length < 4) return false
  if (/^(?=.*\d)[A-Z0-9]{8,}$/i.test(compact)) return true
  if (/^[A-Z]{2,}\d/i.test(compact)) return true
  return false
}

function registerKeywordContaminated(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (isProductHeroListingSeoContaminated(t)) return true
  const c = t.replace(/\s/g, '')
  for (const w of REGISTER_KEYWORD_POLLUTED_COMPACT) {
    if (c.includes(w)) return true
  }
  if (/현지\s*옵션|옵션\s*\d/.test(t)) return true
  if (LISTING_META_CONTAMINATION_RE.test(t)) return true
  if (STANDALONE_MARKETING_LABEL_RE.test(t.trim())) return true
  if (/리뷰/.test(t)) return true
  if (looksLikeSupplierProductCodeToken(t)) return true
  for (const re of REGISTER_KEYWORD_POLLUTED_RES) {
    if (re.test(t)) return true
  }
  return false
}

/** 키워드·한 줄 모두 실패 시에도 NULL 저장 방지 */
function buildGuaranteedRegisterSeoOneLine(input: RegisterPublicImageHeroSeoLineCandidateInput): string {
  const title = (input.title ?? '').replace(/\s+/g, ' ').trim()
  const head =
    (input.primaryDestination ?? '').replace(/\s+/g, ' ').trim() ||
    (input.destination ?? '').split(/[,，、]/)[0]?.replace(/\s+/g, ' ').trim() ||
    (input.city ?? '').replace(/\s+/g, ' ').trim() ||
    (input.country ?? '').replace(/\s+/g, ' ').trim() ||
    ''
  const dur = compactDurationLabelForProductSeo(input.duration)
  if (head && dur) return truncateLine(`${head} ${dur}`, LINE_MAX)
  if (head) return truncateLine(`${head} 핵심`, LINE_MAX)
  const chunk = title.match(/[가-힣][가-힣0-9·\s]{0,14}/u)?.[0]?.replace(/\s+/g, ' ').trim()
  if (chunk && chunk.length >= 2 && !registerKeywordContaminated(chunk)) {
    return truncateLine(chunk, LINE_MAX)
  }
  const lat = title.match(/\b[A-Za-z][A-Za-z\s]{2,18}\b/)?.[0]?.trim()
  if (lat && lat.length >= 3 && !registerKeywordContaminated(lat)) {
    return truncateLine(lat, LINE_MAX)
  }
  return truncateLine('해외 여행', LINE_MAX)
}

export type RegisterPublicImageHeroSeoLineCandidateInput = {
  rawBodyText: string
  title: string
  primaryDestination?: string | null
  destination?: string | null
  /** 선택. 전달 시 목적지 토큰·폴백 한 줄 보강에 사용(미전달 시 무시). */
  country?: string | null
  city?: string | null
  duration?: string | null
  summary?: string | null
  themeTags?: string | null
  primaryRegion?: string | null
  themeLabelsRaw?: string | null
  includedText?: string | null
  /** 키워드·한 줄 후보 스캔용(라인별 오염 필터). `optionalTourSummaryRaw` 보다 안전 편에 둔다. */
  excludedText?: string | null
  benefitSummary?: string | null
  optionalTourSummaryRaw?: string | null
  /** 레거시 호환용. 대표 SEO 키워드·한 줄 후보 스캔에는 넣지 않는다(일정 제목 ↔ SEO 분리). */
  scheduleDayTitles: readonly string[]
  /**
   * 일정 `imageKeyword` 모음 — 대표 SEO 최후 보조만(`productScheduleJson` 과 병합 후 소비).
   */
  scheduleImageKeywords?: readonly string[] | null
  /** `Product.schedule` JSON — 신규 등록 시 orchestration에서 전달, `imageKeyword` 추출만. */
  productScheduleJson?: string | null
  originSourceForFallback: string
}

/**
 * 등록 확정 직전 전용: 붙여넣기 본문·구조화 필드로 이미지 좌측 SEO 한 줄 후보를 만든다.
 * 공급사명·상담/안내류·상품명 앞부분 복붙·쉼표 나열·기간만 한 줄은 피한다.
 */
export function buildRegisterPublicImageHeroSeoLineCandidate(
  input: RegisterPublicImageHeroSeoLineCandidateInput
): string {
  const title = (input.title ?? '').trim()

  const blocks: string[] = []
  if (input.benefitSummary?.trim()) blocks.push(input.benefitSummary.trim().slice(0, 260))
  if (input.optionalTourSummaryRaw?.trim()) blocks.push(input.optionalTourSummaryRaw.trim().slice(0, 220))
  if (input.summary?.trim()) blocks.push(input.summary.trim().slice(0, 420))
  if (input.includedText?.trim()) blocks.push(input.includedText.trim().slice(0, 700))
  if (input.excludedText?.trim()) blocks.push(input.excludedText.trim().slice(0, 520))
  if (input.rawBodyText.trim()) blocks.push(input.rawBodyText.trim().slice(0, 4200))

  const hay = blocks.join('\n')
  const lines = hay
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 8 && l.length <= 64)

  for (const line of lines) {
    if (SUPPLIER_NAME_BAN.test(line)) continue
    if (PHRASE_BAN.test(line)) continue
    if (registerKeywordContaminated(line)) continue
    if (lineLooksLikeTitlePrefix(line, title)) continue
    if ((line.match(/,/g) || []).length >= 3) continue
    if (isMechanicalDurationOnly(line)) continue
    const hangul = (line.match(/[가-힣]/g) || []).length
    if (hangul < 4) continue
    if (!STRONG_THEME_RE.test(line) && line.length > 30) continue
    return truncateLine(line, LINE_MAX)
  }

  const tagLine = themeChunkFromCommaList(input.themeTags) ?? themeChunkFromCommaList(input.themeLabelsRaw)
  if (tagLine && !registerKeywordContaminated(tagLine)) {
    const head = (input.primaryDestination ?? input.destination?.split(/[,，、]/)[0] ?? '').trim()
    if (head && !head.includes(',') && head.length <= 10) {
      const merged = `${head} ${tagLine}`
      if (
        !SUPPLIER_NAME_BAN.test(merged) &&
        !PHRASE_BAN.test(merged) &&
        !registerKeywordContaminated(merged)
      ) {
        return truncateLine(merged, LINE_MAX)
      }
    }
    return truncateLine(tagLine, LINE_MAX)
  }

  const multi = multiCityHeadline(input.primaryDestination ?? null, input.destination ?? null)
  if (multi) return multi

  const reg = (input.primaryRegion ?? '').trim()
  const singlePlace = (input.primaryDestination ?? input.destination?.split(/[,，、]/)[0] ?? '').trim()
  if (reg && singlePlace && !singlePlace.includes(',') && singlePlace.length <= 8) {
    const merged = `${singlePlace} ${reg} 감성`
    if (!SUPPLIER_NAME_BAN.test(merged)) return truncateLine(merged, LINE_MAX)
  }

  const overlay = buildPublicProductHeroSeoKeywordOverlay({
    seoCaptionFromAsset: null,
    title,
    primaryDestination: input.primaryDestination ?? null,
    destination: input.destination ?? null,
    duration: input.duration ?? null,
    originSource: input.originSourceForFallback,
  })
  if (overlay) {
    const cleaned = overlay.replace(/\s+/g, ' ').trim()
    if (
      cleaned &&
      !registerKeywordContaminated(cleaned) &&
      !SUPPLIER_NAME_BAN.test(cleaned) &&
      !PHRASE_BAN.test(cleaned)
    ) {
      return truncateLine(cleaned, LINE_MAX)
    }
  }

  return buildGuaranteedRegisterSeoOneLine(input)
}

/** `resolvePublicProductHeroSeoKeywordOverlay` 저장 JSON 토큰 자르기 상한과 동일하게 유지 */
const REGISTER_KEYWORD_EACH_MAX = 16

/** 다도시·다국 목적지 문자열에서 짧은 지명 1~2개만 추출(등록 키워드 보강, 옵션 요약 미사용) */
function cleanShortDestinationTokens(
  primary: string | null | undefined,
  destination: string | null | undefined,
  extras?: readonly (string | null | undefined)[]
): string[] {
  const ordered: string[] = []
  for (const e of extras ?? []) {
    const ex = (e ?? '').replace(/\s+/g, ' ').trim()
    if (ex && !/[，,、]/.test(ex) && ex.length >= 2 && ex.length <= 10) ordered.push(ex)
  }
  const p = (primary ?? '').replace(/\s+/g, ' ').trim()
  if (p && !/[，,、]/.test(p) && p.length >= 2 && p.length <= 10) ordered.push(p)
  for (const x of (destination ?? '').split(/[,，、/|·]+/)) {
    const t = x.replace(/\s+/g, ' ').trim()
    if (t.length >= 2 && t.length <= 10 && !/[，,、]/.test(t)) ordered.push(t)
  }
  const out: string[] = []
  const seenTok = new Set<string>()
  for (const x of ordered) {
    if (registerKeywordContaminated(x)) continue
    if (SUPPLIER_NAME_BAN.test(x) || PHRASE_BAN.test(x)) continue
    const k = x.replace(/\s/g, '')
    if (k.length < 2 || seenTok.has(k)) continue
    seenTok.add(k)
    out.push(x)
    if (out.length >= 2) break
  }
  return out
}

/**
 * 대표 이미지 좌측용 짧은 키워드 2~3개 — `publicImageHeroSeoKeywordsJson` 저장 전용.
 * 우선순위: 상품명·본문 `#태그` → 본문 섹션·요약 명사구 → 목적지·기간 → 오버레이 휴리스틱 →
 * (선택) 일정 `imageKeyword` 보조. 일정 제목·포함/불포함·옵션 요약은 주원료로 쓰지 않는다.
 */
export function buildRegisterPublicImageHeroSeoKeywords(
  input: RegisterPublicImageHeroSeoLineCandidateInput
): string[] | null {
  const title = (input.title ?? '').trim()
  const out: string[] = []
  const seen = new Set<string>()

  const push = (raw: string | null | undefined) => {
    if (raw == null || out.length >= 3) return
    let s = String(raw).replace(/\s+/g, ' ').trim()
    if (s.length < 2) return
    s = truncateLine(s, REGISTER_KEYWORD_EACH_MAX)
    if (registerKeywordContaminated(s)) return
    if (SUPPLIER_NAME_BAN.test(s) || PHRASE_BAN.test(s)) return
    if (lineLooksLikeTitlePrefix(s, title)) return
    const k = s.replace(/\s/g, '')
    if (seen.has(k)) return
    seen.add(k)
    out.push(s)
  }

  const rawBody = input.rawBodyText.trim()

  // 1순위: 상품명·본문 앞부분 `#태그` (imageKeyword 와 무관)
  for (const tag of extractHashtagLabelsFromText(title)) push(tag)
  for (const tag of extractHashtagLabelsFromText(rawBody.slice(0, 900))) push(tag)

  // 2순위: 본문·혜택 요약의 섹션(핵심 포인트 등) + 짧은 명사구
  const sectionHay = [rawBody, (input.benefitSummary ?? '').trim()].filter(Boolean).join('\n')
  const sectionLines = harvestBodySectionLinesAfterHeaders(sectionHay, 22)
  for (const ln of sectionLines) {
    for (const frag of splitKoreanHighlightFragments(ln)) push(frag)
    const one = ln.replace(/\s+/g, ' ').trim()
    if (one.length >= 4 && one.length <= REGISTER_KEYWORD_EACH_MAX) {
      const hc = (one.match(/[가-힣]/g) || []).length
      if (hc >= 4 || STRONG_THEME_RE.test(one)) push(one)
    }
  }

  const blocksBody: string[] = []
  if (rawBody) blocksBody.push(rawBody.slice(0, 4200))
  if (input.benefitSummary?.trim()) blocksBody.push(input.benefitSummary.trim().slice(0, 260))
  if (input.summary?.trim()) blocksBody.push(input.summary.trim().slice(0, 420))
  const hayBody = blocksBody.join('\n')
  const linesBody = hayBody
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 4 && l.length <= 48)

  for (const line of linesBody) {
    if (SUPPLIER_NAME_BAN.test(line) || PHRASE_BAN.test(line) || registerKeywordContaminated(line)) continue
    if (lineLooksLikeTitlePrefix(line, title)) continue
    if ((line.match(/,/g) || []).length >= 3) continue
    if (isMechanicalDurationOnly(line)) continue
    const hangul = (line.match(/[가-힣]/g) || []).length
    if (hangul < 3) continue
    if (!STRONG_THEME_RE.test(line) && line.length > 24) continue
    push(line)
    if (out.length >= 3) break
  }

  const tagRaw = themeChunkFromCommaList(input.themeTags) ?? themeChunkFromCommaList(input.themeLabelsRaw)
  if (tagRaw) {
    const stripped = tagRaw.replace(/\s*코스$/u, '').trim()
    for (const part of stripped.split(/[·⋅]/)) push(part.trim())
  }

  /** 해시태그·본문 섹션·본문 라인·테마까지 — 이후 단계(목적지·기간·휴리스틱) 전 길이 */
  const slotsAfterBodyAndTheme = out.length

  // 3순위: 목적지·권역·기간
  for (const tok of cleanShortDestinationTokens(input.primaryDestination, input.destination, [
    input.country,
    input.city,
  ])) {
    push(tok)
  }

  const dur = compactDurationLabelForProductSeo(input.duration)
  if (dur) push(dur)

  const mc = multiCityHeadline(input.primaryDestination ?? null, input.destination ?? null)
  if (mc) push(mc)

  const heur = buildPublicProductHeroSeoKeywordOverlay({
    seoCaptionFromAsset: null,
    title,
    primaryDestination: input.primaryDestination ?? null,
    destination: input.destination ?? null,
    duration: input.duration ?? null,
    originSource: input.originSourceForFallback,
  })
  if (heur) {
    const outerParts = heur
      .split(/\s*·\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
    for (const part of outerParts) {
      if (part.length <= REGISTER_KEYWORD_EACH_MAX) {
        push(part)
        continue
      }
      const words = part.split(/\s+/).filter(Boolean)
      if (words.length >= 2) {
        const mid = Math.max(1, Math.ceil(words.length / 2))
        push(words.slice(0, mid).join(' '))
        push(words.slice(mid).join(' '))
      } else {
        push(part)
      }
    }
  }

  const reg = (input.primaryRegion ?? '').trim()
  if (reg.length >= 2 && reg.length <= 8 && out.length >= 1 && out.length < 3) {
    const sfx = /동남아|하와이|괌|몰디브|발리|푸켓|칸쿤|사이판|세부|보홀|코타키나발루/.test(reg) ? '휴양' : '감성'
    push(`${reg} ${sfx}`)
  }

  const head = (input.primaryDestination ?? input.destination?.split(/[,，、]/)[0] ?? '').trim()
  if (head && head.length <= 10 && !head.includes(',')) push(head)

  // 마지막 보조: 일정 `imageKeyword` — 본문·테마로 2칸을 채우지 못했고, 전체 2개 미만일 때만
  if (out.length < 2 && slotsAfterBodyAndTheme < 2) {
    const fromSchedule = mergeScheduleImageKeywordSources(
      input.scheduleImageKeywords,
      input.productScheduleJson ?? null
    )
    for (const ik of fromSchedule) {
      if (!isEligibleScheduleImageKeywordForLastResortSeo(ik)) continue
      push(ik.slice(0, REGISTER_KEYWORD_EACH_MAX))
      if (out.length >= 3) break
    }
  }

  if (out.length === 0) return null
  return out.slice(0, 3)
}
