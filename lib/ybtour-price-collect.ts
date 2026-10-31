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
import type { SupplierTripDuration, SupplierTripDurationFilterStats } from '@/lib/supplier-trip-duration'

/** 상품 기간(박·일) — 있으면 다른 기간 출발 제외, 없으면 지금 동작 + 섞임 경고 */
export type YbtourCollectDurationOptions = { expectedTripDuration?: SupplierTripDuration | null }

export type YbtourPriceCollectSource = 'api' | 'e2e'

export type YbtourPriceCollectResult = {
  inputs: DepartureInput[]
  source: YbtourPriceCollectSource | null
  e2eAttempted: boolean
  /** API·E2E 모두 180일 창 priced 0건 — 판매종료 후보 */
  horizonSoldOut: boolean
  /** 기간 섞임 거르기 등 경고 */
  warnings?: string[]
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
  durationWarnings: string[]
  durationStats: SupplierTripDurationFilterStats | null
  durationAllMismatch: boolean
}

export type YbtourByGoodsApiOnlyOptions = {
  originCode?: string | null
  enrichEvCdPrice?: boolean
} & YbtourCollectDurationOptions

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
      expectedTripDuration: options?.expectedTripDuration ?? null,
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
      durationWarnings: [],
      durationStats: null,
      durationAllMismatch: false,
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
  options?: YbtourCollectDurationOptions,
): Promise<YbtourPriceCollectResult> {
  try {
    const byGoods = await collectYbtourByGoodsApiDepartureInputsForUrl(detailUrl, fromYmd, toYmd, {
      originCode,
      enrichEvCdPrice: process.env.YBTOUR_SKIP_EVCD_PRICE_ENRICH !== '1',
      expectedTripDuration: options?.expectedTripDuration ?? null,
    })
    if (byGoods.inputs.length > 0) {
      return {
        inputs: byGoods.inputs,
        source: 'api',
        e2eAttempted: false,
        horizonSoldOut: false,
        warnings: byGoods.durationWarnings,
      }
    }
    if (byGoods.durationAllMismatch) {
      // E2E 달력은 기간을 못 읽어 다른 기간 출발을 다시 넣음 — 판매종료(horizonSoldOut)로 지우지 않고 건너뜀
      return {
        inputs: [],
        source: null,
        e2eAttempted: false,
        horizonSoldOut: false,
        warnings: byGoods.durationWarnings,
      }
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
    horizonSoldOut: e2e.length === 0,
  }
}
