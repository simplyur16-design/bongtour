import { revalidatePath } from 'next/cache'
import type { PrismaClient } from '@prisma/client'
import {
  collectDepartureInputsForAdminRescrape,
  type DepartureRescrapeResult,
} from '@/lib/admin-departure-rescrape'
import {
  buildHanatourMonthSummaryLines,
  buildHanatourPartialSuccessHeadline,
  type HanatourPythonDiagnostics,
  type HanatourPythonMonthRun,
} from '@/lib/hanatour-departures'
import {
  brandKeyResolvesToYbtour,
  normalizeBrandKeyToCanonicalSupplierKey,
} from '@/lib/overseas-supplier-canonical-keys'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { syncYbtourProductPricesFromDepartureInputsDetailed } from '@/lib/ybtour-sync-product-prices-from-departure-inputs'
import * as updDeparturesHanatour from '@/lib/upsert-product-departures-hanatour'
import * as updDeparturesModetour from '@/lib/upsert-product-departures-modetour'
import * as updDeparturesVerygoodtour from '@/lib/upsert-product-departures-verygoodtour'
import * as updDeparturesYbtour from '@/lib/upsert-product-departures-ybtour'
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
  if (norm === 'modetour') return updDeparturesModetour
  if (norm === 'verygoodtour') return updDeparturesVerygoodtour
  if (norm === 'ybtour') return updDeparturesYbtour
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
