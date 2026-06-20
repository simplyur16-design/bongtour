/**
 * SupplierRegisterFactBundle → 등록 LLM용 붙여넣기 본문(사실만, 재서술은 LLM).
 */
import type { SupplierRegisterFactBundle } from '@/lib/register-facts/types'

function lines(title: string, items: string[]): string {
  if (items.length === 0) return ''
  return `${title}\n${items.map((x) => `- ${x}`).join('\n')}\n`
}

export function registerFactBundleToPasteText(bundle: SupplierRegisterFactBundle): string {
  const parts: string[] = []
  if (bundle.title) parts.push(bundle.title)
  if (bundle.nights != null || bundle.days != null) {
    parts.push(`여행기간: ${bundle.nights ?? '?'}박 ${bundle.days ?? '?'}일`)
  }
  if (bundle.originCode) parts.push(`상품코드: ${bundle.originCode}`)
  parts.push(`출처 URL: ${bundle.originUrl}`)

  const incl = lines('포함사항', bundle.includedBullets)
  const excl = lines('불포함사항', bundle.excludedBullets)
  if (incl) parts.push(incl.trimEnd())
  if (excl) parts.push(excl.trimEnd())
  if (bundle.meetingInfo?.trim()) parts.push(`미팅정보\n${bundle.meetingInfo.trim()}`)
  if (bundle.shoppingPlaces.length) parts.push(lines('쇼핑', bundle.shoppingPlaces).trimEnd())

  if (bundle.flights.length) {
    parts.push(
      '항공\n' +
        bundle.flights
          .map((f) =>
            [
              f.direction === 'outbound' ? '출국' : f.direction === 'inbound' ? '귀국' : '항공',
              f.carrier,
              f.flightNo,
              f.departureCity,
              f.departureAt,
              '→',
              f.arrivalCity,
              f.arrivalAt,
            ]
              .filter(Boolean)
              .join(' '),
          )
          .join('\n'),
    )
  }

  if (bundle.scheduleDays.length) {
    parts.push(
      '여행일정\n' +
        bundle.scheduleDays
          .map((d) => {
            const seg = [
              `${d.day}일차`,
              d.places.length ? d.places.join(' · ') : null,
              d.hotels.length ? `호텔: ${d.hotels.join(', ')}` : null,
              d.meals.length ? `식사: ${d.meals.join(', ')}` : null,
              d.transportNote,
            ]
              .filter(Boolean)
              .join(' | ')
            return seg
          })
          .join('\n'),
    )
  }

  if (bundle.priceRows.length) {
    const first = bundle.priceRows[0]
    if (bundle.supplier === 'hanatour' && first) {
      const adult = first.adultPrice != null ? `${first.adultPrice.toLocaleString('ko-KR')}원` : '-'
      const child = first.childPrice != null ? `${first.childPrice.toLocaleString('ko-KR')}원` : '-'
      const infant = first.infantPrice != null ? `${first.infantPrice.toLocaleString('ko-KR')}원` : '-'
      parts.push(`상품가격\n기본상품\t성인 ${adult}\t아동 ${child}\t유아 ${infant}`)
    }
    parts.push(
      '출발일 가격\n' +
        bundle.priceRows
          .slice(0, 24)
          .map((r) =>
            [
              r.departureDate,
              r.adultPrice != null ? `성인 ${r.adultPrice.toLocaleString('ko-KR')}원` : null,
              r.childPrice != null ? `아동 ${r.childPrice.toLocaleString('ko-KR')}원` : null,
              r.infantPrice != null ? `유아 ${r.infantPrice.toLocaleString('ko-KR')}원` : null,
              r.statusRaw ? `상태 ${r.statusRaw}` : null,
              r.seatCount != null ? `잔여 ${r.seatCount}석` : r.seatsStatusRaw ? r.seatsStatusRaw : null,
              r.minPax != null ? `최소 ${r.minPax}명` : null,
              r.carrierName ? `항공 ${r.carrierName}` : null,
            ]
              .filter(Boolean)
              .join(' '),
          )
          .join('\n'),
    )
  }

  return parts.filter((p) => p.trim()).join('\n\n')
}
