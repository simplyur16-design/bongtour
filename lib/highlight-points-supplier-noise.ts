/**
 * '상품 핵심 포인트' 공급사 노이즈 필터 (10/30 390px overflow 후속).
 * - 공급사 URL(http/https/www/도메인)·공급사 브랜드 프로그램·자사 홍보 문구를 뺀다.
 * - 표시 시점(ProductHighlightPointsSection)과 등록·셀프힐(highlightPoints) 공용.
 * - 줄 단위로 빼기만 한다. 남는 줄의 글자·숫자(가격 포함)는 절대 바꾸지 않는다(URL 조각만 제거).
 * - highlightPointsRaw(공급사 원문)는 저장값을 건드리지 않는다 — 표시할 때만 필터.
 */

/** 공급사 브랜드명 (bongtour 페이지에 공급사 자기홍보가 노출되면 안 됨) */
export const SUPPLIER_BRAND_RE =
  /하나\s?투어|HANA\s?TOUR|노랑\s?풍선|YELLOW\s?BALLOON|롯데\s?관광|LOTTE\s?TOUR|참\s?좋은\s?여행|VERY\s?GOOD\s?TOUR|모두\s?투어|MODE\s?TOUR|내일\s?투어|NAEIL\s?TOUR|교원\s?투어|교원\s?이지|여행이지|KYOWON\s?TOUR/i

/** 공급사 자기홍보 단서 — 브랜드명과 같이 나올 때만 줄 제거 */
const BRAND_PROMO_CUE_RE =
  /고객(?:님)?\s*(?:만을|께만|만|전용)|엄선|대표\s*(?:여행\s*)?상품|함께\s*합니다|함께\s*하는|와\s*함께|와\s*함께,|안심\s*여행|단독|전용\s*(?:서비스|혜택|라운지|호텔)|회원|멤버십|브랜드|자부심|약속(?:합니다|드립니다)|만의\s*(?:특별|혜택|서비스)|는\s*여행의|에서만/

/** 공급사 브랜드 프로그램·운영 안내(브랜드명 없이 나오는 항목 포함) */
const SUPPLIER_PROGRAM_LINE_RES: readonly RegExp[] = [
  /SAFETY\s*&\s*JOY/i, // 하나투어 안심여행 프로그램
  /\bH\s?-\s?care\b/i,
  /100\s*%\s*보상\s*프로그램/,
  /(?:응급|위기)\s*\/?\s*(?:위기)?\s*상황\s*발생\s*시\s*체계적인?\s*현장\s*지원/,
  /안전\s*\/?\s*위생\s*지침\s*준수/,
  /안전\s*교육\s*이수\s*인솔자/,
  /국가별\s*방역\s*지침/,
  /24\s*시간\s*긴급\s*의료\s*지원/,
  /여행\s*후에도\s*이어지는\s*고객\s*만족/,
  /고객\s*만족\s*서비스/,
  /양우산\s*대여|안심\s*양우산/,
  /기획전|프로모션\s*(?:코드|페이지)|이벤트\s*페이지|쿠폰\s*(?:다운|발급|받기)/,
  /고객\s*센터|카카오\s*톡?\s*(?:채널|상담)|앱\s*(?:다운로드|전용)|☎/,
  /L\.?\s?POINT|엘\s?포인트|L\s?포인트/i,
  /(?:^|\s)\d{2,4}-\d{3,4}-\d{4}(?:\s|$)|대표\s*번호|(?:^|\s)1[5-8]\d{2}-\d{4}(?:\s|$)/, // 공급사 대표번호
]

/** 이 줄 다음부터 공급사 프로그램 블록 — 다음 헤더까지(최대 10줄) 함께 제거 */
const SUPPLIER_PROGRAM_BLOCK_START_RES: readonly RegExp[] = [
  /SAFETY\s*&\s*JOY/i,
  /고객(?:님)?\s*(?:만을|께만)\s*위한\s*(?:세심한\s*)?배려/,
  /양우산\s*대여\s*서비스/,
]
/** 블록 종료 = 새 내용 헤더 */
const CONTENT_HEADER_RE = /^(?:✅|♥|❤|■|●|◆|▣|【|\[|<|＜)|핵심\s*포인트|핵심\s*관광|일정\s*안내|^\d+\s*일차/
const BLOCK_MAX_LINES = 10

/** 섹션 제목과 같은 '상품 핵심포인트' 단독 줄(중복 제목) */
const DUPLICATE_HEADING_RE = /^[\s✅✔☑✨★☆♥❤■●◆▣\-–—*•·]*상품\s*핵심\s*포인트[\s!:：]*$/

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|co\.kr|kr|net|org)(?:\/[^\s<>"')\]]*)?/gi

/** URL 제거 뒤 남은 게 링크 안내어·기호뿐이면 줄 자체를 뺀다 */
const URL_LEFTOVER_ONLY_RE =
  /^[\s\-–—:：>▶►→·•※*()\[\]【】]*(?:자세히\s*보기|바로\s*가기|바로가기|링크|확인|참고|클릭|상세\s*(?:보기|안내)|더\s*보기|홈페이지|사이트)?[\s\-–—:：>▶►→·•※*()\[\]【】.!]*$/

export type HighlightNoiseReason = 'url' | 'program' | 'program_block' | 'brand_promo' | 'duplicate_heading'

export type HighlightNoiseResult = {
  text: string | null
  removed: Array<{ line: string; reason: HighlightNoiseReason }>
  urlStripped: number
}

function isBlockStart(line: string): boolean {
  return SUPPLIER_PROGRAM_BLOCK_START_RES.some((re) => re.test(line))
}

/** 한 줄 판정(블록 문맥 제외) */
export function classifyHighlightNoiseLine(line: string): HighlightNoiseReason | null {
  const t = line.trim()
  if (!t) return null
  if (DUPLICATE_HEADING_RE.test(t)) return 'duplicate_heading'
  if (SUPPLIER_PROGRAM_LINE_RES.some((re) => re.test(t))) return 'program'
  if (SUPPLIER_BRAND_RE.test(t) && BRAND_PROMO_CUE_RE.test(t)) return 'brand_promo'
  return null
}

/**
 * highlight 텍스트 → 노이즈 제거본. 남는 줄이 없으면 null.
 * 줄 순서·문구·숫자는 그대로(URL 조각만 잘라냄).
 */
export function filterHighlightPointsSupplierNoise(text: string | null | undefined): HighlightNoiseResult {
  if (typeof text !== 'string' || !text.trim()) return { text: null, removed: [], urlStripped: 0 }
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const kept: string[] = []
  const removed: HighlightNoiseResult['removed'] = []
  let urlStripped = 0
  let blockLeft = 0
  for (const raw of lines) {
    const trimmed = raw.trim()
    if (!trimmed) {
      kept.push(raw)
      continue
    }
    if (blockLeft > 0) {
      if (CONTENT_HEADER_RE.test(trimmed) && !isBlockStart(trimmed)) {
        blockLeft = 0
      } else {
        blockLeft -= 1
        if (isBlockStart(trimmed)) blockLeft = BLOCK_MAX_LINES
        removed.push({ line: trimmed, reason: 'program_block' })
        continue
      }
    }
    let line = raw
    URL_RE.lastIndex = 0
    if (URL_RE.test(line)) {
      URL_RE.lastIndex = 0
      const stripped = line.replace(URL_RE, '').replace(/\s{2,}/g, ' ')
      if (URL_LEFTOVER_ONLY_RE.test(stripped)) {
        removed.push({ line: trimmed, reason: 'url' })
        continue
      }
      urlStripped += 1
      const indent = raw.match(/^\s*/)?.[0] ?? ''
      line = indent + stripped.trim()
    }
    const reason = classifyHighlightNoiseLine(line)
    if (reason) {
      removed.push({ line: trimmed, reason })
      if (isBlockStart(line)) blockLeft = BLOCK_MAX_LINES
      continue
    }
    if (isBlockStart(line)) blockLeft = BLOCK_MAX_LINES
    kept.push(line)
  }
  const out = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  return { text: out ? out : null, removed, urlStripped }
}

/** 편의: 결과 텍스트만 */
export function sanitizeHighlightPointsText(text: string | null | undefined): string | null {
  return filterHighlightPointsSupplierNoise(text).text
}

/**
 * 노이즈(제거 줄·URL 조각)가 있을 때만 정리본, 없으면 원문 그대로(공백·줄바꿈만 다른 재저장 방지).
 * 힐·일괄 정리 스크립트 공통. 반환 null = 전 줄 노이즈.
 */
export function sanitizeHighlightPointsIfNoisy(text: string | null | undefined): string | null | undefined {
  if (typeof text !== 'string' || !text.trim()) return text
  const r = filterHighlightPointsSupplierNoise(text)
  if (r.removed.length === 0 && r.urlStripped === 0) return text
  return r.text
}

/** 핵심 포인트 한 줄 텍스트 class — 긴 무공백 문자열(URL 등)도 줄바꿈(390px 폭 고정) */
export const HIGHLIGHT_LINE_TEXT_CLASS = 'min-w-0 flex-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]'

/**
 * 표시용: 큐레이션(highlightPoints) 우선, 필터 후 비면 원문(highlightPointsRaw) 필터본.
 * decode 는 호출부에서 주입(HTML 엔티티 디코더).
 */
export function resolveHighlightPointsForDisplay(
  highlightPoints: string | null | undefined,
  highlightPointsRaw: string | null | undefined,
  decode: (s: string) => string = (s) => s,
): string | null {
  if (typeof highlightPoints === 'string' && highlightPoints.trim()) {
    const t = sanitizeHighlightPointsText(decode(highlightPoints.replace(/\r\n?/g, '\n')))
    if (t) return t
  }
  if (typeof highlightPointsRaw === 'string' && highlightPointsRaw.trim()) {
    return sanitizeHighlightPointsText(decode(highlightPointsRaw.replace(/\r\n?/g, '\n')))
  }
  return null
}
