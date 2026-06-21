/**
 * 교원이지 가격 수집 — differentDepartDate AJAX → Python E2E 폴백.
 *
 * REGRESSION-FREEZE[kyowontour-sweep-e2e-recheck]: collectKyowontourPriceInputsWithE2eFallback — manifest
 */
import {
  collectKyowontourCalendarRange,
  mapKyowontourCalendarToDepartureInputs,
} from '@/lib/kyowontour-departures'
import { enrichKyowontourCalendarRowsWithTourCodeDetail } from '@/lib/kyowontour-tourcode-detail-meta'
import { departureInputToYmd, filterDepartureInputsOnOrAfterCalendarToday } from '@/lib/scrape-date-bounds'
import type { DepartureInput } from '@/lib/upsert-product-departures-kyowontour'
import type { KyowontourPriceCollectSource } from '@/lib/kyowontour-price-recheck-meta'

export type KyowontourPriceCollectResult = {
  inputs: DepartureInput[]
  source: KyowontourPriceCollectSource | null
  e2eAttempted: boolean
  horizonSoldOut: boolean
  masterCode: string
  tourCodeHint: string
  warnings: string[]
}

const MASTER_CODE_RE = /^[A-Z]{3}\d{3}$/

export function resolveKyowontourSweepCollectKeys(product: {
  originCode: string | null
  originUrl: string | null
}): { masterCode: string; tourCodeHint: string; menuCode: string; detailUrl: string | null } | null {
  const url = (product.originUrl ?? '').trim()
  let tourCode = ''
  let menuCode = ''
  if (url.startsWith('http')) {
    try {
      const u = new URL(url)
      tourCode = (u.searchParams.get('tourCode') ?? u.searchParams.get('tourCd') ?? '').trim()
      menuCode = (u.searchParams.get('menuCode') ?? '').trim()
    } catch {
      /* ignore */
    }
  }
  const oc = (product.originCode ?? '').trim()
  if (!tourCode && oc.length >= 10) tourCode = oc
  const masterCode = MASTER_CODE_RE.test(oc) ? oc : tourCode.slice(0, 6) || oc.slice(0, 6)
  if (!masterCode || masterCode.length < 6) return null
  const tourCodeHint = tourCode || oc || masterCode
  const base = (process.env.KYOWONTOUR_API_BASE_URL ?? 'https://www.kyowontour.com').replace(/\/$/, '')
  const detailUrl =
    url.startsWith('http') && /goodsEventDetail/i.test(url)
      ? url
      : tourCode
        ? `${base}/goods/goodsEventDetail?tourCode=${encodeURIComponent(tourCode)}&menuCode=${encodeURIComponent(menuCode || 'M5204')}&brandId=3`
        : null
  return { masterCode, tourCodeHint, menuCode: menuCode || 'M5204', detailUrl }
}

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

function horizonMonthCount(fromYmd: string, toYmd: string): number {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  const startY = Number(lo.slice(0, 4))
  const startM = Number(lo.slice(5, 7))
  const endY = Number(hi.slice(0, 4))
  const endM = Number(hi.slice(5, 7))
  const months = (endY - startY) * 12 + (endM - startM) + 1
  return Math.max(6, Math.min(36, months + 1))
}

async function mapKyowontourCollectedRows(
  product: { id: string; originCode: string | null; originUrl: string | null },
  keys: NonNullable<ReturnType<typeof resolveKyowontourSweepCollectKeys>>,
  fromYmd: string,
  toYmd: string,
  rows: Awaited<ReturnType<typeof collectKyowontourCalendarRange>>['rows'],
  meta: Awaited<ReturnType<typeof collectKyowontourCalendarRange>>['meta'],
  warnings: string[],
): Promise<Pick<KyowontourPriceCollectResult, 'inputs' | 'source' | 'warnings'>> {
  const enrichedRows =
    keys.detailUrl != null
      ? await enrichKyowontourCalendarRowsWithTourCodeDetail(rows, {
          menuCode: keys.menuCode,
          refererUrl: keys.detailUrl,
        })
      : rows

  const mapped = filterDepartureInputsOnOrAfterCalendarToday(
    mapKyowontourCalendarToDepartureInputs(enrichedRows, product.id),
  )
  const inWindow = filterPricedInputsInWindow(mapped, fromYmd, toYmd)
  const source: KyowontourPriceCollectSource | null =
    meta.collectSource === 'e2e' ? 'e2e' : meta.collectSource === 'ajax' ? 'ajax' : null

  return { inputs: inWindow, source, warnings }
}

/** AJAX only — E2E 없음. 3h 배치·커버리지용. */
export async function collectKyowontourApiOnlyForDateRange(
  product: { id: string; originCode: string | null; originUrl: string | null },
  fromYmd: string,
  toYmd: string,
): Promise<
  Pick<KyowontourPriceCollectResult, 'inputs' | 'source' | 'warnings' | 'masterCode' | 'tourCodeHint'> & {
    e2eAttempted: false
  }
> {
  const keys = resolveKyowontourSweepCollectKeys(product)
  if (!keys) {
    return {
      inputs: [],
      source: null,
      e2eAttempted: false,
      masterCode: '',
      tourCodeHint: '',
      warnings: ['masterCode/tourCode 식별 실패'],
    }
  }

  const { rows, warnings, meta } = await collectKyowontourCalendarRange(keys.masterCode, {
    tourCodeForE2EFallback: keys.tourCodeHint,
    e2eMasterCodeHint: keys.masterCode,
    monthCount: horizonMonthCount(fromYmd, toYmd),
    logLabel: `kyowontour-api-only:${product.id}`,
    refererUrl: keys.detailUrl,
    disableE2EFallback: true,
  })

  const mapped = await mapKyowontourCollectedRows(product, keys, fromYmd, toYmd, rows, meta, warnings)

  return {
    ...mapped,
    e2eAttempted: false,
    masterCode: keys.masterCode,
    tourCodeHint: keys.tourCodeHint,
  }
}

export async function collectKyowontourPriceInputsWithE2eFallback(
  product: { id: string; originCode: string | null; originUrl: string | null },
  fromYmd: string,
  toYmd: string,
): Promise<KyowontourPriceCollectResult> {
  const keys = resolveKyowontourSweepCollectKeys(product)
  if (!keys) {
    return {
      inputs: [],
      source: null,
      e2eAttempted: false,
      horizonSoldOut: false,
      masterCode: '',
      tourCodeHint: '',
      warnings: ['masterCode/tourCode 식별 실패'],
    }
  }

  const { rows, warnings, meta } = await collectKyowontourCalendarRange(keys.masterCode, {
    tourCodeForE2EFallback: keys.tourCodeHint,
    e2eMasterCodeHint: keys.masterCode,
    monthCount: horizonMonthCount(fromYmd, toYmd),
    logLabel: `kyowontour-price-collect:${product.id}`,
    refererUrl: keys.detailUrl,
  })

  const mappedResult = await mapKyowontourCollectedRows(
    product,
    keys,
    fromYmd,
    toYmd,
    rows,
    meta,
    warnings,
  )
  const horizonSoldOut = mappedResult.inputs.length === 0 && meta.e2eAttempted

  return {
    ...mappedResult,
    e2eAttempted: meta.e2eAttempted,
    horizonSoldOut,
    masterCode: keys.masterCode,
    tourCodeHint: keys.tourCodeHint,
  }
}
