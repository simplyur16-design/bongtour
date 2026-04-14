/**
 * 한진투어 본문에서 schedule[] 추출 — 필드 스키마는 RegisterScheduleDay SSOT 준수.
 * 입력은 운영자가 붙여넣은 상세 본문(HTML 또는 플레인)으로 가정한다.
 */
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-ybtour'

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstSentences(text: string, maxSentences: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const parts = t.split(/(?<=[.!?。])\s+/).filter(Boolean)
  return parts.slice(0, maxSentences).join(' ').trim()
}

/** 관광지/장소 후보: 괄호 안 지명, 또는 「」 */
function pickImageKeyword(block: string, title: string): string {
  const fromBrackets = block.match(/[「『]([^」』]{2,40})[」』]/)
  if (fromBrackets?.[1]) return fromBrackets[1].trim()
  const paren = title.match(/\(([^)]{2,40})\)/)
  if (paren?.[1] && !/^\d+일차$/u.test(paren[1])) return paren[1].trim()
  const city = block.match(
    /(?:방문|관광|이동|체류)\s*[：:]\s*([가-힣A-Za-z·,\s]{2,30})/u
  )
  if (city?.[1]) return city[1].split(/[,，]/)[0]!.trim()
  const tail = title.replace(/^\d+일차\s*/u, '').trim()
  if (tail.length >= 2 && tail.length <= 40) return tail
  return '일정'
}

function parseMealLine(block: string, label: string): string | null {
  const re = new RegExp(`${label}\\s*[：:]\\s*([^\\n]+)`, 'u')
  const m = block.match(re)
  return m?.[1]?.trim() || null
}

function pickHotelText(block: string): string | null {
  const h = parseMealLine(block, '호텔') ?? parseMealLine(block, '숙소')
  if (h) return h.length > 400 ? h.slice(0, 400) : h
  const m = block.match(/숙박정보\s+([\s\S]{0,600}?)(?=\s*식사정보|\s*조식\s*[：:]|$)/u)
  const t = m?.[1]?.replace(/\s+/g, ' ').trim()
  return t ? t.slice(0, 400) : null
}

/** 선택관광·쇼핑·약관 등 일정 본문과 섞이면 안 되는 줄 제거 */
function stripNonItineraryLines(text: string): string {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false
      if (/선택\s*관광|옵션\s*관광|별도\s*경비\s*현지\s*지불/u.test(l)) return false
      if (/쇼핑\s*\d+\s*회|^쇼핑\s*[：:]|면세점|쇼핑\s*장소/u.test(l)) return false
      if (/유의\s*사항|여행\s*약관|※\s*본\s*상품|환불\s*불가/u.test(l)) return false
      return true
    })
    .join('\n')
}

/**
 * `N일차` 블록으로 분할해 일정 행을 만든다.
 * 항공편·미팅만 반복되는 줄은 description 비중을 낮추기 위해 앞부분만 사용한다.
 */
export function parseHanjintourScheduleFromBody(bodyText: string): RegisterScheduleDay[] {
  const text = stripNonItineraryLines(
    bodyText.replace(/\r\n/g, '\n').replace(/제\s*(\d+)\s*일차/gu, '$1일차')
  )
  /** trailing `\b`는 한글 접미와의 경계에서 실패할 수 있어 생략 */
  const dayStarts = [...text.matchAll(/(\d+)\s*일차/gu)]
  if (dayStarts.length === 0) return []

  /** 표 머리글 등 짧은 `N일차` 중복은 같은 일차에서 가장 긴 블록만 채택 */
  const bestBlockByDay = new Map<number, { block: string; titleLine: string }>()
  for (let i = 0; i < dayStarts.length; i++) {
    const m = dayStarts[i]!
    const dayNum = Number(m[1])
    if (!Number.isFinite(dayNum) || dayNum < 1) continue
    const start = m.index ?? 0
    const end = i + 1 < dayStarts.length ? (dayStarts[i + 1]!.index ?? text.length) : text.length
    const block = text.slice(start, end).trim()
    const nl = text.indexOf('\n', start)
    const titleLine = (nl > start ? text.slice(start, nl) : (m[0] ?? `${dayNum}일차`)).trim()
    const prev = bestBlockByDay.get(dayNum)
    if (!prev || block.length > prev.block.length) bestBlockByDay.set(dayNum, { block, titleLine })
  }

  const days: RegisterScheduleDay[] = []
  for (const dayNum of Array.from(bestBlockByDay.keys()).sort((a, b) => a - b)) {
    const { block, titleLine } = bestBlockByDay.get(dayNum)!
    const rest = block.replace(/^\d+\s*일차[^\n]*\n?/u, '').trim()
    const hotelText = pickHotelText(rest)
    const breakfastText = parseMealLine(rest, '조식') ?? parseMealLine(rest, '아침')
    const lunchText = parseMealLine(rest, '중식') ?? parseMealLine(rest, '점심')
    const dinnerText = parseMealLine(rest, '석식') ?? parseMealLine(rest, '저녁')
    const mealBits = [breakfastText, lunchText, dinnerText].filter(Boolean).join(' / ')
    const mealSummaryText = mealBits || null

    const noisePrefixes = /^(항공|공항|터미널|미팅|기내|출발|도착)/u
    const lines = rest
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !noisePrefixes.test(l))
    const descSource = lines.join(' ').trim() || rest
    const description = firstSentences(descSource, 3)

    days.push({
      day: dayNum,
      title: titleLine.slice(0, 200),
      description,
      imageKeyword: pickImageKeyword(rest, titleLine),
      hotelText,
      breakfastText,
      lunchText,
      dinnerText,
      mealSummaryText,
    })
  }
  return days.sort((a, b) => a.day - b.day)
}

export function parseHanjintourScheduleFromHtml(detailHtml: string): RegisterScheduleDay[] {
  return parseHanjintourScheduleFromBody(stripTags(detailHtml))
}
