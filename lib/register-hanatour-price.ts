/**
 * 하나투어 등록 가격 축 SSOT (기본상품 3슬롯만 productPriceTable).
 * - 성인·아동·유아: 오직 「기본상품」 행에서만 채움(대표가·출발가·인원 단가 축).
 * - 현지합류·1인 객실 사용료·가이드/기사·선택경비·매너팁·개인경비 등은 기본가 슬롯에 넣지 않음.
 * - 1인 객실 사용료: **`singleRoomSurcharge*` + 불포함/추가비용 안내 축만**(가격 슬롯·합성 출발 행 금지).
 * - 현지합류: `excludedText`에 별도 요금 안내(기존에 현지합류 문구 없을 때만). 1인 객실 축과 합치지 않음.
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'

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

/** 1인 객실 사용료 금액만 — `productPriceTable`·`prices[]` 슬롯에 들어가면 안 됨(검증·제거용). */
export function extractHanatourSingleRoomKrwAmountFromBlob(blob: string): number | null {
  const m = blob.match(/1인\s*객실\s*사용료\s*[:：]?\s*([\d,]+)\s*원/i)
  if (!m?.[1]) return null
  const n = Number(m[1].replace(/,/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

function matchHanatourSingleRoomKrwAmount(blob: string): number | null {
  return extractHanatourSingleRoomKrwAmountFromBlob(blob)
}

function trimThreeSlotSeqIfThirdIsSingleRoomFee(seq: number[], blob: string): number[] {
  if (seq.length < 3) return seq
  const amt = matchHanatourSingleRoomKrwAmount(blob)
  if (amt != null && seq[2] === amt) return seq.slice(0, 2)
  return seq
}

/** 기본상품 3슬롯 후보에서 제외하는 줄(현지합류·싱글/객실·메타). */
function lineIsHanatourNonBasicPriceRow(line: string): boolean {
  const s = line.replace(/\s+/g, ' ').trim()
  if (!s) return true
  if (/현지\s*합류/i.test(s)) return true
  if (/^현지합류/i.test(s)) return true
  if (/1인\s*객실|객실\s*1인\s*사용|싱글\s*차지|룸\s*차지|객실\s*사용료/i.test(s)) return true
  return false
}

function lineIsMetaOrFuelNarrative(line: string): boolean {
  const s = line.replace(/\s+/g, ' ').trim()
  if (!s) return true
  if (/(성인|아동|유아)\s*[:/]/.test(s)) return false
  if (/유류\s*할증|제세\s*공과|공과금|연료\s*할증|기본\s*상품가/i.test(s)) return true
  if (/^[\s※▶*•\-]*유류\s*할증/i.test(s)) return true
  if (/^(잔여|남은\s*좌석|쿠폰|할인|출발일\s*변경|총\s*액|합계|결제|VAT)/i.test(s)) return true
  if (/1인\s*객실\s*사용|객실\s*사용료|사용료\s*:/i.test(s)) return true
  if (/현지\s*합류|^현지합류/i.test(s)) return true
  return false
}

/** 한 줄에서 (유류·제세 직전 문맥을 피해) 원화 액수 후보를 순서대로 수집 */
function krwAmountsFromSegmentSkippingFuel(segment: string): number[] {
  const re = /([\d,]{2,14})\s*원/g
  const out: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(segment)) !== null) {
    const start = m.index ?? 0
    const before = segment.slice(Math.max(0, start - 48), start)
    if (
      /(유류\s*할증료|유류\s*할증|제세\s*공과금|제세\s*공과|공과금|연료\s*할증)\s*[^0-9\n]*$/i.test(
        before
      )
    )
      continue
    const n = Number(m[1]!.replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) out.push(Math.round(n))
  }
  return out
}

/**
 * 「기본상품」 행에서만 성인·아동·유아 3슬롯 추출.
 * 현지합류 다음 줄·1인 객실 줄로 흘러가며 섞이는 것을 막는다.
 */
export function extractBasicProductThreeSlotsFromBlob(blob: string): HanatourThreeSlotExtract | null {
  if (!blob?.trim() || !/상품가격|기본상품/.test(blob)) return null
  const lines = blob.replace(/\r/g, '\n').split('\n').map((l) => l.trim())

  const baseIdx = lines.findIndex((l) => /기본상품/i.test(l) && !/현지합류/i.test(l))
  if (baseIdx < 0) return null

  const baseLine = lines[baseIdx]!

  if (baseLine.includes('\t')) {
    const cells = baseLine.split('\t').map((c) => c.replace(/\s+/g, ' ').trim()).filter(Boolean)
    const nums = cells
      .map((c) => {
        const m = c.match(/^([\d,]+)\s*원/)
        return m ? Number(m[1]!.replace(/,/g, '')) : null
      })
      .filter((x): x is number => x != null && x > 0)
    if (nums.length >= 3) {
      return { adultPrice: nums[0]!, childPrice: nums[1]!, infantPrice: nums[2]! }
    }
  }

  const kwPos = baseLine.search(/기본상품/i)
  let fromKw = kwPos >= 0 ? baseLine.slice(kwPos) : baseLine
  {
    const endCandidates = [
      fromKw.search(/1인\s*객실/i),
      fromKw.search(/현지\s*합류/i),
      fromKw.search(/유류할증료\s*및\s*제세공과금은/i),
      fromKw.search(/약관\s*\(/i),
    ].filter((n) => n >= 0)
    let end = endCandidates.length > 0 ? Math.min(...endCandidates) : Math.min(fromKw.length, 2400)
    if (end < 200) end = Math.min(fromKw.length, 2400)
    fromKw = fromKw.slice(0, Math.max(end, 200))
  }
  const rawSeq = krwAmountsFromSegmentSkippingFuel(fromKw)
  const dedupeConsecutive = (nums: number[]): number[] => {
    const out: number[] = []
    for (const n of nums) {
      if (out.length === 0 || out[out.length - 1] !== n) out.push(n)
    }
    return out
  }
  let seq = dedupeConsecutive(rawSeq)
  if (seq.length < 3) {
    for (let j = baseIdx + 1; j < lines.length && seq.length < 3; j++) {
      const l = lines[j]!
      if (lineIsHanatourNonBasicPriceRow(l)) break
      if (lineIsMetaOrFuelNarrative(l) && !/^[\d,]+\s*원\s*$/i.test(l)) continue
      if (/^[\d,]+\s*원\s*$/i.test(l)) {
        const m = l.match(/^([\d,]+)\s*원/)
        if (m) {
          const n = Number(m[1]!.replace(/,/g, ''))
          if (Number.isFinite(n) && n > 0) seq.push(Math.round(n))
        }
        continue
      }
      if (/^(성인|아동|유아)(?=[\s:：(/]|$)/i.test(l)) {
        const n = krwAmountsFromSegmentSkippingFuel(l)[0]
        if (n != null) seq.push(n)
      }
    }
  }

  seq = trimThreeSlotSeqIfThirdIsSingleRoomFee(seq, blob)

  if (seq.length >= 3) {
    return { adultPrice: seq[0]!, childPrice: seq[1]!, infantPrice: seq[2]! }
  }
  if (seq.length === 2) {
    return { adultPrice: seq[0]!, childPrice: seq[1]!, infantPrice: null }
  }

  return null
}

/**
 * 본문 `상품가격` 표: 기본상품 행의 탭 열 또는 연속 `[\d,]+원` 단독 줄(성인→아동→유아 순).
 * @deprecated 내부적으로 extractBasicProductThreeSlotsFromBlob 우선; 레거시 단일줄 붙박이 HTML 대비.
 */
function extractHanatourProductPriceTableKrw(blob: string): HanatourThreeSlotExtract | null {
  const strict = extractBasicProductThreeSlotsFromBlob(blob)
  if (strict?.adultPrice != null && strict.childPrice != null && strict.infantPrice != null) return strict

  if (!/상품가격|기본상품/.test(blob)) return null
  const lines = blob.replace(/\r/g, '\n').split('\n').map((l) => l.trim())

  for (const line of lines) {
    if (!/기본상품/i.test(line) || /현지합류/i.test(line)) continue
    if (line.includes('\t')) {
      const cells = line.split('\t').map((c) => c.replace(/\s+/g, ' ').trim()).filter(Boolean)
      const nums = cells
        .map((c) => {
          const m = c.match(/^([\d,]+)\s*원/)
          return m ? Number(m[1]!.replace(/,/g, '')) : null
        })
        .filter((x): x is number => x != null && x > 0)
      if (nums.length >= 3) {
        return { adultPrice: nums[0]!, childPrice: nums[1]!, infantPrice: nums[2]! }
      }
    }
    const sameLine = line.match(/기본상품\s*([\d,]+)\s*원/i)
    if (sameLine?.[1]) {
      const adult = Number(sameLine[1].replace(/,/g, ''))
      const idx = lines.indexOf(line)
      const seq: number[] = Number.isFinite(adult) && adult > 0 ? [adult] : []
      for (let j = idx + 1; j < lines.length && seq.length < 3; j++) {
        const l = lines[j]!
        if (lineIsHanatourNonBasicPriceRow(l)) break
        if (/1인\s*객실|사용료|여행\s*기간\s*중\s*만\s*2세|약관|아동.*유아요금|미충족/i.test(l)) break
        if (/유류할증|제세공과|포함|변동될\s*수/.test(l)) continue
        const m = l.match(/^([\d,]+)\s*원\s*$/)
        if (m) seq.push(Number(m[1]!.replace(/,/g, '')))
      }
      if (seq.length >= 3) {
        return { adultPrice: seq[0]!, childPrice: seq[1]!, infantPrice: seq[2]! }
      }
    }
  }

  const idxBase = lines.findIndex((l) => /^기본상품/i.test(l) && !/현지합류/i.test(l))
  if (idxBase >= 0) {
    let seq: number[] = []
    const bl = lines[idxBase]!
    const bp = bl.search(/기본상품/i)
    let scanBl = bl
    if (bp >= 0) {
      const tail = bl.slice(bp)
      const endCandidates = [
        tail.search(/1인\s*객실/i),
        tail.search(/현지\s*합류/i),
        tail.search(/유류할증료\s*및\s*제세공과금은/i),
        tail.search(/약관\s*\(/i),
      ].filter((n) => n >= 0)
      let end = endCandidates.length > 0 ? Math.min(...endCandidates) : Math.min(tail.length, 2400)
      if (end < 200) end = Math.min(tail.length, 2400)
      scanBl = tail.slice(0, Math.max(end, 200))
    }
    const dedupeConsecutiveNums = (nums: number[]): number[] => {
      const o: number[] = []
      for (const n of nums) {
        if (o.length === 0 || o[o.length - 1] !== n) o.push(n)
      }
      return o
    }
    const rawFromScan: number[] = []
    for (const mm of scanBl.matchAll(/([\d,]+)\s*원/g)) {
      const start = mm.index ?? 0
      const pre = scanBl.slice(Math.max(0, start - 28), start)
      if (/(유류|제세\s*공과|공과금|할증료)\s*$/i.test(pre)) continue
      const n = Number(mm[1]!.replace(/,/g, ''))
      if (Number.isFinite(n) && n > 0) rawFromScan.push(n)
    }
    seq.push(...dedupeConsecutiveNums(rawFromScan))
    seq = trimThreeSlotSeqIfThirdIsSingleRoomFee(seq, blob)
    for (let j = idxBase + 1; j < lines.length && seq.length < 3; j++) {
      const l = lines[j]!
      if (lineIsHanatourNonBasicPriceRow(l)) break
      if (/1인\s*객실|사용료|여행\s*기간\s*중\s*만\s*2세|약관|아동.*유아요금|미충족/i.test(l)) break
      if (/유류할증|제세공과|포함|변동될\s*수|^\s*구분\s*$|^\s*성인\s*$|^\s*아동\s*$|^\s*유아\s*$|만\s*\d+\s*세/i.test(l))
        continue
      const m = l.match(/^([\d,]+)\s*원\s*$/)
      if (m) seq.push(Number(m[1]!.replace(/,/g, '')))
    }
    if (seq.length >= 3) {
      return { adultPrice: seq[0]!, childPrice: seq[1]!, infantPrice: seq[2]! }
    }
    if (seq.length === 2) {
      return { adultPrice: seq[0]!, childPrice: seq[1]!, infantPrice: null }
    }
  }

  return null
}

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

type Tier = 'adult' | 'child' | 'infant'

function detectTier(line: string): Tier | null {
  const s = stripLeadingPriceRowNoise(line).replace(/\s+/g, ' ').trim()
  if (!s || lineIsMetaOrFuelNarrative(s)) return null
  if (/현지\s*합류|^현지합류/i.test(s)) return null
  if (/^유아(?=[\s(]|$)/i.test(s) || /^소아\s*\(\s*만\s*2\s*세\s*미만/i.test(s)) return 'infant'
  if (/^성인(?=[\s(]|$)/i.test(s)) return 'adult'
  if (/^아동(?=[\s(]|$)/i.test(s)) return 'child'
  return null
}

export type HanatourThreeSlotExtract = {
  adultPrice: number | null
  childPrice: number | null
  infantPrice: number | null
}

export function extractHanatourThreeSlotPricesFromBlob(blob: string): HanatourThreeSlotExtract | null {
  if (!blob?.trim()) return null
  const table = extractHanatourProductPriceTableKrw(blob)
  if (table?.adultPrice != null && table.childPrice != null && table.infantPrice != null) return table
  if (table?.adultPrice != null && table.childPrice != null) return table

  let repAdult: number | null = null
  const repM = blob.match(/대표\s*가(?:격)?[^\d\n]{0,60}([\d,]+)\s*원/i)
  if (repM?.[1]) {
    const n = Number(repM[1]!.replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) repAdult = n
  }

  const lines = blob.replace(/\r/g, '\n').split('\n')
  const out: HanatourThreeSlotExtract = { adultPrice: null, childPrice: null, infantPrice: null }
  for (let i = 0; i < lines.length; i++) {
    let line = stripLeadingPriceRowNoise(lines[i]!)
    if (!line || lineIsHanatourNonBasicPriceRow(line)) continue
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
  if (out.adultPrice == null && repAdult != null) out.adultPrice = repAdult
  const filled = [out.adultPrice, out.childPrice, out.infantPrice].filter((x) => x != null).length
  return filled > 0 ? out : repAdult != null ? { adultPrice: repAdult, childPrice: null, infantPrice: null } : null
}

export type HanatourSingleRoomExtract = {
  amount: number
  /** 본문 통화 표기 보존(환산 없음). */
  currency: string
  displayText: string
  rawLine: string
  /** 불포함/추가비용 안내(가격 슬롯 아님) — 본문에 있을 때만 */
  noticeLine?: string | null
}

/** 본문에서 1인 객실 사용료 (기본상품가·출발가 축 아님 → singleRoom* / 불포함 안내). */
export function extractHanatourSingleRoomSurchargeFromBlob(blob: string): HanatourSingleRoomExtract | null {
  if (!blob?.trim()) return null
  const noticeLine = extractHanatourSingleRoomUsageNoticeLineFromBlob(blob)

  const parseNum = (s: string) => {
    const n = Number(s.replace(/,/g, ''))
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null
  }

  const amountCurrencyFromLine = (line: string): { amount: number; currency: string } | null => {
    const usdM = line.match(/\$\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\b/)
    if (usdM?.[1]) {
      const amount = parseNum(usdM[1])
      if (amount != null) return { amount, currency: 'USD' }
    }
    const eurM =
      line.match(/€\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\b/i) ||
      line.match(/\b([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*EUR\b/i)
    if (eurM?.[1]) {
      const amount = parseNum(eurM[1])
      if (amount != null) return { amount, currency: 'EUR' }
    }
    const jpyM =
      line.match(/¥\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\b/) ||
      line.match(/￥\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\b/) ||
      line.match(/\b([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,})\s*(?:엔|円|JPY)\b/i)
    if (jpyM?.[1]) {
      const amount = parseNum(jpyM[1])
      if (amount != null) return { amount, currency: 'JPY' }
    }
    const m =
      line.match(/1인\s*객실\s*사용료\s*[:：]?\s*([\d,]+)\s*원/i) ||
      line.match(/객실\s*1인\s*사용료\s*[:：]?\s*([\d,]+)\s*원/i) ||
      line.match(/객실\s*추가\s*요금\s*[:：]?\s*([\d,]+)\s*원/i)
    if (m?.[1]) {
      const amount = parseNum(m[1])
      if (amount != null) return { amount, currency: 'KRW' }
    }
    return null
  }

  const lines = blob.replace(/\r/g, '\n').split('\n').map((l) => l.trim())
  for (const line of lines) {
    if (!/1인\s*객실|객실\s*1인\s*사용|싱글\s*룸\s*사용|객실\s*추가\s*요금/i.test(line)) continue
    const parsed = amountCurrencyFromLine(line)
    if (!parsed) continue
    const displayText = line.replace(/\s+/g, ' ').trim().slice(0, 240)
    return {
      amount: parsed.amount,
      currency: parsed.currency,
      displayText,
      rawLine: line.slice(0, 500),
      noticeLine,
    }
  }
  const looseSpecs: Array<{ re: RegExp; currency: string }> = [
    { re: /1인\s*객실\s*사용료\s*[:：]?\s*\$\s*([\d,]+)/i, currency: 'USD' },
    { re: /1인\s*객실\s*사용료\s*[:：]?\s*€\s*([\d,]+)/i, currency: 'EUR' },
    { re: /1인\s*객실\s*사용료\s*[:：]?\s*¥\s*([\d,]+)/i, currency: 'JPY' },
    { re: /1인\s*객실\s*사용료\s*[:：]?\s*￥\s*([\d,]+)/i, currency: 'JPY' },
    { re: /1인\s*객실\s*사용료\s*[:：]?\s*([\d,]+)\s*(?:엔|円|JPY)\b/i, currency: 'JPY' },
    { re: /1인\s*객실\s*사용료\s*[:：]?\s*([\d,]+)\s*원/i, currency: 'KRW' },
  ]
  for (const { re, currency } of looseSpecs) {
    const loose = blob.match(re)
    if (!loose?.[1]) continue
    const n = parseNum(loose[1])
    if (n == null) continue
    const raw = loose[0] ?? ''
    return {
      amount: n,
      currency,
      displayText: raw.replace(/\s+/g, ' ').trim().slice(0, 240),
      rawLine: raw.slice(0, 500),
      noticeLine,
    }
  }
  return null
}

function formatKrw(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

/** 1인 객실 추가비용 안내 문구(불포함 축; 금액 줄과 별개로 추출). */
export function extractHanatourSingleRoomUsageNoticeLineFromBlob(blob: string): string | null {
  if (!blob?.trim()) return null
  const m = blob.match(/1인\s*객실\s*사용\s*시\s*추가요금\s*발생[^\n.]{0,24}(?:\.|됩니다|요)?/i)
  return m?.[0]?.replace(/\s+/g, ' ').trim() ?? null
}

/** 현지합류 3요금 — 기본가 슬롯에 넣지 않고 안내 문구만 생성. */
export function extractHanatourLocalJoinThreeSlotsFromBlob(blob: string): HanatourThreeSlotExtract | null {
  if (!blob?.trim()) return null
  const lines = blob.replace(/\r/g, '\n').split('\n').map((l) => l.trim())
  const idx = lines.findIndex((l) => /^현지합류/i.test(l) || /^현지\s*합류/i.test(l))
  if (idx < 0) return null
  const first = lines[idx]!
  let nums = krwAmountsFromSegmentSkippingFuel(first)
  if (nums.length < 3 && first.includes('\t')) {
    const cells = first.split('\t').map((c) => c.trim()).filter(Boolean)
    const alt: number[] = []
    for (const c of cells) {
      const m = c.match(/^([\d,]+)\s*원\s*$/)
      if (m) alt.push(Number(m[1]!.replace(/,/g, '')))
    }
    if (alt.length >= 3) nums = alt
  }
  for (let j = idx + 1; j < lines.length && nums.length < 3; j++) {
    const l = lines[j]!
    if (/^기본상품|^1인\s*객|^선택|^유류\s*할증/i.test(l)) break
    const m = l.match(/^([\d,]+)\s*원\s*$/)
    if (m) {
      const n = Number(m[1]!.replace(/,/g, ''))
      if (Number.isFinite(n) && n > 0) nums.push(Math.round(n))
    }
  }
  if (nums.length < 3) return null
  return { adultPrice: nums[0]!, childPrice: nums[1]!, infantPrice: nums[2]! }
}

export function formatHanatourLocalJoinExcludedNote(blob: string): string | null {
  const j = extractHanatourLocalJoinThreeSlotsFromBlob(blob)
  if (!j || j.adultPrice == null || j.childPrice == null || j.infantPrice == null) return null
  return `[요금 안내] 현지합류 ${formatKrw(j.adultPrice)} / ${formatKrw(j.childPrice)} / ${formatKrw(j.infantPrice)} (패키지 기본상품가와 별도)`
}

function hanatourExtraPriceBlobFromDetailBody(parsed: RegisterParsed): string {
  const snap = parsed.detailBodyStructured
  if (!snap?.sections?.length) return ''
  const chunks: string[] = []
  for (const sec of snap.sections) {
    const txt = sec.text?.trim() ?? ''
    if (!txt || txt.length > 12000) continue
    if (!/(?:성인|아동|유아)/.test(txt)) continue
    if (
      /(?:구분|연령|대상).{0,60}(?:가격|요금)/i.test(txt) ||
      /(?:가격표|요금\s*안내|기본\s*상품|상품가격)/i.test(txt)
    ) {
      chunks.push(txt)
    }
  }
  const raw = snap.normalizedRaw?.trim() ?? ''
  let tail = ''
  if (raw && /(?:성인|아동|유아|상품가격|기본상품).{0,160}(?:원|[\d,]{4,})/.test(raw)) {
    const paras = raw.split(/\n{2,}/)
    const hit = paras.filter(
      (p) =>
        (/(?:성인|아동|유아)/.test(p) || /(?:상품가격|기본상품)/.test(p)) &&
        /[\d,]{3,}\s*원/.test(p) &&
        !/^\s*(?:일정|스케줄)\s*:/i.test(p.slice(0, 32))
    )
    tail = hit.join('\n\n').slice(0, 8000)
  }
  return [...chunks, tail].filter(Boolean).join('\n\n')
}

function hanatourPriceBlobFromParsed(parsed: RegisterParsed): string {
  return [
    (parsed.priceTableRawText ?? '').trim(),
    stripHtmlLoose(parsed.priceTableRawHtml ?? null),
    hanatourExtraPriceBlobFromDetailBody(parsed),
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

/**
 * LLM/파싱 오염: 어느 슬롯이든 본문의 1인 객실 사용료 금액과 같으면 기본상품 행으로 교체.
 * 기본상품 3슬롯을 못 찾으면 해당 슬롯만 null로 비워 잘못된 대표가를 막음.
 */
function stripSingleRoomFeeFromBasicThreeSlots(
  adult: number | null,
  child: number | null,
  infant: number | null,
  blob: string,
  basicRef: HanatourThreeSlotExtract | null
): HanatourThreeSlotExtract {
  const sr = matchHanatourSingleRoomKrwAmount(blob)
  let a = adult
  let c = child
  let i = infant

  const rescue = (slot: number | null, basicSlot: number | null | undefined): number | null => {
    if (slot == null) return null
    if (sr != null && slot === sr) {
      if (basicSlot != null && basicSlot !== sr) return basicSlot
      return null
    }
    return slot
  }

  a = rescue(a, basicRef?.adultPrice ?? undefined)
  c = rescue(c, basicRef?.childPrice ?? undefined)
  i = rescue(i, basicRef?.infantPrice ?? undefined)

  const pollutedBefore =
    sr != null && (adult === sr || child === sr || infant === sr)
  if (
    pollutedBefore &&
    basicRef?.adultPrice != null &&
    basicRef.childPrice != null &&
    basicRef.infantPrice != null
  ) {
    return {
      adultPrice: basicRef.adultPrice,
      childPrice: basicRef.childPrice,
      infantPrice: basicRef.infantPrice,
    }
  }

  return { adultPrice: a, childPrice: c, infantPrice: i }
}

export function finalizeHanatourProductPriceTable(
  table: RegisterParsed['productPriceTable'] | null | undefined,
  blob: string
): RegisterParsed['productPriceTable'] | null {
  const fromBlob = extractHanatourThreeSlotPricesFromBlob(blob)
  const t = table ?? null
  let adult = t?.adultPrice ?? null
  let child = t ? collapseLlmChildToSingle(t as NonNullable<RegisterParsed['productPriceTable']>) : null
  let infant = t?.infantPrice ?? null
  if (fromBlob) {
    if (fromBlob.adultPrice != null) adult = fromBlob.adultPrice
    if (fromBlob.childPrice != null) child = fromBlob.childPrice
    if (fromBlob.infantPrice != null) infant = fromBlob.infantPrice
  }

  /** LLM이 현지합류 3요금을 productPriceTable에 넣은 경우: 본문에 기본상품 행이 있으면 그쪽으로 구출 */
  const localJoin = extractHanatourLocalJoinThreeSlotsFromBlob(blob)
  let basicOnly = extractBasicProductThreeSlotsFromBlob(blob)
  if (
    localJoin?.adultPrice != null &&
    localJoin.childPrice != null &&
    localJoin.infantPrice != null &&
    adult != null &&
    child != null &&
    infant != null &&
    adult === localJoin.adultPrice &&
    child === localJoin.childPrice &&
    infant === localJoin.infantPrice &&
    basicOnly?.adultPrice != null &&
    (basicOnly.adultPrice !== localJoin.adultPrice ||
      basicOnly.childPrice !== localJoin.childPrice ||
      basicOnly.infantPrice !== localJoin.infantPrice)
  ) {
    adult = basicOnly.adultPrice
    if (basicOnly.childPrice != null) child = basicOnly.childPrice
    if (basicOnly.infantPrice != null) infant = basicOnly.infantPrice
  }

  basicOnly = extractBasicProductThreeSlotsFromBlob(blob)
  const scrubbed = stripSingleRoomFeeFromBasicThreeSlots(adult, child, infant, blob, basicOnly)
  adult = scrubbed.adultPrice
  child = scrubbed.childPrice
  infant = scrubbed.infantPrice

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

export function finalizeHanatourRegisterParsedPricing(parsed: RegisterParsed): RegisterParsed {
  const blob = hanatourPriceBlobFromParsed(parsed)
  const nextTable = finalizeHanatourProductPriceTable(parsed.productPriceTable ?? null, blob)
  let next: RegisterParsed =
    nextTable === null
      ? parsed
      : {
          ...parsed,
          productPriceTable: nextTable,
        }

  const sr = extractHanatourSingleRoomSurchargeFromBlob(blob)
  if (
    sr != null &&
    (next.singleRoomSurchargeAmount == null || !Number.isFinite(next.singleRoomSurchargeAmount)) &&
    !(next.singleRoomSurchargeDisplayText ?? '').trim()
  ) {
    next = {
      ...next,
      singleRoomSurchargeAmount: sr.amount,
      singleRoomSurchargeCurrency: sr.currency,
      singleRoomSurchargeRaw: sr.rawLine,
      singleRoomSurchargeDisplayText: sr.displayText,
      hasSingleRoomSurcharge: true,
    }
  }

  const lj = formatHanatourLocalJoinExcludedNote(blob)
  const ptJoin = (next.priceTableRawText ?? '').trim()
  if (lj && !ptJoin.replace(/\s+/g, ' ').includes('현지합류')) {
    next = {
      ...next,
      priceTableRawText: ptJoin ? `${ptJoin}\n\n${lj}` : lj,
    }
  }

  const notice = (sr?.noticeLine ?? extractHanatourSingleRoomUsageNoticeLineFromBlob(blob))?.trim()
  if (notice) {
    const ex2 = (next.excludedText ?? '').trim()
    const compact = ex2.replace(/\s+/g, ' ')
    if (!compact.includes(notice.replace(/\s+/g, ' '))) {
      next = {
        ...next,
        excludedText: ex2 ? `${ex2}\n\n${notice}` : notice,
      }
    }
  }

  return next
}
