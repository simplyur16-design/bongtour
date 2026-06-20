/**
 * ybtour 등록 confirm — papi by-goods 다출발·상태·항공사 parsed 주입.
 *
 * REGRESSION-FREEZE[ybtour-register-api-price-inject]: injectYbtourApiDeparturePricesIfMissing — manifest
 */
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
import { registerDepartureInputsToParsedPrices } from '@/lib/register-departure-input-to-parsed-price'
import { collectYbtourByGoodsApiDepartureInputsForUrl } from '@/lib/ybtour-api-departures'

export async function injectYbtourApiDeparturePricesIfMissing(
  parsed: RegisterParsed,
  originUrl?: string | null,
): Promise<RegisterParsed> {
  if ((parsed.prices?.length ?? 0) > 0) return parsed
  const url = (originUrl ?? '').trim()
  if (!url) return parsed

  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const hit = await collectYbtourByGoodsApiDepartureInputsForUrl(url, fromYmd, toYmd, {
    originCode: parsed.originCode ?? null,
  })
  if (hit.inputs.length === 0) return parsed

  const first = hit.inputs[0]!
  const productPriceTable = {
    adultPrice: first.adultPrice ?? null,
    childExtraBedPrice: first.childBedPrice ?? null,
    infantPrice: first.infantPrice ?? null,
  }

  const notes = [...(parsed.registerPreviewPolicyNotes ?? [])]
  const note = `ybtour papi by-goods 출발·가격 주입: ${hit.inputs.length}행`
  if (!notes.includes(note)) notes.push(note)

  const prices = registerDepartureInputsToParsedPrices(hit.inputs)
  if (prices.length === 0) return parsed

  return {
    ...parsed,
    productPriceTable,
    prices,
    registerPreviewPolicyNotes: notes,
  }
}
