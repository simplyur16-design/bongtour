/**
 * 모두투어 등록 가격: 4슬롯(adult / childExtraBed / childNoBed / infant)만 사용.
 * 성인가로 아동·유아 슬롯을 채우지 않는다(infant ?? adult 금지).
 */
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import type { RegisterParsed } from '@/lib/register-llm-schema-modetour'
import type { DepartureInput } from '@/lib/upsert-product-departures-modetour'
import type { BodyProductPriceTable } from '@/lib/public-product-extras'
import {
  extractProductPriceTableByLabels,
  mergeProductPriceTableWithLabelExtract,
  type ProductPriceTableByLabels,
} from '@/lib/product-price-table-extract'
import {
  extractInfantPriceKrwFromText,
  hintInfantPriceInPaste,
  mergeInfantPriceIntoProductPriceTable,
} from '@/lib/infant-price-extract'
import { normalizeCalendarDate } from '@/lib/date-normalize'
import { extractIsoDate } from '@/lib/hero-date-utils'
import { isScheduleAdultBookable } from '@/lib/price-utils'

export {
  extractProductPriceTableByLabels,
  mergeProductPriceTableWithLabelExtract,
} from '@/lib/product-price-table-extract'

type PriceSlot = 'adult' | 'childExtra' | 'childNo' | 'infant'

/** 즉시할인·쿠폰 등 — 상품가격 세로표 금액 수집에서 제외(예: 30,000원 할인이 유아 슬롯으로 오인) */
function isModetourPromoDiscountLine(line: string): boolean {
  const s = line.replace(/\s+/g, ' ').trim()
  if (!s) return false
  if (/즉시\s*할인|할인\s*쿠폰|쿠폰\s*받기|최대\s*\d+\s*만\s*원\s*절약/i.test(s)) return true
  if (/\d{1,3}(?:,\d{3})+\s*원\s*할인/i.test(s)) return true
  if (/할인\s*\[/.test(s) && /원/.test(s)) return true
  return false
}

/** 기본가(성인·아동·유아) 후보에서 제외 — 1인 객실·현지합류·가이드경비·선택경비 등 */
export function isModetourNonBasePriceLine(line: string): boolean {
  const t = line.replace(/\s+/g, ' ').trim()
  if (!t) return false
  if (/현지\s*합류|현지\s*투어\s*합류|현지합류/.test(t)) return true
  if (/1인\s*객실|객실\s*추가\s*사용료|객실추가|싱글\s*차지|싱글차지|독실|룸\s*차지/.test(t)) return true
  if (/가이드\s*경비|기사\s*경비|인솔\s*경비/.test(t)) return true
  if (/선택\s*경비|선택경비/.test(t)) return true
  if (/개인\s*경비/.test(t)) return true
  if (/현지\s*지급|현장\s*결제|별도\s*결제/.test(t) && !/^성인\b/i.test(t)) return true
  if (/추가\s*요금/.test(t) && !/(?:^|[\s/])(?:성인|아동|유아|소아)\b/i.test(t)) return true
  if (/[￥円]|엔\s*\d|JPY/i.test(t) && !/(?:^|[\s/])성인\b/i.test(t)) return true
  return false
}

export let lastModetourPriceClassificationTrace: string[] = []

function pushModetourPriceTrace(msg: string) {
  lastModetourPriceClassificationTrace.push(msg)
  if (lastModetourPriceClassificationTrace.length > 80) lastModetourPriceClassificationTrace.shift()
}

/** 1인 객실 등 → 불포함 탭용 원문 줄 */
export function extractModetourSingleRoomLinesFromBlob(blob: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of blob.split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (!line || !isModetourNonBasePriceLine(line)) continue
    if (!/1인\s*객실|객실\s*추가\s*사용료|싱글\s*차지|싱글차지|독실|룸\s*차지/.test(line)) continue
    if (seen.has(line)) continue
    seen.add(line)
    out.push(line)
  }
  return out
}

/** `product-price-table-extract`와 동일 — 공용 파일 수정 없이 모두투어 보조 추출에 사용 */
function stripLeadingPriceRowNoise(s: string): string {
  return s
    .replace(/\r/g, '')
    .trim()
    .replace(/^[-*•·]+\s*/u, '')
    .replace(/^\d+[.)]\s+/, '')
    .trim()
}

/** 모두투어 본문: "성인 … / 아동(엑베) … / …" 한 줄 다중 슬롯 분리 */
function normalizeModetourPriceBlobForExtract(blob: string): string {
  const lines = blob.split(/\n/).flatMap((line) => {
    const t = stripLeadingPriceRowNoise(line.trim())
    if (!t) return [] as string[]
    if ((/\s\/\s/.test(t) || /\s[|｜]\s/.test(t)) && /(?:성인|아동|유아|소아)/.test(t)) {
      return t
        .split(/\s*(?:\/|[|｜])\s*/)
        .map((p) => stripLeadingPriceRowNoise(p))
        .filter(Boolean)
    }
    if (/[·•]/.test(t) && /(?:성인|아동|유아|소아)/.test(t)) {
      return t
        .split(/\s*[·•]\s*/)
        .map((p) => stripLeadingPriceRowNoise(p))
        .filter(Boolean)
    }
    if (/;\s*(?:성인|아동|유아|소아|infant)\b/i.test(t)) {
      return t
        .split(/\s*;\s*/)
        .map((p) => stripLeadingPriceRowNoise(p))
        .filter(Boolean)
    }
    if (/(?:[\d,]\s*원)\s+(?=[성인아동유소]|infant\b)/i.test(t)) {
      return t
        .split(/\s+(?=(?:성인|아동|유아|소아|infant)\b)/i)
        .map((p) => stripLeadingPriceRowNoise(p))
        .filter(Boolean)
    }
    return [t]
  })
  return lines.join('\n')
}

function stripHtmlLoose(html: string | null | undefined): string {
  if (!html?.trim()) return ''
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

/** 유류·제세 등 본가가 아닌 금액 제외 — product-price-table-extract 와 동일 취지 */
function firstMainKrwInLine(line: string): number | null {
  if (isModetourNonBasePriceLine(line)) return null
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

/** `원` 생략·표 끝 숫자 열 — 본가 추출 보강 */
function firstMainPriceKrwModetour(line: string): number | null {
  if (isModetourNonBasePriceLine(line)) return null
  const w = firstMainKrwInLine(line)
  if (w != null) return w
  const m = line.match(/(?:^|[^\d,])([\d,]{2,14})(?!\d)\s*$/)
  if (!m?.[1]) return null
  const idx = line.lastIndexOf(m[1])
  const pre = line.slice(Math.max(0, idx - 20), idx)
  if (/(유류|제세|할증|공과)\s*$/i.test(pre)) return null
  const n = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 100) return null
  return Math.round(n)
}

/** 부가요금 줄에서만 금액 수집 — `firstMainKrwInLine`은 비기본가 줄을 막아 별도 경로 */
function extractKrwWonFromLineForSurchargeAudit(line: string): number | null {
  const re = /([\d,]{2,14})\s*원/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    const start = m.index
    const pre = line.slice(Math.max(0, start - 16), start)
    if (/(유류|제세|할증|공과)\s*$/i.test(pre)) continue
    const n = Number(m[1]!.replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) return Math.round(n)
  }
  const mm = line.match(/(?:^|[^\d,])([\d,]{2,14})(?!\d)\s*$/)
  if (!mm?.[1]) return null
  const idx = line.lastIndexOf(mm[1])
  const pre = line.slice(Math.max(0, idx - 20), idx)
  if (/(유류|제세|할증|공과)\s*$/i.test(pre)) return null
  const n = Number(mm[1].replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 100) return null
  return Math.round(n)
}

function collectModetourSurchargeKrwAmountsFromBlob(blob: string): Set<number> {
  const set = new Set<number>()
  for (const raw of blob.split('\n')) {
    const line = raw.replace(/\s+/g, ' ').trim()
    if (!line || !isModetourNonBasePriceLine(line)) continue
    const n = extractKrwWonFromLineForSurchargeAudit(line)
    if (n != null && n > 0) set.add(n)
  }
  return set
}

function scrubModetourProductPriceTableSlotsAgainstBlob(
  table: ProductPriceTableByLabels,
  blob: string
): ProductPriceTableByLabels {
  const bad = collectModetourSurchargeKrwAmountsFromBlob(blob)
  if (bad.size === 0) return table
  const next: ProductPriceTableByLabels = { ...table }
  const keys = ['adultPrice', 'childExtraBedPrice', 'childNoBedPrice', 'infantPrice'] as const
  for (const key of keys) {
    const val = next[key]
    if (val != null && bad.has(Math.round(Number(val)))) {
      pushModetourPriceTrace(`rejectedPriceCandidate:${key}=${val}:surcharge-line-amount`)
      next[key] = null
    }
  }
  return next
}

/**
 * 공용 라벨 추출이 놓치는 모두투어식 표기(아동 엑스트라/노베드 등) 보강.
 */
function detectModetourPriceSlotLine(line: string): PriceSlot | null {
  const s = stripLeadingPriceRowNoise(line.replace(/\s+/g, ' ').trim())
  if (!s) return null
  if (isModetourNonBasePriceLine(s)) return null
  if (/^성인(?=[\s(/]|$)/.test(s)) return 'adult'
  if (
    /아동\s*[（(]\s*extra\s*bed/i.test(s) ||
    /아동\s*\(?\s*extra\s*bed/i.test(s) ||
    /아동\s*extra\s*bed/i.test(s) ||
    /아동\s*\(?\s*extrabed/i.test(s) ||
    /아동\s*\(?\s*엑스트라/i.test(s) ||
    /엑스트라\s*베드/i.test(s) ||
    /엑스트라베드/i.test(s) ||
    /아동\s*\(?\s*엑베\s*\)?/i.test(s) ||
    /아동\s*엑베\b/i.test(s) ||
    /아동\s*\(\s*엑베\s*\)/i.test(s) ||
    /(?:^|[\s/])엑베\b/i.test(s) ||
    /(?:^|\s)엑스트라\s*베드/i.test(s) ||
    /(?:^|[\s/])(?:child|아동)[^\n]{0,40}extra\s*bed/i.test(s) ||
    /(?:아동|소아|child|만\s*\d+\s*세).{0,80}(?:침대\s*제공|침대\s*있음|with\s*bed)/i.test(s)
  )
    return 'childExtra'
  if (
    /아동\s*[（(]\s*no\s*bed/i.test(s) ||
    /아동\s*\(?\s*no\s*bed/i.test(s) ||
    /아동\s*\(?\s*nobed/i.test(s) ||
    /아동\s*\(?\s*노베드/i.test(s) ||
    /아동\s*노베드/i.test(s) ||
    /아동\s*노베\b/i.test(s) ||
    /(?:^|[\s/])(?:child|아동)[^\n]{0,40}no\s*bed/i.test(s) ||
    /(?:^|[\s/])노\s*베드/i.test(s) ||
    (/(?:^|[\s/])노베드/i.test(s) && /(?:아동|child|소아)/i.test(s))
  )
    return 'childNo'
  if (
    /^유아(?=[\s(/]|$)/.test(s) ||
    /유아\s*요금/.test(s) ||
    /만\s*2\s*세\s*미만/.test(s) ||
    /^소아\s*\(\s*만\s*2\s*세\s*미만/i.test(s) ||
    /^소아\s*\(\s*24\s*개월/i.test(s) ||
    /^infant\b/i.test(s) ||
    /^인팬트\b/i.test(s)
  )
    return 'infant'
  return null
}

function assignModetourSlot(out: ProductPriceTableByLabels, slot: PriceSlot, price: number) {
  if (slot === 'adult') out.adultPrice = price
  else if (slot === 'childExtra') out.childExtraBedPrice = price
  else if (slot === 'childNo') out.childNoBedPrice = price
  else out.infantPrice = price
}

/** 성인/아동/유아 행과 본가 사이에 끼는 `상품가격`, 연령 괄호, 유류·제세 안내 줄 */
function isModetourPriceNoiseBetweenTierAndKrw(s: string): boolean {
  const t = stripLeadingPriceRowNoise(s.replace(/\s+/g, ' ').trim())
  if (!t) return true
  if (/^상품가격$/i.test(t)) return true
  if (/^구분\s*$/i.test(t)) return true
  if (/^\([^)]{1,120}\)\s*$/.test(t)) return true
  if (/^(만\s*)?\d+\s*세\s*(이상|미만)\s*;?\s*$/i.test(t)) return true
  if (/^[·•]\s*(유류|제세|할증|공과)/i.test(t)) return true
  if (/유류\s*할증|제세\s*공과금?|공과금\s*포함|할증료.*포함/i.test(t)) return true
  return false
}

function expandModetourPriceLinesWithContinuation(rawLines: string[]): string[] {
  const expanded: string[] = []
  let i = 0
  while (i < rawLines.length) {
    const t = stripLeadingPriceRowNoise(rawLines[i]!.trim())
    if (!t) {
      i++
      continue
    }
    const slotOnly = detectModetourPriceSlotLine(t)
    const priceHere = firstMainPriceKrwModetour(t)

    if (slotOnly && priceHere == null) {
      let j = i + 1
      let merged: string | null = null
      while (j < rawLines.length && j - i <= 24) {
        const s = stripLeadingPriceRowNoise(rawLines[j]!.trim())
        if (!s) {
          j++
          continue
        }
        if (isModetourPriceNoiseBetweenTierAndKrw(s)) {
          j++
          continue
        }
        if (detectModetourPriceSlotLine(s)) break
        const px = firstMainPriceKrwModetour(s)
        if (px != null) {
          const withWon = /원/.test(s) ? s : `${s.replace(/\s+/g, '').match(/^[\d,]+/)?.[0] ?? s.trim()}원`
          merged = `${t} ${withWon}`
          break
        }
        j++
      }
      if (merged) {
        if (isModetourNonBasePriceLine(merged)) {
          expanded.push(t)
          i = j + 1
          continue
        }
        expanded.push(merged)
        i = j + 1
        continue
      }
    }

    if (slotOnly && priceHere == null && i + 1 < rawLines.length) {
      const nxt = stripLeadingPriceRowNoise(rawLines[i + 1]!.trim())
      if (/^[\d,]{2,14}\s*원?\s*$/i.test(nxt)) {
        expanded.push(`${t} ${nxt.includes('원') ? nxt : `${nxt}원`}`)
        i += 2
        continue
      }
    }

    expanded.push(t)
    i++
  }
  return expanded
}

function extractModetourSupplementLabelTable(blob: string): ProductPriceTableByLabels | null {
  if (!blob.trim()) return null
  const out: ProductPriceTableByLabels = {
    adultPrice: null,
    childExtraBedPrice: null,
    childNoBedPrice: null,
    infantPrice: null,
  }
  const rawLines = blob.split('\n').map((l) => l.trim()).filter(Boolean)
  const lines = expandModetourPriceLinesWithContinuation(rawLines)
  for (const line of lines) {
    const t = stripLeadingPriceRowNoise(line.trim())
    if (!t) continue
    if (isModetourNonBasePriceLine(t)) continue
    if (t.includes('\t')) {
      const cells = t.split('\t').map((c) => stripLeadingPriceRowNoise(c)).filter(Boolean)
      for (let i = 0; i < cells.length; i++) {
        const rowHay = [cells[i], cells[i + 1]].filter(Boolean).join('\t')
        if (isModetourNonBasePriceLine(rowHay)) continue
        const slot = detectModetourPriceSlotLine(cells[i]!)
        if (!slot) continue
        const price =
          firstMainPriceKrwModetour(cells[i + 1] ?? '') ??
          firstMainPriceKrwModetour(`${cells[i]}\t${cells[i + 1] ?? ''}`) ??
          firstMainPriceKrwModetour(t)
        if (price == null) continue
        assignModetourSlot(out, slot, price)
      }
    }
    const slot = detectModetourPriceSlotLine(t)
    if (!slot) continue
    const price = firstMainPriceKrwModetour(t)
    if (price == null) continue
    assignModetourSlot(out, slot, price)
  }
  const filled = [out.adultPrice, out.childExtraBedPrice, out.childNoBedPrice, out.infantPrice].filter(
    (x) => x != null
  ).length
  return filled ? out : null
}

/** 본문 상단·요약에도 `상품가격` 문구가 있어 첫 번째 매칭이 표가 아닐 수 있음 — 금액 열이 실제로 이어지는 마지막 `상품가격` 행을 쓴다. */
function findModetourStackedProductPriceHeaderIndex(lines: string[]): number {
  const candidates: number[] = []
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]!
    if (!/^상품\s*가격$/i.test(ln)) continue
    let cnt = 0
    for (let j = i + 1; j < Math.min(i + 14, lines.length); j++) {
      const t = stripLeadingPriceRowNoise(lines[j]!)
      if (!t) continue
      if (/^(유류|제세|할증|공과)/i.test(t)) continue
      if (/^[\s·•]+(유류|제세|할증|공과)/i.test(t)) continue
      const n = firstMainPriceKrwModetour(t)
      if (n != null && n > 0) cnt++
    }
    if (cnt >= 2) candidates.push(i)
  }
  return candidates.length ? candidates[candidates.length - 1]! : -1
}

/**
 * 모두투어 PC 본문: 구분 열(성인·아동·유아)이 위에, `상품가격` 헤더 아래에 금액이 세로로 나열하는 표.
 * 기존 `expandModetourPriceLinesWithContinuation`은 중간에 다음 구간 라벨이 나오면 성인-금액 매칭이 끊긴다.
 */
function extractModetourStackedPriceTableFromBlob(blob: string): ProductPriceTableByLabels | null {
  const rawLines = blob.replace(/\r/g, '\n').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)
  let idx = findModetourStackedProductPriceHeaderIndex(rawLines)
  if (idx < 0) {
    idx = rawLines.findIndex((l) => /^상품\s*가격$/i.test(l))
  }
  if (idx < 0) return null
  let 구분Idx = -1
  for (let i = 0; i < idx; i++) {
    if (/^구분$/i.test(rawLines[i]!)) 구분Idx = i
  }
  const before = 구분Idx >= 0 ? rawLines.slice(구분Idx + 1, idx) : rawLines.slice(0, idx)
  const tiers: PriceSlot[] = []
  for (const line of before) {
    const slot = detectModetourPriceSlotLine(line)
    if (!slot) continue
    if (firstMainPriceKrwModetour(line) != null) continue
    tiers.push(slot)
  }
  if (tiers.length < 2) return null
  const after = rawLines.slice(idx + 1)
  const prices: number[] = []
  for (const line of after) {
    if (prices.length >= 6) break
    const t = stripLeadingPriceRowNoise(line)
    if (!t) continue
    if (isModetourPromoDiscountLine(t)) continue
    if (/^[\s·•]+(유류|제세|할증|공과)/i.test(t)) continue
    if (/^(유류|제세|할증|공과)/i.test(t)) continue
    const n = firstMainPriceKrwModetour(t)
    if (n != null && n > 0) prices.push(n)
  }
  if (prices.length === 0) return null
  const n = Math.min(tiers.length, prices.length, 4)
  const out: ProductPriceTableByLabels = {
    adultPrice: null,
    childExtraBedPrice: null,
    childNoBedPrice: null,
    infantPrice: null,
  }
  for (let i = 0; i < n; i++) {
    assignModetourSlot(out, tiers[i]!, prices[i]!)
  }
  return out
}

/** 본문 섹션에만 있고 priceTableRaw* 에 안 올라온 연령별 표를 보강(중복은 merge 단계에서 흡수) */
function modetourExtraPriceBlobFromDetailBody(parsed: RegisterParsed): string {
  const snap = parsed.detailBodyStructured
  if (!snap?.sections?.length) return ''
  const chunks: string[] = []
  for (const sec of snap.sections) {
    const txt = sec.text?.trim() ?? ''
    if (!txt || txt.length > 14000) continue
    if (!/(?:성인|아동|유아|소아)/.test(txt)) continue
    if (
      /(?:구분|연령|연령별|대상).{0,80}(?:가격|요금|금액)/i.test(txt) ||
      /(?:엑베|엑스트라|노베|extra\s*bed|no\s*bed|infant|만\s*2\s*세)/i.test(txt)
    ) {
      chunks.push(txt)
      continue
    }
    if (/(?:상품가격|아동\s*extra\s*bed|아동\s*no\s*bed)/i.test(txt) && /(?:성인|아동|유아)/i.test(txt)) {
      chunks.push(txt)
      continue
    }
    if (
      /(?:가격표|상품\s*가격|상품가격|패키지\s*가격|요금\s*안내)/i.test(txt) &&
      /(?:[\d,]{4,}\s*원|[\d,]{5,})/.test(txt)
    ) {
      chunks.push(txt)
    }
  }
  return [...new Set(chunks)].join('\n\n')
}

/** 섹션 경계 밖·스케줄에 섞인 연령별 표까지 흡수 */
function modetourPriceBlobFromNormalizedRaw(parsed: RegisterParsed): string {
  const raw = parsed.detailBodyStructured?.normalizedRaw?.trim()
  if (!raw) return ''
  if (!/(?:성인|아동|유아|소아).{0,160}(?:원|[\d,]{4,})/i.test(raw)) return ''
  const paras = raw.split(/\n{2,}/)
  const picked = paras.filter((p) => {
    if (!/(?:성인|아동|유아|소아)/i.test(p) || !/[\d,]{3,}/.test(p)) return false
    if (/^\s*(?:일정|스케줄|관광)\s*:/i.test(p.slice(0, 40))) return false
    return (
      /(?:구분|연령|연령별|대상|가격표).{0,80}(?:가격|요금|금액)/i.test(p) ||
      /(?:엑베|엑스트라|노베|extra\s*bed|no\s*bed|유아|infant|만\s*2\s*세)/i.test(p) ||
      (/(?:상품가격|아동\s*extra)/i.test(p) && /(?:성인|아동|유아)/i.test(p))
    )
  })
  return picked.join('\n\n').slice(0, 14000)
}

function modetourPriceBlobFromParsed(parsed: RegisterParsed): string {
  /**
   * 본문 맨 위에 나오는 `상품가격` 표는 LLM이 priceTableRawText에 안 넣거나,
   * 문단 필터(modetourPriceBlobFromNormalizedRaw)에서 빠지면 추출 blob에 없어진다.
   * 정규화 본문 **앞부분**을 항상 앞에 붙여 성인·유아 열·즉시할인 오탐 구분에 쓴다.
   */
  const raw = parsed.detailBodyStructured?.normalizedRaw?.trim() ?? ''
  const leadFromBody = raw.length > 0 ? raw.slice(0, 18000) : ''
  const chunks = [
    ...(leadFromBody ? [leadFromBody] : []),
    (parsed.priceTableRawText ?? '').trim(),
    stripHtmlLoose(parsed.priceTableRawHtml ?? null),
    modetourExtraPriceBlobFromDetailBody(parsed),
    modetourPriceBlobFromNormalizedRaw(parsed),
  ]
  /** 유아만 뒤쪽에 있고 lead에 없을 때 — 본문 나머지를 후보에 추가 */
  if (raw.length > 18000 && hintInfantPriceInPaste(raw)) {
    const joined = chunks.filter((x) => x.length > 0).join('\n\n')
    if (!extractInfantPriceKrwFromText(joined)) {
      chunks.push(raw.slice(18000, 38000))
    }
  }
  return chunks.filter((x) => x.length > 0).join('\n\n')
}

/**
 * 본문 표 + 모두투어 라벨 보강 병합 후, 유아=성인 동일가(오탐)만 정리(유아 힌트 있을 때).
 */
export function finalizeModetourProductPriceTable(
  table: RegisterParsed['productPriceTable'],
  blob: string
): RegisterParsed['productPriceTable'] {
  const blobNorm = normalizeModetourPriceBlobForExtract(blob)
  let merged = mergeProductPriceTableWithLabelExtract(table, extractProductPriceTableByLabels(blobNorm))
  merged = mergeProductPriceTableWithLabelExtract(merged, extractModetourSupplementLabelTable(blobNorm))
  merged = mergeProductPriceTableWithLabelExtract(merged, extractModetourStackedPriceTableFromBlob(blobNorm))
  if (!merged) return table ?? null

  const scrubbed = scrubModetourProductPriceTableSlotsAgainstBlob(merged, blobNorm)

  /** 세로 표 정렬이 즉시할인 3만원 등을 유아 슬롯으로 잡는 경우 → 본문 `유아 … 71,000원` 라벨 추출이 우선 */
  const { productPriceTable: afterInfantMerge } = mergeInfantPriceIntoProductPriceTable(scrubbed, blob)
  const base = afterInfantMerge ?? scrubbed

  const ad = base.adultPrice
  let inf: number | null = base.infantPrice ?? null
  if (ad != null && inf != null && ad > 0 && inf === ad && hintInfantPriceInPaste(blob)) {
    const extracted = extractInfantPriceKrwFromText(blob)
    if (extracted != null && extracted > 0 && extracted !== ad) inf = extracted
    else inf = null
  }

  const out = {
    adultPrice: base.adultPrice ?? null,
    childExtraBedPrice: base.childExtraBedPrice ?? null,
    childNoBedPrice: base.childNoBedPrice ?? null,
    infantPrice: inf,
  }
  for (const k of ['adultPrice', 'childExtraBedPrice', 'childNoBedPrice', 'infantPrice'] as const) {
    const v = out[k]
    if (v != null && v > 0) pushModetourPriceTrace(`acceptedPriceCandidate:product-price-${k}=${v}`)
  }
  return out
}

export function finalizeModetourRegisterParsedPricing(parsed: RegisterParsed): RegisterParsed {
  lastModetourPriceClassificationTrace = []
  const blob = modetourPriceBlobFromParsed(parsed)
  const blobNorm = normalizeModetourPriceBlobForExtract(blob)
  const nextTable = finalizeModetourProductPriceTable(parsed.productPriceTable ?? null, blob)
  const singleLines = extractModetourSingleRoomLinesFromBlob(blobNorm)
  const exParts = new Set(
    (parsed.excludedText ?? '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  )
  let excluded = parsed.excludedText?.trim() ?? ''
  for (const ln of singleLines) {
    if (exParts.has(ln)) continue
    excluded = excluded ? `${excluded}\n${ln}` : ln
    exParts.add(ln)
  }
  let next: RegisterParsed = {
    ...parsed,
    productPriceTable: nextTable,
    excludedText: excluded || null,
  }
  if (singleLines.length && !parsed.singleRoomSurchargeDisplayText?.trim()) {
    next = {
      ...next,
      singleRoomSurchargeDisplayText: singleLines[0]!.slice(0, 500),
      hasSingleRoomSurcharge: true,
    }
  }
  return next
}

export type ModetourDeparturePriceBasis = 'diff' | 'ratio_mirror_adult' | 'per_row_calendar' | 'table_fixed' | 'none'

/** 아동 노베 저장값 추적 — 표에 노베 줄이 없을 때 엑베 비율을 노베에 복제하지 않는다. */
export type ModetourChildNoBedPriceSource =
  | 'table_diff_three_slots'
  | 'scaled_from_table_child_no_bed'
  | 'zero_no_table_child_no_bed_row'
  | 'calendar_row_child_no_bed'
  | 'calendar_row_with_table_child_no_bed_fallback'
  | 'table_child_no_bed_slot_only'
  | 'none'

function roundKrwModetour(n: number): number {
  return Math.max(0, Math.round(n))
}

function safePositiveKrw(n: unknown): number | null {
  const x = Number(n)
  if (!Number.isFinite(x) || x <= 0) return null
  if (x > 1e11) return null
  return Math.round(x)
}

/**
 * 달력 성인가(만 원 단위로 잘린 경우) + 본문 표 성인가의 만 원 미만(remainder) 병합.
 * child/infant 연동은 별도 `computeModetourLinkedDeparturePrices`에서 `adultTotal`만 바꿔 처리.
 */
export function combineModetourCalendarAdultWithBodyTable(
  calendarAdult: number | null | undefined,
  bodyTableAdult: number | null | undefined
): number | null {
  const cal = safePositiveKrw(calendarAdult)
  const body = safePositiveKrw(bodyTableAdult)
  if (cal == null && body == null) return null
  if (cal == null) return body
  if (body == null) return cal

  const bodyRem = body % 10000
  const summed = cal + bodyRem
  const floorCal = Math.floor(cal / 10000)
  const floorBody = Math.floor(body / 10000)

  if (summed === body) return summed
  if (cal === body) return cal
  if (floorCal !== floorBody) return body
  if (cal % 10000 === bodyRem) return cal
  if (cal % 10000 === 0) return summed
  return body
}

/**
 * 본문 연령별 표(adult/child/infant)를 기준으로, 날짜별 성인 총액에 맞춰 아동 엑베·노베드를 연동하고 유아는 고정.
 */
export function computeModetourLinkedDeparturePrices(args: {
  adultTotal: number
  table: BodyProductPriceTable | null | undefined
  rowChildBedBase?: number | null
  rowChildNoBedBase?: number | null
  rowInfantBase?: number | null
  childFuel?: number
  infantFuel?: number
}): {
  childBedPrice: number
  childNoBedPrice: number
  infantPrice: number
  basis: ModetourDeparturePriceBasis
  childNoBedPriceSource: ModetourChildNoBedPriceSource
} {
  const adultTotal = Math.max(0, Number(args.adultTotal) || 0)
  const childFuel = Number(args.childFuel) || 0
  const infantFuel = Number(args.infantFuel) || 0
  const t = args.table
  const ar = t?.adultPrice != null && t.adultPrice > 0 ? Number(t.adultPrice) : null
  const cbR = t?.childExtraBedPrice != null && t.childExtraBedPrice > 0 ? Number(t.childExtraBedPrice) : null
  const cnbR = t?.childNoBedPrice != null && t.childNoBedPrice > 0 ? Number(t.childNoBedPrice) : null
  const infR = t?.infantPrice != null && t.infantPrice > 0 ? Number(t.infantPrice) : null

  const infantPrice = roundKrwModetour(
    (infR != null ? infR : args.rowInfantBase != null ? Number(args.rowInfantBase) : 0) + infantFuel
  )

  const rowCb =
    args.rowChildBedBase != null && Number(args.rowChildBedBase) > 0 ? Number(args.rowChildBedBase) : null
  const rowCnb =
    args.rowChildNoBedBase != null && Number(args.rowChildNoBedBase) > 0 ? Number(args.rowChildNoBedBase) : null

  if (ar != null && cbR != null && cnbR != null && adultTotal > 0) {
    const dCb = cbR - ar
    const dCnb = cnbR - ar
    const childBedPrice = roundKrwModetour(adultTotal + dCb) + childFuel
    const childNoBedPrice = roundKrwModetour(adultTotal + dCnb) + childFuel
    const basis: ModetourDeparturePriceBasis =
      cbR === ar && cnbR === ar ? 'ratio_mirror_adult' : 'diff'
    return {
      childBedPrice,
      childNoBedPrice,
      infantPrice,
      basis,
      childNoBedPriceSource: 'table_diff_three_slots',
    }
  }

  if (ar != null && ar > 0 && adultTotal > 0 && cbR != null) {
    const ratio = cbR / ar
    const hasTableCnb = cnbR != null && cnbR > 0
    const childNoBedCore = hasTableCnb ? (adultTotal * Number(cnbR)) / ar : 0
    const childNoBedPrice = roundKrwModetour(childNoBedCore) + childFuel
    return {
      childBedPrice: roundKrwModetour(adultTotal * ratio) + childFuel,
      childNoBedPrice,
      infantPrice,
      basis: 'ratio_mirror_adult',
      childNoBedPriceSource: hasTableCnb ? 'scaled_from_table_child_no_bed' : 'zero_no_table_child_no_bed_row',
    }
  }

  if (rowCb != null || rowCnb != null) {
    const cnbCore = rowCnb ?? cnbR ?? 0
    const childNoBedPrice = roundKrwModetour(cnbCore + childFuel)
    return {
      childBedPrice: roundKrwModetour((rowCb ?? cbR ?? 0) + childFuel),
      childNoBedPrice,
      infantPrice,
      basis: 'per_row_calendar',
      childNoBedPriceSource:
        rowCnb != null
          ? 'calendar_row_child_no_bed'
          : cnbR != null && cnbR > 0
            ? 'calendar_row_with_table_child_no_bed_fallback'
            : 'zero_no_table_child_no_bed_row',
    }
  }

  const childBedPrice = roundKrwModetour((cbR ?? 0) + childFuel)
  const childNoBedPrice = roundKrwModetour((cnbR ?? 0) + childFuel)
  const hasAnyAgeSlot = Boolean(cbR || cnbR)
  return {
    childBedPrice,
    childNoBedPrice,
    infantPrice,
    basis: t && hasAnyAgeSlot ? 'table_fixed' : 'none',
    childNoBedPriceSource:
      cnbR != null && cnbR > 0
        ? 'table_child_no_bed_slot_only'
        : hasAnyAgeSlot
          ? 'zero_no_table_child_no_bed_row'
          : 'none',
  }
}

/** `scripts/verify-modetour-departure-price-linkage.ts` · MODETOUR_REGISTER_DEBUG=1 용 */
export let lastModetourDeparturePricingSample: {
  adultPrice: number
  childBedPrice: number
  childNoBedPrice: number
  infantPrice: number
  pricingBasis: ModetourDeparturePriceBasis
  childNoBedPriceSource: ModetourChildNoBedPriceSource
  productPriceTable?: {
    adultPrice: number | null
    childExtraBedPrice: number | null
    childNoBedPrice: number | null
    infantPrice: number | null
  }
} | null = null

function modetourFirstIsoFromSchedule(sched: RegisterParsed['schedule']): string | null {
  if (!sched?.length) return null
  for (const row of sched) {
    const blob = [row?.title, row?.description].filter(Boolean).join('\n')
    const iso = extractIsoDate(blob)
    if (iso) return iso
  }
  return null
}

function modetourFlightLegHasPersistSignals(leg: {
  flightNo?: string | null
  departureDate?: string | null
  departureTime?: string | null
  departureAirport?: string | null
  arrivalAirport?: string | null
} | null | undefined): boolean {
  if (!leg) return false
  return Boolean(
    leg.flightNo?.trim() ||
      leg.departureDate?.trim() ||
      leg.departureTime?.trim() ||
      leg.departureAirport?.trim() ||
      leg.arrivalAirport?.trim()
  )
}

export function modetourDepartureInputsSubstantive(inputs: DepartureInput[]): boolean {
  return inputs.some((d) => {
    const ad = Number(d.adultPrice)
    if (!Number.isFinite(ad) || ad <= 0) return false
    if (d.departureDate instanceof Date) return true
    const s = String(d.departureDate ?? '')
    return /^\d{4}-\d{2}-\d{2}/.test(s)
  })
}

function modetourParsedPricesSubstantive(prices: RegisterParsed['prices']): boolean {
  if (!prices?.length) return false
  return prices.some((p) => {
    const ds = String(p?.date ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}/.test(ds.slice(0, 10))) return false
    return isScheduleAdultBookable(p as Parameters<typeof isScheduleAdultBookable>[0])
  })
}

export function modetourScheduleRowsSubstantive(sched: RegisterParsed['schedule'] | null | undefined): boolean {
  if (!sched?.length) return false
  return sched.some((s) => {
    const desc = String(s?.description ?? '').trim()
    const title = String(s?.title ?? '').trim()
    const day = Number(s?.day)
    const blob = `${title}\n${desc}`
    if (day >= 1 && desc.length >= 8) return true
    if (day >= 1 && /(?:\d+\s*일차|DAY\s*\d+)/i.test(blob)) return true
    if (day >= 1 && (title.length >= 6 || desc.length >= 6)) return true
    return false
  })
}

export function modetourItineraryDayDraftsSubstantive(
  drafts: Array<{ summaryTextRaw?: string | null; rawBlock?: string | null }> | undefined
): boolean {
  if (!drafts?.length) return false
  return drafts.some((d) => {
    if ((d.summaryTextRaw?.trim().length ?? 0) >= 10) return true
    const rb = d.rawBlock?.trim() ?? ''
    if (rb.length < 8) return false
    try {
      const j = JSON.parse(rb) as { description?: string; title?: string }
      return (
        String(j?.description ?? '').trim().length >= 8 || String(j?.title ?? '').trim().length >= 6
      )
    } catch {
      return rb.length >= 12
    }
  })
}

/** 등록 확정(confirm): 출발 행 draft + 일정 day draft만으로 통과 (가격표·항공·LLM schedule 단독 불가). */
export function modetourConfirmSaveGateStrict(opts: {
  departureInputs: DepartureInput[]
  itineraryDayDrafts: Array<{ summaryTextRaw?: string | null; rawBlock?: string | null }>
}): {
  pass: boolean
  saveCoverageDeparture: boolean
  saveCoverageSchedule: boolean
  saveBlockedReason: string | null
} {
  const saveCoverageDeparture = modetourDepartureInputsSubstantive(opts.departureInputs)
  const saveCoverageSchedule = modetourItineraryDayDraftsSubstantive(opts.itineraryDayDrafts)
  if (saveCoverageDeparture && saveCoverageSchedule) {
    return { pass: true, saveCoverageDeparture, saveCoverageSchedule, saveBlockedReason: null }
  }
  const parts: string[] = []
  if (!saveCoverageDeparture) parts.push('missing_product_departure_drafts')
  if (!saveCoverageSchedule) parts.push('missing_itinerary_day_drafts')
  return {
    pass: false,
    saveCoverageDeparture,
    saveCoverageSchedule,
    saveBlockedReason: parts.join('+'),
  }
}

export function modetourPersistedSaveCoverageBreakdown(opts: {
  parsed: RegisterParsed
  departureInputs: DepartureInput[]
  itineraryDayDrafts: Array<{ summaryTextRaw?: string | null; rawBlock?: string | null }>
}): {
  saveCoverageDeparture: boolean
  saveCoveragePrice: boolean
  saveCoverageSchedule: boolean
} {
  const { parsed, departureInputs, itineraryDayDrafts } = opts
  const saveCoverageDeparture =
    modetourDepartureInputsSubstantive(departureInputs) || modetourParsedPricesSubstantive(parsed.prices)
  const t = parsed.productPriceTable
  const tableOk =
    (t?.adultPrice != null && Number(t.adultPrice) > 0) ||
    (t?.childExtraBedPrice != null && Number(t.childExtraBedPrice) > 0) ||
    (t?.childNoBedPrice != null && Number(t.childNoBedPrice) > 0) ||
    (t?.infantPrice != null && Number(t.infantPrice) > 0)
  const saveCoveragePrice =
    tableOk ||
    Number(parsed.priceFrom) > 0 ||
    modetourParsedPricesSubstantive(parsed.prices) ||
    modetourDepartureInputsSubstantive(departureInputs)
  const saveCoverageSchedule =
    modetourScheduleRowsSubstantive(parsed.schedule) ||
    modetourItineraryDayDraftsSubstantive(itineraryDayDrafts) ||
    ((parsed.dayHotelPlans?.length ?? 0) > 0 &&
      Boolean(
        parsed.dayHotelPlans?.some(
          (p) => (p.hotels?.length ?? 0) > 0 || (p.raw?.trim().length ?? 0) > 6 || (p.label?.trim().length ?? 0) > 2
        )
      ))
  return { saveCoverageDeparture, saveCoveragePrice, saveCoverageSchedule }
}

/**
 * save 게이트: 출발·가격·일정 신호를 실질 값 기준으로 본다(dayHotelPlans·의미 있는 일정 행 포함).
 */
export function modetourPersistedHasCalendarCoverage(opts: {
  parsed: RegisterParsed
  departureInputsLength: number
  itineraryDayDraftsLength: number
  departureInputs?: DepartureInput[]
  itineraryDayDrafts?: Array<{ summaryTextRaw?: string | null; rawBlock?: string | null }>
}): boolean {
  const { parsed, departureInputsLength, itineraryDayDraftsLength } = opts
  const departureInputs = opts.departureInputs ?? []
  const itineraryDayDrafts = opts.itineraryDayDrafts ?? []
  const b = modetourPersistedSaveCoverageBreakdown({
    parsed,
    departureInputs,
    itineraryDayDrafts,
  })
  if (b.saveCoverageDeparture && b.saveCoveragePrice && b.saveCoverageSchedule) return true
  if (departureInputsLength > 0 && modetourDepartureInputsSubstantive(departureInputs)) return true
  if (modetourParsedPricesSubstantive(parsed.prices)) return true
  if (modetourScheduleRowsSubstantive(parsed.schedule)) return true
  if (itineraryDayDraftsLength > 0 && modetourItineraryDayDraftsSubstantive(itineraryDayDrafts)) return true
  if ((parsed.dayHotelPlans?.length ?? 0) > 0) return true
  const t = parsed.productPriceTable
  if (
    t &&
    ((t.adultPrice != null && Number(t.adultPrice) > 0) ||
      (t.childExtraBedPrice != null && Number(t.childExtraBedPrice) > 0) ||
      (t.childNoBedPrice != null && Number(t.childNoBedPrice) > 0) ||
      (t.infantPrice != null && Number(t.infantPrice) > 0))
  ) {
    return true
  }
  if (Number(parsed.priceFrom) > 0) return true
  const fs = parsed.detailBodyStructured?.flightStructured
  if (!fs) return false
  const air = (fs.airlineName ?? '').trim()
  const airOk = Boolean(air && !/^항공예정$/i.test(air) && !/^항공\s*미정/i.test(air))
  return (
    airOk ||
    modetourFlightLegHasPersistSignals(fs.outbound) ||
    modetourFlightLegHasPersistSignals(fs.inbound)
  )
}

/**
 * `prices[]`가 비었을 때 `productPriceTable`·항공 구조화·일정 텍스트에서 단일 출발 행을 합성 (raw 재분석 없음).
 */
export function modetourSyntheticDepartureInputsForPersistedParsed(parsed: RegisterParsed): DepartureInput[] {
  if ((parsed.prices?.length ?? 0) > 0) return []

  const table = parsed.productPriceTable ?? null
  const adultTable = table?.adultPrice != null && Number(table.adultPrice) > 0 ? Number(table.adultPrice) : 0
  const hasTable =
    adultTable > 0 ||
    (table?.childExtraBedPrice != null && Number(table.childExtraBedPrice) > 0) ||
    (table?.childNoBedPrice != null && Number(table.childNoBedPrice) > 0) ||
    (table?.infantPrice != null && Number(table.infantPrice) > 0)

  const fs = parsed.detailBodyStructured?.flightStructured
  const ob = fs?.outbound
  const depIso =
    extractIsoDate([ob?.departureDate, ob?.departureTime].filter(Boolean).join(' ')) ??
    extractIsoDate(parsed.departureDateTimeRaw) ??
    modetourFirstIsoFromSchedule(parsed.schedule) ??
    null

  const hasFlight =
    modetourFlightLegHasPersistSignals(ob) ||
    modetourFlightLegHasPersistSignals(fs?.inbound) ||
    Boolean(fs?.airlineName?.trim())

  if (!depIso) return []

  const fromPriceFrom = Number(parsed.priceFrom) > 0 ? Number(parsed.priceFrom) : 0
  const adultTotal = adultTable > 0 ? adultTable : fromPriceFrom > 0 ? fromPriceFrom : 0

  const hasSchedule = (parsed.schedule?.length ?? 0) > 0
  if (adultTotal <= 0 && !hasTable && !hasFlight && !hasSchedule) return []

  const adultForLink = Math.max(adultTotal, adultTable, fromPriceFrom)
  const linked = computeModetourLinkedDeparturePrices({
    adultTotal: adultForLink,
    table,
    childFuel: 0,
    infantFuel: 0,
  })

  const carrier = fs?.airlineName?.trim() || parsed.airlineName?.trim() || parsed.airline?.trim() || undefined

  lastModetourDeparturePricingSample = {
    adultPrice: adultForLink,
    childBedPrice: linked.childBedPrice,
    childNoBedPrice: linked.childNoBedPrice,
    infantPrice: linked.infantPrice,
    pricingBasis: linked.basis,
    childNoBedPriceSource: linked.childNoBedPriceSource,
    productPriceTable: table
      ? {
          adultPrice: table.adultPrice ?? null,
          childExtraBedPrice: table.childExtraBedPrice ?? null,
          childNoBedPrice: table.childNoBedPrice ?? null,
          infantPrice: table.infantPrice ?? null,
        }
      : undefined,
  }

  const row: DepartureInput = {
    departureDate: new Date(`${depIso}T00:00:00.000Z`),
    adultPrice: adultForLink > 0 ? adultForLink : adultTable > 0 ? adultTable : undefined,
    childBedPrice: linked.childBedPrice > 0 ? linked.childBedPrice : undefined,
    childNoBedPrice: linked.childNoBedPrice > 0 ? linked.childNoBedPrice : undefined,
    infantPrice: linked.infantPrice > 0 ? linked.infantPrice : undefined,
    carrierName: carrier,
  }
  return [row]
}

/** `parsedPricesToDepartureInputs` 모두투어 전용: 아동·유아에 성인가를 넣지 않고 본문 표로만 보강 */
export function modetourParsedPricesToDepartureInputs(
  prices: ParsedProductPrice[],
  table: BodyProductPriceTable | null | undefined
): DepartureInput[] {
  if (!prices?.length) return []
  lastModetourDeparturePricingSample = null
  return prices.map((p, idx) => {
    const calPart = (Number(p.adultBase) || 0) + (Number(p.adultFuel) || 0)
    const bodyAdult =
      table?.adultPrice != null && Number(table.adultPrice) > 0 ? Number(table.adultPrice) : null
    const resolved = combineModetourCalendarAdultWithBodyTable(calPart > 0 ? calPart : null, bodyAdult)
    const adultPrice = resolved != null && resolved > 0 ? resolved : null
    const adultNum = adultPrice ?? 0
    const linked = computeModetourLinkedDeparturePrices({
      adultTotal: adultNum,
      table,
      rowChildBedBase: p.childBedBase ?? null,
      rowChildNoBedBase: p.childNoBedBase ?? null,
      rowInfantBase: p.infantBase ?? null,
      childFuel: Number(p.childFuel) || 0,
      infantFuel: Number(p.infantFuel) || 0,
    })
    const cb = linked.childBedPrice
    const cnb = linked.childNoBedPrice
    const inf = linked.infantPrice
    if (idx === 0) {
      lastModetourDeparturePricingSample = {
        adultPrice: adultNum,
        childBedPrice: cb,
        childNoBedPrice: cnb,
        infantPrice: inf,
        pricingBasis: linked.basis,
        childNoBedPriceSource: linked.childNoBedPriceSource,
        productPriceTable: table
          ? {
              adultPrice: table.adultPrice ?? null,
              childExtraBedPrice: table.childExtraBedPrice ?? null,
              childNoBedPrice: table.childNoBedPrice ?? null,
              infantPrice: table.infantPrice ?? null,
            }
          : undefined,
      }
    }
    const statusRaw = p.status && String(p.status).trim() ? String(p.status).trim() : null
    const seatsStatusRaw = p.availableSeats != null ? `잔여${p.availableSeats}` : null
    return {
      departureDate: p.date,
      adultPrice: adultPrice || undefined,
      childBedPrice: cb > 0 ? cb : undefined,
      childNoBedPrice: cnb > 0 ? cnb : undefined,
      infantPrice: inf > 0 ? inf : undefined,
      localPriceText: (p as { localPrice?: string | null }).localPrice ?? undefined,
      statusRaw: statusRaw ?? undefined,
      seatsStatusRaw: seatsStatusRaw ?? undefined,
      carrierName: p.carrierName ?? undefined,
      outboundFlightNo: p.outboundFlightNo ?? undefined,
      outboundDepartureAirport: p.outboundDepartureAirport ?? undefined,
      outboundDepartureAt: p.outboundDepartureAt ?? undefined,
      outboundArrivalAirport: p.outboundArrivalAirport ?? undefined,
      outboundArrivalAt: p.outboundArrivalAt ?? undefined,
      inboundFlightNo: p.inboundFlightNo ?? undefined,
      inboundDepartureAirport: p.inboundDepartureAirport ?? undefined,
      inboundDepartureAt: p.inboundDepartureAt ?? undefined,
      inboundArrivalAirport: p.inboundArrivalAirport ?? undefined,
      inboundArrivalAt: p.inboundArrivalAt ?? undefined,
      meetingInfoRaw: p.meetingInfoRaw ?? undefined,
      meetingPointRaw: p.meetingPointRaw ?? undefined,
      meetingTerminalRaw: p.meetingTerminalRaw ?? undefined,
      meetingGuideNoticeRaw: p.meetingGuideNoticeRaw ?? undefined,
    }
  })
}

export function modetourDepartureInputsToProductPriceCreateMany(
  productId: string,
  inputs: DepartureInput[],
  bodyTable: BodyProductPriceTable | null | undefined
): Array<{
  productId: string
  date: Date
  adult: number
  childBed: number
  childNoBed: number
  infant: number
  localPrice: string | null
  priceGap: number
}> {
  if (!inputs?.length) return []
  const sorted = [...inputs].sort((a, b) => {
    const sa =
      a.departureDate instanceof Date
        ? a.departureDate.toISOString().slice(0, 10)
        : normalizeCalendarDate(String(a.departureDate)) ?? String(a.departureDate).slice(0, 10)
    const sb =
      b.departureDate instanceof Date
        ? b.departureDate.toISOString().slice(0, 10)
        : normalizeCalendarDate(String(b.departureDate)) ?? String(b.departureDate).slice(0, 10)
    return sa.localeCompare(sb)
  })
  let prevTotal = 0
  lastModetourDeparturePricingSample = null
  return sorted.map((d, idx) => {
    const calPart = d.adultPrice != null && d.adultPrice > 0 ? d.adultPrice : null
    const bodyAdult =
      bodyTable?.adultPrice != null && Number(bodyTable.adultPrice) > 0
        ? Number(bodyTable.adultPrice)
        : null
    const adult =
      combineModetourCalendarAdultWithBodyTable(calPart, bodyAdult) ?? calPart ?? bodyAdult ?? 0
    const linked = computeModetourLinkedDeparturePrices({
      adultTotal: adult,
      table: bodyTable,
      rowChildBedBase: d.childBedPrice ?? null,
      rowChildNoBedBase: d.childNoBedPrice ?? null,
      rowInfantBase: d.infantPrice ?? null,
      childFuel: 0,
      infantFuel: 0,
    })
    const childBed = linked.childBedPrice
    const childNoBed = linked.childNoBedPrice
    const infant = linked.infantPrice
    if (idx === 0) {
      lastModetourDeparturePricingSample = {
        adultPrice: adult,
        childBedPrice: childBed,
        childNoBedPrice: childNoBed,
        infantPrice: infant,
        pricingBasis: linked.basis,
        childNoBedPriceSource: linked.childNoBedPriceSource,
        productPriceTable: bodyTable
          ? {
              adultPrice: bodyTable.adultPrice ?? null,
              childExtraBedPrice: bodyTable.childExtraBedPrice ?? null,
              childNoBedPrice: bodyTable.childNoBedPrice ?? null,
              infantPrice: bodyTable.infantPrice ?? null,
            }
          : undefined,
      }
    }
    const total = adult + childBed + childNoBed + infant
    const priceGap = prevTotal > 0 ? total - prevTotal : 0
    prevTotal = total
    const ymd =
      d.departureDate instanceof Date
        ? d.departureDate.toISOString().slice(0, 10)
        : normalizeCalendarDate(String(d.departureDate)) ?? String(d.departureDate).slice(0, 10)
    return {
      productId,
      date: new Date(`${ymd}T00:00:00.000Z`),
      adult,
      childBed,
      childNoBed,
      infant,
      localPrice: d.localPriceText ?? null,
      priceGap,
    }
  })
}

export function modetourParsedCalendarRowsToProductPriceCreateMany(
  productId: string,
  sortedPrices: ParsedProductPrice[],
  table: BodyProductPriceTable | null | undefined
): Array<{
  productId: string
  date: Date
  adult: number
  childBed: number
  childNoBed: number
  infant: number
  priceGap: number
}> {
  let prevTotal = 0
  lastModetourDeparturePricingSample = null
  return sortedPrices.map((p, idx) => {
    const calPart = (p.adultBase ?? 0) + (p.adultFuel ?? 0)
    const bodyAdult =
      table?.adultPrice != null && Number(table.adultPrice) > 0 ? Number(table.adultPrice) : null
    const adultTotal =
      combineModetourCalendarAdultWithBodyTable(calPart > 0 ? calPart : null, bodyAdult) ??
      (calPart > 0 ? calPart : 0)
    const linked = computeModetourLinkedDeparturePrices({
      adultTotal,
      table,
      rowChildBedBase: p.childBedBase ?? null,
      rowChildNoBedBase: p.childNoBedBase ?? null,
      rowInfantBase: p.infantBase ?? null,
      childFuel: p.childFuel ?? 0,
      infantFuel: p.infantFuel ?? 0,
    })
    const priceAdult = adultTotal
    const priceChildWithBed = linked.childBedPrice > 0 ? linked.childBedPrice : null
    const priceChildNoBed = linked.childNoBedPrice > 0 ? linked.childNoBedPrice : null
    const priceInfant = linked.infantPrice > 0 ? linked.infantPrice : null
    if (idx === 0) {
      lastModetourDeparturePricingSample = {
        adultPrice: adultTotal,
        childBedPrice: linked.childBedPrice,
        childNoBedPrice: linked.childNoBedPrice,
        infantPrice: linked.infantPrice,
        pricingBasis: linked.basis,
        childNoBedPriceSource: linked.childNoBedPriceSource,
        productPriceTable: table
          ? {
              adultPrice: table.adultPrice ?? null,
              childExtraBedPrice: table.childExtraBedPrice ?? null,
              childNoBedPrice: table.childNoBedPrice ?? null,
              infantPrice: table.infantPrice ?? null,
            }
          : undefined,
      }
    }
    const total = priceAdult + (priceChildWithBed ?? 0) + (priceChildNoBed ?? 0) + (priceInfant ?? 0)
    const priceGap = prevTotal > 0 ? total - prevTotal : null
    prevTotal = total
    return {
      productId,
      date: new Date(p.date),
      adult: priceAdult,
      childBed: priceChildWithBed ?? 0,
      childNoBed: priceChildNoBed ?? 0,
      infant: priceInfant ?? 0,
      priceGap: priceGap ?? 0,
    }
  })
}
