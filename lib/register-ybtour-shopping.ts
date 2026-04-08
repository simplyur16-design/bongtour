/**
 * 노랑풍선: 옵션 블록·메타가 쇼핑 행으로 승격되지 않게 필터 + 쇼핑 횟수 정합.
 * 운영 붙여넣기: `회차\t쇼핑 품목\t쇼핑 장소\t소요시간\t환불여부` (헤더 1행 제외).
 */
import type { ShoppingStructured } from '@/lib/detail-body-parser-types'
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'

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

/** 헤더+데이터 TSV — 실제 쇼핑 회차 행만 생성(candidateOnly=false). */
export function parseYbtourShoppingPasteTab(raw: string): ShoppingStructured | null {
  const text = raw.replace(/\r\n/g, '\n').replace(/^\uFEFF/, '').trim()
  if (!text) return null
  const lines = text.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0)
  if (lines.length < 2) return null
  const head = splitShoppingPasteCols(lines[0]!)
  const headHay = head.join(' ')
  if (!/회차/.test(headHay) || !/쇼핑\s*품목|품목/.test(headHay)) return null

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
    shoppingCountText: totalVisits > 0 ? `쇼핑 ${totalVisits}회` : '',
    reviewNeeded: false,
    reviewReasons: [],
  }
}

const OPTION_AXIS =
  /(선택관광\s*안내|현지\s*옵션|옵션\s*투어|미참여\s*시|미참가\s*시|동행\s*여부|동행여부|가이드\s*동행|인솔자\s*동행|1인\s*당\s*\$|USD\s*\d)/i

const META_ONLY =
  /^(?:※|▶|\*|•|-)?\s*(?:가이드\s*경비|싱글\s*차지|인솔|상품\s*소개|여행\s*안내)\s*$/i

function parseYbtourShoppingVisitCount(hay: string): number | null {
  const t = hay.replace(/\s+/g, ' ')
  const patterns = [/쇼핑\s*총\s*횟수\s*[:\s]*(\d+)/i, /쇼핑\s*(\d+)\s*회/i, /총\s*(\d+)\s*회\s*\(?\s*쇼핑/i]
  for (const re of patterns) {
    const m = t.match(re)
    if (m?.[1]) {
      const n = Number(m[1])
      if (Number.isFinite(n) && n >= 0 && n < 100) return n
    }
  }
  return null
}

export function ybtourShoppingRowLooksPlausible(r: ShoppingStructured['rows'][number]): boolean {
  const item = (r.shoppingItem ?? '').trim()
  const place = (r.shoppingPlace ?? '').trim()
  const dur = (r.durationText ?? '').trim()
  const ref = (r.refundPolicyText ?? '').trim()
  const hay = `${item} ${place} ${dur} ${ref}`
  if (META_ONLY.test(item)) return false
  if (OPTION_AXIS.test(hay) && !/(쇼핑\s*품목|쇼핑\s*장소|회차|면세|아울렛)/i.test(hay)) return false
  if (/(가이드\s*경비|싱글\s*차지|인솔자\s*동행)/i.test(item) && !/(면세|품목|장소)/i.test(hay)) return false
  const shopSignal =
    /(회차|쇼핑\s*품목|쇼핑\s*장소|쇼핑샵|면세|아울렛|환불\s*여부|소요\s*시간)/i.test(hay) ||
    place.length > 0 ||
    (ref.length > 0 && /환불/i.test(ref))
  if (!shopSignal && item.length > 80) return false
  return item.length > 0 || place.length > 0
}

export function sanitizeYbtourShoppingStructured(
  shoppingSection: string,
  structured: ShoppingStructured,
  shoppingPasteRaw: string | null | undefined
): ShoppingStructured {
  const paste = shoppingPasteRaw?.trim()
  if (paste) {
    const tabbed = parseYbtourShoppingPasteTab(paste)
    if (tabbed && tabbed.rows.length > 0) {
      const filtered = tabbed.rows.filter(ybtourShoppingRowLooksPlausible)
      const maxVisit = Math.max(0, ...filtered.map((r) => r.visitNo ?? 0))
      const totalVisits = Math.max(maxVisit, filtered.length)
      return {
        ...tabbed,
        rows: filtered,
        shoppingCountText:
          totalVisits > 0 ? `쇼핑 ${totalVisits}회` : tabbed.shoppingCountText,
      }
    }
    return structured
  }
  const vc = parseYbtourShoppingVisitCount(shoppingSection)
  let shoppingCountText = structured.shoppingCountText ?? ''
  if (!shoppingCountText.trim() && vc != null && vc > 0) {
    shoppingCountText = `쇼핑 ${vc}회`
  }
  const filtered = structured.rows.filter(ybtourShoppingRowLooksPlausible)
  return {
    ...structured,
    rows: filtered,
    shoppingCountText: shoppingCountText || structured.shoppingCountText,
  }
}

export function finalizeYbtourRegisterParsedShopping(parsed: RegisterParsed): RegisterParsed {
  const st = parsed.detailBodyStructured?.shoppingStructured
  if (!st) return parsed
  const plausible = st.rows.filter(ybtourShoppingRowLooksPlausible)
  const n = parseYbtourShoppingVisitCount(st.shoppingCountText ?? '') ??
    parseYbtourShoppingVisitCount(parsed.shoppingSummaryText ?? '')
  const visitFromRows = (() => {
    const nums = plausible.map((r) => r.visitNo).filter((x): x is number => x != null && Number.isFinite(x))
    const mx = nums.length > 0 ? Math.max(...nums) : 0
    return mx > 0 ? mx : plausible.length
  })()
  let vc = parsed.shoppingVisitCount
  if (plausible.length === 0) {
    if (n != null && n > 0) return { ...parsed, shoppingVisitCount: n, hasShopping: true }
    return parsed
  }
  if (vc == null || !Number.isFinite(Number(vc)) || Number(vc) <= 0) {
    return { ...parsed, shoppingVisitCount: visitFromRows, hasShopping: true }
  }
  if (n != null && n > 0 && Number(vc) !== n && visitFromRows === n) {
    return { ...parsed, shoppingVisitCount: n, hasShopping: true }
  }
  return { ...parsed, hasShopping: true }
}
