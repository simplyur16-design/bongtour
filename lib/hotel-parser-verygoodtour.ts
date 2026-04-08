import type { HotelStructured } from '@/lib/detail-body-parser-types'
import { parseHotelSectionGeneric } from '@/lib/hotel-table-parser-verygoodtour'

/** 참좋은: 일차별 호텔 표 없이 일급·실별·미정 안내만 — 표로 억지 변환하지 않음 */
function verygoodTourPolicyOrUndecidedHotelBody(section: string): boolean {
  if (/\d+\s*일차/i.test(section)) return false
  const t = section.replace(/\s+/g, ' ')
  if (
    /(숙박\s*시설|숙박시설).{0,120}미정|출발\s*전까지|출발\s*\d+\s*~\s*\d+\s*일\s*전까지|담당자\s*를\s*통해\s*안내|홈페이지.{0,60}안내|안내\s*드립니다/i.test(
      t
    )
  )
    return true
  if (/전\s*일정.{0,50}일급|일급\s*호텔/i.test(t) && /(2인\s*1실|3인\s*1실|미정|어린이|소아)/i.test(t)) return true
  return false
}

export function parseHotelSectionVerygoodtour(section: string): HotelStructured {
  if (verygoodTourPolicyOrUndecidedHotelBody(section)) {
    return { rows: [], reviewNeeded: false, reviewReasons: [] }
  }
  return parseHotelSectionGeneric(section)
}
