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
import {
  departureInputToYmd,
  filterDepartureInputsOnOrAfterCalendarToday,
} from '@/lib/scrape-date-bounds'
import type { DepartureInput } from '@/lib/upsert-product-departures-lottetour'

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

/** 180일 창에 걸치는 달 수(포함, 최대 36). */
export function lottetourMonthCountInclusive(fromYmd: string, toYmd: string): number {
  const lo = fromYmd <= toYmd ? fromYmd : toYmd
  const hi = fromYmd <= toYmd ? toYmd : fromYmd
  let y = Number(lo.slice(0, 4))
  let m = Number(lo.slice(5, 7))
  const ey = Number(hi.slice(0, 4))
  const em = Number(hi.slice(5, 7))
  let count = 0
  for (let guard = 0; guard < 48; guard += 1) {
    count += 1
    if (y === ey && m === em) break
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return Math.max(1, Math.min(36, count))
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
  options: { disableE2EFallback: boolean; logLabel?: string },
): Promise<{ inputs: DepartureInput[]; warnings: string[] }> {
  const monthCount = lottetourMonthCountInclusive(fromYmd, toYmd)
  const { rows, warnings } = await collectLottetourCalendarRange(
    { godId: ctx.godId, menuNos: ctx.menuNos },
    {
      monthCount,
      dateFrom: fromYmd.slice(0, 7),
      disableE2EFallback: options.disableE2EFallback,
      e2eTourCodeHint: ctx.evtCdHint,
      logLabel: options.logLabel,
    },
  )
  const mapped = mapLottetourCalendarToDepartureInputs(rows, productId)
  const todayFiltered = filterDepartureInputsOnOrAfterCalendarToday(mapped)
  const inputs = filterPricedInputsInWindow(todayFiltered, fromYmd, toYmd)
  return { inputs, warnings }
}

/** HXR(evtListAjax TS fetch)만 — E2E·DB upsert 없음. 커버리지·sweep 사전 검증용. */
export async function collectLottetourHxrOnlyForDateRange(
  ctx: LottetourCollectContext,
  productId: string,
  fromYmd: string,
  toYmd: string,
  options?: { logLabel?: string },
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
  options?: { logLabel?: string },
): Promise<LottetourPriceCollectResult> {
  const warnings: string[] = []

  try {
    const hxr = await collectMappedForContext(ctx, productId, fromYmd, toYmd, {
      disableE2EFallback: true,
      logLabel: options?.logLabel,
    })
    warnings.push(...hxr.warnings)
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
