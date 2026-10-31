/**
 * ybtour 등록 confirm — papi by-goods 다출발·상태·항공사 parsed 주입.
 *
 * REGRESSION-FREEZE[ybtour-register-api-price-inject]: injectYbtourApiDeparturePricesIfMissing — manifest
 */
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import type { RegisterParsed } from '@/lib/register-llm-schema-ybtour'
import { registerDepartureInputsToParsedPrices } from '@/lib/register-departure-input-to-parsed-price'
import { collectYbtourByGoodsApiDepartureInputsForUrl } from '@/lib/ybtour-api-departures'
import { parseSupplierTripDurationLabel } from '@/lib/supplier-trip-duration'

/** ybtour confirm ProductPrice — 동일 departure date 중복 제거 (P2002 방지). */
export function dedupeYbtourProductPriceCreateRows<T extends { date: Date }>(rows: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const row of rows) {
    const key = row.date.toISOString().slice(0, 10)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

export async function injectYbtourApiDeparturePricesIfMissing(
  parsed: RegisterParsed,
  originUrl?: string | null,
): Promise<RegisterParsed> {
  if ((parsed.prices?.length ?? 0) > 0) return parsed
  const url = (originUrl ?? '').trim()
  if (!url) return parsed

  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  // REGRESSION-FREEZE[register-confirm-skip-detail-recollect]: register inject skips per-evCd enrich — manifest
  // confirm 경로에서 prices가 비어 inject가 돌 때 evCd별 /price 연타(수십 초~분)로 플랫폼 타임아웃·실패 유발
  const hit = await collectYbtourByGoodsApiDepartureInputsForUrl(url, fromYmd, toYmd, {
    originCode: parsed.originCode ?? null,
    enrichEvCdPrice: false,
    // 등록 상품 기간(박·일) — 다른 기간 출발 제외. 값이 없으면 URL evCd 행 기간, 그것도 없으면 거르지 않음
    expectedTripDuration: parseSupplierTripDurationLabel(parsed.duration ?? null),
    expectedTripDurationFromUrlEvCd: true,
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
