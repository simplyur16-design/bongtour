/**
 * 모두투어 등록: 쇼핑 표(JSON 행) vs 방문 횟수 요약 정합 + 검수 이슈 후처리(모두투어 핸들러 전용).
 * 운영 붙여넣기: 헤더 다음 4열 완성 행 = 후보 그룹 헤더, 이후 1열 줄 = 동일 그룹 후보 쇼핑점(candidateOnly).
 */
import type { ShoppingStructured } from '@/lib/detail-body-parser-types'
import type { RegisterExtractionFieldIssue, RegisterParsed } from '@/lib/register-llm-schema-modetour'

type ModetourPasteGroup = {
  item: string
  shop: string
  dur: string
  ref: string
  candidates: string[]
}

/** 4열 헤더 + 그룹/후보 줄 — 실제 방문 횟수는 본문 SSOT, 여기서는 후보 그룹만. */
export function parseModetourShoppingPasteGroups(raw: string): ShoppingStructured | null {
  const text = raw.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').trim()
  if (!text) return null
  const lines = text.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0)
  if (lines.length < 2) return null
  let start = 0
  const h = lines[0]!
  if (/\t/.test(h) && /쇼핑\s*품목|쇼핑품목/i.test(h) && /쇼핑\s*장소|쇼핑장소/i.test(h)) {
    start = 1
  }

  const collected: ModetourPasteGroup[] = []
  let cur: ModetourPasteGroup | null = null

  const flush = () => {
    if (cur?.item) collected.push(cur)
    cur = null
  }

  for (let i = start; i < lines.length; i++) {
    const cols = lines[i]!.split('\t').map((c) => c.trim())
    const isHeaderRow =
      cols.length >= 4 && Boolean(cols[0]) && Boolean(cols[1]) && Boolean(cols[2]) && Boolean(cols[3])
    if (isHeaderRow) {
      flush()
      const shop = cols[1]!
      cur = {
        item: cols[0]!,
        shop,
        dur: cols[2]!,
        ref: cols[3]!,
        candidates: [shop],
      }
      continue
    }
    const nonEmpty = cols.filter(Boolean)
    if (cur && nonEmpty.length === 1) {
      const name = nonEmpty[0]!
      if (!cur.candidates.includes(name)) cur.candidates.push(name)
    }
  }
  flush()
  if (collected.length === 0) return null

  const rows: ShoppingStructured['rows'] = collected.map((g, idx) => ({
    shoppingItem: g.item,
    shoppingPlace: g.shop,
    shopName: g.shop,
    durationText: g.dur,
    refundPolicyText: g.ref,
    noteText: g.candidates.join(', '),
    candidateOnly: true,
    candidateGroupKey: `modetour:g${idx}`,
  }))

  return {
    rows,
    shoppingCountText: '',
    reviewNeeded: false,
    reviewReasons: [],
  }
}

export function countModetourShoppingStopsJsonRows(raw: string | null | undefined): number {
  if (!raw?.trim()) return 0
  try {
    const a = JSON.parse(raw) as unknown
    return Array.isArray(a) ? a.length : 0
  } catch {
    return 0
  }
}

/** 본문 쇼핑 행이 실제 쇼핑 표인지(옵션·유류·장문 서술 오탐 제거) */
export function modetourShoppingRowLooksPlausible(r: ShoppingStructured['rows'][number]): boolean {
  const item = (r.shoppingItem ?? '').trim()
  const place = (r.shoppingPlace ?? '').trim()
  const dur = (r.durationText ?? '').trim()
  const ref = (r.refundPolicyText ?? '').trim()
  const hay = `${item} ${place} ${dur} ${ref}`
  const strong =
    /(인삼|홍삼|화장품|건강식품|특산|면세|아울렛|마트|백화점|쇼핑센터|기념품|보석|시계|골드|은협|레드\s*샌드|남대문|동대문|사파이어|루비|라텍스|전통차|진주|침향|발사믹|올리브)/i.test(
      hay
    )

  if (/쇼핑\s*(?:없음|무|미포함|불가|해당\s*없음|0\s*회)|무료\s*쇼핑\s*없음|쇼핑\s*일정\s*없음/i.test(hay)) return false
  if (
    /(?:^|\s)(?:옵션\s*투어|선택\s*관광\s*안내|참가비\s*안내|추가\s*요금\s*안내|일반\s*안내|유의\s*사항|주의\s*사항|문의\s*안내)/i.test(
      item
    ) &&
    !strong
  )
    return false
  if (
    /(유류\s*할증|제세\s*공과|캠프\s*파이어|캠프파이어|파이어\s*쇼|선택\s*참가\s*비|옵션\s*성\s*안내|추가\s*액티비티|현지\s*참가\s*비|판매\s*안내|추가\s*요금\s*안내|부가\s*서비스)/i.test(
      item
    ) &&
    !/(인삼|화장품|쇼핑품목|쇼핑장소|면세|아울렛)/i.test(hay)
  )
    return false
  if (/(?:^|\s)(?:TIP|팁|가이드\s*경비)\b/i.test(item) && !place && !strong) return false
  if (item.length > 160 && !place && !dur) return false
  if (item.length > 90 && !place && !strong && !/(쇼핑\s*품목|쇼핑\s*장소)/i.test(item)) return false
  if (/(?:원하실\s*경우|신청\s*시|불포함이며).{0,60}(?:\$|€|\/\s*1인|1인당)/i.test(item) && !place) return false
  const structured =
    /쇼핑\s*품목|쇼핑\s*장소|쇼핑품목|쇼핑장소/i.test(item) || (item.includes('/') && /(품목|장소|환불|소요)/i.test(hay))
  const hasMiniTable = dur && ref && item.length <= 100
  if (place || strong || structured) return true
  if (hasMiniTable && (strong || place || /(쇼핑|매장|면세|아울렛)/i.test(hay))) return true
  if (item.length <= 40 && (dur || ref) && /(쇼핑|매장|센터|면세)/i.test(hay)) return !!(place || strong || structured)
  return false
}

function modetourNormalizeShoppingStopRecord(row: unknown): ShoppingStructured['rows'][number] {
  const o = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
  const visitRaw = o.visitNo
  let visitNo: number | null = null
  if (typeof visitRaw === 'number' && Number.isFinite(visitRaw)) visitNo = visitRaw
  else if (typeof visitRaw === 'string' && /^\d+$/.test(visitRaw.trim())) visitNo = Number(visitRaw.trim())
  return {
    shoppingItem: String(o.shoppingItem ?? o.itemType ?? o.raw ?? o.name ?? '').trim(),
    shoppingPlace: String(o.shoppingPlace ?? o.placeName ?? '').trim(),
    shopName: o.shopName != null ? String(o.shopName).trim() || null : null,
    durationText: String(o.durationText ?? '').trim(),
    refundPolicyText: String(o.refundPolicyText ?? '').trim(),
    noteText: o.noteText != null ? String(o.noteText) : undefined,
    candidateOnly: o.candidateOnly === true ? true : undefined,
    candidateGroupKey: o.candidateGroupKey != null ? String(o.candidateGroupKey) : null,
    visitNo,
  }
}

/** LLM·병합 JSON에서 모두투어 쇼핑 최소 조건 미달 행 제거(키 호환). */
export function modetourFilterShoppingStopsJsonString(json: string | null | undefined): string | null {
  if (!json?.trim()) return null
  try {
    const arr = JSON.parse(json) as unknown[]
    if (!Array.isArray(arr)) return null
    const filtered = arr.map(modetourNormalizeShoppingStopRecord).filter(modetourShoppingRowLooksPlausible)
    if (filtered.length === 0) return null
    return JSON.stringify(
      filtered.map((r) => {
        const base: Record<string, unknown> = {
          itemType: r.shoppingItem || '쇼핑',
          placeName: r.shoppingPlace || r.shoppingItem || '',
          durationText: r.durationText || null,
          refundPolicyText: r.refundPolicyText || null,
          raw: r.shoppingItem || '',
        }
        if (r.shopName != null && String(r.shopName).trim()) base.shopName = String(r.shopName).trim()
        if (r.candidateOnly === true) base.candidateOnly = true
        if (r.candidateGroupKey != null && String(r.candidateGroupKey).trim()) {
          base.candidateGroupKey = String(r.candidateGroupKey).trim()
        }
        if (r.noteText != null && String(r.noteText).trim()) base.noteText = String(r.noteText).trim()
        if (r.visitNo != null && Number.isFinite(Number(r.visitNo))) base.visitNo = Number(r.visitNo)
        return base
      })
    )
  } catch {
    return null
  }
}

export function sanitizeModetourShoppingStructured(
  shoppingSection: string,
  structured: ShoppingStructured,
  shoppingPasteRaw: string | null | undefined
): ShoppingStructured {
  const paste = shoppingPasteRaw?.trim()
  if (paste) {
    const grouped = parseModetourShoppingPasteGroups(paste)
    if (grouped && grouped.rows.length > 0) {
      const filtered = grouped.rows.filter(modetourShoppingRowLooksPlausible)
      return filtered.length > 0 ? { ...grouped, rows: filtered } : grouped
    }
    return structured
  }
  const sec = shoppingSection.trim()
  if (!sec) {
    return { rows: [], shoppingCountText: '', reviewNeeded: false, reviewReasons: [] }
  }
  const filtered = structured.rows.filter(modetourShoppingRowLooksPlausible)
  if (filtered.length === structured.rows.length) return structured
  if (filtered.length === 0) {
    return {
      rows: [],
      shoppingCountText: '',
      reviewNeeded: false,
      reviewReasons: [],
    }
  }
  return {
    ...structured,
    rows: filtered,
    shoppingCountText: filtered.length ? structured.shoppingCountText : '',
  }
}

/**
 * detail-body 쇼핑 근거가 없으면 LLM 쇼핑 JSON·횟수도 비움(오탐 루프 차단).
 * 쇼핑 정형 붙여넣기가 있으면 LLM 값 유지.
 */
export function finalizeModetourRegisterParsedShopping(parsed: RegisterParsed): RegisterParsed {
  const pasted = parsed.detailBodyStructured?.raw?.shoppingPasteRaw?.trim()
  const plausible =
    (parsed.detailBodyStructured?.shoppingStructured?.rows ?? []).filter(modetourShoppingRowLooksPlausible)
  if (pasted) {
    return reconcileModetourShoppingVisitCountWithStops(parsed)
  }
  if (plausible.length === 0) {
    return {
      ...parsed,
      shoppingStops: undefined,
      shoppingVisitCount: null,
      hasShopping: false,
      shoppingSummaryText: undefined,
    }
  }
  const filteredJson = modetourFilterShoppingStopsJsonString(parsed.shoppingStops)
  const next: RegisterParsed = {
    ...parsed,
    hasShopping: true,
    shoppingStops:
      filteredJson ??
      JSON.stringify(
        plausible.map((r) => {
          const base: Record<string, unknown> = {
            itemType: r.shoppingItem || '쇼핑',
            placeName: r.shoppingPlace || r.shoppingItem || '',
            durationText: r.durationText || null,
            refundPolicyText: r.refundPolicyText || null,
            raw: r.shoppingItem || '',
          }
          if (r.shopName != null && String(r.shopName).trim()) base.shopName = String(r.shopName).trim()
          if (r.candidateOnly === true) base.candidateOnly = true
          if (r.candidateGroupKey != null && String(r.candidateGroupKey).trim()) {
            base.candidateGroupKey = String(r.candidateGroupKey).trim()
          }
          if (r.noteText != null && String(r.noteText).trim()) base.noteText = String(r.noteText).trim()
          if (r.visitNo != null && Number.isFinite(Number(r.visitNo))) base.visitNo = Number(r.visitNo)
          return base
        })
      ),
  }
  return reconcileModetourShoppingVisitCountWithStops(next)
}

/** 본문 요약 `쇼핑 N회` — 후보 행 개수보다 우선(SSOT). */
function parseModetourShoppingVisitCountFromSummary(t: string | null | undefined): number | null {
  const s = (t ?? '').replace(/\s+/g, ' ').trim()
  if (!s) return null
  const m = s.match(/쇼핑\s*(\d+)\s*회|총\s*(\d+)\s*회\s*\(?\s*쇼핑|쇼핑횟수\s*[:\s]*(\d+)/i)
  if (m) {
    const n = Number(m[1] || m[2] || m[3])
    if (Number.isFinite(n) && n > 0 && n < 100) return n
  }
  return null
}

/**
 * 쇼핑 행(JSON)은 절대 줄이지 않는다. `shoppingVisitCount`가 비어 있거나 0 이하일 때만 행 개수로 보강한다.
 * 본문·LLM이 이미 양의 횟수를 준 경우 행 수와 다르면 덮어쓰지 않고 검수에 맡긴다(리스트 우선).
 */
export function reconcileModetourShoppingVisitCountWithStops(parsed: RegisterParsed): RegisterParsed {
  if (!parsed.shoppingStops?.trim()) return parsed
  let arr: unknown[]
  try {
    arr = JSON.parse(parsed.shoppingStops) as unknown[]
    if (!Array.isArray(arr)) return parsed
  } catch {
    return parsed
  }
  const allCandidate =
    arr.length > 0 &&
    arr.every((row) => {
      const o = row && typeof row === 'object' ? (row as Record<string, unknown>) : {}
      return o.candidateOnly === true
    })
  if (allCandidate) {
    return parsed
  }
  const rows = arr.length
  if (rows <= 0) return parsed
  const summaryVc = parseModetourShoppingVisitCountFromSummary(parsed.shoppingSummaryText)
  const vc = parsed.shoppingVisitCount != null ? Number(parsed.shoppingVisitCount) : null
  if (summaryVc != null && summaryVc > 0) {
    if (vc == null || !Number.isFinite(vc) || vc <= 0) {
      return { ...parsed, shoppingVisitCount: summaryVc, hasShopping: true }
    }
    /** 본문 요약 횟수 SSOT: 행 수와 동일하게만 채워진 값이 요약과 다르면 요약 우선 */
    if (vc === rows && summaryVc !== rows) {
      return { ...parsed, shoppingVisitCount: summaryVc, hasShopping: true }
    }
  }
  if (vc === rows) return parsed
  if (vc == null || !Number.isFinite(vc) || vc <= 0) {
    return { ...parsed, shoppingVisitCount: rows, hasShopping: true }
  }
  return parsed
}

export type ModetourExtractionFilterOpts = {
  flightHasUsableCore: boolean
  shoppingStopRowCount: number
}

function modetourLegMentionsDateOnly(reason: string): boolean {
  const dateHints =
    /출발일|귀국일|여행\s*기간|일정\s*날짜|(?:^|\s)날짜(?:\s|로|는)|캘린더|달력|히어로|N박|N일|귀국\s*\(|출발\s*\(/.test(reason)
  const flightHints =
    /항공|편명|공항|출국|입국|가는편|오는편|\b[A-Z]{2,3}\d{2,5}\b/i.test(reason)
  const priceHints = /가격|금액|원\)|프로모|쿠폰|할인|성인|아동|유아|엑스트라|노베드|싱글|1인\s*객실/.test(reason)
  return dateHints && !flightHints && !priceHints
}

const OTHER_SUPPLIER_IN_REASON =
  /하나투어|hanatour|노랑풍선|yellow\s*balloon|참좋은(?:여행)?|very\s*good\s*tour|verygoodtour/i

/**
 * 공용 `register-parse` 산출 이슈를 모두투어 등록 UI(검수·교정 필드 매핑)에 맞게 보수적으로 다듬는다.
 */
export function filterModetourExtractionIssuesForModetourRegister(
  issues: RegisterExtractionFieldIssue[],
  opts: ModetourExtractionFilterOpts
): RegisterExtractionFieldIssue[] {
  const out: RegisterExtractionFieldIssue[] = []
  for (const issue of issues) {
    if (OTHER_SUPPLIER_IN_REASON.test(issue.reason)) continue

    if (
      opts.flightHasUsableCore &&
      issue.field === 'flight_info' &&
      issue.source === 'auto' &&
      issue.reason.startsWith('[REVIEW REQUIRED]')
    ) {
      continue
    }

    if (
      opts.shoppingStopRowCount > 0 &&
      issue.field === 'shoppingStops' &&
      issue.reason.includes('후보지 목록과 방문 횟수가 모두 비어')
    ) {
      continue
    }

    const priceLikeField =
      issue.field === 'price' ||
      issue.field === 'prices' ||
      issue.field === 'priceDisplay' ||
      issue.field === 'productPriceTable' ||
      issue.field === 'priceTableRawText'

    if (priceLikeField && modetourLegMentionsDateOnly(issue.reason)) {
      out.push({ ...issue, field: 'hero_trip_dates' })
      continue
    }

    if (issue.field === 'flight_info' && modetourLegMentionsDateOnly(issue.reason)) {
      out.push({ ...issue, field: 'hero_trip_dates' })
      continue
    }

    out.push(issue)
  }
  return out
}
