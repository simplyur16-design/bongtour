/**
 * kyowontour 등록 confirm — differentDepartDate AJAX 출발가 parsed 주입(E2E 없음).
 *
 * REGRESSION-FREEZE[kyowontour-register-api-price-inject]: injectKyowontourApiDeparturePricesIfMissing — manifest
 */
import { collectKyowontourCalendarRange } from '@/lib/kyowontour-departures'
import type { RegisterParsed } from '@/lib/register-llm-schema-kyowontour'
import { registerDepartureInputsToParsedPrices } from '@/lib/register-departure-input-to-parsed-price'
import { extractKyowontourHiddenFieldsFromDetailHtml } from '@/lib/kyowontour-tour-event-tab-data'
import type { DepartureInput } from '@/lib/upsert-product-departures-kyowontour'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import { kyowontourCalendarRowToFactPriceRow } from '@/lib/register-fact-price-row'

const KYOWONTOUR_BASE = process.env.KYOWONTOUR_BASE_URL ?? 'https://www.kyowontour.com'

function calendarRowsToDepartureInputs(
  rows: Awaited<ReturnType<typeof collectKyowontourCalendarRange>>['rows'],
): DepartureInput[] {
  return rows
    .map((r) => {
      const fact = kyowontourCalendarRowToFactPriceRow(r)
      if (!fact?.departureDate || (fact.adultPrice ?? 0) <= 0) return null
      return {
        departureDate: fact.departureDate,
        adultPrice: fact.adultPrice,
        statusRaw: fact.statusRaw ?? undefined,
        seatsStatusRaw: fact.seatsStatusRaw ?? undefined,
        seatCount: fact.seatCount ?? undefined,
        minPax: fact.minPax ?? undefined,
        carrierName: fact.carrierName ?? null,
      } satisfies DepartureInput
    })
    .filter((x): x is DepartureInput => x != null)
}

async function resolveKyowontourMasterCode(originUrl: string): Promise<{ masterCode: string; tourCode: string } | null> {
  const res = await fetch(originUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      referer: KYOWONTOUR_BASE,
    },
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) return null
  const html = await res.text()
  const hidden = extractKyowontourHiddenFieldsFromDetailHtml(html)
  if (!hidden) return null
  return { masterCode: hidden.masterCode, tourCode: hidden.tourCode }
}

export async function injectKyowontourApiDeparturePricesIfMissing(
  parsed: RegisterParsed,
  originUrl?: string | null,
): Promise<RegisterParsed> {
  if ((parsed.prices?.length ?? 0) > 0) return parsed
  const url = (originUrl ?? '').trim()
  if (!url || !/kyowontour\.com/i.test(url)) return parsed

  const keys = await resolveKyowontourMasterCode(url)
  if (!keys) return parsed

  const cal = await collectKyowontourCalendarRange(keys.masterCode, {
    monthCount: 6,
    disableE2EFallback: true,
    tourCodeForE2EFallback: keys.tourCode,
    refererUrl: url,
    log: process.env.DEV_REGISTER_PERF_LOG === '1',
    logLabel: 'register-api-price-inject',
  })
  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const inputs = calendarRowsToDepartureInputs(
    cal.rows.filter((r) => r.departDate >= fromYmd && r.departDate <= toYmd),
  )
  if (inputs.length === 0) return parsed

  const first = inputs[0]!
  const productPriceTable = {
    adultPrice: first.adultPrice ?? null,
    childExtraBedPrice: first.childBedPrice ?? null,
    infantPrice: first.infantPrice ?? null,
  }

  const notes = [...(parsed.registerPreviewPolicyNotes ?? [])]
  const note = `kyowontour calendar AJAX 출발·가격 주입: ${inputs.length}행`
  if (!notes.includes(note)) notes.push(note)

  const prices = registerDepartureInputsToParsedPrices(inputs)
  if (prices.length === 0) return parsed

  return {
    ...parsed,
    productPriceTable,
    prices,
    registerPreviewPolicyNotes: notes,
  }
}
