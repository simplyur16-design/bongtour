/**
 * 교보이지(kyowontour) 전용 — 상품 상단 가격·혜택·쿠폰 블록 (adapter DOM 우선, 복붙+Gemini 보완, preview/raw 보존).
 * 레거시 공용 단일 모듈은 제거됨. 등록·미리보기는 이 파일만 import한다.
 */

export type PricePromotionSnapshot = {
  basePrice: number | null
  salePrice: number | null
  savingsText: string | null
  benefitTitle: string | null
  couponAvailable: boolean | null
  couponText: string | null
  couponCtaText: string | null
  priceDisplayRaw: string | null
  benefitRawText: string | null
  benefitRawHtml: string | null
  strikeThroughDetected: boolean | null
  /** 어떤 경로로 값이 채워졌는지 검수용 */
  sourcesTried: string[]
}

export type PricePromotionFieldIssue = {
  field: string
  reason: string
  source: 'auto' | 'manual'
}

const MAX_HTML_SNIP = 8000
const MAX_RAW_TEXT = 4000

function trimStr(s: string | null | undefined, max: number): string | null {
  if (s == null) return null
  const t = String(s).trim()
  if (!t) return null
  return t.length > max ? t.slice(0, max) + '…' : t
}

function parseKrwFromString(s: string): number | null {
  const m = s.replace(/,/g, '').match(/(\d{1,3}(?:,\d{3})+|\d{4,})/g)
  if (!m?.length) return null
  const nums = m.map((x) => parseInt(x.replace(/,/g, ''), 10)).filter((n) => Number.isFinite(n) && n >= 1000)
  if (!nums.length) return null
  return Math.max(...nums)
}

/** HTML에서 취소선 구간 + 인근 가격 숫자 추출 */
export function extractPricePromotionFromHtml(html: string): PricePromotionSnapshot {
  const out = emptyPricePromotionSnapshot(['adapter_dom_html'])
  if (!html?.trim()) return out

  const snip = html.slice(0, MAX_HTML_SNIP)
  out.benefitRawHtml = snip

  let strike = false
  if (/<\s*(del|s)\b/i.test(snip)) strike = true
  if (/text-decoration\s*:\s*[^;]*line-through/i.test(snip)) strike = true
  out.strikeThroughDetected = strike

  const delBlocks: string[] = []
  snip.replace(/<\s*(del|s)\b[^>]*>([\s\S]*?)<\/\s*\1\s*>/gi, (_, _tag, inner) => {
    delBlocks.push(String(inner))
    return ''
  })
  const struckPrices: number[] = []
  for (const b of delBlocks) {
    const n = parseKrwFromString(b.replace(/<[^>]+>/g, ' '))
    if (n != null) struckPrices.push(n)
  }
  if (struckPrices.length) {
    out.basePrice = Math.max(...struckPrices)
  }

  const plain = snip.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const textish = plain.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  out.priceDisplayRaw = trimStr(textish.slice(0, 600), 600)

  const allNums = (() => {
    const ms = textish.match(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/g)
    if (!ms) return [] as number[]
    return ms
      .map((x) => parseInt(x.replace(/[,원\s]/g, ''), 10))
      .filter((n) => Number.isFinite(n) && n >= 10000)
  })()

  if (out.basePrice == null && allNums.length >= 2) {
    const sorted = [...new Set(allNums)].sort((a, b) => b - a)
    out.basePrice = sorted[0]
    out.salePrice = sorted[1]
  } else if (out.salePrice == null && allNums.length >= 1) {
    const maxN = Math.max(...allNums)
    if (out.basePrice != null && maxN < out.basePrice) out.salePrice = maxN
    else if (out.basePrice == null) out.salePrice = maxN
  }

  const savingsM = textish.match(
    /(지금\s*예약\s*시\s*[^\n]{0,40}|최대\s*[^\n]{0,30}절약|[^\n]{0,20}원\s*절약|할인\s*[^\n]{0,30})/i
  )
  out.savingsText = trimStr(savingsM?.[1] ?? null, 200)

  const benefitM = textish.match(/(할인\s*쿠폰\s*혜택|쿠폰\s*혜택|프로모션\s*혜택|카드\s*혜택[^\n]{0,40})/i)
  out.benefitTitle = trimStr(benefitM?.[1] ?? null, 120)

  const couponLine = textish.match(/(쿠폰[^\n]{0,120})/i)
  out.couponText = trimStr(couponLine?.[1] ?? null, 200)
  if (/(쿠폰\s*받기|쿠폰받기|다운로드|받기)/i.test(textish)) {
    out.couponAvailable = true
    const cta = textish.match(/(쿠폰\s*받기|쿠폰받기|혜택\s*받기)/i)
    out.couponCtaText = trimStr(cta?.[1] ?? '쿠폰 받기', 80)
  } else {
    out.couponAvailable = /쿠폰/.test(textish) ? true : null
  }

  const benefitChunk = textish.match(
    /((?:혜택|프로모션|할인|쿠폰|절약)[\s\S]{0,500}?(?=(?:일정|상품|포함|불포함|예약안내|$)))/i
  )
  out.benefitRawText = trimStr(benefitChunk?.[1] ?? null, MAX_RAW_TEXT)

  return out
}

export function emptyPricePromotionSnapshot(sourcesTried: string[] = []): PricePromotionSnapshot {
  return {
    basePrice: null,
    salePrice: null,
    savingsText: null,
    benefitTitle: null,
    couponAvailable: null,
    couponText: null,
    couponCtaText: null,
    priceDisplayRaw: null,
    benefitRawText: null,
    benefitRawHtml: null,
    strikeThroughDetected: null,
    sourcesTried: [...sourcesTried],
  }
}

/** 복붙 텍스트만 있는 경우 보조 추출 (취소선 없음 가정) */
export function extractPricePromotionFromPlainText(text: string, sourceLabel: string): PricePromotionSnapshot {
  const base = emptyPricePromotionSnapshot([sourceLabel])
  if (!text?.trim()) return base
  const t = text.replace(/\r/g, '\n').slice(0, MAX_RAW_TEXT)
  const lines = t.split(/\n/).map((x) => x.trim()).filter(Boolean)
  const joined = lines.join(' ')

  const nums = joined.match(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/g)
  const parsed = nums
    ? nums
        .map((x) => parseInt(x.replace(/[,원\s]/g, ''), 10))
        .filter((n) => Number.isFinite(n) && n >= 10000)
    : []
  if (parsed.length >= 2) {
    const u = [...new Set(parsed)].sort((a, b) => b - a)
    base.basePrice = u[0]
    base.salePrice = u[1]
  } else if (parsed.length === 1) {
    base.salePrice = parsed[0]
  }

  base.savingsText = trimStr(joined.match(/(지금\s*예약[^\n]{0,50}|최대\s*[^\n]{0,40}절약)/i)?.[0] ?? null, 200)
  base.benefitTitle = trimStr(joined.match(/(할인\s*쿠폰\s*혜택|쿠폰\s*혜택)/i)?.[0] ?? null, 120)
  base.couponText = trimStr(joined.match(/(쿠폰[^\n]{0,100})/i)?.[0] ?? null, 200)
  if (/(쿠폰\s*받기|쿠폰받기)/i.test(joined)) {
    base.couponAvailable = true
    base.couponCtaText = '쿠폰 받기'
  }
  base.priceDisplayRaw = trimStr(joined.slice(0, 500), 500)
  base.benefitRawText = trimStr(joined, MAX_RAW_TEXT)
  base.strikeThroughDetected = false
  return base
}

export function isPricePromotionSnapshotEmpty(s: PricePromotionSnapshot | null | undefined): boolean {
  if (!s) return true
  return (
    s.basePrice == null &&
    s.salePrice == null &&
    !s.savingsText &&
    !s.benefitTitle &&
    !s.couponText &&
    !s.benefitRawText &&
    !s.priceDisplayRaw
  )
}

/**
 * 병합: 구조 정보(DOM) > Gemini 정규화 > 수동 텍스트/HTML
 * 동일 필드는 더 구체적인 non-null 우선.
 */
export function mergePricePromotionLayers(
  adapterDom: PricePromotionSnapshot | null,
  gemini: PricePromotionSnapshot | null,
  manualFromHtml: PricePromotionSnapshot | null,
  manualFromText: PricePromotionSnapshot | null
): PricePromotionSnapshot {
  const pick = <T>(
    a: T | null | undefined,
    b: T | null | undefined,
    c: T | null | undefined,
    d: T | null | undefined
  ): T | null => {
    const xs = [a, b, c, d]
    for (const x of xs) {
      if (x !== null && x !== undefined && x !== '') return x as T
    }
    return null
  }

  const pickNum = (
    a: number | null | undefined,
    b: number | null | undefined,
    c: number | null | undefined,
    d: number | null | undefined
  ): number | null => {
    for (const x of [a, b, c, d]) {
      if (x != null && Number.isFinite(x) && x > 0) return x
    }
    return null
  }

  const merged: PricePromotionSnapshot = {
    basePrice: pickNum(adapterDom?.basePrice, gemini?.basePrice, manualFromHtml?.basePrice, manualFromText?.basePrice),
    salePrice: pickNum(adapterDom?.salePrice, gemini?.salePrice, manualFromHtml?.salePrice, manualFromText?.salePrice),
    savingsText: pick(adapterDom?.savingsText, gemini?.savingsText, manualFromHtml?.savingsText, manualFromText?.savingsText),
    benefitTitle: pick(
      adapterDom?.benefitTitle,
      gemini?.benefitTitle,
      manualFromHtml?.benefitTitle,
      manualFromText?.benefitTitle
    ),
    couponAvailable: pick(
      adapterDom?.couponAvailable,
      gemini?.couponAvailable,
      manualFromHtml?.couponAvailable,
      manualFromText?.couponAvailable
    ),
    couponText: pick(adapterDom?.couponText, gemini?.couponText, manualFromHtml?.couponText, manualFromText?.couponText),
    couponCtaText: pick(
      adapterDom?.couponCtaText,
      gemini?.couponCtaText,
      manualFromHtml?.couponCtaText,
      manualFromText?.couponCtaText
    ),
    priceDisplayRaw: pick(
      adapterDom?.priceDisplayRaw,
      gemini?.priceDisplayRaw,
      manualFromHtml?.priceDisplayRaw,
      manualFromText?.priceDisplayRaw
    ),
    benefitRawText: pick(
      adapterDom?.benefitRawText,
      gemini?.benefitRawText,
      manualFromHtml?.benefitRawText,
      manualFromText?.benefitRawText
    ),
    benefitRawHtml: adapterDom?.benefitRawHtml ?? manualFromHtml?.benefitRawHtml ?? gemini?.benefitRawHtml ?? null,
    strikeThroughDetected:
      adapterDom?.strikeThroughDetected === true ||
      gemini?.strikeThroughDetected === true ||
      manualFromHtml?.strikeThroughDetected === true
        ? true
        : pick(
            adapterDom?.strikeThroughDetected,
            gemini?.strikeThroughDetected,
            manualFromHtml?.strikeThroughDetected,
            manualFromText?.strikeThroughDetected
          ),
    sourcesTried: [
      ...new Set([
        ...(adapterDom?.sourcesTried ?? []),
        ...(gemini?.sourcesTried ?? []),
        ...(manualFromHtml?.sourcesTried ?? []),
        ...(manualFromText?.sourcesTried ?? []),
        'merged',
      ]),
    ],
  }

  return merged
}

/**
 * 달력/가격표로 확정된 판매가와 충돌하는 프로모 `salePrice`는 구조값에서 제거한다.
 * 운영 SSOT: 가격은 달력/가격표 우선 — 프로모 문구·LLM 숫자는 참고만.
 * @see lib/register-preview-ssot-hanatour.ts · lib/register-preview-ssot-modetour.ts · lib/register-preview-ssot-verygoodtour.ts · lib/register-preview-ssot-kyowontour.ts (미리보기 배지·문구, 공급사별)
 */
export function reconcilePromotionSalePriceWithAuthoritative(
  merged: PricePromotionSnapshot,
  authoritativeSellingPrice: number | null | undefined,
  gemini: PricePromotionSnapshot | null
): { snapshot: PricePromotionSnapshot; extraIssues: PricePromotionFieldIssue[] } {
  const extraIssues: PricePromotionFieldIssue[] = []
  const auth =
    authoritativeSellingPrice != null &&
    Number.isFinite(authoritativeSellingPrice) &&
    authoritativeSellingPrice > 0
      ? Math.round(Number(authoritativeSellingPrice))
      : null
  if (auth == null) return { snapshot: merged, extraIssues }

  let next = { ...merged }
  if (next.salePrice != null && next.salePrice !== auth) {
    const fromGemini = gemini?.salePrice != null && gemini.salePrice === next.salePrice
    extraIssues.push({
      field: 'pricePromotion.salePrice',
      reason: `프로모션 구조화 salePrice(${next.salePrice.toLocaleString('ko-KR')}원)가 달력/가격표 확정가(${auth.toLocaleString('ko-KR')}원)와 달라 제거했습니다. 가격표·달력 우선.`,
      source: 'auto',
    })
    next = {
      ...next,
      salePrice: null,
      sourcesTried: [...new Set([...(next.sourcesTried ?? []), 'reconciled_authoritative_sale_cleared'])],
    }
    if (!fromGemini) {
      /* 충돌이 Gemini 외 소스면 동일 처리 — 이미 제거됨 */
    }
  }

  return { snapshot: next, extraIssues }
}

export function buildPricePromotionFieldIssues(merged: PricePromotionSnapshot): PricePromotionFieldIssue[] {
  const issues: PricePromotionFieldIssue[] = []

  if (merged.strikeThroughDetected === true && merged.basePrice == null && merged.salePrice != null) {
    issues.push({
      field: 'basePrice',
      reason: '취소선(기존가) 표기는 DOM에서 감지됐으나 기준가 숫자를 확정하지 못했습니다. 원문·스크린 검수 필요.',
      source: 'auto',
    })
  }

  if (
    merged.salePrice == null &&
    (merged.basePrice != null || merged.priceDisplayRaw) &&
    !merged.sourcesTried?.includes('reconciled_authoritative_sale_cleared')
  ) {
    issues.push({
      field: 'salePrice',
      reason: '할인가(현재 노출가) 숫자가 비어 있습니다.',
      source: 'auto',
    })
  }

  if (/(쿠폰|혜택|프로모션|절약)/i.test(`${merged.priceDisplayRaw ?? ''} ${merged.benefitRawText ?? ''}`)) {
    if (!merged.couponText && !merged.benefitTitle && !merged.savingsText) {
      issues.push({
        field: 'benefitBlock',
        reason: '혜택·쿠폰·절약 키워드는 보이나 구조화 필드가 비었습니다. 원문 블록을 확인하세요.',
        source: 'auto',
      })
    }
  }

  if (isPricePromotionSnapshotEmpty(merged)) {
    issues.push({
      field: 'pricePromotion',
      reason: '가격·혜택 블록이 비어 있습니다. URL 수집 또는 가격/혜택 복붙을 권장합니다.',
      source: 'auto',
    })
  }

  return issues
}

export const PRICE_PROMOTION_CONSULTING_DISCLAIMER =
  '표시 금액·혜택·쿠폰 문구는 공급사 기준 원문이며, 실제 적용 여부는 상담 시 확인합니다. 조건 확정을 사이트 문구만으로 보장하지 않습니다.'

/** Gemini JSON 블록 → 스냅샷 (누락 필드는 null) */
export function parsePricePromotionFromGeminiJson(raw: unknown): PricePromotionSnapshot | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const num = (k: string): number | null => {
    const v = o[k]
    if (v == null) return null
    const n = typeof v === 'number' ? v : parseInt(String(v).replace(/,/g, ''), 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  const str = (k: string): string | null => trimStr(o[k] != null ? String(o[k]) : null, MAX_RAW_TEXT)
  const bool = (k: string): boolean | null => {
    if (o[k] === true || o[k] === false) return o[k] as boolean
    return null
  }
  return {
    basePrice: num('basePrice'),
    salePrice: num('salePrice'),
    savingsText: str('savingsText'),
    benefitTitle: str('benefitTitle'),
    couponAvailable: bool('couponAvailable'),
    couponText: str('couponText'),
    couponCtaText: str('couponCtaText'),
    priceDisplayRaw: str('priceDisplayRaw'),
    benefitRawText: str('benefitRawText'),
    benefitRawHtml: str('benefitRawHtml'),
    strikeThroughDetected:
      o.strikeThroughDetected === true || o.strikeThroughDetected === false
        ? (o.strikeThroughDetected as boolean)
        : null,
    sourcesTried: ['gemini_register_parse'],
  }
}

export type ManualPriceAssistPayload = {
  priceBlockText?: string
  benefitBlockText?: string
  priceHtmlFragment?: string
  supplierPromotionNotes?: string
}

export function buildManualPromotionAugment(manual: ManualPriceAssistPayload | null | undefined): string {
  if (!manual) return ''
  const parts: string[] = []
  if (manual.priceBlockText?.trim()) parts.push(`[가격 블록]\n${manual.priceBlockText.trim()}`)
  if (manual.benefitBlockText?.trim()) parts.push(`[혜택·쿠폰 블록]\n${manual.benefitBlockText.trim()}`)
  if (manual.supplierPromotionNotes?.trim()) parts.push(`[프로모션 메모]\n${manual.supplierPromotionNotes.trim()}`)
  if (manual.priceHtmlFragment?.trim()) {
    parts.push(`[가격·혜택 HTML 일부]\n${manual.priceHtmlFragment.trim().slice(0, 12000)}`)
  }
  return parts.join('\n\n')
}

export function manualAssistToPromotionSnapshots(manual: ManualPriceAssistPayload | null | undefined): {
  fromHtml: PricePromotionSnapshot | null
  fromText: PricePromotionSnapshot | null
} {
  if (!manual) return { fromHtml: null, fromText: null }
  const fromHtml = manual.priceHtmlFragment?.trim()
    ? extractPricePromotionFromHtml(manual.priceHtmlFragment)
    : null
  const textBlob = [manual.priceBlockText, manual.benefitBlockText, manual.supplierPromotionNotes]
    .filter(Boolean)
    .join('\n')
  const fromText = textBlob.trim()
    ? extractPricePromotionFromPlainText(textBlob, 'manual_paste_text')
    : null
  return { fromHtml, fromText }
}

export function mergeProductRawMetaPricePromotion(
  existingRawMeta: string | null,
  pack: { merged: PricePromotionSnapshot; fieldIssues: PricePromotionFieldIssue[] }
): string {
  let base: Record<string, unknown> = {}
  try {
    if (existingRawMeta?.trim()) base = JSON.parse(existingRawMeta) as Record<string, unknown>
  } catch {
    base = {}
  }
  base.pricePromotion = {
    merged: pack.merged,
    fieldIssues: pack.fieldIssues,
    savedAt: new Date().toISOString(),
  }
  return JSON.stringify(base)
}
