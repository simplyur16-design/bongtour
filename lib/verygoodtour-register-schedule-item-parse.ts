/**
 * 참좋은여행 PackageDetail — `#product-day-N.scheduleItem` DOM 일정 SSOT.
 * REGRESSION-FREEZE[verygoodtour-register-schedule-collect]: product-day scheduleItem — manifest
 */
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'
import {
  applyVerygoodScheduleExpressionToRows,
  dedupeVerygoodtourScheduleRoutePlaces,
  joinVerygoodtourScheduleRouteText,
} from '@/lib/verygoodtour-register-api-schedule'
import { parseScheduleMealFieldsFromText } from '@/lib/register-schedule-meal-parse'
import { itineraryDayCityFromSupplierCities } from '@/lib/itinerary-day-city'

type ParsedScheduleItem = RegisterScheduleDay & { flightReturnHead: string | null }

/**
 * scheduleItem accordion 중 안내·필독 카드(아동 동반 출국·공증·여권·좌석·기내 반입 등) — 방문지 아님.
 * REGRESSION-FREEZE[verygoodtour-schedule-notice-accordion-not-route]: 공지 accordion 1일차 혼입 금지 — manifest
 */
const VERYGOOD_SCHEDULE_NOTICE_HEAD_RE =
  /필독|유의\s*사항|안내\s*사항|참고\s*사항|주의\s*사항|준비물|체크사항|미팅|출발\s*전|연락처|1644|동반\s*출국|출국\s*시|공증|여권|비자|입국\s*(?:서류|규정|신고)|좌석\s*배정|기내\s*반입|^\s*※/u

export function isVerygoodScheduleNoticeHead(head: string): boolean {
  return VERYGOOD_SCHEDULE_NOTICE_HEAD_RE.test(String(head ?? ''))
}

function stripVerygoodScheduleInnerHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractVerygoodScheduleItemBlock(html: string, day: number): string | null {
  const next = day + 1
  const re = new RegExp(
    `id="product-day-${day}"\\s+class="scheduleItem">([\\s\\S]*?)(?=id="product-day-${next}"\\s+class="scheduleItem"|class="scheduleListEnd"|<!--\\s*//\\s*scheduleList)`,
    'i',
  )
  return html.match(re)?.[1] ?? null
}

function parseVerygoodScheduleItemBlock(day: number, block: string): ParsedScheduleItem {
  const dateText = stripVerygoodScheduleInnerHtml(
    block.match(/class="info date"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '',
  )
  const locRaw = stripVerygoodScheduleInnerHtml(
    block.match(/class="info location"[\s\S]*?<div class="inner">([\s\S]*?)<\/div>/i)?.[1] ?? '',
  )
  const heads = [...block.matchAll(/class="accordion-head"[\s\S]*?<p>([\s\S]*?)<\/p>/gi)]
    .map((m) => stripVerygoodScheduleInnerHtml(m[1]!))
    .filter(Boolean)
  const flightReturnHead = heads.find((h) => /\[[A-Z]{2}\s*\d+\].*인천/i.test(h)) ?? null
  const touringHeads = heads.filter((h) => !isVerygoodScheduleNoticeHead(h) && !/\[[A-Z]{2}\s*\d+\]/i.test(h))
  const hotelRaw =
    stripVerygoodScheduleInnerHtml(
      block.match(/<h4>\s*호텔\s*<\/h4>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '',
    ) || null
  // REGRESSION-FREEZE[verygoodtour-register-schedule-collect]: scheduleItem 식사 h4 — manifest
  // 일부 상품은 호텔 h4 칸에 「조식 호텔식」만 넣고 식사 h4가 비어 있음 → 식사로 승격
  const mealFromH4 =
    stripVerygoodScheduleInnerHtml(
      block.match(/<h4>\s*식사\s*<\/h4>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '',
    ) ||
    stripVerygoodScheduleInnerHtml(
      block.match(/<h4>\s*식사\s*<\/h4>[\s\S]*?<div[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '',
    ) ||
    ''
  const hotelLooksLikeMeal =
    !!hotelRaw &&
    /^(?:조식|중식|석식|아침|점심|저녁)/u.test(hotelRaw) &&
    !/(Hotel|Resort|메리어트|노보텔|힐튼|하얏트|쉐라톤|리조트)/i.test(hotelRaw)
  const hotelText = hotelLooksLikeMeal ? null : hotelRaw
  const mealBlob = mealFromH4 || (hotelLooksLikeMeal ? hotelRaw! : '')
  const mealFields = mealBlob ? parseScheduleMealFieldsFromText(mealBlob) : {}

  const routeSeed = [
    ...locRaw.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean),
    ...touringHeads,
  ]
  const routePlaces = dedupeVerygoodtourScheduleRoutePlaces(routeSeed)
  const routeText = joinVerygoodtourScheduleRouteText(routePlaces)
  const title = routePlaces[0] ?? locRaw.split('-')[0]?.trim() ?? `${day}일차`
  const descriptionLines = [
    dateText,
    locRaw,
    ...heads.filter((h) => h !== flightReturnHead && !isVerygoodScheduleNoticeHead(h)),
  ]

  return {
    day,
    title,
    description: descriptionLines.filter(Boolean).join('\n'),
    routeText,
    // REGRESSION-FREEZE[itinerary-day-city-only]: info location 도시 칸만 cityText — manifest
    cityText: itineraryDayCityFromSupplierCities(locRaw.split(/\s*-\s*/)),
    dateText: dateText || null,
    hotelText,
    breakfastText: mealFields.breakfastText ?? null,
    lunchText: mealFields.lunchText ?? null,
    dinnerText: mealFields.dinnerText ?? null,
    mealSummaryText: mealFields.mealSummaryText ?? (mealBlob || null),
    imageKeyword: '',
    imageKeyword2: null,
    flightReturnHead,
  }
}

function inferTripDaysFromHtml(html: string): number | null {
  const m = stripVerygoodScheduleInnerHtml(html).match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (!m?.[2]) return null
  const n = Number(m[2])
  return Number.isFinite(n) && n >= 1 && n <= 30 ? n : null
}

/** PackageDetail HTML `#product-day-N` 패널 → RegisterScheduleDay[] */
export function parseVerygoodScheduleRowsFromDetailHtml(html: string): RegisterScheduleDay[] {
  const rawRows: ParsedScheduleItem[] = []
  for (let day = 1; day <= 14; day++) {
    const block = extractVerygoodScheduleItemBlock(html, day)
    if (!block) break
    rawRows.push(parseVerygoodScheduleItemBlock(day, block))
  }
  if (rawRows.length === 0) return []

  const tripDays = inferTripDaysFromHtml(html)
  const returnHead =
    [...rawRows].reverse().find((r) => r.flightReturnHead)?.flightReturnHead ?? null
  if (tripDays != null && tripDays > rawRows.length) {
    rawRows.push({
      day: tripDays,
      title: '인천',
      // REGRESSION-FREEZE[display-text-fix-1031]: 귀국일 패널 없음 — 원문에 없는 쿠알라룸푸르 하드코딩 금지 — manifest
      description: returnHead ?? '',
      routeText: returnHead
        ? joinVerygoodtourScheduleRouteText(returnHead.split(/\s*-\s*/).filter(Boolean))
        : joinVerygoodtourScheduleRouteText(['인천']),
      dateText: null,
      hotelText: null,
      imageKeyword: '',
      imageKeyword2: null,
      flightReturnHead: null,
    })
  }

  const cleaned: RegisterScheduleDay[] = rawRows.map(({ flightReturnHead: _, ...row }) => row)
  return applyVerygoodScheduleExpressionToRows(cleaned)
}
