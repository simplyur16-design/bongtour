import { prisma } from '@/lib/prisma'
import {
  buildCountryMatchVariants,
  monthOverlapsEvent,
} from '@/lib/bong-marketing/curation-event-repository'
import { countryLabelsMatch } from '@/lib/bong-marketing/curation-event-gemini-parse'

export const CURATION_EVENT_SUMMARY_SELECT = {
  id: true,
  name: true,
  countryCode: true,
  startMonth: true,
  endMonth: true,
  type: true,
  city: true,
  monthKey: true,
  monthlyCurationContentId: true,
} as const

export type CurationEventSummary = {
  id: string
  name: string
  countryCode: string
  startMonth: number
  endMonth: number
  type: string
  city: string | null
  monthKey: string
  monthlyCurationContentId?: string | null
}

export type CurationEventCandidate = CurationEventSummary & {
  linkedSeasonCard: {
    id: string
    title: string
    monthKey: string
  } | null
}

function parseMonthKey(monthKey: string): { year: number; month: number } | null {
  const trimmed = monthKey.trim()
  if (!/^\d{4}-\d{2}$/.test(trimmed)) return null
  const [yearStr, monthStr] = trimmed.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  if (!Number.isFinite(year) || month < 1 || month > 12) return null
  return { year, month }
}

async function buildCountryLabelBySlug(): Promise<Record<string, string>> {
  const rows = await prisma.country.findMany({
    select: { countryKey: true, koreanLabel: true },
  })
  const merged: Record<string, string> = {}
  for (const row of rows) {
    merged[row.countryKey] = row.koreanLabel
  }
  return merged
}

function eventMatchesCardCountry(
  eventCountryCode: string,
  cardCountryCode: string | null | undefined,
  labelBySlug: Record<string, string>,
): boolean {
  if (!cardCountryCode?.trim()) return true
  const variants = buildCountryMatchVariants(cardCountryCode.trim(), labelBySlug)
  return variants.some((v) => countryLabelsMatch(v, eventCountryCode))
}

export function formatCurationEventMonthRange(
  startMonth: number,
  endMonth: number,
): string {
  if (startMonth === endMonth) return `${startMonth}월`
  return `${startMonth}~${endMonth}월`
}

export function formatLinkedEventBadgeLabel(event: {
  name: string
  countryCode: string
  startMonth: number
  endMonth: number
}): string {
  const monthPart = formatCurationEventMonthRange(event.startMonth, event.endMonth)
  return `🌐 ${event.name} (${event.countryCode}, ${monthPart})`
}

export async function listCandidateCurationEventsForCard(params: {
  monthKey: string
  countryCode?: string | null
}): Promise<CurationEventCandidate[]> {
  const parsed = parseMonthKey(params.monthKey)
  if (!parsed) return []

  const { year, month } = parsed
  const labelBySlug = await buildCountryLabelBySlug()

  const rows = await prisma.curationEvent.findMany({
    where: { status: 'approved', year },
    orderBy: [{ startMonth: 'asc' }, { name: 'asc' }],
    select: {
      ...CURATION_EVENT_SUMMARY_SELECT,
      monthlyCurationContent: {
        select: { id: true, title: true, monthKey: true },
      },
    },
  })

  return rows
    .filter((row) => monthOverlapsEvent(month, row.startMonth, row.endMonth))
    .filter((row) => eventMatchesCardCountry(row.countryCode, params.countryCode, labelBySlug))
    .map((row) => {
      const { monthlyCurationContent, ...rest } = row
      return {
        ...rest,
        linkedSeasonCard: monthlyCurationContent,
      }
    })
}

export async function linkCurationEventToSeasonCard(
  cardId: string,
  eventId: string,
): Promise<{
  event: CurationEventSummary
  previousCardId: string | null
}> {
  const [card, event] = await Promise.all([
    prisma.monthlyCurationContent.findUnique({
      where: { id: cardId },
      select: { id: true },
    }),
    prisma.curationEvent.findUnique({
      where: { id: eventId },
      select: CURATION_EVENT_SUMMARY_SELECT,
    }),
  ])

  if (!card) throw new Error('시즌 카드를 찾을 수 없습니다.')
  if (!event) throw new Error('이벤트를 찾을 수 없습니다.')

  const approved = await prisma.curationEvent.findUnique({
    where: { id: eventId },
    select: { status: true },
  })
  if (approved?.status !== 'approved') {
    throw new Error('승인된(approved) 이벤트만 연결할 수 있습니다.')
  }

  const previousCardId = event.monthlyCurationContentId

  const updated = await prisma.curationEvent.update({
    where: { id: eventId },
    data: { monthlyCurationContentId: cardId },
    select: CURATION_EVENT_SUMMARY_SELECT,
  })

  return { event: updated, previousCardId }
}

export async function unlinkCurationEventFromSeasonCard(
  cardId: string,
  eventId: string,
): Promise<void> {
  const event = await prisma.curationEvent.findUnique({
    where: { id: eventId },
    select: { id: true, monthlyCurationContentId: true },
  })
  if (!event) throw new Error('이벤트를 찾을 수 없습니다.')
  if (event.monthlyCurationContentId !== cardId) {
    throw new Error('이 카드에 연결된 이벤트가 아닙니다.')
  }

  await prisma.curationEvent.update({
    where: { id: eventId },
    data: { monthlyCurationContentId: null },
  })
}
