/**
 * 참좋은 일정 `description` / ItineraryDay `summaryTextRaw` 파이프라인 추적.
 * `BONGTOUR_TRACE_SCHEDULE_DESC=1` 일 때만 stdout 로그 (운영 기본 OFF).
 */
import type { PrismaClient } from '@prisma/client'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'
import type { ItineraryDayInput } from '@/lib/upsert-itinerary-days-verygoodtour'

export function isVerygoodScheduleDescTraceEnabled(): boolean {
  return process.env.BONGTOUR_TRACE_SCHEDULE_DESC === '1'
}

function clip(s: string, max = 200): string {
  const t = s.replace(/\r/g, '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…(+${t.length - max})`
}

export function traceVerygoodScheduleDesc(
  stage: string,
  schedule: RegisterScheduleDay[] | undefined,
  extra?: Record<string, unknown>
): void {
  if (!isVerygoodScheduleDescTraceEnabled()) return
  if (!schedule?.length) {
    // eslint-disable-next-line no-console
    console.info(`[TRACE verygood scheduleDesc] ${stage} rows=0`, extra ?? '')
    return
  }
  for (const row of schedule) {
    const day = Number(row.day) || 0
    const d = String(row.description ?? '').trim()
    const title = String(row.title ?? '').trim()
    // eslint-disable-next-line no-console
    console.info(
      `[TRACE verygood scheduleDesc] ${stage} day=${day} titleLen=${title.length} descLen=${d.length} desc=${JSON.stringify(clip(d, 220))}`,
      extra && Object.keys(extra).length ? extra : ''
    )
  }
}

/** 결정론(det) 행의 description 길이만 요약(원문 poi 블록 재주입 여부 추적용) */
export function traceVerygoodDetScheduleDesc(stage: string, det: RegisterScheduleDay[] | undefined): void {
  if (!isVerygoodScheduleDescTraceEnabled()) return
  if (!det?.length) {
    // eslint-disable-next-line no-console
    console.info(`[TRACE verygood detDesc] ${stage} rows=0`)
    return
  }
  for (const row of det) {
    const day = Number(row.day) || 0
    const d = String(row.description ?? '').trim()
    // eslint-disable-next-line no-console
    console.info(
      `[TRACE verygood detDesc] ${stage} day=${day} detDescLen=${d.length} preview=${JSON.stringify(clip(d, 160))}`
    )
  }
}

export function traceVerygoodItineraryDrafts(stage: string, drafts: ItineraryDayInput[]): void {
  if (!isVerygoodScheduleDescTraceEnabled()) return
  for (const d of drafts) {
    const day = Number(d.day) || 0
    const s = String(d.summaryTextRaw ?? '').trim()
    // eslint-disable-next-line no-console
    console.info(
      `[TRACE verygood itineraryDraft] ${stage} day=${day} summaryTextRawLen=${s.length} preview=${JSON.stringify(clip(s, 220))}`
    )
  }
}

/** Prisma ItineraryDay 저장 직후 DB에서 읽은 값(재조회) */
export async function traceVerygoodItineraryDayDbReadBack(
  prisma: PrismaClient,
  productId: string,
  stage: string
): Promise<void> {
  if (!isVerygoodScheduleDescTraceEnabled()) return
  const rows = await prisma.itineraryDay.findMany({
    where: { productId },
    orderBy: { day: 'asc' },
    take: 14,
    select: { day: true, summaryTextRaw: true },
  })
  for (const r of rows) {
    const s = String(r.summaryTextRaw ?? '').trim()
    // eslint-disable-next-line no-console
    console.info(
      `[TRACE verygood itineraryDB] ${stage} day=${r.day} summaryTextRawLen=${s.length} preview=${JSON.stringify(clip(s, 220))}`
    )
  }
}

/** 레거시 `Itinerary` 행(title+description 합본) — UI/다른 경로가 이걸 읽으면 이중 노출 가능 */
export async function traceVerygoodItineraryLegacyTable(
  prisma: PrismaClient,
  productId: string,
  stage: string
): Promise<void> {
  if (!isVerygoodScheduleDescTraceEnabled()) return
  const rows = await prisma.itinerary.findMany({
    where: { productId },
    orderBy: { day: 'asc' },
    take: 5,
    select: { day: true, description: true },
  })
  for (const r of rows) {
    const s = String(r.description ?? '').trim()
    // eslint-disable-next-line no-console
    console.info(
      `[TRACE verygood itineraryLegacy] ${stage} day=${r.day} combinedLen=${s.length} preview=${JSON.stringify(clip(s, 220))}`
    )
  }
}
