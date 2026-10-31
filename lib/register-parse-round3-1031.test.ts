/**
 * REGRESSION-FREEZE[register-parse-round3-1031]: round3-1031(봉실장 10/31 21:03) — 제목 도시 대안·귀국일 제목·빈말 0·Gemini 키워드 사후 검사·장소 없는 날 사진 제외·사람 주인공 필터
 */
import { describe, expect, it } from 'vitest'
import {
  finalizeRegisterPackageScheduleRows,
  isRegisterScheduleFillerSentence,
  isRegisterScheduleNoPlacePhotoDay,
  registerScheduleDestinationCityLabel,
  type RegisterScheduleFinalizeRow,
} from '@/lib/register-schedule-day-summary-finalize'
import { personIsMainSubject } from '@/lib/register-photo-match-gate'

const row = (r: Partial<RegisterScheduleFinalizeRow> & { day: number }): RegisterScheduleFinalizeRow =>
  ({ title: '', description: '', routeText: '', hotelText: '', imageKeyword: '', imageKeyword2: null, ...r }) as RegisterScheduleFinalizeRow

describe('round3 제목', () => {
  it("장소 없는 1일차는 목적지 도시를 제목으로 — '1일차'만 남기지 않음", () => {
    const out = finalizeRegisterPackageScheduleRows(
      [
        row({ day: 1, title: '1일차', routeText: '', hotelText: 'HOLIDAY INN', imageKeyword: 'Zurich' }),
        row({ day: 2, title: '그로스뮌스터 대성당', routeText: '그로스뮌스터 대성당', hotelText: 'HOTEL A', imageKeyword: 'Grossmunster' }),
        row({ day: 3, title: '숙박 없음(귀국)', routeText: '' }),
      ],
      { destination: '취리히' }
    )
    expect(out[0].title).not.toBe('1일차')
    expect(out[0].title).toMatch(/취리히/)
  })

  it("귀국일 제목은 '<마지막 도시> 출발 · 귀국'", () => {
    const out = finalizeRegisterPackageScheduleRows(
      [
        row({ day: 1, title: '푸꾸옥', routeText: '인천 - 푸꾸옥', hotelText: '노보텔 호텔', imageKeyword: 'Phu Quoc' }),
        row({ day: 2, title: '사오 비치', routeText: '푸꾸옥 - 사오 비치', hotelText: '노보텔 호텔', imageKeyword: 'Sao Beach' }),
        row({ day: 3, title: '숙박 없음(귀국)', routeText: '', imageKeyword: 'Phu Quoc' }),
      ],
      { destination: '푸꾸옥', sourceRows: [{ day: 3, description: '체크아웃 후 인천으로 귀국합니다.' }] }
    )
    expect(out[2].title).toBe('푸꾸옥 출발 · 귀국')
    expect(out[2].description).toContain('체크아웃 후 인천으로 귀국합니다.')
  })

  it('registerScheduleDestinationCityLabel — 목적지 도시 한글', () => {
    expect(registerScheduleDestinationCityLabel('푸꾸옥')).toBe('푸꾸옥')
  })
})

describe('round3 빈말', () => {
  it.each(['1일차 구간을 이어서 둘러봅니다.', '파리 구간을 둘러봅니다.', '3일차 일정을 이어갑니다.'])('빈말 판정: %s', (s) => {
    expect(isRegisterScheduleFillerSentence(s)).toBe(true)
  })
  it("'공항 이동을 둘러봅니다'·'호텔을 둘러봅니다' 같은 문장을 만들지 않음", () => {
    const out = finalizeRegisterPackageScheduleRows(
      [
        row({ day: 1, title: '다낭', routeText: '인천 - 다낭 공항 이동 - 호텔', description: '다낭 공항 이동과 호텔을 둘러봅니다. 1일차 구간을 이어서 둘러봅니다.', hotelText: '호텔', imageKeyword: 'Da Nang' }),
        row({ day: 2, title: '숙박 없음(귀국)', routeText: '' }),
      ],
      { destination: '다낭' }
    )
    const d = out.map((r) => String(r.description)).join(' ')
    expect(d).not.toMatch(/공항 이동[^.]*둘러봅니다|호텔을 둘러봅니다|구간을\s*(이어서\s*)?둘러봅니다/)
  })
})

describe('round3 Gemini 키워드 사후 검사', () => {
  it('그날 장소가 아닌 키워드2는 지움(hn-2 Grand World)', () => {
    const out = finalizeRegisterPackageScheduleRows(
      [
        row({ day: 1, title: '푸꾸옥', routeText: '인천 - 푸꾸옥', hotelText: 'H', imageKeyword: 'Phu Quoc' }),
        row({ day: 2, title: '혼똔섬 케이블카', routeText: '혼똔섬 케이블카 - 혼똔섬 워터파크', hotelText: 'H', imageKeyword: 'Phu Quoc Hon Thom Cable Car', imageKeyword2: 'Phu Quoc Grand World' }),
        row({ day: 3, title: '숙박 없음(귀국)', routeText: '' }),
      ],
      { destination: '푸꾸옥' }
    )
    expect(out[1].imageKeyword2 ?? '').not.toMatch(/Grand World/)
  })
  it('공항 키워드는 출발·귀국일이 아니면 그날 장소로 바꿈', () => {
    const out = finalizeRegisterPackageScheduleRows(
      [
        row({ day: 1, title: '삿포로', routeText: '인천 - 삿포로', hotelText: 'H', imageKeyword: 'Sapporo' }),
        row({ day: 2, title: '오타루 운하', routeText: '오타루 운하', hotelText: 'H', imageKeyword: 'New Chitose Airport Hokkaido' }),
        row({ day: 3, title: '숙박 없음(귀국)', routeText: '' }),
      ],
      { destination: '삿포로' }
    )
    expect(out[1].imageKeyword).not.toMatch(/airport/i)
  })
})

describe('round3 장소 없는 날 사진 제외', () => {
  it('숙박 없는 귀국일·장소 없는 공항 이동일은 사진 칸 제외', () => {
    expect(isRegisterScheduleNoPlacePhotoDay({ day: 5, title: '푸꾸옥 출발 · 귀국', routeText: '', hotelText: '' }, 5)).toBe(true)
    expect(isRegisterScheduleNoPlacePhotoDay({ day: 1, title: '다낭', routeText: '인천 - 다낭 공항', hotelText: '호텔' }, 5)).toBe(true)
  })
  it('장소가 있는 날은 사진 칸 유지', () => {
    expect(isRegisterScheduleNoPlacePhotoDay({ day: 2, title: '사오 비치', routeText: '사오 비치 - 호국사', hotelText: '호텔' }, 5)).toBe(false)
  })
})

describe('round3 사람 필터 — 사람이 주인공일 때만', () => {
  it.each([
    'a person crossing a bamboo bridge in rural hội an, lush greenery surrounds.',
    'traveler admires chapel bridge and water tower in lucerne, switzerland.',
    'hikers explore a lush mountain trail with a stunning view over a sea of clouds.',
    'people walk past the ruins of st. paul',
    'tourists at the temple courtyard',
  ])('통과: %s', (alt) => expect(personIsMainSubject(alt)).toBe(false))
  it.each([
    'a woman in a red dress stands with a colorful umbrella on a wooden bridge.',
    'portrait of a young man',
    'a woman gazes at colorful fish and coral in a vibrant aquarium display.',
  ])('탈락: %s', (alt) => expect(personIsMainSubject(alt)).toBe(true))
})
