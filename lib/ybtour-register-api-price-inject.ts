/**
 * ybtour 등록 confirm — papi 출발·기본가 parsed 주입.
 *
 * REGRESSION-FREEZE[ybtour-register-api-price-inject]: injectYbtourApiDeparturePricesIfMissing — manifest
 */
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
import { collectYbtourApiDepartureInputsForUrl } from '@/lib/ybtour-api-departures'
import type { DepartureInput } from '@/lib/upsert-product-departures-ybtour'

function departureInputToPriceRow(dep: DepartureInput): ParsedProductPrice {
  return {
    date: dep.departureDate,
    adultBase: dep.adultPrice ?? 0,
    adultFuel: 0,
    childBedBase: dep.childBedPrice ?? undefined,
    childFuel: 0,
    infantBase: dep.infantPrice ?? undefined,
    infantFuel: 0,
    status: dep.statusRaw ?? '예약가능',
    availableSeats: 0,
    carrierName: dep.carrierName ?? null,
    outboundFlightNo: dep.outboundFlightNo ?? null,
  }
}

export async function injectYbtourApiDeparturePricesIfMissing(
  parsed: RegisterParsed,
  originUrl?: string | null,
): Promise<RegisterParsed> {
  if ((parsed.prices?.length ?? 0) > 0) return parsed
  const url = (originUrl ?? '').trim()
  if (!url) return parsed

  const hit = await collectYbtourApiDepartureInputsForUrl(url)
  if (hit.inputs.length === 0) return parsed

  const first = hit.inputs[0]!
  const productPriceTable = {
    adultPrice: first.adultPrice ?? null,
    childExtraBedPrice: first.childBedPrice ?? null,
    infantPrice: first.infantPrice ?? null,
  }

  const notes = [...(parsed.registerPreviewPolicyNotes ?? [])]
  const note = `ybtour papi 출발·기본가 주입: ${hit.inputs.length}행`
  if (!notes.includes(note)) notes.push(note)

  return {
    ...parsed,
    productPriceTable,
    prices: hit.inputs.map(departureInputToPriceRow),
    registerPreviewPolicyNotes: notes,
    ybtourApiPriceInjectRan: true,
  }
}
