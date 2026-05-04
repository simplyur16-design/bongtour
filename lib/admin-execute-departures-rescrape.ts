import { revalidatePath } from 'next/cache'
import type { PrismaClient } from '@prisma/client'
import {
  buildDetailUrl,
  collectDepartureInputsForAdminRescrape,
  collectYbtourDepartureInputsForDateRange,
  mapScrapedRowsToInputs,
  scrapeLiveCalendar,
  type DepartureRescrapeResult,
} from '@/lib/admin-departure-rescrape'
import {
  buildHanatourMonthSummaryLines,
  buildHanatourPartialSuccessHeadline,
  collectHanatourDepartureInputsForDateRange,
  type HanatourPythonDiagnostics,
  type HanatourPythonMonthRun,
} from '@/lib/hanatour-departures'
import { collectModetourDepartureInputsForDateRange } from '@/lib/modetour-departures'
import {
  brandKeyResolvesToYbtour,
  normalizeBrandKeyToCanonicalSupplierKey,
} from '@/lib/overseas-supplier-canonical-keys'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { syncYbtourProductPricesFromDepartureInputsDetailed } from '@/lib/ybtour-sync-product-prices-from-departure-inputs'
import type { DepartureInput } from '@/lib/upsert-product-departures-hanatour'
import type { DepartureInput as LottetourDepartureInput } from '@/lib/upsert-product-departures-lottetour'
import { departureInputToYmd, filterDepartureInputsOnOrAfterCalendarToday } from '@/lib/scrape-date-bounds'
import * as updDeparturesHanatour from '@/lib/upsert-product-departures-hanatour'
import * as updDeparturesModetour from '@/lib/upsert-product-departures-modetour'
import * as updDeparturesVerygoodtour from '@/lib/upsert-product-departures-verygoodtour'
import * as updDeparturesYbtour from '@/lib/upsert-product-departures-ybtour'
import { upsertKyowontourDepartures } from '@/lib/kyowontour-departures'
import {
  collectLottetourCalendarRange,
  mapLottetourCalendarToDepartureInputs,
  parseLottetourEvtListCollectionHints,
  upsertLottetourDepartures,
} from '@/lib/lottetour-departures'
import type {
  AdminDeparturesRescrapeResponseBody,
  AdminDeparturesRescrapeStage,
} from '@/lib/admin-departures-rescrape-types'

function upsertDeparturesModuleForProduct(p: {
  originSource: string | null
  brand: { brandKey: string } | null
}) {
  const fromBrand = normalizeBrandKeyToCanonicalSupplierKey(p.brand?.brandKey ?? null)
  const norm = normalizeSupplierOrigin(p.originSource)
  if (fromBrand === 'modetour') return updDeparturesModetour
  if (fromBrand === 'verygoodtour') return updDeparturesVerygoodtour
  if (fromBrand === 'ybtour') return updDeparturesYbtour
  if (fromBrand === 'hanatour') return updDeparturesHanatour
  if (fromBrand === 'kyowontour') {
    return {
      upsertProductDepartures: async (prisma: PrismaClient, productId: string, departures: DepartureInput[]) => {
        const r = await upsertKyowontourDepartures(prisma, productId, departures)
        return r.created + r.updated
      },
    }
  }
  if (fromBrand === 'lottetour') {
    return {
      upsertProductDepartures: async (prisma: PrismaClient, productId: string, departures: DepartureInput[]) => {
        const r = await upsertLottetourDepartures(prisma, productId, departures as unknown as LottetourDepartureInput[])
        return r.created + r.updated
      },
    }
  }
  if (norm === 'modetour') return updDeparturesModetour
  if (norm === 'verygoodtour') return updDeparturesVerygoodtour
  if (norm === 'ybtour') return updDeparturesYbtour
  if (norm === 'kyowontour') {
    return {
      upsertProductDepartures: async (prisma: PrismaClient, productId: string, departures: DepartureInput[]) => {
        const r = await upsertKyowontourDepartures(prisma, productId, departures)
        return r.created + r.updated
      },
    }
  }
  if (norm === 'lottetour') {
    return {
      upsertProductDepartures: async (prisma: PrismaClient, productId: string, departures: DepartureInput[]) => {
        const r = await upsertLottetourDepartures(prisma, productId, departures as unknown as LottetourDepartureInput[])
        return r.created + r.updated
      },
    }
  }
  return updDeparturesHanatour
}

function isYbtourProduct(p: { originSource: string | null; brand: { brandKey: string } | null }): boolean {
  const norm = normalizeSupplierOrigin(p.originSource ?? '')
  return norm === 'ybtour' || brandKeyResolvesToYbtour(p.brand?.brandKey ?? null)
}

function inferEmptyStage(r: DepartureRescrapeResult): AdminDeparturesRescrapeStage {
  if (r.site !== 'hanatour' || !r.hanatourPythonDiagnostics) return 'collect'
  const d = r.hanatourPythonDiagnostics
  const cs = r.collectorStatus
  if (d.pythonTimedOut) return 'python'
  if (d.exitCode !== null && d.exitCode !== 0) return 'python'
  if (cs === 'cli_error') return 'python'
  if (cs === 'parse_error') return 'parse'
  return 'collect'
}

function emptyFailureMessage(r: DepartureRescrapeResult): string {
  if (r.site === 'hanatour' && r.hanatourPythonDiagnostics?.pythonTimedOut) {
    const ms = r.hanatourPythonDiagnostics.timeoutMs
    const sec = typeof ms === 'number' && ms > 0 ? Math.round(ms / 1000) : null
    return sec != null
      ? `Python 실행 시간 초과(${sec}초 한도) 또는 프로세스 종료`
      : 'Python 실행 시간 초과 또는 프로세스 종료'
  }
  if (r.collectorStatus === 'parse_error') return 'stdout JSON 파싱 실패'
  if (r.collectorStatus === 'cli_error') return 'Python CLI 실행 실패(비정상 종료)'
  if (r.liveError) return r.liveError
  return '재수집할 출발일 데이터가 없습니다.'
}

function hanatourMonthExtras(r: DepartureRescrapeResult): {
  pythonMonthDiagnostics: HanatourPythonMonthRun[] | null
  hanatourMonthSummaryLines: string[]
} {
  if (r.site !== 'hanatour') {
    return { pythonMonthDiagnostics: null, hanatourMonthSummaryLines: [] }
  }
  const md = r.hanatourPythonMonthDiagnostics ?? null
  const lines = md?.length ? buildHanatourMonthSummaryLines(md) : []
  return { pythonMonthDiagnostics: md, hanatourMonthSummaryLines: lines }
}

function enrichEmptyMessageForHanatour(r: DepartureRescrapeResult, base: string): string {
  if (r.site !== 'hanatour') return base
  const { hanatourMonthSummaryLines } = hanatourMonthExtras(r)
  if (hanatourMonthSummaryLines.length) {
    return `${base} · 월별: ${hanatourMonthSummaryLines.join(' · ')}`
  }
  return base
}

function buildHanatourSuccessMessage(
  r: DepartureRescrapeResult,
  inputsLen: number,
  upserted: number
): string {
  const tail = `수집 ${inputsLen}건 → DB 반영 ${upserted}건. 클라이언트에서 상세·미리보기 재조회 예정.`
  if (r.site !== 'hanatour') return tail
  if (r.collectorStatus === 'success_partial') {
    const hl = buildHanatourPartialSuccessHeadline(r.hanatourPythonMonthDiagnostics)
    return hl ? `${hl}. ${tail}` : tail
  }
  return tail
}

function buildDiagnosticsPayload(r: DepartureRescrapeResult): HanatourPythonDiagnostics | null {
  return r.hanatourPythonDiagnostics ?? null
}

function summarizeFromResult(r: DepartureRescrapeResult): {
  stderrSummary: string
  stdoutSummary: string
  pythonTimedOut: boolean
} {
  const d = r.hanatourPythonDiagnostics
  return {
    stderrSummary: d?.stderrSummary ?? '',
    stdoutSummary: d?.stdoutSummary ?? '',
    pythonTimedOut: d?.pythonTimedOut ?? false,
  }
}

export type AdminDeparturesProductRow = {
  id: string
  originSource: string | null
  originCode: string | null
  originUrl: string | null
  brand: { brandKey: string } | null
}

/**
 * POST /api/admin/products/[id]/departures 와 동일한 재수집 코어(스케줄러 배치 등에서 재사용).
 */
export async function executeAdminDeparturesRescrapeCore(
  prisma: PrismaClient,
  product: AdminDeparturesProductRow,
  hanatourMonthParam: string | null
): Promise<{ status: number; body: AdminDeparturesRescrapeResponseBody }> {
  const bk = String(product.brand?.brandKey ?? '').trim()
  const norm = normalizeSupplierOrigin(product.originSource ?? '')
  const isHanatourProduct = bk === 'hanatour' || norm === 'hanatour'
  const hanatourMonthYm = isHanatourProduct ? hanatourMonthParam : null

  const result = await collectDepartureInputsForAdminRescrape(
    prisma,
    {
      id: product.id,
      originSource: product.originSource ?? '',
      originCode: product.originCode ?? '',
      originUrl: product.originUrl ?? null,
    },
    { hanatourMonthYm }
  )

  const inputs = result.inputs
  const io = summarizeFromResult(result)
  const diag = buildDiagnosticsPayload(result)
  const hx = hanatourMonthExtras(result)

  if (!inputs || inputs.length === 0) {
    const stage = inferEmptyStage(result)
    const message = enrichEmptyMessageForHanatour(result, emptyFailureMessage(result))
    const body: AdminDeparturesRescrapeResponseBody = {
      ok: false,
      stage,
      message,
      site: result.site,
      detailUrl: result.detailUrl,
      collectorStatus: result.collectorStatus ?? null,
      collectedCount: 0,
      upsertAttemptedCount: 0,
      upsertedCount: 0,
      emptyResult: true,
      pythonTimedOut: io.pythonTimedOut,
      stderrSummary: io.stderrSummary,
      stdoutSummary: io.stdoutSummary,
      diagnostics: diag,
      error: message,
      mode: result.mode,
      source: result.source,
      liveError: result.liveError ?? null,
      mappingStatus: result.mappingStatus,
      notes: result.notes ?? [],
      productId: product.id,
      rescrapeOutcome: 'empty',
      pythonMonthDiagnostics: hx.pythonMonthDiagnostics,
      hanatourMonthSummaryLines: hx.hanatourMonthSummaryLines,
    }
    return { status: 422, body }
  }

  const upsertAttemptedCount = inputs.length
  let upsertedCount = 0
  try {
    upsertedCount = await upsertDeparturesModuleForProduct({
      originSource: product.originSource,
      brand: product.brand,
    }).upsertProductDepartures(prisma, product.id, inputs)
  } catch (upErr) {
    const msg = upErr instanceof Error ? upErr.message : String(upErr)
    const body: AdminDeparturesRescrapeResponseBody = {
      ok: false,
      stage: 'upsert',
      message: `DB upsert 실패: ${msg.slice(0, 400)}`,
      site: result.site,
      detailUrl: result.detailUrl,
      collectorStatus: result.collectorStatus ?? null,
      collectedCount: inputs.length,
      upsertAttemptedCount,
      upsertedCount: 0,
      emptyResult: false,
      pythonTimedOut: io.pythonTimedOut,
      stderrSummary: io.stderrSummary,
      stdoutSummary: io.stdoutSummary,
      diagnostics: diag,
      error: msg.slice(0, 400),
      mode: result.mode,
      source: result.source,
      liveError: result.liveError ?? null,
      mappingStatus: result.mappingStatus,
      notes: result.notes ?? [],
      productId: product.id,
      rescrapeOutcome: 'failed',
      pythonMonthDiagnostics: hx.pythonMonthDiagnostics,
      hanatourMonthSummaryLines: hx.hanatourMonthSummaryLines,
    }
    return { status: 500, body }
  }

  let productPriceSyncedCount = 0
  let productPriceSyncError: string | null = null
  if (isYbtourProduct(product)) {
    const ppSync = await syncYbtourProductPricesFromDepartureInputsDetailed(prisma, product.id, inputs)
    productPriceSyncedCount = ppSync.syncedCount
    productPriceSyncError = ppSync.error
    if (ppSync.error) {
      console.error('[executeAdminDeparturesRescrapeCore] ybtour ProductPrice sync', {
        productId: product.id,
        error: ppSync.error,
      })
    }
  }

  if (isHanatourProduct && upsertedCount > 0) {
    revalidatePath(`/products/${product.id}`)
  }

  const rescrapeOutcome: AdminDeparturesRescrapeResponseBody['rescrapeOutcome'] =
    result.collectorStatus === 'success_partial' ? 'success_partial' : 'success'
  const body: AdminDeparturesRescrapeResponseBody = {
    ok: true,
    stage: 'done',
    message: buildHanatourSuccessMessage(result, inputs.length, upsertedCount),
    site: result.site,
    detailUrl: result.detailUrl,
    collectorStatus: result.collectorStatus ?? null,
    collectedCount: inputs.length,
    upsertAttemptedCount,
    upsertedCount,
    emptyResult: false,
    pythonTimedOut: io.pythonTimedOut,
    stderrSummary: io.stderrSummary,
    stdoutSummary: io.stdoutSummary,
    diagnostics: diag,
    mode: result.mode,
    source: result.source,
    liveError: result.liveError ?? null,
    mappingStatus: result.mappingStatus,
    notes: result.notes ?? [],
    productId: product.id,
    clientRefreshExpected: true,
    rescrapeOutcome,
    pythonMonthDiagnostics: hx.pythonMonthDiagnostics,
    hanatourMonthSummaryLines: hx.hanatourMonthSummaryLines,
    ...(isYbtourProduct(product) ? { productPriceSyncedCount, productPriceSyncError } : {}),
  }
  return { status: 200, body }
}

function utcMidnight(ymd: string): Date {
  return new Date(ymd + 'T00:00:00.000Z')
}

function blobFromDepartureRow(row: { statusRaw: string | null; seatsStatusRaw: string | null }): string {
  return `${row.statusRaw ?? ''} ${row.seatsStatusRaw ?? ''}`.toLowerCase()
}

function blobFromInput(inp: DepartureInput): string {
  return `${inp.statusRaw ?? ''} ${inp.seatsStatusRaw ?? ''}`.toLowerCase()
}

function inferUiFromDepartureDb(row: {
  adultPrice: number | null
  statusRaw: string | null
  seatsStatusRaw: string | null
}): 'open' | 'sold_out' | 'closed' | 'price_unavailable' {
  const b = blobFromDepartureRow(row)
  if (/마감|만석|매진|예약\s*불가|판매\s*종료/i.test(b)) return 'sold_out'
  if (/출발\s*대기\s*마감|접수\s*마감|모객\s*종료|행사\s*종료/i.test(b)) return 'closed'
  const ap = row.adultPrice
  if (ap != null && ap > 0) return 'open'
  return 'price_unavailable'
}

function inferUiFromInput(inp: DepartureInput): 'open' | 'sold_out' | 'closed' | 'price_unavailable' {
  const b = blobFromInput(inp)
  if (/마감|만석|매진|예약\s*불가|판매\s*종료/i.test(b)) return 'sold_out'
  if (/출발\s*대기\s*마감|접수\s*마감|모객\s*종료|행사\s*종료/i.test(b)) return 'closed'
  const ap = inp.adultPrice ?? null
  if (ap != null && ap > 0) return 'open'
  return 'price_unavailable'
}

function addDaysUtcYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + deltaDays)
  return dt.toISOString().slice(0, 10)
}

/** `fromYmd`~`toYmd` 구간이 덮는 달 목록 `YYYY-MM`(UTC 날짜 문자열 기준) */
function eachYmBetweenInclusive(fromYmd: string, toYmd: string): string[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const sm = lo.slice(0, 7)
  const em = hi.slice(0, 7)
  let y = parseInt(sm.slice(0, 4), 10)
  let m = parseInt(sm.slice(5, 7), 10)
  const ey = parseInt(em.slice(0, 4), 10)
  const emo = parseInt(em.slice(5, 7), 10)
  const out: string[] = []
  for (;;) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    if (y === ey && m === emo) break
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

/**
 * 기준일 ±windowDays 범위 on-demand(전체 재수집·큐 미사용). `windowDays === 0`이면 당일만.
 */
export async function executeRangeOnDemandDepartures(
  prisma: PrismaClient,
  product: AdminDeparturesProductRow,
  departureDateYmd: string,
  windowDays: number
): Promise<{ status: number; body: Record<string, unknown> }> {
  const ymd = departureDateYmd.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return { status: 400, body: { ok: false, error: 'invalid_departure_date', departureDate: ymd } }
  }
  const wdRaw = Number(windowDays)
  const wd = Number.isFinite(wdRaw) && wdRaw >= 0 ? Math.min(31, Math.floor(wdRaw)) : 14
  const fromYmd = addDaysUtcYmd(ymd, -wd)
  const toYmd = addDaysUtcYmd(ymd, wd)
  const fetchedRange = { from: fromYmd, to: toYmd }

  const existing = await prisma.productDeparture.findFirst({
    where: { productId: product.id, departureDate: utcMidnight(ymd) },
  })

  if (existing) {
    const ui = inferUiFromDepartureDb(existing)
    if (ui === 'price_unavailable') {
      return {
        status: 200,
        body: { ok: false, reason: 'departure_exists_price_unavailable', departureDate: ymd },
      }
    }
    if (ui === 'sold_out' || ui === 'closed') {
      return {
        status: 200,
        body: { ok: true, cached: true, departureDate: ymd, status: ui, price: null },
      }
    }
    return {
      status: 200,
      body: {
        ok: true,
        cached: true,
        departureDate: ymd,
        status: 'open',
        price: existing.adultPrice ?? null,
      },
    }
  }

  const detailUrl =
    (product.originUrl ?? '').trim() || buildDetailUrl(product.originSource ?? '', product.originCode ?? '')
  const bk = normalizeBrandKeyToCanonicalSupplierKey(product.brand?.brandKey ?? null)
  const norm = normalizeSupplierOrigin(product.originSource ?? '')

  let livesRange: DepartureInput[] = []
  if (bk === 'lottetour' || norm === 'lottetour') {
    const metaRow = await prisma.product.findUnique({
      where: { id: product.id },
      select: { rawMeta: true, originUrl: true },
    })
    const hints = parseLottetourEvtListCollectionHints({
      rawMeta: metaRow?.rawMeta ?? null,
      originUrl: (product.originUrl ?? '').trim() || metaRow?.originUrl || null,
    })
    if (!hints.godId || !hints.menuNos) {
      return {
        status: 422,
        body: {
          ok: false,
          reason: 'lottetour_missing_god_or_menu',
          departureDate: ymd,
          fetchedRange,
          warnings: hints.warnings,
        },
      }
    }
    const months = eachYmBetweenInclusive(fromYmd, toYmd)
    const allRows = []
    for (const ym of months) {
      const { rows } = await collectLottetourCalendarRange(
        { godId: hints.godId, menuNos: hints.menuNos },
        { monthCount: 1, dateFrom: ym, logLabel: `execute-range-on-demand:${product.id}` }
      )
      allRows.push(...rows)
    }
    const mapped = mapLottetourCalendarToDepartureInputs(allRows, product.id)
    const lo = fromYmd <= toYmd ? fromYmd : toYmd
    const hi = fromYmd <= toYmd ? toYmd : fromYmd
    const filtered = mapped.filter((x) => {
      const dk = departureInputToYmd(x.departureDate as unknown as string)
      return dk != null && dk >= lo && dk <= hi
    })
    filtered.sort((a, b) => {
      const da = departureInputToYmd(a.departureDate as unknown as string) ?? ''
      const db = departureInputToYmd(b.departureDate as unknown as string) ?? ''
      if (da !== db) return da.localeCompare(db)
      return (a.supplierPriceKey ?? '').localeCompare(b.supplierPriceKey ?? '')
    })
    livesRange = filterDepartureInputsOnOrAfterCalendarToday(filtered as unknown as DepartureInput[])
  } else if (bk === 'hanatour' || norm === 'hanatour') {
    livesRange = await collectHanatourDepartureInputsForDateRange(detailUrl, fromYmd, toYmd)
  } else if (bk === 'modetour' || norm === 'modetour') {
    livesRange = await collectModetourDepartureInputsForDateRange(product.originUrl, fromYmd, toYmd)
  } else if (bk === 'verygoodtour' || norm === 'verygoodtour') {
    const lo = fromYmd <= toYmd ? fromYmd : toYmd
    const hi = fromYmd <= toYmd ? toYmd : fromYmd
    const statusByDate = new Map<string, { statusRaw: string | null; seatsStatusRaw: string | null }>()
    try {
      const cal = await scrapeLiveCalendar(detailUrl, 'verygoodtour', {
        VERYGOOD_DATE_FROM: lo,
        VERYGOOD_DATE_TO: hi,
      })
      livesRange = filterDepartureInputsOnOrAfterCalendarToday(
        mapScrapedRowsToInputs(cal.rows, statusByDate)
      ).filter((x) => {
        const dk = departureInputToYmd(x.departureDate)
        return dk != null && dk >= lo && dk <= hi
      })
    } catch {
      livesRange = []
    }
  } else if (norm === 'ybtour' || bk === 'ybtour' || brandKeyResolvesToYbtour(product.brand?.brandKey ?? null)) {
    livesRange = await collectYbtourDepartureInputsForDateRange(detailUrl, product.originCode, fromYmd, toYmd)
  }

  const scrapeByYmd = new Map<string, DepartureInput>()
  for (const x of livesRange) {
    const d = departureInputToYmd(x.departureDate)
    if (!d || d < fromYmd || d > toYmd) continue
    scrapeByYmd.set(d, x)
  }

  let ppUnpriced = false
  if (!scrapeByYmd.has(ymd)) {
    const pp = await prisma.productPrice.findFirst({
      where: { productId: product.id, date: utcMidnight(ymd) },
    })
    if (pp && pp.adult > 0) {
      scrapeByYmd.set(ymd, {
        departureDate: utcMidnight(ymd),
        adultPrice: pp.adult,
        childBedPrice: pp.childBed,
        childNoBedPrice: pp.childNoBed,
        infantPrice: pp.infant,
        localPriceText: pp.localPrice,
      })
    } else if (pp) {
      ppUnpriced = true
    }
  }

  const toUpsert: DepartureInput[] = []
  for (const [d, inp] of scrapeByYmd) {
    if (d === ymd && inferUiFromInput(inp) === 'price_unavailable') continue
    toUpsert.push(inp)
  }
  toUpsert.sort((a, b) => {
    const da = departureInputToYmd(a.departureDate) ?? ''
    const db = departureInputToYmd(b.departureDate) ?? ''
    return da.localeCompare(db)
  })

  const updatedDates = [
    ...new Set(
      toUpsert
        .map((x) => departureInputToYmd(x.departureDate))
        .filter((x): x is string => Boolean(x))
    ),
  ].sort()

  const upsertMod = upsertDeparturesModuleForProduct(product)
  if (toUpsert.length > 0) {
    await upsertMod.upsertProductDepartures(prisma, product.id, toUpsert)
    if (isYbtourProduct(product)) {
      await syncYbtourProductPricesFromDepartureInputsDetailed(prisma, product.id, toUpsert)
    }
    if ((bk === 'hanatour' || norm === 'hanatour') && toUpsert.some((x) => (x.adultPrice ?? 0) > 0)) {
      revalidatePath(`/products/${product.id}`)
    }
  }

  if (ppUnpriced) {
    return {
      status: 200,
      body: { ok: false, reason: 'departure_exists_price_unavailable', departureDate: ymd },
    }
  }

  const clickedFinal = scrapeByYmd.get(ymd) ?? null
  if (!clickedFinal || departureInputToYmd(clickedFinal.departureDate) !== ymd) {
    return {
      status: 200,
      body: {
        ok: false,
        reason: 'departure_not_found',
        departureDate: ymd,
        fetchedRange,
        ...(updatedDates.length > 0 ? { updatedDates } : {}),
      },
    }
  }

  const clickedUi = inferUiFromInput(clickedFinal)
  if (clickedUi === 'price_unavailable') {
    return {
      status: 200,
      body: { ok: false, reason: 'departure_exists_price_unavailable', departureDate: ymd },
    }
  }

  if (clickedUi === 'sold_out' || clickedUi === 'closed') {
    return {
      status: 200,
      body: {
        ok: true,
        cached: false,
        departureDate: ymd,
        status: clickedUi,
        price: null,
        source: 'live',
        fetchedRange,
        updatedDates,
      },
    }
  }
  return {
    status: 200,
    body: {
      ok: true,
      cached: false,
      departureDate: ymd,
      status: 'open',
      price: clickedFinal.adultPrice ?? null,
      source: 'live',
      fetchedRange,
      updatedDates,
    },
  }
}

/** 호환: `windowDays === 0` 범위 수집과 동일. */
export async function executeSingleDateOnDemandDepartures(
  prisma: PrismaClient,
  product: AdminDeparturesProductRow,
  departureDateYmd: string
): Promise<{ status: number; body: Record<string, unknown> }> {
  return executeRangeOnDemandDepartures(prisma, product, departureDateYmd, 0)
}
