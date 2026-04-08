/**
 * `DetailBodyParseSnapshot`의 항공·선택관광·쇼핑 필드용 **빈 껍데기**.
 * 본문 파서(`detail-body-parser-*`)는 섹션 슬라이스·`raw.*`만 채우고, 이 축의 구조화는
 * `register-input-parse-*` + `register-parse-*`가 담당한다.
 */
import type { FlightStructured, OptionalToursStructured, ShoppingStructured } from '@/lib/detail-body-parser-types'

export function emptyFlightStructured(): FlightStructured {
  const leg = {
    departureAirport: null,
    departureAirportCode: null,
    departureDate: null,
    departureTime: null,
    arrivalAirport: null,
    arrivalAirportCode: null,
    arrivalDate: null,
    arrivalTime: null,
    flightNo: null,
    durationText: null,
  }
  return {
    airlineName: null,
    outbound: { ...leg },
    inbound: { ...leg },
    rawFlightLines: [],
    reviewNeeded: false,
    reviewReasons: [],
  }
}

export function emptyOptionalToursStructured(): OptionalToursStructured {
  return { rows: [], reviewNeeded: false, reviewReasons: [] }
}

export function emptyShoppingStructured(): ShoppingStructured {
  return { rows: [], shoppingCountText: '', reviewNeeded: false, reviewReasons: [] }
}
