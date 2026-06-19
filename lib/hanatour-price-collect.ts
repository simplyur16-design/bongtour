/**
 * 하나투어 가격 수집 — gw.hanatour.com API 우선, 0건 시 E2E 폴백.
 *
 * REGRESSION-FREEZE[hanatour-api-departure-collect]: API→E2E 폴백 — manifest
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
}

function filterInputsInWindow(inputs: DepartureInput[], fromYmd: string, toYmd: string): DepartureInput[] {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  return inputs.filter((x) => {
    const d = departureInputToYmd(x.departureDate)
    return d != null && d >= lo && d <= hi && (x.adultPrice ?? 0) > 0
  })
}

/**
 * API 우선. 지평 내 성인가 출발 0건이면 기존 Python E2E로 폴백.
 */
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
  }
}
