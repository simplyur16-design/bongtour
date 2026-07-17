/**
 * 하나투어 등록 — gw getPkgProdLst 다출발·상태·좌석·항공사를 parsed에 주입.
 * 붙여넣기·LLM에 prices[]/productPriceTable이 없을 때 confirm 게이트 통과용.
 *
 * API 역할 분리:
 * - getPkgProdInfo → productPriceTable (URL 페이지 대표가·anchor 1건)
 * - getPkgProdLst  → prices[] (동일 상품라인 다출발 달력 — 호텔·일수·마스터 일치만)
 *
 * REGRESSION-FREEZE[hanatour-register-api-price-inject]: injectHanatourApiDeparturePricesIfMissing — manifest
 */
import { buildHanatourKstTargetMonths } from '@/lib/hanatour-departures'
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'
import {
  collectHanatourApiDepartureInputsForMonths,
  parseHanatourPkgCdFromUrl,
} from '@/lib/hanatour-api-departures'
import { registerDepartureInputsToParsedPrices } from '@/lib/register-departure-input-to-parsed-price'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import type { DepartureInput } from '@/lib/upsert-product-departures-hanatour'

function filterInputsInWindow(inputs: DepartureInput[], fromYmd: string, toYmd: string): DepartureInput[] {
  return inputs.filter((x) => {
    const d = departureInputToYmd(x.departureDate)
    return d != null && d >= fromYmd && d <= toYmd
  })
}

export async function injectHanatourApiDeparturePricesIfMissing(
  parsed: RegisterParsed,
  originUrl?: string | null,
  options?: { adminTravelScope?: string | null },
): Promise<RegisterParsed> {
  if ((parsed.prices?.length ?? 0) > 0) return parsed
  const url = (originUrl ?? '').trim()
  const pkgCd = parseHanatourPkgCdFromUrl(url)
  if (!pkgCd) return parsed

  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const monthYms = buildHanatourKstTargetMonths(6)
  const hit = await collectHanatourApiDepartureInputsForMonths(pkgCd, monthYms, {
    adminTravelScope: options?.adminTravelScope,
  })
  let inputs = filterInputsInWindow(hit.inputs, fromYmd, toYmd).filter((x) => (x.adultPrice ?? 0) > 0)

  if (inputs.length === 0) {
    const single = hit.anchorInput ?? hit.inputs[0] ?? null
    // REGRESSION-FREEZE[hanatour-register-api-price-inject]: 과거 anchor 단독 재주입 금지 — manifest
    if (single) {
      const d = departureInputToYmd(single.departureDate) ?? ''
      if (d && d >= fromYmd && d <= toYmd && (single.adultPrice ?? 0) > 0) {
        inputs = [single]
      } else if (d && d < fromYmd) {
        return {
          ...parsed,
          registerPreviewPolicyNotes: [
            ...(parsed.registerPreviewPolicyNotes ?? []),
            `하나투어 출발 달력 0건·anchor 과거마감: ${d}`,
          ],
        }
      }
    }
  }
  if (inputs.length === 0) return parsed

  const anchor = hit.anchorInput
  const priceAnchor =
    (anchor && (anchor.adultPrice ?? 0) > 0 ? anchor : null) ??
    inputs.find((x) => x.supplierDepartureCodeCandidate === `hanatour:${pkgCd}`) ??
    inputs[0]!
  const productPriceTable = {
    adultPrice: priceAnchor.adultPrice ?? null,
    childExtraBedPrice: priceAnchor.childBedPrice ?? null,
    infantPrice: priceAnchor.infantPrice ?? null,
  }

  const notes = [...(parsed.registerPreviewPolicyNotes ?? [])]
  const note = `하나투어 gw API 출발·가격 주입: ${inputs.length}행`
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
