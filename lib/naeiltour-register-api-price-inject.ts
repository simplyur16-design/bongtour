/**
 * naeiltour 등록 confirm — program_process 월별 출발가 parsed 주입.
 *
 * REGRESSION-FREEZE[naeiltour-register-api-price-inject]: injectNaeiltourApiDeparturePricesIfMissing — manifest
 * REGRESSION-FREEZE[naeiltour-program-process-departures]: program_process span.disc — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-naeiltour'
import { registerDepartureInputsToParsedPrices } from '@/lib/register-departure-input-to-parsed-price'
import { collectNaeiltourProgramProcessDeparturesForUrl } from '@/lib/naeiltour-departures'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import type { DepartureInput } from '@/lib/upsert-product-departures-naeiltour'

function rowsToDepartureInputs(
  rows: Awaited<ReturnType<typeof collectNaeiltourProgramProcessDeparturesForUrl>>,
  childFallback: number | null,
  infantFallback: number | null,
): DepartureInput[] {
  return rows.map((r) => ({
    departureDate: r.departDate,
    adultPrice: r.adultPrice,
    childBedPrice: childFallback && childFallback > 0 ? childFallback : null,
    infantPrice: infantFallback && infantFallback > 0 ? infantFallback : null,
    statusRaw: r.statusRaw ?? undefined,
    seatsStatusRaw: r.seatsStatusRaw ?? undefined,
    seatCount: r.seatCount ?? undefined,
    carrierName: r.carrierName ?? undefined,
    supplierDepartureCodeCandidate: r.eventSeq ?? undefined,
  }))
}

export async function injectNaeiltourApiDeparturePricesIfMissing(
  parsed: RegisterParsed,
  originUrl?: string | null,
): Promise<RegisterParsed> {
  if ((parsed.prices?.length ?? 0) > 0) return parsed
  const url = (originUrl ?? '').trim()
  if (!url || !/naeiltour\.co\.kr/i.test(url)) return parsed

  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const rows = await collectNaeiltourProgramProcessDeparturesForUrl(url, { fromYmd, toYmd })
  if (rows.length === 0) return parsed

  const childFallback = parsed.productPriceTable?.childExtraBedPrice ?? null
  const infantFallback = parsed.productPriceTable?.infantPrice ?? null
  const inputs = rowsToDepartureInputs(rows, childFallback, infantFallback)
  const prices = registerDepartureInputsToParsedPrices(inputs)
  if (prices.length === 0) return parsed

  const first = rows[0]!
  const productPriceTable = {
    adultPrice: first.adultPrice,
    childExtraBedPrice: childFallback,
    infantPrice: infantFallback,
  }
  const notes = [...(parsed.registerPreviewPolicyNotes ?? [])]
  const note = `naeiltour program_process 출발·가격 주입: ${prices.length}행`
  if (!notes.includes(note)) notes.push(note)

  return {
    ...parsed,
    productPriceTable,
    prices,
    registerPreviewPolicyNotes: notes,
  }
}
