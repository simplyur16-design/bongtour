/**
 * verygoodtour HXR — ProductCalendarSearch·모달 DOM 파서 (Playwright 없음).
 *
 * SSOT DOM: `scripts/calendar_e2e_scraper_verygoodtour/calendar_price_scraper.py`
 * VERYGOOD_MODAL_DOM_BUNDLE_JS 동일 계약.
 *
 * REGRESSION-FREEZE[verygoodtour-hxr-calendar-parse]: 모달 dep_left/dep_right 파싱 — manifest
 */
const VERYGOOD_CARRIER_RE =
  /(에미레이트항공|에미레이트|튀르키예항공|터키항공|카타르항공|카타르|에티하드항공|에티하드|영국항공|싱가포르항공|태국항공|베트남항공|티웨이항공|대한항공|아시아나항공|제주항공|진에어|에어부산|에어서울|이스타항공|에어프레미아|플라이강원|루프트한자|에어캐나다|델타항공|유나이티드항공|핀에어|ANA|전일본공수)/

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

/** 좌측 달력 td.jq_cl_day — E2E leftCells 계약 */
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
    const mm = raw.match(/^(\d{1,2})(?:\s+(\d+)\s*만원~?)?$/)
    if (!mm) continue
    const day = Number(mm[1])
    const man = mm[2] ? Number(mm[2]) : 0
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
