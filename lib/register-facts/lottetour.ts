/**
 * lottetour 등록 사실 수집 — evtDetailBasicAjax·scheduleAjax·evtListAjax(다출발).
 *
 * REGRESSION-FREEZE[register-facts-foundation]: fetchLottetourRegisterDetailBundle — manifest
 */
import {
  collectLottetourCalendarRange,
  enrichLottetourEvtListCollectionHintsFromDetailPage,
  parseLottetourEvtListCollectionHints,
} from '@/lib/lottetour-departures'
import {
  extractLottetourIncludedExcludedFromBasicAjax,
  fetchLottetourRegisterDetailBundle,
  parseLottetourScheduleDaysFromScheduleAjax,
} from '@/lib/lottetour-register-api-detail'
import { lottetourCalendarRowToFactPriceRow } from '@/lib/register-fact-price-row'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-lottetour'
import type { RegisterFactScheduleDay, SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'

function scheduleDaysToFactDays(days: RegisterScheduleDay[]): RegisterFactScheduleDay[] {
  return days.map((d) => {
    const places = d.routeText
      ? d.routeText
          .split(/\s*-\s*/)
          .map((x) => x.trim())
          .filter(Boolean)
      : d.title?.trim()
        ? [d.title.trim()]
        : []
    const meals = [d.breakfastText, d.lunchText, d.dinnerText].map((x) => String(x ?? '').trim()).filter(Boolean)
    return {
      day: d.day,
      places,
      hotels: d.hotelText?.trim() ? [d.hotelText.trim()] : [],
      meals,
      transportNote: null,
    }
  })
}

function parseNightsDays(durationText: string | null | undefined): { nights: number | null; days: number | null } {
  const m = String(durationText ?? '').match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (!m) return { nights: null, days: null }
  const nights = Number(m[1])
  const days = Number(m[2])
  return {
    nights: Number.isFinite(nights) ? nights : null,
    days: Number.isFinite(days) ? days : null,
  }
}

export async function collectLottetourRegisterFacts(originUrl: string): Promise<SupplierRegisterFactBundle | null> {
  const url = originUrl.trim()
  if (!url || !/lottetour\.com/i.test(url)) return null

  const bundle = await fetchLottetourRegisterDetailBundle(url)
  if (!bundle) return null

  const scheduleDays = scheduleDaysToFactDays(parseLottetourScheduleDaysFromScheduleAjax(bundle.scheduleAjaxHtml))
  const { includedItems, excludedItems } = extractLottetourIncludedExcludedFromBasicAjax(bundle.basicAjaxHtml)
  const row = bundle.evtListRow
  const { nights, days } = parseNightsDays(row?.durationText ?? row?.tourTitleRaw)

  let priceRows: SupplierRegisterFactBundle['priceRows'] = []
  let hints = parseLottetourEvtListCollectionHints({ rawMeta: null, originUrl: url })
  if (!hints.godId || !hints.menuNos) {
    hints = await enrichLottetourEvtListCollectionHintsFromDetailPage(hints, url)
  }
  if (hints.godId && hints.menuNos) {
    const cal = await collectLottetourCalendarRange(
      { godId: hints.godId, menuNos: hints.menuNos },
      { monthCount: 6, disableE2EFallback: true, logLabel: 'register-facts-lottetour' },
    )
    const evtPrefix = bundle.evtCd?.slice(0, 5) ?? ''
    const filtered = cal.rows.filter((r) => r.adultPrice > 0 && r.departDate)
    const scoped =
      evtPrefix.length >= 4
        ? filtered.filter((r) => r.evtCd.startsWith(evtPrefix.slice(0, 4)))
        : filtered
    const fromYmd = kstTodayYmd()
    const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
    priceRows = (scoped.length > 0 ? scoped : filtered)
      .filter((r) => r.departDate >= fromYmd && r.departDate <= toYmd)
      .map((r) => lottetourCalendarRowToFactPriceRow(r))
      .filter((row): row is NonNullable<typeof row> => row != null)
  } else if (row && row.adultPrice > 0 && row.departDate) {
    const fact = lottetourCalendarRowToFactPriceRow(row)
    priceRows = fact ? [fact] : []
  }

  return {
    supplier: 'lottetour',
    fetchedAt: new Date().toISOString(),
    originUrl: url,
    originCode: bundle.evtCd ?? bundle.godId,
    title: row?.tourTitleRaw?.trim() || null,
    nights,
    days,
    meetingInfo: null,
    includedBullets: includedItems.slice(0, 24),
    excludedBullets: excludedItems.slice(0, 24),
    shoppingPlaces: [],
    scheduleDays,
    flights: [],
    priceRows,
    notes: [
      'source=lottetour_register_detail_bundle',
      `evtCd=${bundle.evtCd ?? '-'}`,
      `godId=${bundle.godId ?? '-'}`,
      `priceRows=${priceRows.length}`,
    ],
  }
}
