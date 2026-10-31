/**
 * verygoodtour 등록 confirm — ProductCalendarSearch HXR 출발가 parsed 주입(E2E 없음).
 *
 * REGRESSION-FREEZE[verygoodtour-register-api-price-inject]: injectVerygoodtourApiDeparturePricesIfMissing — manifest
 */
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import type { RegisterParsed } from '@/lib/register-llm-schema-verygoodtour'
import { registerDepartureInputsToParsedPrices } from '@/lib/register-departure-input-to-parsed-price'
import { collectVerygoodtourPriceInputsWithProCodeDetail } from '@/lib/verygoodtour-price-collect'
import { parseSupplierTripDurationLabel } from '@/lib/supplier-trip-duration'

export async function injectVerygoodtourApiDeparturePricesIfMissing(
  parsed: RegisterParsed,
  originUrl?: string | null,
): Promise<RegisterParsed> {
  if ((parsed.prices?.length ?? 0) > 0) return parsed
  const url = (originUrl ?? '').trim()
  if (!url) return parsed

  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  // 등록 상품 기간(박·일) — 다른 기간 출발 제외(모르면 거르지 않음)
  const hxr = await collectVerygoodtourPriceInputsWithProCodeDetail(url, fromYmd, toYmd, {
    expectedTripDuration: parseSupplierTripDurationLabel(parsed.duration ?? null),
  })
  const priced = hxr.inputs.filter((r) => (r.adultPrice ?? 0) > 0)
  if (priced.length === 0) return parsed

  const first = priced[0]!
  const productPriceTable = {
    adultPrice: first.adultPrice ?? null,
    childExtraBedPrice: first.childBedPrice ?? null,
    infantPrice: first.infantPrice ?? null,
  }

  const notes = [...(parsed.registerPreviewPolicyNotes ?? [])]
  const note = `verygoodtour HXR+ProCode 출발·가격 주입: ${priced.length}행`
  if (!notes.includes(note)) notes.push(note)

  const prices = registerDepartureInputsToParsedPrices(priced)
  if (prices.length === 0) return parsed

  return {
    ...parsed,
    productPriceTable,
    prices,
    registerPreviewPolicyNotes: notes,
  }
}
