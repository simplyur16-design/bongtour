/**
 * 관리자 상품등록 항공 입력란 — 공급사별 결정적 파서 스모크(LLM 없음).
 */
import { parseFlightSectionHanatour } from '@/lib/flight-parser-hanatour'
import { parseFlightSectionModetour } from '@/lib/flight-parser-modetour'
import { parseFlightSectionVerygoodtour } from '@/lib/flight-parser-verygoodtour'
import { parseFlightSectionYbtour } from '@/lib/flight-parser-ybtour'

function main() {
  const h = parseFlightSectionHanatour(
    `이스타항공

출발 : 2026.05.01(금) 20:25 2026.05.02(토) 01:15 ZE0535총 05시간 50분 소요

도착 : 2026.05.05(화) 02:20 2026.05.05(화) 08:40 ZE0536총 05시간 20분 소요`,
    null
  )
  console.log('HANA', h.debug?.status, h.airlineName, h.outbound.flightNo, h.inbound.flightNo)

  const m = parseFlightSectionModetour(
    `티웨이항공
출발 : 인천 2026.05.30(토) 12:35 → 로마-피우미치노 2026.05.30(토) 19:15 TW405
도착 : 로마-피우미치노 2026.06.06(토) 21:15 → 인천 2026.06.07(일) 16:10 TW406`,
    null
  )
  console.log('MODE', m.debug?.status, m.airlineName, m.outbound, m.inbound)

  const vgText = `3박4일티웨이항공 티웨이항공 '출·도착 시각은 현지 시각 기준이며, 항공기 스케줄은 정부인가 조건으로 항공사 및 공항 사정에 의하여 예고 없이 변경 될 수 있습니다항공여정보기 출발일변경
출국
2026.05.04 (월) 11:10 인천 출발

2026.05.04 (월) 13:00 도야마 도착

입국
2026.05.07 (목) 18:00 도야마 출발

2026.05.07 (목) 20:20 인천 도착`
  const vg = parseFlightSectionVerygoodtour(vgText, null)
  console.log('VG', vg.debug?.status, vg.airlineName, JSON.stringify(vg.outbound), JSON.stringify(vg.inbound), vg.reviewReasons)

  const yb = parseFlightSectionYbtour(
    `출발
에어서울
에어서울
RS511
인천
2026.04.26 (일) 20:55
다낭
2026.04.26 (일) 23:40
도착
에어서울
에어서울
RS512
다낭
2026.04.30 (목) 00:40
인천
2026.04.30 (목) 07:15`,
    null
  )
  console.log('YB', yb.debug?.status, yb.airlineName, JSON.stringify(yb.outbound), JSON.stringify(yb.inbound))
}

main()
