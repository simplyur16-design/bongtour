/**
 * 한진투어 일정 description에서 항공·쇼핑 덩어리 제거 및 1일차·막일 짧은 문장 치환.
 */
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-ybtour'

function firstSentences(text: string, maxSentences: number): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const parts = t.split(/(?<=[.!?。])\s+/).filter(Boolean)
  return parts.slice(0, maxSentences).join(' ').trim()
}

function stripFlightShoppingNoise(s: string): string {
  let t = s.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  t = t.replace(/\[[A-Z]{1,3}\d{2,5}[^\]]*\]/gi, ' ')
  t = t.replace(/\b[A-Z]{1,3}\d{3,4}[A-Z]?\b/gi, ' ')
  t = t.replace(/총\s*\d{1,2}\s*시간\s*\d{1,2}\s*분\s*소요/giu, ' ')
  t = t.replace(/총\s*\d{1,2}\s*시간\s*\d{1,2}\s*분/giu, ' ')
  t = t.replace(/\d{1,2}\s*시간\s*\d{1,2}\s*분\s*소요/giu, ' ')
  t = t.replace(/탑승\s*수속/giu, ' ')
  t = t.replace(/\d{2}\.\d{2}\.\d{2}\s*\([^)]+\)\s*(?:[01]?\d|2[0-3]):[0-5]\d/g, ' ')
  t = t.replace(/\b(?:ICN|JFK|LAX|GMP|PUS|TAG|CUN)\b/gi, ' ')
  t = t.replace(/서울\s*\(ICN\)|인천\s*국제공항|김포/giu, ' ')
  t = t.replace(/대한항공|아시아나|진에어|티웨이|에어부산|OZ|KE|LJ\d*/giu, ' ')
  t = t.replace(/화살표|입국신고|세관검사|기내|터미널|탑승구|게이트/giu, ' ')
  t = t.replace(/쇼핑\s*\d+\s*회|면세점|쇼핑\s*장소|쇼핑\s*품목/giu, ' ')
  t = t.replace(/[가-힣A-Za-z·/\s]+\(\s*\)/gu, ' ')
  t = t.replace(/\b\d{1,2}:\d{2}\b/g, ' ')
  return t.replace(/\s{2,}/g, ' ').trim()
}

function tailNonAirHint(s: string): string {
  const t = stripFlightShoppingNoise(s)
  const hotel = t.match(/숙박정보[^.]{0,200}/u)
  const meet = t.match(/가이드\s*미팅[^.]{0,120}/u)
  const parts = [hotel?.[0], meet?.[0]].filter(Boolean) as string[]
  return parts.join(' ').trim()
}

export function polishHanjintourScheduleDescriptions(
  days: RegisterScheduleDay[],
  tripDays: number | null | undefined
): RegisterScheduleDay[] {
  const maxDay = Math.max(0, ...days.map((d) => d.day))
  const last = tripDays && tripDays > 0 ? tripDays : maxDay

  return days.map((row) => {
    const raw = (row.description ?? '').trim()
    const stripped = stripFlightShoppingNoise(raw)
    let desc = firstSentences(stripped, 3)

    if (row.day === 1) {
      const hint = tailNonAirHint(raw)
      if (stripped.length < 40 && hint) desc = firstSentences(hint, 2)
      else if (/ICN|JFK|KE\d|LJ\d|편|소요|공항|출발|도착|화살표/u.test(raw)) {
        desc =
          '출국 항공편으로 이동 후 현지에 도착합니다. 안내에 따라 가이드 미팅 후 숙소로 이동합니다.' +
          (hint ? ` ${firstSentences(hint, 1)}` : '')
      }
      if (desc.length > 160 || /숙박정보/.test(desc) && desc.indexOf('숙박정보') !== desc.lastIndexOf('숙박정보')) {
        desc = '출국 항공편으로 이동해 현지에 도착합니다. 안내에 따라 가이드 미팅 후 숙소로 이동합니다.'
      }
    } else if (last > 0 && row.day === last) {
      if (/인천|ICN|귀국|출발\s*편|공항으로/u.test(raw)) {
        desc = '공항으로 이동하여 귀국편에 탑승합니다. 인천국제공항에 도착합니다.'
      } else {
        desc = firstSentences(stripped, 3) || desc
      }
    } else if (last > 1 && row.day === last - 1 && /탑승|수속|ICN|서울\s*\(|00\s*:\s*\d{2}/u.test(raw)) {
      desc = '귀국 전 이동·탑승 준비 일정입니다. 항공·시각은 전용 항공 입력란을 확인합니다.'
    } else {
      desc = firstSentences(stripped, 3)
    }

    return { ...row, description: desc.trim() }
  })
}
