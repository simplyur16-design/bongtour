/**
 * 참좋은여행 등록 가격: 3슬롯(성인·아동·유아)만 사용.
 * 엑베/노베드 이원 분리 없음 — 저장 필드는 기존 `BodyProductPriceTable`을 쓰되
 * `childExtraBedPrice`에만 아동 단가를 두고 `childNoBedPrice`는 항상 null로 정리한다.
 * 가이드경비·인솔 등은 슬롯 추출 대상에서 제외한다.
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-verygoodtour'

function stripHtmlLoose(html: string | null | undefined): string {
  if (!html?.trim()) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function stripLeadingPriceRowNoise(s: string): string {
  return s
    .replace(/\r/g, '')
    .trim()
    .replace(/^[-*•·]+\s*/u, '')
    .replace(/^\d+[.)]\s+/, '')
    .trim()
}

/** 가이드경비·인솔·팁·현지경비 등 — 본가 슬롯으로 넣지 않음 */
function lineIsGuideOrNonProductPrice(line: string): boolean {
  const s = line.replace(/\s+/g, ' ').trim()
  if (!s) return true
  if (
    /(가이드\s*경비|가이드경비|가이드\s*경비\s*별도|인솔\s*비용|인솔자|인솔\s*팁|현지\s*경비|가이드\s*팁|Tipping|Guide\s*tip|기사\s*팁)/i.test(
      s
    )
  ) {
    return true
  }
  return false
}

/** 유류·제세 안내 줄 전체 — 연령 슬롯으로 쓰지 않음 */
function lineIsFuelTaxNarrativeOnly(line: string): boolean {
  const s = line.replace(/\s+/g, ' ').trim()
  if (/(성인|아동|유아)\s*[:/]/.test(s)) return false
  if (/유류\s*할증료?\s*포함|제세\s*공과금?\s*포함|연료\s*할증\s*포함|공과금\s*포함/i.test(s)) return true
  if (/^[\s※▶*•\-]*유류\s*할증/i.test(s)) return true
  return false
}

/** 성인/아동/유아 라벨 없이 잔여석·쿠폰·할부 등만 있는 줄 */
function lineIsPriceMetaOnly(line: string): boolean {
  const s = line.replace(/\s+/g, ' ').trim()
  if (/(성인|아동|유아)/.test(s)) return false
  return /^(잔여|남은\s*좌석|쿠폰|할인|무이자|출발일\s*변경|총\s*액|총\s*금액|합계|패키지\s*가격|상품\s*가격\s*안내|결제|VAT|부가세)/i.test(
    s
  )
}

/** 1인실 추가요금 등 — 연령 슬롯에 넣지 않음 */
function lineIsVerygoodRoomSurchargeLine(line: string): boolean {
  const s = line.replace(/\s+/g, ' ').trim()
  return /(객실\s*1인\s*1실|1인\s*1실\s*사용|1인실\s*사용|\*\s*객실)/i.test(s)
}

/** 본가: 같은 줄에서 유류·제세·할증·공과 직전의 '원' 금액은 제외 */
function firstMainKrwInLine(line: string): number | null {
  const re = /([\d,]{2,14})\s*원/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    const start = m.index
    const pre = line.slice(Math.max(0, start - 16), start)
    if (/(유류|제세|할증|공과)\s*$/i.test(pre)) continue
    const n = Number(m[1]!.replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }
  return null
}

type VerygoodTier = 'adult' | 'child' | 'infant'

function detectVerygoodTierSlot(line: string): VerygoodTier | null {
  const s = stripLeadingPriceRowNoise(line).replace(/\s+/g, ' ').trim()
  if (
    !s ||
    lineIsGuideOrNonProductPrice(s) ||
    lineIsPriceMetaOnly(s) ||
    lineIsFuelTaxNarrativeOnly(s) ||
    lineIsVerygoodRoomSurchargeLine(s)
  )
    return null
  if (
    /^유아(?:만)?(?=[\s\d(;]|$)/i.test(s) ||
    /^소아\s*\(\s*만\s*2\s*세\s*미만/i.test(s)
  )
    return 'infant'
  if (/^성인(?:만)?(?=[\s\d(;]|$)/i.test(s)) return 'adult'
  if (/^아동아동/i.test(s) || /^아동/i.test(s)) return 'child'
  return null
}

export type VerygoodThreeSlotExtract = {
  adultPrice: number | null
  childPrice: number | null
  infantPrice: number | null
}

function isVerygoodPriceNoiseBetweenTierAndKrw(s: string): boolean {
  const t = stripLeadingPriceRowNoise(s.replace(/\s+/g, ' ').trim())
  if (!t) return true
  if (/^상품가격$/i.test(t)) return true
  if (/^구분\s*$/i.test(t)) return true
  if (/^\([^)]{1,120}\)\s*$/.test(t)) return true
  if (/^[·•]\s*(유류|제세|할증|공과)/i.test(t)) return true
  if (/유류\s*할증|제세\s*공과금?|공과금\s*포함|할증료.*포함/i.test(t)) return true
  if (/\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}\s*~\s*\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}/.test(t) && !/원/.test(t))
    return true
  return false
}

/** 성인/아동/유아 라벨과 본가 원화 사이에 끼는 줄(상품가격, 인원수, 유류 안내 등)을 건너뜀 */
function expandVerygoodPriceLinesWithContinuation(rawLines: string[]): string[] {
  const expanded: string[] = []
  let i = 0
  while (i < rawLines.length) {
    const t = stripLeadingPriceRowNoise(rawLines[i]!.trim())
    if (!t) {
      i++
      continue
    }
    const slot = detectVerygoodTierSlot(t)
    const priceHere = firstMainKrwInLine(t)
    if (slot && priceHere == null) {
      let j = i + 1
      let merged: string | null = null
      while (j < rawLines.length && j - i <= 24) {
        const s = stripLeadingPriceRowNoise(rawLines[j]!.trim())
        if (!s) {
          j++
          continue
        }
        if (/^(?:0|1|2|3|4|5|6|7|8|9|10)\s*$/.test(s) && !/원/.test(s)) {
          j++
          continue
        }
        if (isVerygoodPriceNoiseBetweenTierAndKrw(s)) {
          j++
          continue
        }
        if (detectVerygoodTierSlot(s)) break
        const px = firstMainKrwInLine(s)
        if (px != null) {
          const fixed = /원/.test(s) ? s : `${s.replace(/\s+/g, '').match(/^[\d,]+/)?.[0] ?? s.trim()}원`
          merged = `${t} ${fixed}`
          break
        }
        j++
      }
      if (merged) {
        expanded.push(merged)
        i = j + 1
        continue
      }
    }
    expanded.push(t)
    i++
  }
  return expanded
}

function trimVerygoodPriceBlobBeforeTotals(blob: string): string {
  const lines = blob.replace(/\r/g, '\n').split('\n')
  const out: string[] = []
  for (const line of lines) {
    const t = line.trim()
    if (/^(?:총\s*금액|가이드\s*경비)\b/i.test(t)) break
    out.push(line)
  }
  return out.join('\n')
}

export function extractVerygoodThreeSlotPricesFromBlob(blob: string): VerygoodThreeSlotExtract | null {
  if (!blob?.trim()) return null
  const trimmed = trimVerygoodPriceBlobBeforeTotals(blob)
  const lines = expandVerygoodPriceLinesWithContinuation(trimmed.replace(/\r/g, '\n').split('\n'))
  const out: VerygoodThreeSlotExtract = {
    adultPrice: null,
    childPrice: null,
    infantPrice: null,
  }
  for (let i = 0; i < lines.length; i++) {
    let line = stripLeadingPriceRowNoise(lines[i]!)
    if (!line) continue
    if (/^(?:0|1|2|3|4|5|6|7|8|9|10)\s*$/.test(line) && !/원/.test(line)) continue
    if (/^[\d,]{2,14}\s*$/.test(line) && i + 1 < lines.length) {
      const nxt = stripLeadingPriceRowNoise(lines[i + 1]!)
      if (/^원\s*$/i.test(nxt)) {
        line = `${line}원`
        i++
      }
    }
    const slotPeek = detectVerygoodTierSlot(line)
    let price = firstMainKrwInLine(line)
    if (slotPeek && price == null && i + 1 < lines.length) {
      const nxt = stripLeadingPriceRowNoise(lines[i + 1]!)
      if (/^[\d,]{2,14}\s*원?\s*$/i.test(nxt)) {
        line = `${line} ${nxt.includes('원') ? nxt : `${nxt}원`}`
        i++
        price = firstMainKrwInLine(line)
      }
    }
    const slot = detectVerygoodTierSlot(line)
    if (!slot) continue
    if (price == null) continue
    if (slot === 'adult') out.adultPrice = price
    else if (slot === 'child') out.childPrice = price
    else out.infantPrice = price
  }
  const filled = [out.adultPrice, out.childPrice, out.infantPrice].filter((x) => x != null).length
  return filled > 0 ? out : null
}

/**
 * detailBody normalizedRaw 에서 상품가격~총금액/가이드경비 직전까지 잘라 3슬롯 추출 입력을 보강한다.
 * (priceTableRawText 가 비었을 때 finalize 단계에서만 본문이 빠지는 문제 방지)
 */
function sliceVerygoodPriceBlockFromNormalizedRaw(normalizedRaw: string | null | undefined): string {
  const raw = String(normalizedRaw ?? '').replace(/\r/g, '\n')
  if (!raw.trim()) return ''
  let start = 0
  const sm = /상품\s*가격|상품가격|연령\s*별\s*요금|구분\s*[^\n]{0,40}가격/i.exec(raw)
  if (sm?.index != null) start = sm.index
  const tail = raw.slice(start)
  const endM = /\n\s*(?:총\s*금액|가이드\s*경비)\b/i.exec(tail)
  const sliced = (endM ? tail.slice(0, endM.index) : tail).trim()
  return sliced.length >= 12 ? sliced.slice(0, 20000) : ''
}

/** 본문 섹션·normalizedRaw 에만 있는 연령 표를 보강(가격표 raw 누락 대비) */
function verygoodExtraPriceBlobFromDetailBody(parsed: RegisterParsed): string {
  const snap = parsed.detailBodyStructured
  if (!snap?.sections?.length) return ''
  const chunks: string[] = []
  for (const sec of snap.sections) {
    const txt = sec.text?.trim() ?? ''
    if (!txt || txt.length > 12000) continue
    if (!/(?:성인|아동|유아)/.test(txt)) continue
    if (
      /(?:구분|연령|대상).{0,60}(?:가격|요금)/i.test(txt) ||
      /(?:가격표|요금\s*안내|상품\s*가격|상품가격)/i.test(txt) ||
      (/(?:성인|아동|유아)/.test(txt) &&
        /(?:유류\s*할증|상품가격|성인만|아동아동|아동\(|유아만|남은\s*좌석|교통|출발일\s*변경)/i.test(txt))
    ) {
      chunks.push(txt)
    }
  }
  const raw = snap.normalizedRaw?.trim() ?? ''
  let tail = ''
  if (raw && /(?:성인|아동|유아).{0,120}(?:원|[\d,]{4,})/.test(raw)) {
    const paras = raw.split(/\n{2,}/)
    const hit = paras.filter(
      (p) =>
        /(?:성인|아동|유아)/.test(p) &&
        (/[\d,]{3,}\s*원/.test(p) || /[\d,]{3,}\s*\n\s*원/.test(p)) &&
        !/^\s*(?:일정|스케줄)\s*:/i.test(p.slice(0, 32))
    )
    tail = hit.join('\n\n').slice(0, 8000)
  }
  return [...chunks, tail].filter(Boolean).join('\n\n')
}

function verygoodPriceBlobFromParsed(parsed: RegisterParsed): string {
  const fromNorm = sliceVerygoodPriceBlockFromNormalizedRaw(parsed.detailBodyStructured?.normalizedRaw ?? null)
  return [
    (parsed.priceTableRawText ?? '').trim(),
    stripHtmlLoose(parsed.priceTableRawHtml ?? null),
    verygoodExtraPriceBlobFromDetailBody(parsed),
    fromNorm,
  ]
    .filter((x) => x.length > 0)
    .join('\n\n')
}

function collapseLlmChildToSingle(
  table: NonNullable<RegisterParsed['productPriceTable']>
): number | null {
  const cx = table.childExtraBedPrice
  const cn = table.childNoBedPrice
  if (cx != null && cn != null) {
    if (cx === cn) return cx
    return cx
  }
  return cx ?? cn ?? null
}

/**
 * LLM·라벨 병합 후 참좋은 3슬롯 규약으로 `productPriceTable` 정리.
 * 유류/제세 문구는 `firstMainKrwInLine`으로 본가 숫자와 분리.
 */
export function finalizeVerygoodProductPriceTable(
  table: RegisterParsed['productPriceTable'] | null | undefined,
  blob: string
): RegisterParsed['productPriceTable'] | null {
  const fromBlob = extractVerygoodThreeSlotPricesFromBlob(blob)
  const t = table ?? null

  let adult = t?.adultPrice ?? null
  let child = t ? collapseLlmChildToSingle(t as NonNullable<RegisterParsed['productPriceTable']>) : null
  let infant = t?.infantPrice ?? null

  if (fromBlob) {
    if (fromBlob.adultPrice != null) adult = fromBlob.adultPrice
    if (fromBlob.childPrice != null) child = fromBlob.childPrice
    if (fromBlob.infantPrice != null) infant = fromBlob.infantPrice
  }

  const hasAny = adult != null || child != null || infant != null
  if (!hasAny) {
    if (!t) return null
    return {
      adultPrice: t.adultPrice ?? null,
      childExtraBedPrice: collapseLlmChildToSingle(t as NonNullable<RegisterParsed['productPriceTable']>),
      childNoBedPrice: null,
      infantPrice: t.infantPrice ?? null,
    }
  }

  return {
    adultPrice: adult,
    childExtraBedPrice: child,
    childNoBedPrice: null,
    infantPrice: infant,
  }
}

export function finalizeVerygoodRegisterParsedPricing(parsed: RegisterParsed): RegisterParsed {
  const blob = verygoodPriceBlobFromParsed(parsed)
  const next = finalizeVerygoodProductPriceTable(parsed.productPriceTable ?? null, blob)
  if (next === null) return parsed
  return { ...parsed, productPriceTable: next }
}
