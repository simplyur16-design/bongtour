/**
 * LLM 없이 결정론 파서만 스모크 (verygood / ybtour).
 * 실행: npx tsx scripts/dev-verify-supplier-register-smoke.ts
 */
import { parseFlightSectionYbtour } from '@/lib/flight-parser-ybtour'
import { extractVerygoodScheduleRowsFromPasteBody } from '@/lib/verygoodtour-schedule-blocks-from-paste'
import { buildYbtourScheduleFromPastedText } from '@/lib/parse-and-register-ybtour-schedule'
import { parseYbtourTravelMainScheduleFlightFromTable } from '@/lib/flight-ybtour-blocks'

const YB_SAMPLE = `
여행 주요일정
출발
스칸디나비아항공
SK988
인천
2026.07.15 (수) 23:45
로마
2026.07.16 (목) 11:05
도착
스칸디나비아항공
SK987
파리
2026.07.23 (목) 20:10
인천
2026.07.24 (금) 19:00
예약현황
`

const VG_SAMPLE = `
1일차
2026년 07월 15일 (수)
인천-런던
2일차
2026년 07월 16일 (목)
런던
3일차
2026년 07월 17일 (금)
런던
4일차
2026년 07월 18일 (토)
런던
5일차
2026년 07월 19일 (일)
런던
6일차
2026년 07월 20일 (월)
런던
7일차
2026년 07월 21일 (화)
인천
`

function main() {
  const table = parseYbtourTravelMainScheduleFlightFromTable(YB_SAMPLE)
  const flight = parseFlightSectionYbtour('', YB_SAMPLE)
  const ybDays = buildYbtourScheduleFromPastedText(
    `${YB_SAMPLE}\n여행 일정\n1일차\n2026.07.15(수) - 인천\n10일차\n2026.07.24(금) - 인천`
  )
  const vg = extractVerygoodScheduleRowsFromPasteBody(VG_SAMPLE)

  console.log(
    JSON.stringify(
      {
        ybtour: {
          tableOutbound: table?.outbound?.flightNo ?? null,
          tableInbound: table?.inbound?.flightNo ?? null,
          flightStructuredOutbound: flight.outbound?.flightNo ?? null,
          flightStructuredInbound: flight.inbound?.flightNo ?? null,
          airline: flight.airlineName ?? null,
          ybDayCount: ybDays.length,
        },
        verygood: {
          rowCount: vg.rows.length,
          day1: vg.rows[0]?.dateText ?? null,
          day7: vg.rows[vg.rows.length - 1]?.dateText ?? null,
        },
      },
      null,
      2
    )
  )
}

main()
