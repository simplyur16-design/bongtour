/**
 * 참좋은여행 등록: 쇼핑 총횟수·회차 표 정합 + 비쇼핑 안내문 행 제거.
 * 운영 붙여넣기: `구분\t쇼핑항목\t쇼핑장소\t소요시간\t현지/귀국 후 환불여부` (헤더 1행 제외).
 */
import type { ShoppingStructured } from '@/lib/detail-body-parser-types'
import type { RegisterParsed } from '@/lib/register-llm-schema-verygoodtour'

function splitShoppingPasteCols(line: string): string[] {
  const t = line.trim()
  if (t.includes('\t')) return t.split('\t').map((c) => c.trim())
  const by2 = t.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean)
  if (by2.length >= 5) return by2
  const m = /^(\d+)\s+(.+)$/.exec(t)
  if (!m) return t.split(/\t/).map((c) => c.trim())
  const rest = m[2]!.split(/\s{2,}/).map((c) => c.trim()).filter(Boolean)
  return [m[1]!, ...rest].length >= 5 ? [m[1]!, ...rest] : by2
}

/** 헤더+데이터 TSV — 구분 숫자 = 실제 쇼핑 회차(candidateOnly=false). */
export function parseVerygoodShoppingPasteTab(raw: string): ShoppingStructured | null {
  const text = raw.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').trim()
  if (!text) return null
  const lines = text.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0)
  if (lines.length < 2) return null
  const head = splitShoppingPasteCols(lines[0]!)
  const headHay = head.join(' ')
  if (!/구분/.test(headHay) || !/쇼핑항목|쇼핑\s*항목/.test(headHay)) return null

  const rows: ShoppingStructured['rows'] = []
  for (let i = 1; i < lines.length; i++) {
    const cols = splitShoppingPasteCols(lines[i]!)
    if (cols.length < 5) continue
    const visitNo = Number(String(cols[0]).replace(/[^\d]/g, '') || NaN)
    if (!Number.isFinite(visitNo) || visitNo < 1 || visitNo > 99) continue
    rows.push({
      shoppingItem: cols[1] ?? '',
      shoppingPlace: cols[2] ?? '',
      durationText: cols[3] ?? '',
      refundPolicyText: cols.slice(4).join(' ').trim(),
      visitNo,
      candidateOnly: false,
    })
  }
  if (rows.length === 0) return null
  const maxVisit = Math.max(...rows.map((r) => r.visitNo ?? 0))
  const totalVisits = Math.max(maxVisit, rows.length)
  return {
    rows,
    shoppingCountText: totalVisits > 0 ? `쇼핑총횟수 ${totalVisits}회` : '',
    reviewNeeded: false,
    reviewReasons: [],
  }
}

function parseVerygoodShoppingTotalVisits(hay: string): number | null {
  const t = hay.replace(/\s+/g, ' ')
  const patterns = [
    /쇼핑\s*총\s*횟수\s*[:\s]*(\d+)/i,
    /쇼핑\s*총?\s*(\d+)\s*회/i,
    /쇼핑횟수\s*총\s*(\d+)\s*회/i,
    /총\s*(\d+)\s*회\s*\(?\s*쇼핑/i,
    /쇼핑\s*(\d+)\s*회\s*예정/i,
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (m?.[1]) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n >= 0 && n < 100) return n
    }
  }
  return null
}

/** 회차·품목·장소 구조 없는 장문·옵션성 문구 제거 */
export function verygoodShoppingRowLooksPlausible(r: ShoppingStructured['rows'][number]): boolean {
  const item = (r.shoppingItem ?? '').trim()
  const place = (r.shoppingPlace ?? '').trim()
  const dur = (r.durationText ?? '').trim()
  const ref = (r.refundPolicyText ?? '').trim()
  const hay = `${item} ${place} ${dur} ${ref}`

  if (/쇼핑\s*(?:없음|무|미포함|0\s*회)|무료\s*쇼핑\s*없음/i.test(hay)) return false
  if (
    /(유류\s*할증|제세\s*공과|옵션\s*투어|선택\s*참가|추가\s*요금\s*안내|TIP|팁|가이드\s*경비)/i.test(
      item
    ) &&
    !/(면세|아울렛|인삼|화장품|쇼핑품목|쇼핑장소)/i.test(hay)
  )
    return false
  if (item.length > 140 && !place && !dur) return false
  if (
    /^(20|30|40|50)대$/i.test(item) ||
    /연령대|상품평점|여행후기|오늘의\s*날씨|현지시각|무이자|일정표호텔|관광지약관|선택관광\s*\/\s*쇼핑|쇼핑\s*안내|유의사항|참고사항/i.test(
      hay
    )
  )
    return false
  const hasStructure =
    Boolean(place) ||
    Boolean(dur && ref) ||
    /(쇼핑\s*품목|쇼핑\s*장소|쇼핑\s*항목|쇼핑항목|회차|구분|소요시간|환불)/i.test(hay) ||
    /(면세|아울렛|마트|백화점|기념품|인삼|화장품|잡화|약국)/i.test(hay)
  if (!hasStructure && item.length > 72) return false
  return item.length > 0 || place.length > 0
}

export function sanitizeVerygoodShoppingStructured(
  shoppingSection: string,
  structured: ShoppingStructured,
  shoppingPasteRaw: string | null | undefined
): ShoppingStructured {
  const paste = shoppingPasteRaw?.trim()
  if (paste) {
    const tabbed = parseVerygoodShoppingPasteTab(paste)
    if (tabbed && tabbed.rows.length > 0) {
      const filtered = tabbed.rows.filter(verygoodShoppingRowLooksPlausible)
      const maxVisit = Math.max(0, ...filtered.map((r) => r.visitNo ?? 0))
      const totalVisits = Math.max(maxVisit, filtered.length)
      return {
        ...tabbed,
        rows: filtered,
        shoppingCountText:
          totalVisits > 0 ? `쇼핑총횟수 ${totalVisits}회` : tabbed.shoppingCountText,
      }
    }
    return structured
  }
  const fromSection = parseVerygoodShoppingTotalVisits(shoppingSection)
  const fromCountField = parseVerygoodShoppingTotalVisits(structured.shoppingCountText ?? '')
  const countHint = fromSection ?? fromCountField
  let shoppingCountText = structured.shoppingCountText ?? ''
  if (!shoppingCountText.trim() && countHint != null && countHint > 0) {
    shoppingCountText = `쇼핑총횟수 ${countHint}회`
  }
  const filtered = structured.rows.filter(verygoodShoppingRowLooksPlausible)
  if (filtered.length === structured.rows.length && shoppingCountText === (structured.shoppingCountText ?? '')) {
    return { ...structured, shoppingCountText: shoppingCountText || structured.shoppingCountText }
  }
  return {
    ...structured,
    rows: filtered,
    shoppingCountText,
    reviewNeeded: filtered.length > 0 ? structured.reviewNeeded : false,
    reviewReasons: filtered.length > 0 ? structured.reviewReasons : [],
  }
}

export function finalizeVerygoodRegisterParsedShopping(parsed: RegisterParsed): RegisterParsed {
  const st = parsed.detailBodyStructured?.shoppingStructured
  if (!st) return parsed
  const plausible = st.rows.filter(verygoodShoppingRowLooksPlausible)
  const fromStructuredText = parseVerygoodShoppingTotalVisits(st.shoppingCountText ?? '')
  const fromSummary = parseVerygoodShoppingTotalVisits(parsed.shoppingSummaryText ?? '')
  const headerN = fromStructuredText ?? fromSummary
  const visitFromRows = (() => {
    const nums = plausible.map((r) => r.visitNo).filter((x): x is number => x != null && Number.isFinite(x))
    const mx = nums.length > 0 ? Math.max(...nums) : 0
    return mx > 0 ? mx : plausible.length
  })()
  let vc = parsed.shoppingVisitCount

  if (plausible.length === 0) {
    if (headerN != null && headerN > 0) {
      return {
        ...parsed,
        shoppingVisitCount: headerN,
        hasShopping: true,
      }
    }
    return {
      ...parsed,
      shoppingVisitCount: 0,
      hasShopping: false,
    }
  }

  if (vc == null || !Number.isFinite(Number(vc)) || Number(vc) <= 0) {
    return {
      ...parsed,
      shoppingVisitCount: visitFromRows,
      hasShopping: true,
    }
  }

  if (headerN != null && headerN > 0 && Number(vc) !== headerN && visitFromRows === headerN) {
    return { ...parsed, shoppingVisitCount: headerN, hasShopping: true }
  }
  if (headerN != null && headerN > 0 && Number(vc) !== visitFromRows && headerN === visitFromRows) {
    return { ...parsed, shoppingVisitCount: visitFromRows, hasShopping: true }
  }
  return { ...parsed, hasShopping: true }
}
