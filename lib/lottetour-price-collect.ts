/**
 * lottetour 가격 수집 — evtListAjax HXR 우선, 0건 시 Python E2E 폴백.
 *
 * REGRESSION-FREEZE[lottetour-hxr-departure-collect]: HXR→E2E 폴백 — manifest
 * REGRESSION-FREEZE[lottetour-sweep-e2e-recheck]: sweep·7일 재확인 — manifest
 */
import {
  buildLottetourEvtDetailUrl,
  collectLottetourCalendarRange,
  enrichLottetourEvtListCollectionHintsFromDetailPage,
  mapLottetourCalendarToDepartureInputs,
  parseLottetourEvtListCollectionHints,
} from '@/lib/lottetour-departures'
import { lottetourMonthCountInclusive } from '@/lib/lottetour-price-recheck-meta'
import {
  departureInputToYmd,
  filterDepartureInputsOnOrAfterCalendarToday,
} from '@/lib/scrape-date-bounds'
import type { DepartureInput } from '@/lib/upsert-product-departures-lottetour'
import type { SupplierTripDuration } from '@/lib/supplier-trip-duration'

/** 상품 기간(박·일) — 있으면 다른 기간 출발 제외, 없으면 지금 동작 + 섞임 경고 */
export type LottetourCollectDurationOptions = { expectedTripDuration?: SupplierTripDuration | null }

export type LottetourPriceCollectSource = 'hxr' | 'e2e'

export type LottetourCollectContext = {
  godId: string
  menuNos: [string, string, string, string]
  detailEvtCd: string | null
  detailUrl: string | null
  evtCdHint: string | null
}

export type LottetourPriceCollectResult = {
  inputs: DepartureInput[]
  source: LottetourPriceCollectSource | null
  e2eAttempted: boolean
  /** HXR·E2E 모두 180일 창 priced 0건 — 판매종료 후보 */
  horizonSoldOut: boolean
  warnings: string[]
}

export type LottetourHxrOnlyCollectResult = {
  inputs: DepartureInput[]
  godId: string | null
  menuNos: [string, string, string, string] | null
  hxrError: string | null
  warnings: string[]
}

export { lottetourMonthCountInclusive } from '@/lib/lottetour-price-recheck-meta'

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

export async function resolveLottetourCollectContext(p: {
  originUrl: string | null
  originCode: string | null
  rawMeta: string | null
}): Promise<{ ctx: LottetourCollectContext | null; warnings: string[] }> {
  const originUrl = (p.originUrl ?? '').trim() || null
  let hints = parseLottetourEvtListCollectionHints({
    rawMeta: p.rawMeta,
    originUrl,
  })
  const detailUrlResolved =
    originUrl ??
    (hints.menuNos && hints.detailEvtCd
      ? buildLottetourEvtDetailUrl(hints.menuNos, hints.detailEvtCd)
      : null)

  if (!hints.godId && hints.menuNos) {
    hints = await enrichLottetourEvtListCollectionHintsFromDetailPage(hints, detailUrlResolved)
  }

  const evtCdHint =
    (hints.detailEvtCd ?? '').trim() ||
    (p.originCode ?? '').trim() ||
    null

  if (!hints.godId || !hints.menuNos) {
    return { ctx: null, warnings: hints.warnings }
  }

  return {
    ctx: {
      godId: hints.godId,
      menuNos: hints.menuNos,
      detailEvtCd: hints.detailEvtCd,
      detailUrl: detailUrlResolved,
      evtCdHint,
    },
    warnings: hints.warnings,
  }
}

async function collectMappedForContext(
  ctx: LottetourCollectContext,
  productId: string,
  fromYmd: string,
  toYmd: string,
  options: { disableE2EFallback: boolean; logLabel?: string } & LottetourCollectDurationOptions,
): Promise<{ inputs: DepartureInput[]; warnings: string[]; durationAllMismatch: boolean }> {
  const monthCount = lottetourMonthCountInclusive(fromYmd, toYmd)
  const { rows, warnings, durationStats } = await collectLottetourCalendarRange(
    { godId: ctx.godId, menuNos: ctx.menuNos },
    {
      monthCount,
      dateFrom: fromYmd.slice(0, 7),
      disableE2EFallback: options.disableE2EFallback,
      e2eTourCodeHint: ctx.evtCdHint,
      logLabel: options.logLabel,
      expectedTripDuration: options.expectedTripDuration ?? null,
    },
  )
  const mapped = mapLottetourCalendarToDepartureInputs(rows, productId)
  const todayFiltered = filterDepartureInputsOnOrAfterCalendarToday(mapped)
  const inputs = filterPricedInputsInWindow(todayFiltered, fromYmd, toYmd)
  // 응답 출발이 전부 상품 기간과 다름 — 상품 기간값이 낡았을 수 있음(판매종료로 보지 않음)
  const durationAllMismatch =
    !!options.expectedTripDuration && !!durationStats && durationStats.droppedMismatch > 0 && durationStats.kept === 0
  return { inputs, warnings, durationAllMismatch }
}

/** HXR(evtListAjax TS fetch)만 — E2E·DB upsert 없음. 커버리지·sweep 사전 검증용. */
export async function collectLottetourHxrOnlyForDateRange(
  ctx: LottetourCollectContext,
  productId: string,
  fromYmd: string,
  toYmd: string,
  options?: { logLabel?: string } & LottetourCollectDurationOptions,
): Promise<LottetourHxrOnlyCollectResult> {
  if (!ctx.godId || !ctx.menuNos) {
    return {
      inputs: [],
      godId: ctx.godId ?? null,
      menuNos: ctx.menuNos ?? null,
      hxrError: 'missing_godId_or_menuNos',
      warnings: [],
    }
  }
  try {
    const hit = await collectMappedForContext(ctx, productId, fromYmd, toYmd, {
      disableE2EFallback: true,
      logLabel: options?.logLabel,
      expectedTripDuration: options?.expectedTripDuration ?? null,
    })
    return {
      inputs: hit.inputs,
      godId: ctx.godId,
      menuNos: ctx.menuNos,
      hxrError: null,
      warnings: hit.warnings,
    }
  } catch (err) {
    return {
      inputs: [],
      godId: ctx.godId,
      menuNos: ctx.menuNos,
      hxrError: (err instanceof Error ? err.message : String(err)).slice(0, 400),
      warnings: [],
    }
  }
}

export async function collectLottetourPriceInputsWithE2eFallback(
  ctx: LottetourCollectContext,
  productId: string,
  fromYmd: string,
  toYmd: string,
  options?: { logLabel?: string } & LottetourCollectDurationOptions,
): Promise<LottetourPriceCollectResult> {
  const warnings: string[] = []

  try {
    const hxr = await collectMappedForContext(ctx, productId, fromYmd, toYmd, {
      disableE2EFallback: true,
      logLabel: options?.logLabel,
      expectedTripDuration: options?.expectedTripDuration ?? null,
    })
    warnings.push(...hxr.warnings)
    if (hxr.inputs.length === 0 && hxr.durationAllMismatch) {
      // E2E 도 같은 godId 행이라 결과가 같음 — 판매종료(horizonSoldOut)로 지우지 않고 건너뜀
      warnings.push('[lottetour] 응답 출발이 전부 상품 기간과 다름 — 상품 기간값 의심, E2E 폴백·판매종료 처리 생략')
      return {
        inputs: [],
        source: null,
        e2eAttempted: false,
        horizonSoldOut: false,
        warnings,
      }
    }
    if (hxr.inputs.length > 0) {
      return {
        inputs: hxr.inputs,
        source: 'hxr',
        e2eAttempted: false,
        horizonSoldOut: false,
        warnings,
      }
    }
  } catch (err) {
    console.warn(
      '[lottetour] hxr-collect-failed',
      err instanceof Error ? err.message : String(err),
    )
  }

  try {
    const e2e = await collectMappedForContext(ctx, productId, fromYmd, toYmd, {
      disableE2EFallback: false,
      logLabel: options?.logLabel ? `${options.logLabel}:e2e` : 'e2e',
      expectedTripDuration: options?.expectedTripDuration ?? null,
    })
    warnings.push(...e2e.warnings)
    return {
      inputs: e2e.inputs,
      source: e2e.inputs.length > 0 ? 'e2e' : null,
      e2eAttempted: true,
      horizonSoldOut: e2e.inputs.length === 0,
      warnings,
    }
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).slice(0, 400)
    warnings.push(msg)
    return {
      inputs: [],
      source: null,
      e2eAttempted: true,
      horizonSoldOut: true,
      warnings,
    }
  }
}
