/**
 * 롯데관광 등록 가격: 3슬롯(성인·아동·유아). 쿠폰·총액·잔여석·적립·무이자 등 메타는 슬롯 제외.
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-lottetour'

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

function lineIsLottetourMeta(line: string): boolean {
  const s = line.replace(/\s+/g, ' ').trim()
  if (!s) return true
  if (/(성인|아동|유아)\s*[:/]/.test(s)) return false
  return /(쿠폰|할인쿠폰|쿠폰\s*적용|총\s*액|합계|잔여\s*좌석|남은\s*좌석|출발일\s*변경|적립\s*예정|포인트|무이자\s*할부|할부\s*안내|카드\s*혜택|VAT|부가세|유류\s*할증|제세\s*공과)/i.test(
    s
  )
}

function firstMainKrwInLine(line: string): number | null {
  const re = /([\d,]{2,14})\s*원/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    const start = m.index
    const pre = line.slice(Math.max(0, start - 16), start)
    if (/(유류|제세|할증|공과|쿠폰)\s*$/i.test(pre)) continue
    const n = Number(m[1]!.replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }
  return null
}

type Tier = 'adult' | 'child' | 'infant'

function detectTier(line: string): Tier | null {
  const s = stripLeadingPriceRowNoise(line).replace(/\s+/g, ' ').trim()
  if (!s || lineIsLottetourMeta(s)) return null
  if (/^유아(?=[\s(]|$)/i.test(s) || /^소아\s*\(\s*만\s*2\s*세\s*미만/i.test(s)) return 'infant'
  if (/^성인(?=[\s(]|$)/i.test(s)) return 'adult'
  if (/^아동(?=[\s(]|$)/i.test(s)) return 'child'
  return null
}

export type LottetourThreeSlotExtract = {
  adultPrice: number | null
  childPrice: number | null
  infantPrice: number | null
}

export function extractLottetourThreeSlotPricesFromBlob(blob: string): LottetourThreeSlotExtract | null {
  if (!blob?.trim()) return null
  const lines = blob.replace(/\r/g, '\n').split('\n')
  const out: LottetourThreeSlotExtract = { adultPrice: null, childPrice: null, infantPrice: null }
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
    const peek = detectTier(line)
    let price = firstMainKrwInLine(line)
    if (peek && price == null && i + 1 < lines.length) {
      const nxt = stripLeadingPriceRowNoise(lines[i + 1]!)
      if (/^[\d,]{2,14}\s*원?\s*$/i.test(nxt)) {
        line = `${line} ${nxt.includes('원') ? nxt : `${nxt}원`}`
        i++
        price = firstMainKrwInLine(line)
      }
    }
    const slot = detectTier(line)
    if (!slot || price == null) continue
    if (slot === 'adult') out.adultPrice = price
    else if (slot === 'child') out.childPrice = price
    else out.infantPrice = price
  }
  const filled = [out.adultPrice, out.childPrice, out.infantPrice].filter((x) => x != null).length
  return filled > 0 ? out : null
}

function lottetourExtraPriceBlobFromDetailBody(parsed: RegisterParsed): string {
  const snap = parsed.detailBodyStructured
  if (!snap?.sections?.length) return ''
  const chunks: string[] = []
  for (const sec of snap.sections) {
    const txt = sec.text?.trim() ?? ''
    if (!txt || txt.length > 12000) continue
    if (!/(?:성인|아동|유아)/.test(txt)) continue
    if (
      /(?:구분|연령|대상).{0,60}(?:가격|요금)/i.test(txt) ||
      /(?:가격표|요금\s*안내)/i.test(txt) ||
      (/(?:성인|아동|유아)/.test(txt) &&
        /(?:남은\s*좌석|교통|출발일\s*변경|할인쿠폰|쿠폰\s*할인|쿠폰\s*적용)/i.test(txt))
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

function lottetourPriceBlobFromParsed(parsed: RegisterParsed): string {
  const nr = parsed.detailBodyStructured?.normalizedRaw?.trim() ?? ''
  /** 섹션 앵커(예: `쇼핑 5회`) 때문에 가격 블록이 summary에서 잘리는 경우 — 상단 원문 일부를 항상 넣어 3슬롯 추출 안정화 */
  const head = nr.length > 0 ? nr.slice(0, 14000) : ''
  return [
    (parsed.priceTableRawText ?? '').trim(),
    stripHtmlLoose(parsed.priceTableRawHtml ?? null),
    lottetourExtraPriceBlobFromDetailBody(parsed),
    head,
  ]
    .filter((x) => x.length > 0)
    .join('\n\n')
}

function collapseLlmChildToSingle(table: NonNullable<RegisterParsed['productPriceTable']>): number | null {
  const cx = table.childExtraBedPrice
  const cn = table.childNoBedPrice
  if (cx != null && cn != null) return cx
  return cx ?? cn ?? null
}

export function finalizeLottetourProductPriceTable(
  table: RegisterParsed['productPriceTable'] | null | undefined,
  blob: string
): RegisterParsed['productPriceTable'] | null {
  const fromBlob = extractLottetourThreeSlotPricesFromBlob(blob)
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

export function finalizeLottetourRegisterParsedPricing(parsed: RegisterParsed): RegisterParsed {
  const blob = lottetourPriceBlobFromParsed(parsed)
  const next = finalizeLottetourProductPriceTable(parsed.productPriceTable ?? null, blob)
  if (next === null) return parsed
  return { ...parsed, productPriceTable: next }
}
