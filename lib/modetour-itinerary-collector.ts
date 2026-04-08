import type { ItineraryDayInput } from '@/lib/upsert-itinerary-days-modetour'
import { normalizeDay } from '@/lib/upsert-itinerary-days-modetour'

export type ModetourItineraryCollectParams = {
  detailUrl: string
}

export type ModetourItineraryCollectResult = {
  days: ItineraryDayInput[]
  notes: string[]
}

function stripTags(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '\n')
}

function parseDayBlocks(html: string): Array<{ day: number; rawBlock: string }> {
  const text = stripTags(html)
  const chunks = text
    .split(/(?=(?:^|\n)\s*(?:DAY\s*)?\d+\s*(?:일차|일))/i)
    .map((x) => x.trim())
    .filter(Boolean)
  const out: Array<{ day: number; rawBlock: string }> = []
  for (const c of chunks) {
    const m = c.match(/(?:DAY\s*)?(\d+)\s*(?:일차|일)/i)
    const day = normalizeDay(Number(m?.[1] ?? 0))
    if (!day) continue
    out.push({ day, rawBlock: c })
  }
  return out
}

function blockToDayInput(block: { day: number; rawBlock: string }): ItineraryDayInput | null {
  const raw = block.rawBlock.trim()
  if (!raw) return null
  const dateText = raw.match(/(20\d{2}[.\-/]\d{1,2}[.\-/]\d{1,2}|\d{1,2}월\s*\d{1,2}일)/)?.[1] ?? null
  const city =
    raw.match(
      /(도쿄|오사카|교토|나라|고베|후쿠오카|삿포로|부산|서울|제주|타이페이|방콕|다낭|하노이|홍콩|마카오)/
    )?.[1] ?? null
  const meals = raw.match(/(조식[^\n]{0,80}|중식[^\n]{0,80}|석식[^\n]{0,80})/)?.[1] ?? null
  const accommodation = raw.match(/(숙박|호텔|리조트)[^\n]{0,120}/)?.[0] ?? null
  const transport = raw.match(/(이동|탑승|출발|도착)[^\n]{0,160}/)?.[0] ?? null
  const poiNamesRaw = raw.match(/(관광|방문|체험)[^\n]{0,220}/)?.[0] ?? null
  return {
    day: block.day,
    dateText,
    city,
    summaryTextRaw: raw.slice(0, 500),
    poiNamesRaw,
    meals,
    accommodation,
    transport,
    rawBlock: raw,
  }
}

export async function collectModetourItineraryInputs(
  params: ModetourItineraryCollectParams
): Promise<ModetourItineraryCollectResult> {
  const notes: string[] = []
  const res = await fetch(params.detailUrl, {
    method: 'GET',
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'ko-KR',
    },
  })
  if (!res.ok) return { days: [], notes: [`detail fetch failed: ${res.status}`] }
  const html = await res.text()
  const blocks = parseDayBlocks(html)
  if (!blocks.length) return { days: [], notes: ['itinerary day blocks not found'] }
  const byDay = new Map<number, ItineraryDayInput>()
  for (const b of blocks) {
    const input = blockToDayInput(b)
    if (!input) continue
    if (!byDay.has(input.day)) byDay.set(input.day, input)
  }
  const days = [...byDay.values()].sort((a, b) => a.day - b.day)
  notes.push(`itinerary parsed days=${days.length}`)
  return { days, notes }
}
