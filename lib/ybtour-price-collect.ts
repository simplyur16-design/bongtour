/**
 * ybtour 가격 수집 — papi by-goods 월 API 우선, 0건·구간 밖 시 E2E 폴백.
 *
 * REGRESSION-FREEZE[ybtour-api-departure-collect]: API→E2E 폴백 — manifest
 * REGRESSION-FREEZE[ybtour-by-goods-departure-list]: by-goods 다출발 API — manifest
 * REGRESSION-FREEZE[ybtour-sweep-e2e-recheck]: sweep·7일 재확인 — manifest
 */
import {
  collectYbtourByGoodsApiDepartureInputsForUrl,
} from '@/lib/ybtour-api-departures'
import type { DepartureInput } from '@/lib/upsert-product-departures-ybtour'

export type YbtourPriceCollectSource = 'api' | 'e2e'

export type YbtourPriceCollectResult = {
  inputs: DepartureInput[]
  source: YbtourPriceCollectSource | null
  e2eAttempted: boolean
}

export type YbtourApiOnlyCollectResult = {
  inputs: DepartureInput[]
  evCd: string | null
  apiError: string | null
}

export type YbtourByGoodsApiOnlyCollectResult = {
  inputs: DepartureInput[]
  goodsCd: string | null
  goodsCdFromUrl: string | null
  dspSid: string | null
  seedEvCd: string | null
  monthKeys: string[]
  rawRowCount: number
  evCdPriceEnriched: boolean
  apiError: string | null
}

export type YbtourByGoodsApiOnlyOptions = {
  originCode?: string | null
  enrichEvCdPrice?: boolean
}

/** by-goods 월 API만 — 다출발 (+ 선택 evCd /price). */
export async function collectYbtourByGoodsApiOnlyForDateRange(
  detailUrl: string,
  fromYmd: string,
  toYmd: string,
  options?: YbtourByGoodsApiOnlyOptions,
): Promise<YbtourByGoodsApiOnlyCollectResult> {
  try {
    const hit = await collectYbtourByGoodsApiDepartureInputsForUrl(detailUrl, fromYmd, toYmd, {
      originCode: options?.originCode,
      enrichEvCdPrice: options?.enrichEvCdPrice,
    })
    return { ...hit, apiError: null }
  } catch (err) {
    return {
      inputs: [],
      goodsCd: null,
      goodsCdFromUrl: null,
      dspSid: null,
      seedEvCd: null,
      monthKeys: [],
      rawRowCount: 0,
      evCdPriceEnriched: false,
      apiError: (err instanceof Error ? err.message : String(err)).slice(0, 400),
    }
  }
}

/** API만 — E2E 없음. 커버리지·sweep 사전 검증용 (by-goods 다출발). */
export async function collectYbtourApiOnlyForDateRange(
  detailUrl: string,
  fromYmd: string,
  toYmd: string,
  options?: YbtourByGoodsApiOnlyOptions,
): Promise<YbtourApiOnlyCollectResult> {
  const hit = await collectYbtourByGoodsApiOnlyForDateRange(detailUrl, fromYmd, toYmd, options)
  if (hit.apiError) {
    return { inputs: [], evCd: hit.seedEvCd, apiError: hit.apiError }
  }
  if (!hit.goodsCd) {
    return { inputs: [], evCd: null, apiError: 'no_goods_cd' }
  }
  return { inputs: hit.inputs, evCd: hit.seedEvCd, apiError: null }
}

export async function collectYbtourPriceInputsWithE2eFallback(
  detailUrl: string,
  originCode: string | null,
  fromYmd: string,
  toYmd: string,
): Promise<YbtourPriceCollectResult> {
  try {
    const byGoods = await collectYbtourByGoodsApiDepartureInputsForUrl(detailUrl, fromYmd, toYmd, {
      originCode,
      enrichEvCdPrice: process.env.YBTOUR_SKIP_EVCD_PRICE_ENRICH !== '1',
    })
    if (byGoods.inputs.length > 0) {
      return { inputs: byGoods.inputs, source: 'api', e2eAttempted: false }
    }
  } catch (err) {
    console.warn(
      '[ybtour] by-goods-api-collect-failed',
      err instanceof Error ? err.message : String(err),
    )
  }

  const { collectYbtourE2eDepartureInputsForDateRange } = await import('@/lib/admin-departure-rescrape')
  const e2e = await collectYbtourE2eDepartureInputsForDateRange(detailUrl, originCode, fromYmd, toYmd)
  return {
    inputs: e2e,
    source: e2e.length > 0 ? 'e2e' : null,
    e2eAttempted: true,
  }
}
