/**
 * 노랑풍선 일정(ItineraryDay) 수집기.
 * 정본은 일정 탭/원문 블록이며, rawBlock 없는 일차는 생성하지 않는다.
 */

import type { ItineraryDayInput } from '@/lib/upsert-itinerary-days-ybtour'
import { normalizeDay } from '@/lib/upsert-itinerary-days-ybtour'
import { YBTOUR_SOURCE } from '@/lib/ybtour/ybtour-adapter'

export { YBTOUR_SOURCE }

/** 수집 컨텍스트 (브라우저 page 또는 정적 HTML — 미연결 시 TODO) */
export type YellowBalloonItineraryContext = {
  /** Playwright/Puppeteer Page 또는 cheerio root 등 */
  page?: unknown
  html?: string | null
}

export type YellowBalloonItineraryCollectParams = {
  productId: string
  /** 항상 YBTOUR (`YBTOUR`) */
  originSource: typeof YBTOUR_SOURCE
  originCode: string
  originUrl?: string | null
  ctx?: YellowBalloonItineraryContext
  /** 상품 상단 등 참고용 — 일정 정본 대체에 사용 금지 */
  rawProductContext?: string | null
}

export type YellowBalloonItineraryFailureReason =
  | 'tab_open_failed'
  | 'itinerary_raw_unavailable'
  | 'day_blocks_unsplitable'
  | 'unimplemented'

export type YellowBalloonItineraryCollectMeta = {
  notes: string[]
  failureReason?: YellowBalloonItineraryFailureReason
}

export type YellowBalloonItineraryCollectResult = {
  days: ItineraryDayInput[]
  meta: YellowBalloonItineraryCollectMeta
}

/**
 * 파싱 중간 표현 (설계 초안의 title/summary/visitSpots… 명칭).
 * 최종 적재 전 ItineraryDayInput 으로 변환한다.
 */
export type YellowBalloonParsedDayBlock = {
  dayIndex: number
  title?: string | null
  summary?: string | null
  routeTextRaw?: string | null
  visitSpotsRaw?: string | null
  mealInfoRaw?: string | null
  hotelInfoRaw?: string | null
  rawBlock?: string | null
  dateText?: string | null
  city?: string | null
}

// --- 파이프라인 단계 (구현은 TODO: selector·탭 이름·XHR 미확정) ---

export async function openItineraryTab(_ctx: YellowBalloonItineraryContext): Promise<{ ok: boolean }> {
  const html = String(_ctx.html ?? '')
  return { ok: /(일정|itinerary|여행일정)/i.test(html) }
}

export async function fetchItineraryHtmlOrState(
  ctx: YellowBalloonItineraryContext
): Promise<{ html: string | null; fromXHR: boolean }> {
  if (ctx.html?.trim()) return { html: ctx.html, fromXHR: false }
  return { html: null, fromXHR: false }
}

/**
 * 1일차/2일차… 블록 분리. 구분 실패 시 빈 배열 + meta (억지 단일 블록 분해 금지).
 */
export function extractDayBlocks(_html: string): YellowBalloonParsedDayBlock[] {
  const html = String(_html ?? '')
  const text = html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '\n')
  const chunks = text
    .split(/(?=(?:^|\n)\s*(?:D\s*AY\s*)?\d+\s*일차|\n\s*\[\s*\d+\s*일차\s*])/i)
    .map((x) => x.trim())
    .filter(Boolean)
  const out: YellowBalloonParsedDayBlock[] = []
  for (const raw of chunks) {
    const dayMatch = raw.match(/(?:DAY\s*)?(\d+)\s*일차/i) ?? raw.match(/^\s*(\d+)\s*일/i)
    const dayIndex = Number(dayMatch?.[1] ?? 0)
    if (!Number.isInteger(dayIndex) || dayIndex < 1) continue
    out.push(parseDayBlock(dayIndex, raw))
  }
  return out
}

/**
 * 한 일차 블록에서 필드 추출. 구조화 실패 시 rawBlock 만이라도 채운다.
 */
export function parseDayBlock(dayIndex: number, rawBlock: string): YellowBalloonParsedDayBlock {
  const trimmed = rawBlock.trim()
  const dateText = trimmed.match(/(20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{1,2}월\s*\d{1,2}일)/)?.[1] ?? null
  const city = trimmed.match(/(삿포로|도쿄|오사카|후쿠오카|부산|서울|제주|타이페이|방콕|다낭|하노이|호치민)/)?.[1] ?? null
  const meals = trimmed.match(/(조식[^\n]{0,80}|중식[^\n]{0,80}|석식[^\n]{0,80})/)?.[1] ?? null
  const accommodation = trimmed.match(/(숙박|호텔|리조트)[^\n]{0,120}/)?.[0] ?? null
  const routeTextRaw = trimmed.match(/(이동|탑승|출발|도착)[^\n]{0,180}/)?.[0] ?? null
  return {
    dayIndex,
    rawBlock: trimmed || null,
    summary: trimmed ? trimmed.slice(0, 500) : null,
    dateText,
    city,
    mealInfoRaw: meals,
    hotelInfoRaw: accommodation,
    routeTextRaw,
    visitSpotsRaw: trimmed.match(/(관광|방문|체험)[^\n]{0,220}/)?.[0] ?? null,
  }
}

/**
 * 설계 명세 필드 → DB 계약 `ItineraryDayInput`.
 * - title/summary → summaryTextRaw (제목이 있으면 앞에 붙임)
 */
export function yellowBalloonParsedDayToItineraryDayInput(p: YellowBalloonParsedDayBlock): ItineraryDayInput | null {
  const day = normalizeDay(p.dayIndex)
  if (day == null) return null
  const title = (p.title ?? '').trim()
  const summary = (p.summary ?? '').trim()
  let summaryTextRaw: string | null = null
  if (title && summary) summaryTextRaw = `${title} — ${summary}`
  else summaryTextRaw = title || summary || null

  const rawBlock = (p.rawBlock ?? '').trim()
  /** 금지: rawBlock 없이 summary만 — 원문 블록이 비면 일차 행을 만들지 않는다 */
  if (!rawBlock) return null

  return {
    day,
    dateText: p.dateText?.trim() || null,
    city: p.city?.trim() || null,
    summaryTextRaw,
    poiNamesRaw: p.visitSpotsRaw?.trim() || null,
    meals: p.mealInfoRaw?.trim() || null,
    accommodation: p.hotelInfoRaw?.trim() || null,
    transport: p.routeTextRaw?.trim() || null,
    rawBlock,
  }
}

/**
 * day 오름차순, 동일 day 병합(첫 승), 완전 빈 항목 제거.
 */
export function buildItineraryDayInputs(blocks: YellowBalloonParsedDayBlock[]): ItineraryDayInput[] {
  const mapped = blocks
    .map(yellowBalloonParsedDayToItineraryDayInput)
    .filter((x): x is ItineraryDayInput => x != null)

  const byDay = new Map<number, ItineraryDayInput>()
  for (const row of mapped) {
    const d = row.day
    if (!byDay.has(d)) byDay.set(d, row)
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, v]) => v)
}

/**
 * 일정 탭 기반 ItineraryDayInput[] 수집.
 * 스펙 미확정으로 현재는 항상 빈 배열 + failureReason: unimplemented.
 */
export async function collectYellowBalloonItineraryInputs(
  params: YellowBalloonItineraryCollectParams
): Promise<YellowBalloonItineraryCollectResult> {
  const notes: string[] = []
  const ctx = params.ctx ?? {}
  if ((!ctx.html || !ctx.html.trim()) && params.originUrl?.trim()) {
    try {
      const res = await fetch(params.originUrl, { method: 'GET' })
      if (res.ok) ctx.html = await res.text()
      else notes.push(`itinerary fetch failed: ${res.status}`)
    } catch (e) {
      notes.push(`itinerary fetch error: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  const tab = await openItineraryTab(ctx)
  if (!tab.ok) {
    return {
      days: [],
      meta: {
        notes: [...notes, '일정 탭/일정 텍스트를 찾지 못함'],
        failureReason: 'tab_open_failed',
      },
    }
  }
  const raw = await fetchItineraryHtmlOrState(ctx)
  if (!raw.html?.trim()) {
    return {
      days: [],
      meta: { notes: [...notes, '일정 원문 없음'], failureReason: 'itinerary_raw_unavailable' },
    }
  }
  const blocks = extractDayBlocks(raw.html)
  if (!blocks.length) {
    return {
      days: [],
      meta: { notes: [...notes, '일차 블록 분리 실패'], failureReason: 'day_blocks_unsplitable' },
    }
  }
  const days = buildItineraryDayInputs(blocks)
  return {
    days,
    meta: {
      notes: [...notes, `itinerary parsed days=${days.length}`],
    },
  }
}
