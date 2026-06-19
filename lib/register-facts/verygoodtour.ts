/**
 * verygoodtour 등록 사실 수집 — PackageDetail SSR HTML에서 구조만 추출.
 *
 * REGRESSION-FREEZE[register-facts-foundation]: PackageDetail fetch·메타 추출 — manifest
 */
import type { SupplierRegisterFactBundle } from '@/lib/register-facts/types'

const VERYGOODTOUR_BASE = process.env.VERYGOODTOUR_BASE_URL ?? 'https://www.verygoodtour.com'

export function parseVerygoodProCodeFromUrl(originUrl: string | null | undefined): string | null {
  const m = String(originUrl ?? '').match(/[?&]ProCode=([^&]+)/i)
  return m?.[1]?.trim() || null
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function firstMatch(html: string, pattern: RegExp): string | null {
  const m = html.match(pattern)
  return m?.[1]?.trim() || null
}

export function extractVerygoodRegisterFactsFromHtml(
  originUrl: string,
  html: string,
): SupplierRegisterFactBundle | null {
  const proCode = parseVerygoodProCodeFromUrl(originUrl)
  if (!proCode) return null

  const title =
    firstMatch(html, /<meta\s+property="og:title"\s+content="([^"]+)"/i) ??
    firstMatch(html, /<h1[^>]*class="[^"]*tit[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.replace(/<[^>]+>/g, ' ').trim() ??
    null

  const nightsDays =
    html.match(/(\d+)\s*박\s*(\d+)\s*일/) ??
    html.match(/(\d+)\s*night/i)
  const nights = nightsDays ? Number(nightsDays[1]) : null
  const days = nightsDays && nightsDays[2] ? Number(nightsDays[2]) : null

  const airlineBlock = firstMatch(html, /항공[\s\S]{0,1200}?(?=<\/(?:div|section|table))/i)
  const hotelBlock = firstMatch(html, /호텔[\s\S]{0,1200}?(?=<\/(?:div|section|table))/i)

  return {
    supplier: 'verygoodtour',
    fetchedAt: new Date().toISOString(),
    originUrl,
    originCode: proCode,
    title: title ? stripTags(title) : null,
    nights: Number.isFinite(nights) ? nights : null,
    days: Number.isFinite(days) ? days : null,
    meetingInfo: null,
    includedBullets: [],
    excludedBullets: [],
    shoppingPlaces: [],
    scheduleDays: [],
    flights: airlineBlock
      ? [
          {
            direction: 'unknown',
            carrier: null,
            flightNo: null,
            departureCity: null,
            departureAt: null,
            arrivalCity: null,
            arrivalAt: null,
          },
        ]
      : [],
    priceRows: [],
    notes: [
      'source=verygoodtour_package_detail_html',
      `proCode=${proCode}`,
      airlineBlock ? `airline_excerpt=${stripTags(airlineBlock).slice(0, 120)}` : 'airline_excerpt=missing',
      hotelBlock ? `hotel_excerpt=${stripTags(hotelBlock).slice(0, 120)}` : 'hotel_excerpt=missing',
    ],
  }
}

export async function collectVerygoodtourRegisterFacts(originUrl: string): Promise<SupplierRegisterFactBundle | null> {
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
  })
  if (!res.ok) return null
  const html = await res.text()
  return extractVerygoodRegisterFactsFromHtml(url, html)
}
