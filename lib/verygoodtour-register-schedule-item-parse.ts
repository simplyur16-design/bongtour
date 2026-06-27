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

type ParsedScheduleItem = RegisterScheduleDay & { flightReturnHead: string | null }

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
  const touringHeads = heads.filter(
    (h) => !/체크사항|미팅|출발\s*전|연락처|1644/i.test(h) && !/\[[A-Z]{2}\s*\d+\]/i.test(h),
  )
  const hotelText =
    stripVerygoodScheduleInnerHtml(
      block.match(/<h4>\s*호텔\s*<\/h4>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '',
    ) || null

  const routeSeed = [
    ...locRaw.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean),
    ...touringHeads,
  ]
  const routePlaces = dedupeVerygoodtourScheduleRoutePlaces(routeSeed)
  const routeText = joinVerygoodtourScheduleRouteText(routePlaces)
  const title = routePlaces[0] ?? locRaw.split('-')[0]?.trim() ?? `${day}일차`
  const descriptionLines = [dateText, locRaw, ...heads.filter((h) => h !== flightReturnHead)]

  return {
    day,
    title,
    description: descriptionLines.filter(Boolean).join('\n'),
    routeText,
    dateText: dateText || null,
    hotelText,
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
      description: returnHead ?? '쿠알라룸푸르 - 인천',
      routeText: joinVerygoodtourScheduleRouteText(['쿠알라룸푸르', '인천']),
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
