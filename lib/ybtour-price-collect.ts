/**
 * ybtour 가격 수집 — papi evCd API 우선, 0건·구간 밖 시 E2E 폴백.
 *
 * REGRESSION-FREEZE[ybtour-api-departure-collect]: API→E2E 폴백 — manifest
 */
import {
  collectYbtourApiDepartureInputsForUrl,
  filterYbtourInputsInYmdWindow,
} from '@/lib/ybtour-api-departures'
import type { DepartureInput } from '@/lib/upsert-product-departures-ybtour'

export type YbtourPriceCollectSource = 'api' | 'e2e'

export type YbtourPriceCollectResult = {
  inputs: DepartureInput[]
  source: YbtourPriceCollectSource | null
  e2eAttempted: boolean
}

export async function collectYbtourPriceInputsWithE2eFallback(
  detailUrl: string,
  originCode: string | null,
  fromYmd: string,
  toYmd: string,
): Promise<YbtourPriceCollectResult> {
  try {
    const api = await collectYbtourApiDepartureInputsForUrl(detailUrl)
    const priced = filterYbtourInputsInYmdWindow(api.inputs, fromYmd, toYmd)
    if (priced.length > 0) {
      return { inputs: priced, source: 'api', e2eAttempted: false }
    }
  } catch (err) {
    console.warn('[ybtour] api-collect-failed', err instanceof Error ? err.message : String(err))
  }

  const { collectYbtourE2eDepartureInputsForDateRange } = await import('@/lib/admin-departure-rescrape')
  const e2e = await collectYbtourE2eDepartureInputsForDateRange(detailUrl, originCode, fromYmd, toYmd)
  return {
    inputs: e2e,
    source: e2e.length > 0 ? 'e2e' : null,
    e2eAttempted: true,
  }
}
