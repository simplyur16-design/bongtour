/**
 * verygoodtour detail-collect 축 카운트 — PackageDetail HTML SSOT.
 * REGRESSION-FREEZE[register-facts-completeness]
 */
import {
  buildVerygoodProductCoreFromDetailHtml,
  extractVerygoodDetailFlightFactsFromHtml,
  extractVerygoodIncludedExcludedFromDetailHtml,
} from '@/lib/verygoodtour-departures'
import { parseVerygoodItineraryFromDetailHtml } from '@/lib/verygoodtour-itinerary-collector'
import { collectVerygoodtourPriceInputsWithProCodeDetail } from '@/lib/verygoodtour-price-collect'
import type { RegisterFactDetailParityMetrics } from '@/lib/register-facts/detail-parity-metrics'
import { parseVerygoodProCodeFromUrl } from '@/lib/register-facts/verygoodtour'
import { inferRegisterFactProductKindFromOriginUrl } from '@/lib/register-facts/product-kind'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

const VERYGOODTOUR_BASE = process.env.VERYGOODTOUR_BASE_URL ?? 'https://www.verygoodtour.com'

function bulletsFromMultilineText(raw: string | null | undefined): string[] {
  return String(raw ?? '')
    .split(/\n/)
    .map((l) => l.replace(/^[\s\-•·▪–—]+/, '').trim())
    .filter((l) => l.length > 1)
}

export async function fetchVerygoodRegisterDetailParityMetrics(
  originUrl: string,
): Promise<RegisterFactDetailParityMetrics | null> {
  const proCode = parseVerygoodProCodeFromUrl(originUrl)
  if (!proCode) return null

  const url =
    originUrl.trim() ||
    `${VERYGOODTOUR_BASE.replace(/\/$/, '')}/Product/PackageDetail?ProCode=${encodeURIComponent(proCode)}&PriceSeq=1`

  const res = await fetch(url, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'ko-KR',
      referer: VERYGOODTOUR_BASE,
    },
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) return null
  const html = await res.text()

  const coreHit = buildVerygoodProductCoreFromDetailHtml(url, html)
  const product = coreHit.product
  const inclExcl = extractVerygoodIncludedExcludedFromDetailHtml(html)
  const itinerary = parseVerygoodItineraryFromDetailHtml(html)
  const flightFacts = extractVerygoodDetailFlightFactsFromHtml(html)
  const productKind = inferRegisterFactProductKindFromOriginUrl('verygoodtour', url)
  let includedItems = bulletsFromMultilineText(product?.includedText ?? inclExcl.includedText)
  if (productKind === 'air_hotel_free') {
    const hotelLine = product?.hotelSummaryRaw?.trim()
    if (hotelLine && !includedItems.some((b) => b.includes(hotelLine.slice(0, 12)))) {
      includedItems = [`숙소: ${hotelLine}`, ...includedItems].slice(0, 24)
    }
  }
  const excludedItems = bulletsFromMultilineText(product?.excludedText ?? inclExcl.excludedText)

  const fromYmd = kstTodayYmd()
  const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
  const collected = await collectVerygoodtourPriceInputsWithProCodeDetail(url, fromYmd, toYmd)
  const priceRows = collected.inputs.filter((x) => (x.adultPrice ?? 0) > 0).length

  const detailFlightSignal = Boolean(
    flightFacts.carrierName?.trim() ||
      flightFacts.outboundDepartureAirport?.trim() ||
      flightFacts.inboundDepartureAirport?.trim(),
  )

  return {
    detailScheduleDays: itinerary.days.length,
    detailIncludedCount: includedItems.length,
    detailExcludedCount: excludedItems.length,
    detailShoppingCount:
      product?.shoppingVisitCountTotal != null && product.shoppingVisitCountTotal > 0
        ? 1
        : product?.noShoppingFlag
          ? 1
          : 0,
    detailFlightSignal,
    detailPriceRows: priceRows,
  }
}
