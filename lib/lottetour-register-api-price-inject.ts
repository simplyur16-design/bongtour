/**
 * lottetour 등록 confirm — evtListAjax 다출발 parsed 주입.
 *
 * REGRESSION-FREEZE[lottetour-register-api-price-inject]: injectLottetourApiDeparturePricesIfMissing — manifest
 */
import {
  collectLottetourCalendarRange,
  enrichLottetourEvtListCollectionHintsFromDetailPage,
  mapLottetourCalendarToDepartureInputs,
  parseLottetourEvtListCollectionHints,
} from '@/lib/lottetour-departures'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import { lottetourMonthCountInclusive } from '@/lib/lottetour-price-recheck-meta'
import { fetchLottetourRegisterDetailBundle } from '@/lib/lottetour-register-api-detail'
import type { RegisterParsed } from '@/lib/register-llm-schema-lottetour'
import { registerDepartureInputsToParsedPrices } from '@/lib/register-departure-input-to-parsed-price'

export async function injectLottetourApiDeparturePricesIfMissing(
  parsed: RegisterParsed,
  originUrl?: string | null,
): Promise<RegisterParsed> {
  if ((parsed.prices?.length ?? 0) > 0) return parsed
  const url = (originUrl ?? '').trim()
  if (!url || !/lottetour\.com/i.test(url)) return parsed

  let hints = parseLottetourEvtListCollectionHints({ rawMeta: null, originUrl: url })
  if (!hints.godId || !hints.menuNos) {
    hints = await enrichLottetourEvtListCollectionHintsFromDetailPage(hints, url)
  }
  if (!hints.godId || !hints.menuNos) {
    const bundle = await fetchLottetourRegisterDetailBundle(url)
    const row = bundle?.evtListRow
    if (!row || row.adultPrice <= 0 || !row.departDate) return parsed
    const inputs = mapLottetourCalendarToDepartureInputs([row], 'register-inject')
    const prices = registerDepartureInputsToParsedPrices(inputs)
    if (prices.length === 0) return parsed
    const notes = [...(parsed.registerPreviewPolicyNotes ?? [])]
    const note = `lottetour evtListAjax 출발·기본가 주입(단일): ${row.departDate}`
    if (!notes.includes(note)) notes.push(note)
    return {
      ...parsed,
      productPriceTable: { adultPrice: row.adultPrice, childExtraBedPrice: null, infantPrice: null },
      prices,
      registerPreviewPolicyNotes: notes,
    }
  }

  const bundle = await fetchLottetourRegisterDetailBundle(url)
  const evtPrefix = bundle?.evtCd?.slice(0, 4) ?? ''
  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  // REGRESSION-FREEZE[lottetour-register-facts-calendar-horizon]: inject도 RULE_A monthCount — manifest
  const monthCount = lottetourMonthCountInclusive(fromYmd, toYmd)
  const cal = await collectLottetourCalendarRange(
    { godId: hints.godId, menuNos: hints.menuNos },
    {
      monthCount,
      disableE2EFallback: true,
      e2eTourCodeHint: bundle?.evtCd ?? null,
      logLabel: 'register-api-price-inject',
    },
  )
  let rows = cal.rows.filter((r) => r.adultPrice > 0 && r.departDate)
  if (evtPrefix.length >= 4) {
    const scoped = rows.filter((r) => r.evtCd.startsWith(evtPrefix))
    if (scoped.length > 0) rows = scoped
  }
  if (rows.length === 0) return parsed

  rows = rows.filter((r) => r.departDate >= fromYmd && r.departDate <= toYmd)
  if (rows.length === 0) return parsed

  const inputs = mapLottetourCalendarToDepartureInputs(rows, 'register-inject')
  const first = rows[0]!
  const notes = [...(parsed.registerPreviewPolicyNotes ?? [])]
  const note = `lottetour evtListAjax 출발·가격 주입: ${rows.length}행`
  if (!notes.includes(note)) notes.push(note)

  const prices = registerDepartureInputsToParsedPrices(inputs)
  if (prices.length === 0) return parsed

  return {
    ...parsed,
    productPriceTable: {
      adultPrice: first.adultPrice,
      childExtraBedPrice: null,
      infantPrice: null,
    },
    prices,
    registerPreviewPolicyNotes: notes,
  }
}
