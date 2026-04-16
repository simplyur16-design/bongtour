/**
 * 로컬 검증: npx tsx tools/verify-verygood-description-samples.ts
 */
import { polishVerygoodRegisterScheduleDescriptions } from '@/lib/verygoodtour-schedule-description-polish'
import type { RegisterScheduleDay } from '@/lib/register-llm-schema-verygoodtour'

function R(day: number, description: string): RegisterScheduleDay {
  return {
    day,
    title: '',
    description,
    imageKeyword: '',
    dateText: null,
    hotelText: null,
    breakfastText: null,
    lunchText: null,
    dinnerText: null,
    mealSummaryText: null,
  }
}

const cases: { name: string; rows: RegisterScheduleDay[] }[] = [
  {
    name: '1 관광지 많은 날',
    rows: [
      R(
        1,
        '오전 바르샤바 구시가지 도보 관광 후 와지엔키 공원 내 쇼팽 동상 및 공원 산책 오후 바르샤바 대성당 외관 감상 및 구시가지 자유 관광 저녁 호텔로 복귀'
      ),
    ],
  },
  {
    name: '2 이동 많은 날',
    rows: [
      R(
        1,
        '아침 호텔 출발 비아리스토크로 장거리 이동 중간 휴게소 경유 오후 도착 후 시내 경유하여 호텔 투숙 및 휴식'
      ),
    ],
  },
  {
    name: '3 자유시간 포함',
    rows: [
      R(
        1,
        '호텔 조식 후 바르샤바 최대규모 와지엔키 공원내 쇼팽 공원 산책 자유시간 비르스토나스로 이동 호텔 투숙 및 휴식'
      ),
    ],
  },
  {
    name: '4 항공 귀국일',
    rows: [
      R(1, '트라카이 성 관광 후 빌뉴스 시내 자유시간'),
      R(2, '리가 구시가지 도보 관광'),
      R(3, '호텔 조식 후 공항으로 이동 KE902편 인천국제공항 도착'),
    ],
  },
  {
    name: '5 관광+이동 혼합',
    rows: [
      R(
        1,
        '트라카이 성 관광 후 빌뉴스로 이동 빌뉴스 시내 자유시간 저녁 호텔 투숙'
      ),
    ],
  },
]

for (const c of cases) {
  const before = c.rows.map((r) => ({ ...r, description: r.description }))
  const rowsIn = c.rows.map((r) => ({ ...r }))
  const after = polishVerygoodRegisterScheduleDescriptions(rowsIn)
  console.log('\n===', c.name, '===')
  for (const r of after) {
    const orig = before.find((x) => x.day === r.day)
    if (!orig?.description) continue
    console.log(`[${r.day}일] 원문:`, orig.description)
    console.log(`[${r.day}일] 개선:`, r.description)
  }
}
