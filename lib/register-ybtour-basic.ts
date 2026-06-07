/**
 * 노랑풍선(ybtour) 기본정보: 포함사항·불포함사항·추가비용 블록(써차지·비자 등) 결정적 분리.
 * `detail-body-parser-ybtour`는 이 파서만 사용한다(공용 줄 키워드 fallback 없음).
 */
import type {
  DetailBodyParseSnapshot,
  IncludedExcludedStructured,
} from '@/lib/detail-body-parser-types'
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
import { sanitizeIncludedExcludedItemsLines } from '@/lib/included-excluded-postprocess'

const PREFIX = '[ybtour-basic]'

const YB_SURCHARGE_SUMMARY =
  '호텔 써차지·갈라디너·성수기 등 추가비용 발생 가능(일자·금액은 본문 별도 고지 참고).'

function compactJson(obj: Record<string, unknown>, maxLen = 900): string {
  try {
    const s = JSON.stringify(obj)
    return s.length > maxLen ? `${s.slice(0, maxLen)}…` : s
  } catch {
    return '{}'
  }
}

export function logYbtourBasic(phase: string, payload: Record<string, unknown>) {
  console.log(`${PREFIX} phase=${phase} ${compactJson(payload)}`)
}

/** 본문 상단 `상품번호EWP…` / `상품번호 EWP…` */
export function extractYbtourProductCodeFromBlob(blob: string): string | null {
  const t = blob.replace(/\s+/g, ' ').trim()
  const m =
    t.match(/상품번호\s*[:：]?\s*([A-Za-z]{1,6}\d[A-Za-z0-9-]{4,})/i) ||
    t.match(/상품번호([A-Za-z]{1,6}\d[A-Za-z0-9-]{4,})/i)
  return m?.[1]?.trim() ?? null
}

const YBTOUR_LISTING_TITLE_SKIP_RE =
  /^(출발|도착|예약하기|인쇄|문의|찜|공유|담당자|상품\s*이미지|더보기|추천\s*상품|상품번호)\b/i

function ybtourListingTitleHasTourShape(line: string): boolean {
  return (
    /\d+\s*박\s*\d+\s*일/.test(line) ||
    /\d+\s*박/.test(line) ||
    /(?<!\d)\d+\s*일(?!\d)/.test(line) ||
    /\d+\s*\/\s*\d+\s*일/.test(line)
  )
}

function isYbtourListingTitleCandidateLine(line: string): boolean {
  if (!line || line.length < 12 || line.length > 220) return false
  if (/^https?:\/\//i.test(line)) return false
  if (/^\d+\s*\.\s*\d+\s*\/\s*\d+/i.test(line)) return false
  if (/^\d+(\.\d+)?\s*\/\s*\d+/.test(line) && /리뷰/.test(line)) return false
  if (/(리뷰\s*\d+건)/i.test(line) && line.length < 48) return false
  if (YBTOUR_LISTING_TITLE_SKIP_RE.test(line)) return false
  if (/^COUPON\b|^다운로드\b/i.test(line)) return false
  return true
}

/** 해시·박일·자유여행 신호가 강한 줄 우선(자유여행 FIT og:title vs 리스트 한 줄). */
function scoreYbtourListingTitleLine(line: string): number {
  const hashCount = (line.match(/#/g) || []).length
  const tourShape = ybtourListingTitleHasTourShape(line)
  let score = 0
  if (tourShape) score += 40
  if (hashCount >= 2) score += 25 + Math.min(hashCount, 8) * 4
  else if (hashCount >= 1) score += 12
  if (/자유여행|에어텔/i.test(line)) score += 8
  score += Math.min(line.length, 140) / 20
  return score
}

function pickBestYbtourListingTitle(lines: string[]): string | null {
  let best: { line: string; score: number } | null = null
  for (const line of lines) {
    if (!isYbtourListingTitleCandidateLine(line)) continue
    const hashCount = (line.match(/#/g) || []).length
    const tourShape = ybtourListingTitleHasTourShape(line)
    if (!tourShape && !/(박|일)/.test(line)) continue
    const minHash = tourShape ? 1 : 2
    if (hashCount < minHash) continue
    const score = scoreYbtourListingTitleLine(line)
    if (!best || score > best.score) best = { line, score }
  }
  return best?.line ?? null
}

/**
 * 상품 상단 노출 제목(해시태그·항공코드 등 포함) — LLM 의역 대신 붙여넣기 원문을 SSOT로 쓴다.
 * `상품번호` 이후 구간 우선; 자유여행(FIT)은 해시 1개+박일 줄도 인정한다.
 */
export function extractYbtourVerbatimListingTitle(blob: string): string | null {
  const text = blob.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ')
  const lines = text.slice(0, 12_000).split('\n').map((l) => l.trim())
  const productIdx = text.search(/상품번호\s*[A-Za-z]*\d[A-Za-z0-9-]+/i)
  if (productIdx >= 0) {
    const fromProduct = text.slice(productIdx, productIdx + 9000).split('\n').map((l) => l.trim())
    const picked = pickBestYbtourListingTitle(fromProduct)
    if (picked) return picked
  }
  return pickBestYbtourListingTitle(lines.slice(0, 70))
}

function normLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim()
}

function isYbtourIncExcBulletLine(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  return (
    /^[\s·•‧∙‣⁃*\-･・\u00B7\u2022\u2023\u30FB\uFF65■▪]+\s*\S/.test(s) ||
    /^\s*■\s*\S/.test(s) ||
    /^\s*ㄴ\s/.test(s) ||
    /^ㄴ\s/.test(s) ||
    /^(?:\d{1,2}[.)．]|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫])\s*\S/u.test(t) ||
    /^(?:교통|숙박|식사|보험|항공|호텔|미팅|픽업|샌딩|차량)\s*[:：]/i.test(t)
  )
}

function isExampleOnlyLine(t: string): boolean {
  return /^예\s*\)\s*/i.test(t) || /^예\)\s*/i.test(t)
}

function isYbtourGlobalStopLine(t: string): boolean {
  if (!t) return true
  if (/^미팅장소|^상품약관|^■\s*약관|^약관\s*\/|^약관\s*$/i.test(t)) return true
  if (/^포함\s*\/\s*불포함/i.test(t) && !/^포함사항|^불포함사항|^포함내역|^불포함내역/i.test(t)) return true
  return false
}

/** 선택경비 블록: 장문·약관성 안내는 버리고 핵심만 */
function ybSelectionCostLineToItem(line: string): string | null {
  const t = normLine(line)
  if (!t) return null
  if (t.length > 420) {
    if (/(?:1인실|싱글|리턴\s*변경|변경\s*불가|유류\s*할증|비자|입국|ETA|eTA)/i.test(t)) {
      return `${t.slice(0, 240)}…`
    }
    return null
  }
  return t.slice(0, 280)
}

function startsYbtourExtraChargeBlock(t: string): boolean {
  return (
    /^▷/.test(t) ||
    /^▼|^►/.test(t) ||
    /^♣/.test(t) ||
    /싱글\s*차지|싱글차지/i.test(t) ||
    /호텔\s*써차지|써차지\s*\(|써차지\s*비용|갈라디너|E-비자|\[E-비자\]|비자\s*관련|입국시.*비자|성수기\s*추가/i.test(t)
  )
}

/** 일정/옵션 홍보 문구 — 불포함 bullet 목록에 넣지 않음(선택관광 표·일정 SSOT 우선). */
function isYbtourOptionalTourPitchLine(t: string): boolean {
  if (t.length < 12) return false
  if (/유니버셜\s*스튜디오|\bUSJ\b/i.test(t)) return true
  if (/\d+\s*일\s*선택관광/i.test(t) && t.length > 24) return true
  return false
}

function collectYbtourSurchargeChunk(lines: string[], startIdx: number): { consumed: number; summary: string | null } {
  let j = startIdx
  const buf: string[] = []
  const maxScan = 45
  let n = 0
  while (j < lines.length && n < maxScan) {
    const raw = lines[j]!
    const t = normLine(raw)
    if (!t) {
      j++
      n++
      continue
    }
    if (isYbtourGlobalStopLine(t) && buf.length > 0) break
    if (isExampleOnlyLine(t)) {
      j++
      n++
      continue
    }
    buf.push(raw)
    j++
    n++
  }
  const flat = buf.map(normLine).filter(Boolean)
  const dateish = flat.filter((l) => /\d{4}\s*[-./년]\s*\d{1,2}/.test(l) || /\d{4}-\d{4}/.test(l)).length
  if (flat.length >= 8 || dateish >= 4) {
    return { consumed: j - startIdx, summary: YB_SURCHARGE_SUMMARY }
  }
  const joined = flat.slice(0, 14).join('\n').trim()
  return { consumed: j - startIdx, summary: joined.length ? joined.slice(0, 1200) : null }
}

/**
 * `포함사항` ~ `불포함사항` ~ (써차지·비자 등 추가 블록) ~ 종료 앵커.
 * 추가 블록은 불포함/추가비용으로만 합류; `예 )` 예시 줄·미팅·약관 제외.
 */
export function parseYbtourIncludedExcludedSection(section: string): IncludedExcludedStructured {
  const lines = section.split(/\r?\n/)
  const includedItems: string[] = []
  const excludedItems: string[] = []
  const noteParts: string[] = []

  let mode: 'idle' | 'inc' | 'exc' | 'sel' = 'idle'
  let i = 0

  while (i < lines.length) {
    const raw = lines[i]!
    const line = normLine(raw)
    if (!line) {
      i++
      continue
    }
    if (
      /^약관\s*[/／]?\s*취소/i.test(line) ||
      /^약관\s*\/\s*취소\s*수수료/i.test(line) ||
      /^■\s*약관\b/i.test(line) ||
      /^■\s*예약금/i.test(line) ||
      /^■\s*항공\s*규정/i.test(line) ||
      /^■\s*기간에\s*따른/i.test(line) ||
      /^■\s*최저출발인원/i.test(line) ||
      /^■\s*감염병/i.test(line) ||
      /^여행\s*일정$/i.test(line)
    ) {
      break
    }
    if (/^포함\s*사항\s*$/i.test(line) || /^포함사항\s*$/i.test(line) || /^포함\s*내역\s*$/i.test(line)) {
      mode = 'inc'
      i++
      continue
    }
    if (/^불포함\s*사항\s*$/i.test(line) || /^불포함사항\s*$/i.test(line) || /^불포함\s*내역\s*$/i.test(line)) {
      mode = 'exc'
      i++
      continue
    }
    if (/^선택\s*경비\s*$/i.test(line)) {
      mode = 'sel'
      i++
      continue
    }
    if (/^포함\s*\/\s*불포함/i.test(line) && !/^포함사항/i.test(line)) {
      mode = 'idle'
      i++
      continue
    }
    if (isYbtourGlobalStopLine(line) && mode !== 'idle') {
      mode = 'idle'
      i++
      continue
    }

    if (mode === 'inc') {
      if (/^불포함\s*사항/i.test(line) || /^불포함사항/i.test(line) || /^불포함\s*내역/i.test(line)) {
        mode = 'exc'
        continue
      }
      if (/^선택\s*경비/i.test(line)) {
        mode = 'sel'
        continue
      }
      if (startsYbtourExtraChargeBlock(line)) {
        mode = 'exc'
        continue
      }
      if (isYbtourIncExcBulletLine(line)) {
        includedItems.push(line.slice(0, 280))
      }
      i++
      continue
    }

    if (mode === 'exc') {
      if (/^선택\s*경비/i.test(line)) {
        mode = 'sel'
        i++
        continue
      }
      if (isExampleOnlyLine(line)) {
        i++
        continue
      }
      if (isYbtourOptionalTourPitchLine(line)) {
        i++
        continue
      }
      if (startsYbtourExtraChargeBlock(line)) {
        const { consumed, summary } = collectYbtourSurchargeChunk(lines, i)
        if (summary) {
          if (summary === YB_SURCHARGE_SUMMARY) noteParts.push(summary)
          else excludedItems.push(summary)
        }
        i += Math.max(1, consumed)
        continue
      }
      if (isYbtourIncExcBulletLine(line)) {
        excludedItems.push(line.slice(0, 280))
      }
      i++
      continue
    }

    if (mode === 'sel') {
      if (/^포함\s*(?:사항|내역)\s*$/i.test(line) || /^불포함\s*(?:사항|내역)\s*$/i.test(line)) {
        mode = 'idle'
        i++
        continue
      }
      if (isExampleOnlyLine(line)) {
        i++
        continue
      }
      if (isYbtourIncExcBulletLine(line)) {
        const it = ybSelectionCostLineToItem(line)
        if (it) excludedItems.push(it)
      }
      i++
      continue
    }

    if (mode === 'idle' && startsYbtourExtraChargeBlock(line)) {
      const { consumed, summary } = collectYbtourSurchargeChunk(lines, i)
      if (summary) {
        if (summary === YB_SURCHARGE_SUMMARY) noteParts.push(summary)
        else excludedItems.push(summary)
      }
      i += Math.max(1, consumed)
      continue
    }

    i++
  }

  const noteText = [...new Set(noteParts)].join('\n').slice(0, 1500)

  let exc = excludedItems.map(normLine).filter(Boolean)
  const dedupe = (arr: string[]) => {
    const seen = new Set<string>()
    const out: string[] = []
    for (const x of arr) {
      const k = x.toLowerCase()
      if (!k || seen.has(k)) continue
      seen.add(k)
      out.push(x)
    }
    return out
  }

  const inc = sanitizeIncludedExcludedItemsLines(
    dedupe(includedItems.map((x) => x.slice(0, 280))).slice(0, 40)
  )
  exc = sanitizeIncludedExcludedItemsLines(dedupe(exc.map((x) => x.slice(0, 1200))).slice(0, 45))

  const reviewNeeded = inc.length === 0 && exc.length === 0 && section.trim().length > 40
  return {
    includedItems: inc,
    excludedItems: exc,
    noteText,
    reviewNeeded,
    reviewReasons: reviewNeeded ? ['ybtour_include_exclude_bullet_parse_empty'] : [],
  }
}

function bodyKeywordHits(text: string): Record<string, boolean> {
  const t = text.slice(0, 120000)
  return {
    hasWonPrice: /[\d,]{3,}\s*원/.test(t),
    hasAdultChild: /(?:성인|아동|유아)/.test(t),
    hasDepartureWord: /출발/.test(t),
    hasArrivalWord: /도착|귀국/.test(t),
    hasIncludeHeader: /포함\s*사항|포함사항|포함\s*내역|포함내역/.test(t),
    hasExcludeHeader: /불포함\s*사항|불포함사항|불포함\s*내역|불포함내역/.test(t),
    hasFlightNo: /\b[A-Z]{2,3}\d{2,5}\b/.test(t),
  }
}

export function logYbtourBasicDetailBody(detail: DetailBodyParseSnapshot, rawLen: number) {
  const raw = detail.normalizedRaw ?? ''
  const hits = bodyKeywordHits(raw)
  const ie = detail.includedExcludedStructured
  const fs = detail.flightStructured
  const ob = fs?.outbound
  const ib = fs?.inbound
  logYbtourBasic('detail-body', {
    detailBodyLen: rawLen,
    normalizedRawLen: raw.length,
    ...hits,
    includeItemCount: ie?.includedItems?.length ?? 0,
    excludeItemCount: ie?.excludedItems?.length ?? 0,
    flightDbgStatus: fs?.debug?.status ?? null,
    outbound: {
      airline: fs?.airlineName ?? null,
      flightNo: ob?.flightNo ?? null,
      depAp: ob?.departureAirport ?? null,
      arrAp: ob?.arrivalAirport ?? null,
      depAt: ob?.departureDate && ob?.departureTime ? `${ob.departureDate} ${ob.departureTime}` : null,
      arrAt: ob?.arrivalDate && ob?.arrivalTime ? `${ob.arrivalDate} ${ob.arrivalTime}` : null,
    },
    inbound: {
      flightNo: ib?.flightNo ?? null,
      depAp: ib?.departureAirport ?? null,
      arrAp: ib?.arrivalAirport ?? null,
      depAt: ib?.departureDate && ib?.departureTime ? `${ib.departureDate} ${ib.departureTime}` : null,
      arrAt: ib?.arrivalDate && ib?.arrivalTime ? `${ib.arrivalDate} ${ib.arrivalTime}` : null,
    },
  })

  const codes: string[] = []
  if (!raw.trim()) codes.push('detail-body-empty')
  if (!hits.hasWonPrice && !hits.hasAdultChild) codes.push('price-signal-missing')
  if (!ob?.flightNo && !ib?.flightNo && fs?.debug?.status !== 'success') codes.push('flight-structure-weak')

  if (codes.length) {
    logYbtourBasic('detail-body-flags', { failCodes: codes })
  }
}

/** LLM `includedRaw`/`excludedRaw`에 일정·약관 등 본문 전체가 섞였는지 */
export function isYbtourIncExcTextBodyDump(text: string | null | undefined): boolean {
  const t = (text ?? '').replace(/\r/g, '').trim()
  if (!t) return false
  const markerRes = [
    /(?:^|\n)\s*여행\s*일정/im,
    /(?:^|\n)\s*\d\s*일차/im,
    /(?:^|\n)\s*DAY\s*\d/im,
    /(?:^|\n)\s*약관\s*\/\s*취소/im,
    /(?:^|\n)\s*■\s*약관/im,
    /(?:^|\n)\s*■\s*취소수수료/im,
    /(?:^|\n)\s*참고하세요/im,
  ]
  const markerHits = markerRes.filter((re) => re.test(t)).length
  const bothIeHeaders =
    /(?:^|\n)\s*포함\s*사항/im.test(t) && /(?:^|\n)\s*불포함\s*사항/im.test(t)
  if (bothIeHeaders && t.length > 80) return true
  if (markerHits >= 2) return true
  if (markerHits >= 1 && t.length > 100) return true
  if (t.length > 2400) return true
  return false
}

/** 구조화 bullet·파서 결과가 있으면 LLM raw 덤프보다 우선 */
export function resolveYbtourMergedIncExcText(args: {
  rawText?: string | null
  items: string[]
  structuredItems?: string[]
  fallbackText?: string | null
}): string | null {
  const raw = args.rawText?.trim() || null
  const fromItems = args.items.map((x) => String(x).trim()).filter(Boolean)
  const fromStructured = (args.structuredItems ?? []).map((x) => String(x).trim()).filter(Boolean)
  const itemLines = fromItems.length > 0 ? fromItems : fromStructured
  const joinedItems = itemLines.length > 0 ? itemLines.join('\n') : null
  if (isYbtourIncExcTextBodyDump(raw)) {
    return joinedItems ?? args.fallbackText?.trim() ?? null
  }
  return raw ?? joinedItems ?? args.fallbackText?.trim() ?? null
}

export type YbtourRegisterGeminiIncExcRaw = {
  includedItems?: string[] | null
  excludedItems?: string[] | null
  includedRaw?: string | null
  excludedRaw?: string | null
  includedText?: string | null
  excludedText?: string | null
}

/** 풀 등록 LLM JSON — detail-body 구조화 포함·불포함이 raw 덤프보다 우선 */
export function overlayYbtourStructuredIncExcOnRegisterRaw<T extends YbtourRegisterGeminiIncExcRaw>(
  raw: T,
  ie: Pick<IncludedExcludedStructured, 'includedItems' | 'excludedItems'>
): T {
  const next = { ...raw }
  if (ie.includedItems.length) {
    const dump = isYbtourIncExcTextBodyDump(
      typeof raw.includedRaw === 'string' ? raw.includedRaw : null
    )
    const emptyItems = !Array.isArray(raw.includedItems) || raw.includedItems.length === 0
    if (dump || emptyItems) {
      next.includedItems = [...ie.includedItems]
      if (dump) next.includedRaw = null
    }
  }
  if (ie.excludedItems.length) {
    const dump = isYbtourIncExcTextBodyDump(
      typeof raw.excludedRaw === 'string' ? raw.excludedRaw : null
    )
    const emptyItems = !Array.isArray(raw.excludedItems) || raw.excludedItems.length === 0
    if (dump || emptyItems) {
      next.excludedItems = [...ie.excludedItems]
      if (dump) next.excludedRaw = null
    }
  }
  return next
}

/** LLM이 포함·불포함을 한 덩어리로 넣었을 때 `불포함사항` 헤더 기준 분리 */
export function repairYbtourMergedIncludedExcluded(parsed: RegisterParsed): RegisterParsed {
  const blob = (parsed.includedText ?? '').trim()
  if (!blob || !/불포함\s*사항|불포함사항/i.test(blob)) return parsed
  const m = blob.match(/(?:^|\n)\s*불포함\s*사항\s*\n?/i)
  if (!m || m.index == null) return parsed
  const includedPart = blob.slice(0, m.index).replace(/(?:^|\n)\s*포함\s*사항\s*\n?/i, '').trim()
  const excludedPart = blob
    .slice(m.index + m[0].length)
    .replace(/^(?:포함|불포함)\s*사항\s*\n?/gim, '')
    .trim()
  if (!excludedPart) return parsed
  const ie = parsed.detailBodyStructured?.includedExcludedStructured
  const excLines = excludedPart
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l && isYbtourIncExcBulletLine(l))
    .map((l) => l.replace(/^[\s·•‧∙‣⁃*\-･・\u00B7\u2022\u2023\u30FB\uFF65■▪]+\s*/, '').trim())
    .filter(Boolean)
  const incLines = includedPart
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l && isYbtourIncExcBulletLine(l))
    .map((l) => l.replace(/^[\s·•‧∙‣⁃*\-･・\u00B7\u2022\u2023\u30FB\uFF65■▪]+\s*/, '').trim())
    .filter(Boolean)
  const excludedItems =
    excLines.length > 0 ? excLines : ie?.excludedItems?.length ? ie.excludedItems : parsed.excludedItems
  const includedItems =
    incLines.length > 0 ? incLines : ie?.includedItems?.length ? ie.includedItems : parsed.includedItems
  return {
    ...parsed,
    includedText: includedItems?.length ? includedItems.join('\n') : includedPart || parsed.includedText,
    excludedText: excludedItems?.length ? excludedItems.join('\n') : excludedPart,
    includedItems: includedItems ?? parsed.includedItems,
    excludedItems: excludedItems ?? parsed.excludedItems,
  }
}

/** 상단 메타 `싱글차지` + 다음 줄 금액 */
export function extractYbtourMetaSingleRoomFromBody(blob: string): {
  amount: number | null
  currency: string | null
  raw: string | null
} {
  const lines = blob.replace(/\r/g, '\n').split('\n').map((l) => l.trim())
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i]!
    if (!/싱글\s*차지|싱글차지/i.test(ln)) continue
    const next = lines[i + 1] ?? ''
    const joined =
      /^[\d,]{2,}\s*원?\s*$/i.test(next) || /^[\d,]{2,}$/.test(next) ? `${ln} ${next}` : ln
    const m = joined.match(/([\d,]{2,})\s*원/i) ?? joined.match(/([\d,]{2,})/)
    const amount = m ? Number(m[1]!.replace(/,/g, '')) : null
    if (amount != null && Number.isFinite(amount) && amount > 0) {
      return { amount, currency: 'KRW', raw: joined.slice(0, 200) }
    }
  }
  return { amount: null, currency: null, raw: null }
}

/** 공용 merge는 `departureDateTimeRaw`/`arrivalDateTimeRaw`를 flightStructured에서 안 채우는 경우가 있어 preview 표시용으로만 보강 */
export function applyYbtourStructuredPreviewFields(parsed: RegisterParsed): RegisterParsed {
  let next = repairYbtourMergedIncludedExcluded(parsed)
  const snap = next.detailBodyStructured
  const fs = snap?.flightStructured
  if (!fs) return next
  const ob = fs.outbound
  const ib = fs.inbound
  const ie = snap.includedExcludedStructured
  let out: RegisterParsed = { ...next }

  const obDep =
    ob.departureDate && ob.departureTime ? `${String(ob.departureDate).trim()} ${String(ob.departureTime).trim()}`.trim() : null
  const ibArr =
    ib.arrivalDate && ib.arrivalTime ? `${String(ib.arrivalDate).trim()} ${String(ib.arrivalTime).trim()}`.trim() : null
  if (!(out.departureDateTimeRaw ?? '').trim() && obDep) {
    out = { ...out, departureDateTimeRaw: obDep }
  }
  if (!(out.arrivalDateTimeRaw ?? '').trim() && ibArr) {
    out = { ...out, arrivalDateTimeRaw: ibArr }
  }

  const airNm = (fs.airlineName ?? '').trim()
  if (!(out.airline ?? '').trim() && airNm) {
    out = { ...out, airline: airNm }
  }
  if (!(out.airlineName ?? '').trim() && airNm) {
    out = { ...out, airlineName: airNm }
  }

  const ieExc = ie?.excludedItems?.length ? ie.excludedItems : []
  const ieInc = ie?.includedItems?.length ? ie.includedItems : []

  if (!(out.includedText ?? '').trim()) {
    const src = out.includedItems?.length ? out.includedItems : ieInc
    if (src?.length) {
      const lines = src.map((x) => String(x).trim()).filter(Boolean)
      out = { ...out, includedText: lines.join('\n'), includedItems: lines }
    }
  } else if (ieInc.length > 0 && /불포함\s*사항|불포함사항/i.test(out.includedText ?? '')) {
    const lines = ieInc.map((x) => String(x).trim()).filter(Boolean)
    if (lines.length) out = { ...out, includedText: lines.join('\n'), includedItems: lines }
  }

  const excludedCurrent = (out.excludedText ?? '').trim()
  if (!excludedCurrent || isYbtourIncExcTextBodyDump(excludedCurrent)) {
    const fromItems = out.excludedItems?.length ? out.excludedItems : ieExc
    const note = (ie?.noteText ?? '').trim()
    const lines = (fromItems ?? []).map((x) => String(x).trim()).filter(Boolean)
    const merged = [lines.join('\n'), note].filter(Boolean).join('\n\n').trim()
    if (merged) {
      out = {
        ...out,
        excludedText: merged,
        excludedItems: lines.length ? lines : out.excludedItems,
      }
    }
  } else if (ieExc.length > 0 && !(out.excludedItems?.length ?? 0)) {
    const lines = ieExc.map((x) => String(x).trim()).filter(Boolean)
    if (lines.length) out = { ...out, excludedItems: lines }
  }

  const includedCurrent = (out.includedText ?? '').trim()
  if (
    includedCurrent &&
    isYbtourIncExcTextBodyDump(includedCurrent) &&
    ieInc.length > 0
  ) {
    const lines = ieInc.map((x) => String(x).trim()).filter(Boolean)
    if (lines.length) out = { ...out, includedText: lines.join('\n'), includedItems: lines }
  }

  return out
}

export function logYbtourBasicRegisterFinal(parsed: RegisterParsed, rawTextLen: number) {
  const pt = parsed.productPriceTable
  const fs = parsed.detailBodyStructured?.flightStructured
  const ob = fs?.outbound
  const ib = fs?.inbound
  logYbtourBasic('register-final', {
    rawTextLen,
    adultPrice: pt?.adultPrice ?? null,
    childPrice: pt?.childExtraBedPrice ?? null,
    infantPrice: pt?.infantPrice ?? null,
    originCode: parsed.originCode?.trim() || null,
    airline: parsed.airline ?? null,
    duration: parsed.duration ?? null,
    departureDateTimeRaw: (parsed.departureDateTimeRaw ?? '').trim().slice(0, 80) || null,
    arrivalDateTimeRaw: (parsed.arrivalDateTimeRaw ?? '').trim().slice(0, 80) || null,
    includedTextLen: (parsed.includedText ?? '').length,
    excludedTextLen: (parsed.excludedText ?? '').length,
    outboundFlightNo: ob?.flightNo ?? null,
    inboundFlightNo: ib?.flightNo ?? null,
    obDepAt: ob?.departureDate && ob?.departureTime ? `${ob.departureDate} ${ob.departureTime}` : null,
    ibArrAt: ib?.arrivalDate && ib?.arrivalTime ? `${ib.arrivalDate} ${ib.arrivalTime}` : null,
  })

  const fail: string[] = []
  if (!pt?.adultPrice) fail.push('price-parse-zero')
  if (!ob?.departureDate && !ob?.departureTime) fail.push('departure-date-empty')
  if (!ib?.arrivalDate && !ib?.arrivalTime) fail.push('return-date-empty')
  if (!ob?.flightNo && !ib?.flightNo) fail.push('flight-structure-empty')
  if (!(parsed.includedText ?? '').trim() && !(parsed.excludedText ?? '').trim()) {
    const ie = parsed.detailBodyStructured?.includedExcludedStructured
    if ((ie?.includedItems?.length ?? 0) + (ie?.excludedItems?.length ?? 0) === 0) {
      fail.push('include-exclude-empty')
    }
  }
  if (fail.length) {
    logYbtourBasic('register-final-flags', { failCodes: fail })
  }
}
