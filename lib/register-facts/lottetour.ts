/**
 * lottetour 등록 사실 수집 — evtDetailBasicAjax·scheduleAjax·evtListAjax(다출발).
 *
 * REGRESSION-FREEZE[register-facts-foundation]: fetchLottetourRegisterDetailBundle — manifest
 */
import {
  collectLottetourCalendarRange,
  enrichLottetourEvtListCollectionHintsFromDetailPage,
  parseLottetourEvtListCollectionHints,
  type LottetourCalendarRow,
} from '@/lib/lottetour-departures'
import {
  extractLottetourIncludedExcludedFromBasicAjax,
  extractLottetourMeetingFromScheduleAjax,
  extractLottetourShoppingVisitCountFromCoreInfo,
  fetchLottetourRegisterDetailBundle,
  parseLottetourScheduleDaysFromScheduleAjax,
} from '@/lib/lottetour-register-api-detail'
import { lottetourCalendarRowToFactPriceRow } from '@/lib/register-fact-price-row'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-lottetour'
import type { RegisterFactScheduleDay, SupplierRegisterFactBundle } from '@/lib/register-facts/types'
import { addDaysUtcYmd, kstTodayYmd, RULE_A_WINDOW_DAYS } from '@/lib/product-sales-policy'
import { lottetourMonthCountInclusive } from '@/lib/lottetour-price-recheck-meta'
import { lottetourRegisterFactFlightsFromScheduleAndCalendar } from '@/lib/register-facts/lottetour-register-fact-flights'
import { registerFactProductKindNote } from '@/lib/register-facts/product-kind'
import { extractLottetourListingTitleFromHtml } from '@/lib/register-lottetour-basic'
import { isSupplierListingTitleUnacceptable } from '@/lib/supplier-listing-title-unacceptable'

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
    // REGRESSION-FREEZE[lottetour-schedule-plan-info-description]: plan_info 요약을 facts로 보존 — manifest
    const planSummary = String(d.description ?? '').trim()
    return {
      day: d.day,
      places,
      hotels: d.hotelText?.trim() ? [d.hotelText.trim()] : [],
      meals,
      transportNote: planSummary || null,
    }
  })
}

function parseNightsDays(durationText: string | null | undefined): { nights: number | null; days: number | null } {
  const raw = String(durationText ?? '')
  const nm = raw.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (nm) {
    const nights = Number(nm[1])
    const days = Number(nm[2])
    return {
      nights: Number.isFinite(nights) ? nights : null,
      days: Number.isFinite(days) ? days : null,
    }
  }
  // [KE]…푸꾸옥 5일▶… 브래킷 제목 — 일수만
  const daysOnly = raw.match(/(\d+)\s*일/)
  if (daysOnly) {
    const days = Number(daysOnly[1])
    return { nights: null, days: Number.isFinite(days) ? days : null }
  }
  return { nights: null, days: null }
}

/** evtList tourTitleRaw 비면 basicAjax HTML 브래킷 제목으로 복구 */
function resolveLottetourFactListingTitle(
  tourTitleRaw: string | null | undefined,
  basicAjaxHtml: string | null | undefined,
): string | null {
  const fromRow = tourTitleRaw?.trim() || null
  if (fromRow && !isSupplierListingTitleUnacceptable(fromRow, 'lottetour')) return fromRow
  // REGRESSION-FREEZE[lottetour-register-listing-title]: HTML bracket title when evtList empty — manifest
  const fromHtml = extractLottetourListingTitleFromHtml(basicAjaxHtml)
  if (fromHtml && !isSupplierListingTitleUnacceptable(fromHtml, 'lottetour')) return fromHtml
  return fromRow
}

export async function collectLottetourRegisterFacts(originUrl: string): Promise<SupplierRegisterFactBundle | null> {
  const url = originUrl.trim()
  if (!url || !/lottetour\.com/i.test(url)) return null

  const bundle = await fetchLottetourRegisterDetailBundle(url)
  if (!bundle) return null

  const scheduleDays = scheduleDaysToFactDays(parseLottetourScheduleDaysFromScheduleAjax(bundle.scheduleAjaxHtml))
  const { includedItems, excludedItems } = extractLottetourIncludedExcludedFromBasicAjax(bundle.basicAjaxHtml)
  const meeting = extractLottetourMeetingFromScheduleAjax(bundle.scheduleAjaxHtml)
  const shopCount = extractLottetourShoppingVisitCountFromCoreInfo(bundle.basicAjaxHtml)
  const shoppingPlaces =
    shopCount != null && shopCount > 0 ? [`쇼핑 ${shopCount}회`] : shopCount === 0 ? ['노쇼핑'] : []
  const row = bundle.evtListRow
  const listingTitle = resolveLottetourFactListingTitle(row?.tourTitleRaw, bundle.basicAjaxHtml)
  const { nights, days } = parseNightsDays(row?.durationText ?? listingTitle ?? row?.tourTitleRaw)

  // REGRESSION-FREEZE[lottetour-singapore-register-quality]: evtDetail 단건은 flight seed만 — priceRows는 RULE_A(180일) monthCount 가족 크롤 — manifest
  // REGRESSION-FREEZE[lottetour-register-facts-calendar-horizon]: monthCount=2면 9~10월 상품(D01A) 0건 — manifest
  let priceRows: SupplierRegisterFactBundle['priceRows'] = []
  let flightSourceRow: LottetourCalendarRow | null =
    row && row.adultPrice > 0 && row.departDate ? row : null

  let hints = parseLottetourEvtListCollectionHints({ rawMeta: null, originUrl: url })
  if (!hints.godId || !hints.menuNos) {
    hints = await enrichLottetourEvtListCollectionHintsFromDetailPage(hints, url)
  }
  if (hints.godId && hints.menuNos) {
    const fromYmd = kstTodayYmd()
    const toYmd = addDaysUtcYmd(fromYmd, RULE_A_WINDOW_DAYS)
    // 당월부터 180일 창을 덮는 달 수(약 6~7). 하드코딩 2는 가을 출발 상품을 통째로 놓친다.
    const monthCount = lottetourMonthCountInclusive(fromYmd, toYmd)
    const cal = await collectLottetourCalendarRange(
      { godId: hints.godId, menuNos: hints.menuNos },
      { monthCount, disableE2EFallback: true, logLabel: 'register-facts-lottetour' },
    )
    const evtExact = (bundle.evtCd ?? '').trim()
    const filtered = cal.rows.filter((r) => r.adultPrice > 0 && r.departDate)
    const evtPrefix = bundle.evtCd?.slice(0, 4) ?? ''
    // godId 캘린더는 이미 상품군 — prefix(D01A/B05A)로 같은 라인만 남긴다
    const scoped =
      evtPrefix.length >= 4
        ? filtered.filter((r) => r.evtCd.startsWith(evtPrefix))
        : evtExact
          ? filtered.filter((r) => r.evtCd === evtExact)
          : filtered
    const pricedRows = scoped.filter((r) => r.departDate >= fromYmd && r.departDate <= toYmd)
    const pool = pricedRows.length > 0 ? pricedRows : scoped
    if (!flightSourceRow) {
      flightSourceRow =
        (evtExact ? pool.find((r) => r.evtCd === evtExact) : null) ??
        pool[0] ??
        filtered[0] ??
        null
    }
    priceRows = pool
      .map((r) => lottetourCalendarRowToFactPriceRow(r))
      .filter((pr): pr is NonNullable<typeof pr> => pr != null)
  }
  if (priceRows.length === 0 && row && row.adultPrice > 0 && row.departDate) {
    const fact = lottetourCalendarRowToFactPriceRow(row)
    priceRows = fact ? [fact] : []
  }

  const flights = lottetourRegisterFactFlightsFromScheduleAndCalendar(
    bundle.scheduleAjaxHtml,
    flightSourceRow ?? row,
    meeting.meetingPlaceRaw,
  )

  return {
    supplier: 'lottetour',
    fetchedAt: new Date().toISOString(),
    originUrl: url,
    originCode: bundle.evtCd ?? bundle.godId,
    title: listingTitle,
    nights,
    days,
    meetingInfo: meeting.meetingInfoRaw,
    includedBullets: includedItems.slice(0, 24),
    excludedBullets: excludedItems.slice(0, 24),
    shoppingPlaces,
    scheduleDays,
    flights,
    priceRows,
    notes: [
      'source=lottetour_register_detail_bundle',
      `evtCd=${bundle.evtCd ?? '-'}`,
      `godId=${bundle.godId ?? '-'}`,
      `priceRows=${priceRows.length}`,
      registerFactProductKindNote('package'),
    ],
  }
}
