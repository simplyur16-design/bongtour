/**
 * 노랑풍선 호텔: 미정·설명형 허용, 상품소개/싱글/가이드경비는 호텔명에서 분리.
 */
import type { HotelStructured } from '@/lib/detail-body-parser-types'
import { parseHotelSectionGeneric } from '@/lib/hotel-table-parser-ybtour'

const YB_HOTEL_META =
  /(싱글\s*차지|가이드\s*경비|인솔자\s*동행|상품\s*소개|특전\s*안내|쿠폰\s*적용|적립\s*포인트)/i

const YB_DESC_ONLY =
  /^(?:※|▶|\*|•|-)?\s*(?:미정|동급|예정\s*호텔|지역\s*호텔|숙박\s*은|투숙\s*호텔)/i

export function parseHotelSectionYbtour(section: string): HotelStructured {
  const base = parseHotelSectionGeneric(section)
  let noteAttached = false
  const rows = base.rows
    .map((r) => {
      let hotelNameText = r.hotelNameText.replace(/\s+/g, ' ').trim()
      let noteText = r.noteText ?? ''
      if (YB_HOTEL_META.test(hotelNameText) && hotelNameText.length > 60) {
        const cut = hotelNameText.split(/[.!?。]/)[0]?.slice(0, 90).trim() ?? hotelNameText.slice(0, 60)
        if (cut.length >= 4) {
          noteText = [hotelNameText.slice(cut.length).trim(), noteText].filter(Boolean).join('\n')
          hotelNameText = cut
        }
      }
      if (YB_DESC_ONLY.test(hotelNameText) && !/(호텔|리조트|숙소)/i.test(hotelNameText)) {
        noteText = [hotelNameText, noteText].filter(Boolean).join('\n')
        hotelNameText = hotelNameText.slice(0, 40) || '숙박(설명형)'
      }
      return { ...r, hotelNameText, noteText: noteText || undefined }
    })
    .filter((r) => {
      const hn = r.hotelNameText.trim()
      if (!hn) return false
      if (YB_HOTEL_META.test(hn) && !/(호텔|리조트|숙소|미정|동급|일차)/i.test(hn)) return false
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
