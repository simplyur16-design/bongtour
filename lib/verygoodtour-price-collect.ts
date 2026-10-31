/**
 * verygoodtour 가격 수집 — ProductCalendarSearch HXR(우측 0건) → Python E2E 폴백.
 *
 * REGRESSION-FREEZE[verygoodtour-hxr-departure-collect]: HXR→E2E·horizonSoldOut·URL 정규화 — manifest
 * REGRESSION-FREEZE[verygoodtour-sweep-e2e-recheck]: sweep collectVerygoodtourPriceInputsWithE2eFallback — manifest
 */
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import {
  isVerygoodtourDetailUrlExpired,
  normalizeVerygoodtourDetailUrlForCollect,
} from '@/lib/verygoodtour-detail-url-health'
import {
  buildVerygoodProductCalendarSearchUrl,
  isVerygoodCalendarJsonRowOnSale,
  parseVerygoodCalendarProductListJson,
  parseVerygoodCalendarRightRows,
  parseVerygoodModalDomHtml,
  parseVerygoodProCodeMasterCode,
  verygoodProCodeSuffix,
  type VerygoodCalendarProductJsonRow,
} from '@/lib/verygoodtour-calendar-hxr'
import {
  formatSupplierTripDuration,
  parseSupplierTripDurationLabel,
  supplierTripDurationEquals,
  supplierTripDurationFromNumbers,
  type SupplierTripDuration,
} from '@/lib/supplier-trip-duration'
import { enrichVerygoodDepartureInputsWithProCodeDetail } from '@/lib/verygoodtour-procode-detail-meta'
import { parseVerygoodProCodeFromUrl } from '@/lib/register-facts/verygoodtour'
import type { DepartureInput } from '@/lib/upsert-product-departures-verygoodtour'

export type VerygoodPriceCollectSource = 'hxr' | 'e2e'

export type VerygoodPriceCollectResult = {
  inputs: DepartureInput[]
  source: VerygoodPriceCollectSource | null
  e2eAttempted: boolean
  /** HXR·E2E 모두 180일 창 priced 0건 — 판매종료 후보 */
  horizonSoldOut: boolean
  detailUrl: string
  warnings: string[]
}

export type VerygoodHxrOnlyCollectResult = {
  inputs: DepartureInput[]
  masterCode: string | null
  menuCode: string | null
  rightRowCount: number
  leftWithPriceCount: number
  hxrError: string | null
  warnings: string[]
  /** 상품 기간으로 `$calendarProductListJson` 행을 거른 달이 하나라도 있으면 true */
  durationFilterApplied?: boolean
}

/** 상품 기간(박·일) — 있으면 다른 기간 출발 제외, 없으면 지금 동작 + 섞임 경고 */
export type VerygoodCollectDurationOptions = { expectedTripDuration?: SupplierTripDuration | null }

/** 참좋은 달력 JSON 행 기간 — TourNight·TourDay 우선, 없으면 TravelPeriodExt('4박 6일'). */
export function verygoodCalendarJsonRowTripDuration(
  row: Pick<VerygoodCalendarProductJsonRow, 'tourNights' | 'tourDays' | 'travelPeriodText'>,
): SupplierTripDuration | null {
  return supplierTripDurationFromNumbers(row.tourNights, row.tourDays) ?? parseSupplierTripDurationLabel(row.travelPeriodText)
}

/**
 * 같은 MasterCode 달력 JSON 행 → 상품 기간이 같은 판매중 출발만, 날짜당 1행.
 * 같은 날짜 여러 행: 시드 ProCode 와 접미(항공·박일 코드)가 같은 행 → 없으면 최저 성인가 → ProductCode 사전순.
 * 기간을 못 읽는 행은 남기고 개수만 센다. 가격은 응답 AdultPrice 그대로(추정 없음).
 */
export function pickVerygoodCalendarJsonRowsForTripDuration(
  rows: readonly VerygoodCalendarProductJsonRow[],
  expected: SupplierTripDuration,
  seedProCode: string | null | undefined,
): { inputs: DepartureInput[]; droppedMismatch: number; droppedClosed: number; keptUnknown: number } {
  const seedSuffix = verygoodProCodeSuffix(seedProCode)
  let droppedMismatch = 0
  let droppedClosed = 0
  let keptUnknown = 0
  const byDate = new Map<string, VerygoodCalendarProductJsonRow[]>()
  for (const r of rows) {
    if (!(r.adultPrice > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) continue
    const got = verygoodCalendarJsonRowTripDuration(r)
    if (got && !supplierTripDurationEquals(got, expected)) {
      droppedMismatch += 1
      continue
    }
    if (!got) keptUnknown += 1
    if (!isVerygoodCalendarJsonRowOnSale(r)) {
      droppedClosed += 1
      continue
    }
    const list = byDate.get(r.date) ?? []
    list.push(r)
    byDate.set(r.date, list)
  }
  const inputs: DepartureInput[] = []
  for (const [date, group] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const sameSuffix = seedSuffix ? group.filter((r) => verygoodProCodeSuffix(r.proCode) === seedSuffix) : []
    const pool = sameSuffix.length > 0 ? sameSuffix : group
    const pick = [...pool].sort((a, b) => {
      if (a.adultPrice !== b.adultPrice) return a.adultPrice - b.adultPrice
      return String(a.proCode ?? '').localeCompare(String(b.proCode ?? ''))
    })[0]!
    inputs.push({
      departureDate: date,
      adultPrice: pick.adultPrice,
      statusRaw: pick.statusRaw,
      seatsStatusRaw: null,
      minPax: pick.minPax,
      carrierName: pick.carrierText,
    })
  }
  return { inputs, droppedMismatch, droppedClosed, keptUnknown }
}

const VERYGOOD_FETCH_HEADERS = {
  accept: 'text/html,*/*',
  'accept-language': 'ko-KR,ko;q=0.9',
  referer: 'https://www.verygoodtour.com/',
  'user-agent': 'Mozilla/5.0 (compatible; BongTour/1.0)',
} as const

function filterPricedInputsInWindow(
  inputs: DepartureInput[],
  fromYmd: string,
  toYmd: string,
): DepartureInput[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  return inputs.filter((x) => {
    const d = departureInputToYmd(x.departureDate)
    return d != null && d >= lo && d <= hi && (x.adultPrice ?? 0) > 0
  })
}

function monthKeysInclusive(fromYmd: string, toYmd: string): Array<{ year: number; month: number }> {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  let y = Number(lo.slice(0, 4))
  let m = Number(lo.slice(5, 7))
  const ey = Number(hi.slice(0, 4))
  const em = Number(hi.slice(5, 7))
  const out: Array<{ year: number; month: number }> = []
  for (let guard = 0; guard < 48; guard += 1) {
    out.push({ year: y, month: m })
    if (y === ey && m === em) break
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

function extractMenuCodeFromDetailHtml(html: string): string | null {
  const m = html.match(/MenuCode['"]?\s*[:=]\s*['"]?(\d+)/i)
  return m?.[1]?.trim() ?? null
}

function mapVerygoodLeftCellsToInputs(
  cells: Array<{ date: string; approxPrice: number }>,
): DepartureInput[] {
  return cells
    .filter((c) => c.approxPrice > 0 && /^\d{4}-\d{2}-\d{2}$/.test(c.date))
    .map((c) => ({
      departureDate: c.date,
      adultPrice: c.approxPrice,
      statusRaw: '예약가능',
      seatsStatusRaw: null,
      carrierName: null,
    }))
}

function mapVerygoodRightRowsToInputs(rows: ReturnType<typeof parseVerygoodCalendarRightRows>): DepartureInput[] {
  return rows
    .filter((r) => r.adultPrice > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    .map((r) => {
      const seatM = r.seatsRaw?.match(/(\d+)/)
      const minM = r.rawText.match(/최소\s*출발\s*인원\s*[:：]?\s*(\d+)\s*명/)
      return {
        departureDate: r.date,
        adultPrice: r.adultPrice,
        statusRaw: r.statusRaw,
        seatsStatusRaw: r.seatsRaw,
        seatCount: seatM ? Number(seatM[1]) : null,
        minPax: minM?.[1] ? Number(minM[1]) : null,
        carrierName: r.carrierText,
      }
    })
}

async function fetchDetailHtml(detailUrl: string): Promise<{ html: string; error: string | null }> {
  try {
    const res = await fetch(detailUrl, {
      method: 'GET',
      headers: VERYGOOD_FETCH_HEADERS,
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return { html: '', error: `detail_http_${res.status}` }
    return { html: await res.text(), error: null }
  } catch (err) {
    return { html: '', error: (err instanceof Error ? err.message : String(err)).slice(0, 200) }
  }
}

/** HXR only — plain ProductCalendarSearch (우측 행은 대부분 0, 커버리지용). */
export async function collectVerygoodHxrOnlyForDateRange(
  detailUrl: string,
  fromYmd: string,
  toYmd: string,
  options?: VerygoodCollectDurationOptions,
): Promise<VerygoodHxrOnlyCollectResult> {
  const expected = options?.expectedTripDuration ?? null
  const normalized = normalizeVerygoodtourDetailUrlForCollect(detailUrl)
  const proCode = parseVerygoodProCodeFromUrl(normalized)
  const masterCode = proCode ? parseVerygoodProCodeMasterCode(proCode) : null
  if (!masterCode) {
    return {
      inputs: [],
      masterCode: null,
      menuCode: null,
      rightRowCount: 0,
      leftWithPriceCount: 0,
      hxrError: 'no_pro_code',
      warnings: [],
    }
  }

  const detail = await fetchDetailHtml(normalized)
  if (detail.error) {
    return {
      inputs: [],
      masterCode,
      menuCode: null,
      rightRowCount: 0,
      leftWithPriceCount: 0,
      hxrError: detail.error,
      warnings: [],
    }
  }

  const menuCode = extractMenuCodeFromDetailHtml(detail.html) ?? ''
  const warnings: string[] = []
  let rightRowCount = 0
  let leftWithPriceCount = 0
  const merged = new Map<string, DepartureInput>()
  let durationFilterApplied = false
  let durationDropped = 0
  let durationUnknownKept = 0
  const durationSeen = new Map<string, number>()

  for (const ym of monthKeysInclusive(fromYmd, toYmd)) {
    const calUrl = buildVerygoodProductCalendarSearchUrl({
      masterCode,
      menuCode,
      year: ym.year,
      month: ym.month,
    })
    try {
      const res = await fetch(calUrl, {
        headers: { ...VERYGOOD_FETCH_HEADERS, referer: normalized },
        signal: AbortSignal.timeout(25_000),
      })
      if (!res.ok) {
        warnings.push(`calendar_http_${ym.year}-${ym.month}:${res.status}`)
        continue
      }
      const html = await res.text()
      const parsed = parseVerygoodModalDomHtml(html)
      rightRowCount += parsed.rightRows.length
      leftWithPriceCount += parsed.leftCells.filter((c) => c.approxPrice > 0).length
      if (parsed.warnings.length > 0) warnings.push(...parsed.warnings.map((w) => `${ym.year}-${ym.month}:${w}`))
      const jsonRows = parseVerygoodCalendarProductListJson(html)
      for (const r of jsonRows ?? []) {
        const k = formatSupplierTripDuration(verygoodCalendarJsonRowTripDuration(r))
        durationSeen.set(k, (durationSeen.get(k) ?? 0) + 1)
      }
      if (expected && jsonRows && jsonRows.length > 0) {
        // 같은 MasterCode 에 다른 기간(박·일) 출발이 섞임 — 상품 기간이 같은 JSON 행만, 날짜당 1행
        const picked = pickVerygoodCalendarJsonRowsForTripDuration(jsonRows, expected, proCode)
        durationFilterApplied = true
        durationDropped += picked.droppedMismatch
        durationUnknownKept += picked.keptUnknown
        for (const row of picked.inputs) {
          const dk = departureInputToYmd(row.departureDate)
          if (dk) merged.set(dk, row)
        }
        continue
      }
      const rightInputs = mapVerygoodRightRowsToInputs(parsed.rightRows)
      const rowInputs =
        rightInputs.length > 0 ? rightInputs : mapVerygoodLeftCellsToInputs(parsed.leftCells)
      for (const row of rowInputs) {
        const dk = departureInputToYmd(row.departureDate)
        if (dk) merged.set(dk, row)
      }
    } catch (err) {
      warnings.push((err instanceof Error ? err.message : String(err)).slice(0, 120))
    }
  }

  const seenLabel = [...durationSeen.entries()].map(([k, v]) => `${k} ${v}건`).join(', ')
  const knownDurations = [...durationSeen.keys()].filter((k) => k !== '?')
  if (!expected && knownDurations.length > 1) {
    warnings.push(`[verygoodtour] ${masterCode}: 기간 섞임 경고 — 상품 기간을 몰라 거르지 않음 (달력 기간 ${seenLabel})`)
  }
  if (expected && durationDropped > 0) {
    warnings.push(
      `[verygoodtour] ${masterCode}: 상품 기간 ${formatSupplierTripDuration(expected)}과 다른 출발 ${durationDropped}건 제외 (달력 기간 ${seenLabel})`,
    )
  }
  if (expected && durationUnknownKept > 0) {
    warnings.push(`[verygoodtour] ${masterCode}: 기간을 읽지 못한 출발 ${durationUnknownKept}건은 남김`)
  }
  if (expected && !durationFilterApplied && merged.size > 0) {
    warnings.push(`[verygoodtour] ${masterCode}: 달력 출발 JSON 없음 — 기간 거르기 못 함(지금 동작)`)
  }

  const inputs = filterPricedInputsInWindow([...merged.values()], fromYmd, toYmd)
  return {
    inputs,
    masterCode,
    menuCode: menuCode || null,
    rightRowCount,
    leftWithPriceCount,
    hxrError: null,
    warnings,
    durationFilterApplied,
  }
}

/** HXR + 출발일별 ProCode PackageDetail 메타 — E2E 없음(register·inject·facts용). */
export async function collectVerygoodtourPriceInputsWithProCodeDetail(
  detailUrl: string,
  fromYmd: string,
  toYmd: string,
  options?: VerygoodCollectDurationOptions,
): Promise<VerygoodHxrOnlyCollectResult & { seedProCode: string | null }> {
  const normalized = normalizeVerygoodtourDetailUrlForCollect(detailUrl)
  const seedProCode = parseVerygoodProCodeFromUrl(normalized)
  const hxr = await collectVerygoodHxrOnlyForDateRange(normalized, fromYmd, toYmd, options)
  if (!seedProCode || hxr.inputs.length === 0) {
    return { ...hxr, seedProCode }
  }
  const enriched = await enrichVerygoodDepartureInputsWithProCodeDetail(hxr.inputs, seedProCode, normalized)
  return {
    ...hxr,
    inputs: filterPricedInputsInWindow(enriched, fromYmd, toYmd),
    seedProCode,
  }
}

export async function collectVerygoodtourPriceInputsWithE2eFallback(
  detailUrl: string,
  fromYmd: string,
  toYmd: string,
  options?: { skipExpiredCheck?: boolean } & VerygoodCollectDurationOptions,
): Promise<VerygoodPriceCollectResult> {
  const normalized = normalizeVerygoodtourDetailUrlForCollect(detailUrl)
  const warnings: string[] = []

  if (!options?.skipExpiredCheck && (await isVerygoodtourDetailUrlExpired(normalized))) {
    return {
      inputs: [],
      source: null,
      e2eAttempted: false,
      horizonSoldOut: true,
      detailUrl: normalized,
      warnings: ['detail_url_expired'],
    }
  }

  try {
    const hxr = await collectVerygoodHxrOnlyForDateRange(normalized, fromYmd, toYmd, {
      expectedTripDuration: options?.expectedTripDuration ?? null,
    })
    warnings.push(...hxr.warnings)
    if (hxr.inputs.length === 0 && hxr.durationFilterApplied) {
      // 기간이 같은 출발이 창 안에 0건 — E2E(좌측 칸)는 기간을 구분하지 못해 다른 기간 값을 다시 가져온다.
      warnings.push('[verygoodtour] 상품 기간과 같은 출발 0건 — E2E 폴백 생략(E2E 는 기간 구분 불가)')
      return {
        inputs: [],
        source: null,
        e2eAttempted: false,
        horizonSoldOut: false,
        detailUrl: normalized,
        warnings,
      }
    }
    if (hxr.inputs.length > 0) {
      return {
        inputs: hxr.inputs,
        source: 'hxr',
        e2eAttempted: false,
        horizonSoldOut: false,
        detailUrl: normalized,
        warnings,
      }
    }
  } catch (err) {
    console.warn('[verygoodtour] hxr-collect-failed', err instanceof Error ? err.message : String(err))
  }

  const { collectVerygoodE2eDepartureInputsForDateRange } = await import('@/lib/admin-departure-rescrape')
  const e2e = await collectVerygoodE2eDepartureInputsForDateRange(normalized, fromYmd, toYmd)
  return {
    inputs: e2e,
    source: e2e.length > 0 ? 'e2e' : null,
    e2eAttempted: true,
    horizonSoldOut: e2e.length === 0,
    detailUrl: normalized,
    warnings,
  }
}
