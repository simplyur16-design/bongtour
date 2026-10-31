/**
 * verygoodtour HXR — ProductCalendarSearch·모달 DOM 파서 (Playwright 없음).
 *
 * SSOT DOM: `scripts/calendar_e2e_scraper_verygoodtour/calendar_price_scraper.py`
 * VERYGOOD_MODAL_DOM_BUNDLE_JS 동일 계약.
 *
 * REGRESSION-FREEZE[verygoodtour-hxr-calendar-parse]: 모달 dep_left/dep_right 파싱 — manifest
 */
import { isDepartureOnSaleForImport } from '@/lib/departure-booking-status'

const VERYGOOD_CARRIER_RE =
  /(에미레이트항공|에미레이트|튀르키예항공|터키항공|카타르항공|카타르|에티하드항공|에티하드|영국항공|싱가포르항공|태국항공|베트남항공|트리니티항공|티웨이항공|대한항공|아시아나항공|제주항공|진에어|에어부산|에어서울|이스타항공|에어프레미아|플라이강원|루프트한자|에어캐나다|델타항공|유나이티드항공|핀에어|ANA|전일본공수)/

export type VerygoodCalendarLeftCell = {
  date: string
  approxPrice: number
  raw: string
}

export type VerygoodCalendarRightRow = {
  date: string
  adultPrice: number
  proCode: string | null
  productName: string | null
  carrierText: string | null
  statusRaw: string | null
  seatsRaw: string | null
  rawText: string
}

export type VerygoodModalDomParseResult = {
  ym: string | null
  leftCells: VerygoodCalendarLeftCell[]
  rightRows: VerygoodCalendarRightRow[]
  warnings: string[]
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function extractInner(html: string, className: string): string | null {
  const re = new RegExp(
    `<div[^>]*class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)</div>\\s*(?=<div[^>]*class="[^"]*(?:dep_|pop_|ui-dialog)|$)`,
    'i',
  )
  const m = html.match(re)
  return m?.[1] ?? null
}

function parseYearMonthFromHtml(html: string): { y: string; mo: string } | null {
  const m = html.match(/(\d{4})\.(\d{1,2})/)
  if (!m) return null
  const y = m[1]!
  const mo = String(Number(m[2])).padStart(2, '0')
  return { y, mo }
}

/**
 * 좌측 달력 td.jq_cl_day — E2E leftCells 계약.
 * 만원 표기: `21 95만원~` · `4 1,899 만원~`(천단위 콤마) 모두 허용.
 */
// REGRESSION-FREEZE[verygoodtour-hxr-calendar-parse]: 좌측 만원 콤마(1,899 만원~) — manifest
export function parseVerygoodCalendarLeftCells(
  html: string,
  ym: { y: string; mo: string },
): VerygoodCalendarLeftCell[] {
  const leftHtml = extractInner(html, 'dep_left_wrap') ?? html
  const cells: VerygoodCalendarLeftCell[] = []
  const tdRe = /<td[^>]*class="[^"]*jq_cl_day[^"]*"[^>]*>([\s\S]*?)<\/td>/gi
  let m: RegExpExecArray | null
  while ((m = tdRe.exec(leftHtml)) != null) {
    const raw = stripTags(m[1]!)
    const mm = raw.match(/^(\d{1,2})(?:\s+([0-9]{1,3}(?:,[0-9]{3})*|[0-9]+)\s*만원~?)?$/)
    if (!mm) continue
    const day = Number(mm[1])
    const man = mm[2] ? Number(String(mm[2]).replace(/,/g, '')) : 0
    cells.push({
      date: `${ym.y}-${ym.mo}-${String(day).padStart(2, '0')}`,
      approxPrice: man > 0 ? man * 10_000 : 0,
      raw,
    })
  }
  return cells
}

function parsePriceFromLiInner(liInner: string): number {
  const pw =
    liInner.match(/class="[^"]*price_wrap[^"]*"[^>]*>([\s\S]*?)<\/(?:div|span)/i)?.[1] ?? liInner
  const plain = stripTags(pw)
  const m1 = plain.match(/([0-9]{1,3}(?:,[0-9]{3})+)\s*원/)
  if (m1) return parseInt(m1[1]!.replace(/,/g, ''), 10)
  const m2 = plain.match(/([0-9]{4,9})\s*원/)
  if (m2) return parseInt(m2[1]!.replace(/,/g, ''), 10)
  return 0
}

function parseDateFromRowText(t: string, ym: { y: string; mo: string } | null): string | null {
  const dm = t.match(/(20\d{2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})/)
  if (dm) {
    return `${dm[1]}-${String(Number(dm[2])).padStart(2, '0')}-${String(Number(dm[3])).padStart(2, '0')}`
  }
  if (!ym) return null
  const sm = t.match(/(?:^|\s)(\d{1,2})\s*[.\/-]\s*(\d{1,2})(?:\s|$)/)
  if (!sm) return null
  return `${ym.y}-${String(Number(sm[1])).padStart(2, '0')}-${String(Number(sm[2])).padStart(2, '0')}`
}

/** 우측 li.jq_cl_detailViewBtn — E2E rightRows 계약 (모달 HTML 필수) */
export function parseVerygoodCalendarRightRows(
  html: string,
  ym: { y: string; mo: string } | null,
): VerygoodCalendarRightRow[] {
  const rightHtml = extractInner(html, 'dep_right_wrap') ?? html
  const rows: VerygoodCalendarRightRow[] = []
  const liRe = /<li[^>]*class="[^"]*jq_cl_detailViewBtn[^"]*"[^>]*>([\s\S]*?)<\/li>/gi
  let m: RegExpExecArray | null
  while ((m = liRe.exec(rightHtml)) != null) {
    const inner = m[1]!
    const t = stripTags(inner)
    if (t.length < 8 || t.length > 2500) continue
    const price = parsePriceFromLiInner(inner)
    const date = parseDateFromRowText(t, ym)
    if (!date || price <= 0) continue
    const proM = inner.match(/ProCode[=:]([A-Z0-9-]+)/i)
    const carrierM = t.match(VERYGOOD_CARRIER_RE)
    const seatM = t.match(/(\d+)\s*석/)
    let statusRaw: string | null = null
    if (/출발\s*확정|예약\s*가능|대기\s*예약|마감/i.test(t)) {
      statusRaw = t.match(/출발\s*확정|예약\s*가능|대기\s*예약|예약\s*마감|마감/)?.[0] ?? null
    }
    // REGRESSION-FREEZE[departure-onsale-import-filter]: drop 마감 only — keep 대기예약 — manifest
    if (!isDepartureOnSaleForImport(statusRaw)) continue
    rows.push({
      date,
      adultPrice: price,
      proCode: proM?.[1]?.trim() ?? null,
      productName: null,
      carrierText: carrierM?.[1] ?? null,
      statusRaw,
      seatsRaw: seatM ? `${seatM[1]}석` : null,
      rawText: t.slice(0, 400),
    })
  }
  return rows
}

/** ProductCalendarSearch 응답 또는 ui-dialog 모달 HTML 통째 파싱 */
export function parseVerygoodModalDomHtml(html: string): VerygoodModalDomParseResult {
  const warnings: string[] = []
  const ymParsed = parseYearMonthFromHtml(html)
  if (!ymParsed) warnings.push('ym_not_found')
  const leftCells = ymParsed ? parseVerygoodCalendarLeftCells(html, ymParsed) : []
  const rightRows = parseVerygoodCalendarRightRows(html, ymParsed)
  if (leftCells.length === 0) warnings.push('left_cells_empty')
  if (rightRows.length === 0) warnings.push('right_rows_empty')
  return {
    ym: ymParsed ? `${ymParsed.y}-${ymParsed.mo}` : null,
    leftCells,
    rightRows,
    warnings,
  }
}

export function buildVerygoodProductCalendarSearchUrl(args: {
  masterCode: string
  year: number
  month: number
  menuCode?: string
  baseUrl?: string
}): string {
  const base = (args.baseUrl ?? process.env.VERYGOODTOUR_BASE_URL ?? 'https://www.verygoodtour.com').replace(
    /\/$/,
    '',
  )
  const u = new URL(`${base}/Product/ProductCalendarSearch`)
  u.searchParams.set('MasterCode', args.masterCode.trim())
  u.searchParams.set('MenuCode', (args.menuCode ?? '').trim())
  u.searchParams.set('Year', String(args.year))
  u.searchParams.set('Month', String(args.month))
  return u.toString()
}

export function parseVerygoodProCodeMasterCode(proCode: string): string {
  const t = proCode.trim()
  const i = t.indexOf('-')
  return i > 0 ? t.slice(0, i) : t
}

/**
 * ProductCalendarSearch HTML 안 `var $calendarProductListJson = [...]` — 우측 목록을 그리는 출발 행 원본.
 * (우측 li 는 JS 템플릿이라 서버 HTML 에는 실제 행이 없다. 좌측 칸은 날짜별 최저가 근사치라 기간 구분이 없다.)
 * 행마다 ProductCode·TourNight·TourDay·AdultPrice(정확한 공급사 값)·예약 상태가 있다.
 */
export type VerygoodCalendarProductJsonRow = {
  date: string
  returnDate: string | null
  proCode: string | null
  tourNights: number | null
  tourDays: number | null
  travelPeriodText: string | null
  adultPrice: number
  statusRaw: string | null
  productName: string | null
  carrierText: string | null
  minPax: number | null
}

function extractJsonArrayAfter(html: string, marker: string): unknown[] | null {
  const k = html.indexOf(marker)
  if (k < 0) return null
  const st = html.indexOf('[', k)
  if (st < 0) return null
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = st; i < html.length; i += 1) {
    const ch = html[i]!
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') inStr = true
    else if (ch === '[') depth += 1
    else if (ch === ']') {
      depth -= 1
      if (depth === 0) {
        try {
          const v = JSON.parse(html.slice(st, i + 1)) as unknown
          return Array.isArray(v) ? v : null
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function toNumOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v)
  return null
}

function toStrOrNull(v: unknown, max = 200): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

/** `$calendarProductListJson` 파싱. 변수 자체가 없거나 JSON 이 깨지면 null(= 판단 불가, 지금 동작 유지). */
export function parseVerygoodCalendarProductListJson(html: string): VerygoodCalendarProductJsonRow[] | null {
  const arr = extractJsonArrayAfter(html, '$calendarProductListJson')
  if (!arr) return null
  const out: VerygoodCalendarProductJsonRow[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    const o = item as Record<string, unknown>
    const date = toStrOrNull(o.DepartureDateToShortString, 10)
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    const ret = toStrOrNull(o.ArrivalDateToShortString, 10)
    out.push({
      date,
      returnDate: ret && /^\d{4}-\d{2}-\d{2}$/.test(ret) ? ret : null,
      proCode: toStrOrNull(o.ProductCode, 40),
      tourNights: toNumOrNull(o.TourNight),
      tourDays: toNumOrNull(o.TourDay),
      travelPeriodText: toStrOrNull(o.TravelPeriodExt, 40),
      adultPrice: toNumOrNull(o.AdultPrice) ?? 0,
      statusRaw: toStrOrNull(o.BtnReserveAltTag, 40),
      productName: toStrOrNull(o.ProductName, 400),
      carrierText: toStrOrNull(o.TrasnName, 80),
      minPax: toNumOrNull(o.MinCount),
    })
  }
  return out
}

/** 'APP9074-2611027C46' → '7C46' (마스터-YYMMDD 뒤 접미). 형식이 다르면 null. */
export function verygoodProCodeSuffix(proCode: string | null | undefined): string | null {
  const m = String(proCode ?? '').trim().match(/^[A-Z0-9]+-\d{6}([A-Z0-9]+)$/i)
  return m?.[1]?.toUpperCase() ?? null
}

/** 예약 상태가 판매 중인지(마감 제외) — 수집 공통 규칙. */
export function isVerygoodCalendarJsonRowOnSale(row: Pick<VerygoodCalendarProductJsonRow, 'statusRaw'>): boolean {
  return isDepartureOnSaleForImport(row.statusRaw)
}
