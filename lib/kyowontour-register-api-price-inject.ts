/**
 * kyowontour 등록 confirm — differentDepartDate AJAX 출발가 parsed 주입(E2E 없음).
 *
 * REGRESSION-FREEZE[kyowontour-register-api-price-inject]: injectKyowontourApiDeparturePricesIfMissing — manifest
 */
import { collectKyowontourCalendarRange } from '@/lib/kyowontour-departures'
import type { ParsedProductPrice } from '@/lib/parsed-product-types'
import type { RegisterParsed } from '@/lib/register-llm-schema-kyowontour'
import { departureInputToYmd } from '@/lib/scrape-date-bounds'
import { extractKyowontourHiddenFieldsFromDetailHtml } from '@/lib/kyowontour-tour-event-tab-data'
import type { DepartureInput } from '@/lib/upsert-product-departures-kyowontour'

const KYOWONTOUR_BASE = process.env.KYOWONTOUR_BASE_URL ?? 'https://www.kyowontour.com'

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

function calendarRowsToDepartureInputs(
  rows: Awaited<ReturnType<typeof collectKyowontourCalendarRange>>['rows'],
): DepartureInput[] {
  return rows
    .filter((r) => r.adultPriceFromCalendar > 0 && r.departDate)
    .map((r) => ({
      departureDate: r.departDate,
      adultPrice: r.adultPriceFromCalendar,
      statusRaw: r.status === 'available' ? '예약가능' : r.status,
      seatsStatusRaw: null,
      carrierName: r.airline || null,
    }))
}

async function resolveKyowontourMasterCode(originUrl: string): Promise<{ masterCode: string; tourCode: string } | null> {
  const res = await fetch(originUrl, {
    headers: {
      accept: 'text/html,application/xhtml+xml',
      referer: KYOWONTOUR_BASE,
    },
    signal: AbortSignal.timeout(25_000),
  })
  if (!res.ok) return null
  const html = await res.text()
  const hidden = extractKyowontourHiddenFieldsFromDetailHtml(html)
  if (!hidden) return null
  return { masterCode: hidden.masterCode, tourCode: hidden.tourCode }
}

export async function injectKyowontourApiDeparturePricesIfMissing(
  parsed: RegisterParsed,
  originUrl?: string | null,
): Promise<RegisterParsed> {
  if ((parsed.prices?.length ?? 0) > 0) return parsed
  const url = (originUrl ?? '').trim()
  if (!url || !/kyowontour\.com/i.test(url)) return parsed

  const keys = await resolveKyowontourMasterCode(url)
  if (!keys) return parsed

  const cal = await collectKyowontourCalendarRange(keys.masterCode, {
    monthCount: 6,
    disableE2EFallback: true,
    tourCodeForE2EFallback: keys.tourCode,
    refererUrl: url,
    log: process.env.DEV_REGISTER_PERF_LOG === '1',
    logLabel: 'register-api-price-inject',
  })
  const inputs = calendarRowsToDepartureInputs(cal.rows)
  if (inputs.length === 0) return parsed

  const first = inputs[0]!
  const productPriceTable = {
    adultPrice: first.adultPrice ?? null,
    childExtraBedPrice: first.childBedPrice ?? null,
    infantPrice: first.infantPrice ?? null,
  }

  const notes = [...(parsed.registerPreviewPolicyNotes ?? [])]
  const note = `kyowontour calendar AJAX 출발가 주입: ${inputs.length}행`
  if (!notes.includes(note)) notes.push(note)

  return {
    ...parsed,
    productPriceTable,
    prices: inputs.map(departureInputToPriceRow).filter((row): row is ParsedProductPrice => row != null),
    registerPreviewPolicyNotes: notes,
  }
}
