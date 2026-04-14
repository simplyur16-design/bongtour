import type { HanjintourDepartureCardSnapshot } from '@/DEV/lib/hanjintour-types'

function dotHmToIso(dot: string, hm: string): string | null {
  const dp = dot.split('.').map((x) => parseInt(x, 10))
  const hmParts = hm.split(':').map((x) => parseInt(x, 10))
  if (dp.length !== 3 || hmParts.length !== 2) return null
  const yy = dp[0]!
  const mm = dp[1]!
  const dd = dp[2]!
  const hh = hmParts[0]!
  const mi = hmParts[1]!
  if (!yy || !mm || !dd || Number.isNaN(hh) || Number.isNaN(mi)) return null
  const y = yy >= 70 ? 1900 + yy : 2000 + yy
  return `${y}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mi).padStart(2, '0')}:00`
}

/** 모달 `product-event__item` 텍스트에서 일시·항공·박일·뱃지·가격 보조 추출 */
export function enrichHanjintourDepartureCardFromRaw(card: HanjintourDepartureCardSnapshot): void {
  const raw = card.raw_card_text.replace(/\s+/g, ' ')
  const tm = raw.match(
    /(\d{2}\.\d{2}\.\d{2})\s*\([^)]{1,12}\)\s*(\d{1,2}:\d{2})\s*~\s*(\d{2}\.\d{2}\.\d{2})\s*\([^)]{1,12}\)\s*(\d{1,2}:\d{2})/
  )
  if (tm) {
    card.departure_datetime = dotHmToIso(tm[1]!, tm[2]!)
    card.return_datetime = dotHmToIso(tm[3]!, tm[4]!)
  }
  const nd = raw.match(/(\d+)박\s*(\d+)일/)
  if (nd) {
    card.trip_nights = parseInt(nd[1]!, 10)
    card.trip_days = parseInt(nd[2]!, 10)
  }
  if (/대한항공/u.test(raw)) {
    card.airline_name = '대한항공'
    card.airline_code = 'KE'
  } else if (/아시아나항공/u.test(raw)) {
    card.airline_name = '아시아나항공'
    card.airline_code = 'OZ'
  }
  const resM = raw.match(/예약인원\s*(\d+)\s*명/)
  if (resM) card.reservation_count = parseInt(resM[1]!, 10)
  const seatM = raw.match(/잔여좌석\s*:\s*(\d+)\s*명/)
  if (seatM) card.remaining_seats = parseInt(seatM[1]!, 10)
  if (/마감/u.test(raw) && !card.status_badges.includes('마감')) card.status_badges.push('마감')
  const ob: string[] = []
  if (/SKYPASS\s*바우처/u.test(raw)) ob.push('SKYPASS 바우처')
  if (/OZ마일샵\s*바우처/u.test(raw)) ob.push('OZ마일샵 바우처')
  if (/현지합류/u.test(raw)) ob.push('현지합류')
  if (/기획특가/u.test(raw)) ob.push('기획특가')
  card.option_badges = ob
  if (card.listed_price == null) {
    const p = raw.match(/(\d{1,3}(?:,\d{3})+|\d{4,7})\s*원/)
    if (p) card.listed_price = parseInt(p[1]!.replace(/,/g, ''), 10)
  }
}
