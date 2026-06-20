/**
 * 하나투어 등록 — gw getPkgProdInfo에서 출발·기본가를 parsed에 주입.
 * 붙여넣기·LLM에 prices[]/productPriceTable이 없을 때 confirm 게이트 통과용.
 *
 * REGRESSION-FREEZE[hanatour-register-api-price-inject]: injectHanatourApiDeparturePricesIfMissing — manifest
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import {
  fetchHanatourPkgProdInfo,
  hanatourProdInfoToDepartureInput,
  parseHanatourPkgCdFromUrl,
} from '@/lib/hanatour-api-departures'

function departureInputToPriceRow(dep: NonNullable<ReturnType<typeof hanatourProdInfoToDepartureInput>>): ParsedProductPrice {
  return {
    date: dep.departureDate,
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

export async function injectHanatourApiDeparturePricesIfMissing(
  parsed: RegisterParsed,
  originUrl?: string | null,
): Promise<RegisterParsed> {
  if ((parsed.prices?.length ?? 0) > 0) return parsed
  const url = (originUrl ?? '').trim()
  const pkgCd = parseHanatourPkgCdFromUrl(url)
  if (!pkgCd) return parsed

  const info = await fetchHanatourPkgProdInfo(pkgCd)
  const dep = hanatourProdInfoToDepartureInput(info)
  if (!dep?.departureDate || dep.adultPrice == null || dep.adultPrice <= 0) return parsed

  const productPriceTable = {
    adultPrice: dep.adultPrice,
    childExtraBedPrice: dep.childBedPrice ?? null,
    infantPrice: dep.infantPrice ?? null,
  }

  const notes = [...(parsed.registerPreviewPolicyNotes ?? [])]
  const note = `하나투어 gw API 출발·기본가 주입: ${dep.departureDate} 성인 ${dep.adultPrice.toLocaleString('ko-KR')}원`
  if (!notes.includes(note)) notes.push(note)

  return {
    ...parsed,
    productPriceTable,
    prices: [departureInputToPriceRow(dep)],
    registerPreviewPolicyNotes: notes,
    hanatourApiPriceInjectRan: true,
  }
}
