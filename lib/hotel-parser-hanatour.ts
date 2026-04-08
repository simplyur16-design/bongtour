import type { HotelStructured } from '@/lib/detail-body-parser-types'
import { parseHotelSectionGeneric } from '@/lib/hotel-table-parser-hanatour'

const HANATOUR_HOTEL_POLICY =
  /(?:^|[\s,])(?:2인\s*1실|1인\s*1실|트윈|더블|싱글|엑스트라\s*베드|엑베|유럽\s*호텔|객실\s*기준|룸\s*타입|조식\s*불포함|체크인|체크아웃)/i

const HANATOUR_PURE_POLICY =
  /^(?:※|▶|\*|•|-)?\s*(?:2인\s*1실|객실\s*기준|엑스트라|유럽\s*호텔|트윈|더블|싱글)/i

/** `태국(푸껫)` 한 줄 + 다음 줄 호텔명 붙여넣기 */
const HANATOUR_REGION_ONLY_LINE = /^[가-힣A-Za-z0-9]{1,28}\([^)]{1,28}\)\s*$/

function lineLooksLikeHanatourHotelNameAfterRegion(l: string): boolean {
  const t = l.replace(/\s+/g, ' ').trim()
  if (!t || t.length < 2 || t.length > 120) return false
  if (HANATOUR_REGION_ONLY_LINE.test(t)) return false
  if (HANATOUR_PURE_POLICY.test(t) && !/(호텔|리조트|숙소)/i.test(t)) return false
  return (
    /(호텔|리조트|숙소|콘도|HOTEL|INN|RESORT|윈덤|메리어트|Marriott|그랜드|시티|팰리스|코트야드|Courtyard)/i.test(
      t
    ) || (/^[A-Za-z가-힣]/.test(t) && t.length < 72 && !/^만\s*\d+/.test(t))
  )
}

function mergeHanatourHotelRegionHotelLines(section: string): string {
  const lines = section
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i]!
    const b = lines[i + 1]
    if (a && b && HANATOUR_REGION_ONLY_LINE.test(a) && lineLooksLikeHanatourHotelNameAfterRegion(b)) {
      out.push(`${a} ${b}`)
      i++
      continue
    }
    if (a) out.push(a)
  }
  return out.join('\n')
}

/** 호텔명처럼 보이는 짧은 토큰(후보) */
function lineLooksLikeHotelNameToken(l: string): boolean {
  const t = l.replace(/\s+/g, ' ').trim()
  if (t.length < 4 || t.length > 120) return false
  if (HANATOUR_PURE_POLICY.test(t) && !/(호텔|리조트|숙소)/i.test(t)) return false
  return /(호텔|리조트|숙소|콘도|HOTEL|INN|RESORT)/i.test(t) || /^[A-Za-z][A-Za-z0-9\s·\-]{3,50}$/.test(t)
}

/**
 * 하나투어: 예정호텔 후보 / 일차 행은 유지하고, 정책·장문 설명은 note로 분리한다.
 */
export function parseHotelSectionHanatour(section: string): HotelStructured {
  const merged = mergeHanatourHotelRegionHotelLines(section)
  const base = parseHotelSectionGeneric(merged)
  const policyLines = merged
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .filter((l) => HANATOUR_HOTEL_POLICY.test(l) && !lineLooksLikeHotelNameToken(l))

  const policyBlob = policyLines.length ? policyLines.slice(0, 12).join('\n') : ''

  let policyAttached = false
  const rows = base.rows
    .map((r) => {
      let hotelNameText = r.hotelNameText
      let noteText = r.noteText ?? ''
      const hn = hotelNameText.replace(/\s+/g, ' ').trim()
      if (hn.length > 100 && HANATOUR_HOTEL_POLICY.test(hn)) {
        const cut = hn.slice(0, 80).replace(/\s+\S*$/, '').trim()
        const rest = hn.slice(cut.length).trim()
        if (cut.length >= 6 && /(호텔|리조트|숙소)/i.test(cut)) {
          hotelNameText = cut
          noteText = [rest, noteText].filter(Boolean).join('\n')
        } else if (policyBlob && !policyAttached) {
          noteText = [policyBlob, noteText].filter(Boolean).join('\n')
          policyAttached = true
        }
      } else if (policyBlob && !noteText && !policyAttached) {
        noteText = policyBlob
        policyAttached = true
      }
      const candidates = r.hotelCandidates.filter((c) => {
        const x = c.replace(/\s+/g, ' ').trim()
        if (x.length > 140) return false
        if (HANATOUR_PURE_POLICY.test(x) && !/(호텔|리조트)/i.test(x)) return false
        return true
      })
      return {
        ...r,
        hotelNameText,
        hotelCandidates: candidates.length ? candidates : r.hotelCandidates,
        noteText: noteText || undefined,
      }
    })
    .filter((r) => {
      const hn = r.hotelNameText.replace(/\s+/g, ' ').trim()
      if (!hn) return false
      if (hn.length > 200 && !/(호텔|리조트|숙소)/i.test(hn)) return false
      if (HANATOUR_PURE_POLICY.test(hn) && !/(호텔|리조트|숙소|일차|day)/i.test(hn)) return false
      return true
    })

  return {
    rows,
    reviewNeeded: rows.length === 0,
    reviewReasons:
      rows.length === 0
        ? ['호텔 섹션이 있으나 row 복원 실패']
        : rows.some((r) => r.hotelCandidates.length > 1)
          ? ['호텔명 후보 다수']
          : [],
  }
}
