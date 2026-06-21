/**
 * 3h 달력 배치·관리자 on-demand — 공급사별 API/HXR 우선, 0건 시 E2E 폴백.
 *
 * REGRESSION-FREEZE[calendar-batch-api-first]: batch Node collect SSOT — manifest
 */
import { buildDetailUrl } from '@/lib/admin-departure-rescrape'
import {
  departureInputToCalendarScrapeItem,
  type CalendarScrapeHorizonItem,
} from '@/lib/calendar-scrape-horizon-items'
import {
  buildHanatourKstTargetMonths,
  validateHanatourAdminMonthYm,
} from '@/lib/hanatour-departures'
import { collectHanatourPriceInputsWithE2eFallback } from '@/lib/hanatour-price-collect'
import { collectKyowontourPriceInputsWithE2eFallback } from '@/lib/kyowontour-price-collect'
import {
  collectLottetourPriceInputsWithE2eFallback,
  resolveLottetourCollectContext,
} from '@/lib/lottetour-price-collect'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import { resolveHanatourAdminE2eMonthsForward } from '@/lib/scrape-date-bounds'
import { collectVerygoodtourPriceInputsWithE2eFallback } from '@/lib/verygoodtour-price-collect'
import { collectYbtourPriceInputsWithE2eFallback } from '@/lib/ybtour-price-collect'

export type CalendarHorizonCollectProduct = {
  id: string
  originSource: string | null
  originCode: string | null
  originUrl: string | null
  title?: string | null
  originalTitle?: string | null
  rawMeta?: string | null
}

export type CalendarHorizonCollectResult = {
  items: CalendarScrapeHorizonItem[]
  source: string | null
  e2eAttempted: boolean
  horizonSoldOut: boolean
  warnings: string[]
}

function monthYmsForHorizon(fromYmd: string, toYmd: string): string[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const horizon = resolveHanatourAdminE2eMonthsForward()
  const allowedYm = new Set(buildHanatourKstTargetMonths(horizon))
  const ymSet = new Set<string>()
  let cur = lo
  for (let guard = 0; guard < 400 && cur <= hi; guard += 1) {
    const ym = cur.slice(0, 7)
    const validated = validateHanatourAdminMonthYm(ym)
    if (validated && allowedYm.has(validated)) ymSet.add(validated)
    const [y, m, d] = cur.split('-').map(Number)
    const dt = new Date(Date.UTC(y, m - 1, d))
    dt.setUTCDate(dt.getUTCDate() + 1)
    cur = dt.toISOString().slice(0, 10)
  }
  return [...ymSet].sort()
}

function resolveDetailUrl(product: CalendarHorizonCollectProduct): string | null {
  const stored = (product.originUrl ?? '').trim()
  if (stored.startsWith('http')) return stored
  const supplier = normalizeSupplierOrigin(product.originSource)
  if (!supplier) return null
  const built = buildDetailUrl(supplier, product.originCode ?? '')
  return built.startsWith('http') ? built : null
}

function inputsToItems(inputs: Parameters<typeof departureInputToCalendarScrapeItem>[0][]): CalendarScrapeHorizonItem[] {
  return inputs
    .map(departureInputToCalendarScrapeItem)
    .filter((x): x is CalendarScrapeHorizonItem => x != null)
}

export async function collectCalendarHorizonPriceInputs(
  product: CalendarHorizonCollectProduct,
  fromYmd: string,
  toYmd: string,
): Promise<CalendarHorizonCollectResult> {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const supplier = normalizeSupplierOrigin(product.originSource)
  const detailUrl = resolveDetailUrl(product)

  if (!supplier || !detailUrl) {
    return {
      items: [],
      source: null,
      e2eAttempted: false,
      horizonSoldOut: false,
      warnings: ['detail_url_or_supplier_missing'],
    }
  }

  if (supplier === 'hanatour') {
    const monthYms = monthYmsForHorizon(lo, hi)
    const collected = await collectHanatourPriceInputsWithE2eFallback(detailUrl, lo, hi, {
      monthYms,
      registeredRawTitle: product.originalTitle ?? product.title ?? null,
    })
    return {
      items: inputsToItems(collected.inputs),
      source: collected.source,
      e2eAttempted: collected.e2eAttempted,
      horizonSoldOut: collected.horizonSoldOut,
      warnings: [],
    }
  }

  if (supplier === 'ybtour') {
    const collected = await collectYbtourPriceInputsWithE2eFallback(
      detailUrl,
      product.originCode,
      lo,
      hi,
    )
    return {
      items: inputsToItems(collected.inputs),
      source: collected.source,
      e2eAttempted: collected.e2eAttempted,
      horizonSoldOut: collected.horizonSoldOut,
      warnings: [],
    }
  }

  if (supplier === 'verygoodtour') {
    const collected = await collectVerygoodtourPriceInputsWithE2eFallback(detailUrl, lo, hi)
    return {
      items: inputsToItems(collected.inputs),
      source: collected.source,
      e2eAttempted: collected.e2eAttempted,
      horizonSoldOut: collected.horizonSoldOut,
      warnings: collected.warnings,
    }
  }

  if (supplier === 'lottetour') {
    const resolved = await resolveLottetourCollectContext({
      originUrl: product.originUrl,
      originCode: product.originCode,
      rawMeta: product.rawMeta ?? null,
    })
    if (!resolved.ctx) {
      return {
        items: [],
        source: null,
        e2eAttempted: false,
        horizonSoldOut: false,
        warnings: resolved.warnings,
      }
    }
    const collected = await collectLottetourPriceInputsWithE2eFallback(
      resolved.ctx,
      product.id,
      lo,
      hi,
      { logLabel: `batch:${product.id}` },
    )
    return {
      items: inputsToItems(collected.inputs),
      source: collected.source,
      e2eAttempted: collected.e2eAttempted,
      horizonSoldOut: collected.horizonSoldOut,
      warnings: collected.warnings,
    }
  }

  if (supplier === 'kyowontour') {
    const collected = await collectKyowontourPriceInputsWithE2eFallback(
      {
        id: product.id,
        originCode: product.originCode,
        originUrl: product.originUrl,
      },
      lo,
      hi,
    )
    return {
      items: inputsToItems(collected.inputs),
      source: collected.source,
      e2eAttempted: collected.e2eAttempted,
      horizonSoldOut: collected.horizonSoldOut,
      warnings: collected.warnings,
    }
  }

  return {
    items: [],
    source: null,
    e2eAttempted: false,
    horizonSoldOut: false,
    warnings: [`unsupported_supplier:${supplier}`],
  }
}
