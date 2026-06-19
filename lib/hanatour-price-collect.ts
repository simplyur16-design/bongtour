/**
 * 하나투어 가격 수집 — gw.hanatour.com API 우선, 0건 시 E2E 폴백.
 *
 * REGRESSION-FREEZE[hanatour-api-departure-collect]: API→E2E 폴백 — manifest
 * REGRESSION-FREEZE[hanatour-sweep-e2e-recheck]: sweep·7일 재확인 — manifest
 */
import {
  collectHanatourApiDepartureInputsForMonths,
  parseHanatourPkgCdFromUrl,
} from '@/lib/hanatour-api-departures'
import {
  collectHanatourDepartureInputs,
  type HanatourDepartureCollectResult,
} from '@/lib/hanatour-departures'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import type { DepartureInput } from '@/lib/upsert-product-departures-hanatour'

export type HanatourPriceCollectSource = 'api' | 'e2e'

export type HanatourPriceCollectResult = {
  inputs: DepartureInput[]
  source: HanatourPriceCollectSource | null
  e2eAttempted: boolean
  e2eMeta: HanatourDepartureCollectResult['meta'] | null
  /** API+E2E 모두 180일 창 priced 0건 — 판매종료·stale DB 후보 */
  horizonSoldOut: boolean
}

function filterInputsInWindow(inputs: DepartureInput[], fromYmd: string, toYmd: string): DepartureInput[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  return inputs.filter((x) => {
    const d = departureInputToYmd(x.departureDate)
    return d != null && d >= lo && d <= hi && (x.adultPrice ?? 0) > 0
  })
}

export type HanatourApiOnlyCollectResult = {
  inputs: DepartureInput[]
  pkgCd: string | null
  apiError: string | null
}

/** API만 — E2E 없음. 커버리지·sweep 사전 검증용. */
export async function collectHanatourApiOnlyForDateRange(
  detailUrl: string,
  fromYmd: string,
  toYmd: string,
  monthYms: string[],
): Promise<HanatourApiOnlyCollectResult> {
  const pkgCd = parseHanatourPkgCdFromUrl(detailUrl)
  if (!pkgCd || monthYms.length === 0) {
    return { inputs: [], pkgCd, apiError: pkgCd ? null : 'no_pkg_cd' }
  }
  try {
    const api = await collectHanatourApiDepartureInputsForMonths(pkgCd, monthYms)
    const priced = filterInputsInWindow(api.inputs, fromYmd, toYmd)
    return { inputs: priced, pkgCd, apiError: null }
  } catch (err) {
    return {
      inputs: [],
      pkgCd,
      apiError: (err instanceof Error ? err.message : String(err)).slice(0, 400),
    }
  }
}

export async function collectHanatourPriceInputsWithE2eFallback(
  detailUrl: string,
  fromYmd: string,
  toYmd: string,
  options?: {
    monthYms?: string[]
    registeredRawTitle?: string | null
  },
): Promise<HanatourPriceCollectResult> {
  const pkgCd = parseHanatourPkgCdFromUrl(detailUrl)
  const monthYms = options?.monthYms ?? []

  if (pkgCd && monthYms.length > 0) {
    try {
      const api = await collectHanatourApiDepartureInputsForMonths(pkgCd, monthYms)
      const priced = filterInputsInWindow(api.inputs, fromYmd, toYmd)
      if (priced.length > 0) {
        return {
          inputs: priced,
          source: 'api',
          e2eAttempted: false,
          e2eMeta: null,
          horizonSoldOut: false,
        }
      }
    } catch (err) {
      console.warn('[hanatour] api-collect-failed', err instanceof Error ? err.message : String(err))
    }
  }

  const e2e = await collectHanatourDepartureInputs(detailUrl, {
    monthYmsOverride: monthYms.length > 0 ? monthYms : undefined,
    registeredRawTitle: options?.registeredRawTitle,
  })
  const pricedE2e = filterInputsInWindow(e2e.inputs, fromYmd, toYmd)
  return {
    inputs: pricedE2e,
    source: pricedE2e.length > 0 ? 'e2e' : null,
    e2eAttempted: true,
    e2eMeta: e2e.meta,
    horizonSoldOut: pricedE2e.length === 0,
  }
}
