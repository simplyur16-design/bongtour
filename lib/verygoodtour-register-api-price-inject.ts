/**
 * verygoodtour 등록 confirm — ProductCalendarSearch HXR 출발가 parsed 주입(E2E 없음).
 *
 * REGRESSION-FREEZE[verygoodtour-register-api-price-inject]: injectVerygoodtourApiDeparturePricesIfMissing — manifest
 */
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import type { RegisterParsed } from '@/lib/register-llm-schema-verygoodtour'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import { collectVerygoodHxrOnlyForDateRange } from '@/lib/verygoodtour-price-collect'
import type { DepartureInput } from '@/lib/upsert-product-departures-verygoodtour'

function departureInputToPriceRow(dep: DepartureInput): ParsedProductPrice | null {
  const date = departureInputToYmd(dep.departureDate)
  if (!date) return null
  return {
    date,
    adultBase: dep.adultPrice ?? 0,
    adultFuel: 0,
    childBedBase: dep.childBedPrice ?? undefined,
    childFuel: 0,
    infantBase: dep.infantPrice ?? undefined,
    infantFuel: 0,
    status: '예약가능',
    availableSeats: 0,
    carrierName: dep.carrierName ?? null,
    outboundFlightNo: dep.outboundFlightNo ?? null,
  }
}

export async function injectVerygoodtourApiDeparturePricesIfMissing(
  parsed: RegisterParsed,
  originUrl?: string | null,
): Promise<RegisterParsed> {
  if ((parsed.prices?.length ?? 0) > 0) return parsed
  const url = (originUrl ?? '').trim()
  if (!url) return parsed

  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const hxr = await collectVerygoodHxrOnlyForDateRange(url, fromYmd, toYmd)
  const priced = hxr.inputs.filter((r) => (r.adultPrice ?? 0) > 0)
  if (priced.length === 0) return parsed

  const first = priced[0]!
  const productPriceTable = {
    adultPrice: first.adultPrice ?? null,
    childExtraBedPrice: first.childBedPrice ?? null,
    infantPrice: first.infantPrice ?? null,
  }

  const notes = [...(parsed.registerPreviewPolicyNotes ?? [])]
  const note = `verygoodtour HXR 출발가 주입: ${priced.length}행`
  if (!notes.includes(note)) notes.push(note)

  return {
    ...parsed,
    productPriceTable,
    prices: priced.map(departureInputToPriceRow).filter((row): row is ParsedProductPrice => row != null),
    registerPreviewPolicyNotes: notes,
  }
}
