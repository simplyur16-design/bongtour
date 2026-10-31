/**
 * REGRESSION-FREEZE[register-parse-round3-1031]: round3-1031(봉실장 10/31 21:03) — 제목 도시 대안·귀국일 제목·빈말 0·Gemini 키워드 사후 검사·장소 없는 날 사진 제외·사람 주인공 필터
 */
import { describe, expect, it } from 'vitest'
import {
  finalizeRegisterPackageScheduleRows,
  isRegisterScheduleFillerSentence,
  isRegisterScheduleNoPlacePhotoDay,
  registerScheduleDestinationCityLabel,
  fixDepartureTemplateSentence,
  registerScheduleDepartureHub,
  type RegisterScheduleFinalizeRow,
} from '@/lib/register-schedule-day-summary-finalize'
import { personIsMainSubject } from '@/lib/register-photo-match-gate'
import { registerSupplierTripDays, registerSupplierTripDaysFromDuration, trimRegisterScheduleToSupplierDays } from '@/lib/register-schedule-supplier-day-count'

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

describe('round3 원문 일수보다 많은 일차 금지 (봉실장 21:18)', () => {
  it.each([
    ['2박 3일', 3],
    ['2박3일', 3],
    ['3일', 3],
    ['3박 5일', 5],
    ['', null],
    ['미정', null],
  ] as const)('일수 읽기 %s → %s', (d, n) => expect(registerSupplierTripDaysFromDuration(d)).toBe(n))
  it('원문 3일인데 4일차가 있으면 4일차를 뺀다', () => {
    const rows = [{ day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }]
    const r = trimRegisterScheduleToSupplierDays(rows, 3)
    expect(r.rows.map((x) => x.day)).toEqual([1, 2, 3])
    expect(r.droppedDays).toEqual([4])
  })
  it('여행기간·상품명 일수가 어긋나면 큰 값(yb-0110 기간 5일·상품명 6일 → 6, 6일차 유지)', () => {
    expect(registerSupplierTripDays({ duration: '5일', title: '곤명/여강/중전 6일 #TOP PICK' })).toBe(6)
    expect(registerSupplierTripDays({ duration: '2박 3일', title: '청도 3일 [고품격]' })).toBe(3)
    expect(registerSupplierTripDays({ duration: null, title: null })).toBeNull()
  })
  it('일수를 모르면 그대로', () => {
    const rows = [{ day: 1 }, { day: 2 }, { day: 3 }, { day: 4 }]
    expect(trimRegisterScheduleToSupplierDays(rows, null).rows).toBe(rows)
  })
})

describe('round3 1일차 틀 문장 (봉실장 21:27)', () => {
  it('원문 출발지가 없으면 출발 틀 문장을 버린다', () => {
    expect(fixDepartureTemplateSentence('인천에서 출발해 곤명에서 도착합니다.', null)).toBeNull()
  })
  it('원문 출발지가 청주면 청주로', () => {
    expect(fixDepartureTemplateSentence('인천에서 출발해 연태에서 도착합니다.', '청주', ['연태'])).toBe('청주에서 출발해 연태에 도착합니다.')
  })
  it.each(['보얼예술특구', '별도 간식을 챙겨주시면 좋습니다.', '가이드 미팅', '미카즈키 리조트'])('도착지 자리에 도시가 아닌 말(%s)이면 버린다', (x) => {
    expect(fixDepartureTemplateSentence(`인천에서 출발해 ${x}에서 도착합니다.`, '인천')).toBeNull()
  })
  it('귀국 틀 문장의 출발지도 원문 것으로', () => {
    expect(fixDepartureTemplateSentence('체크아웃 후 인천으로 귀국합니다.', '김해')).toBe('체크아웃 후 김해로 귀국합니다.')
    expect(fixDepartureTemplateSentence('체크아웃 후 인천으로 귀국합니다.', null)).toBe('체크아웃 후 귀국합니다.')
  })
  it('출발지 확인: 출국 항공 출발 공항 → 1일차 동선 맨 앞', () => {
    expect(registerScheduleDepartureHub('청주 국제공항', '')).toBe('청주')
    expect(registerScheduleDepartureHub('', '김해 - 후쿠오카')).toBe('김해')
    expect(registerScheduleDepartureHub('', '곤명 - 쿤밍')).toBeNull()
  })
  it('파이프 결과: 원문 출발지 없음 → 1일차 틀 문장 없음', () => {
    const out = finalizeRegisterPackageScheduleRows(
      [
        row({ day: 1, title: '곤명 · 쿤밍', routeText: '곤명 - 쿤밍', description: '인천에서 출발해 곤명에서 도착합니다. 첫날 리듬을 맞추며 일정을 이어갑니다.', hotelText: '미정' }),
        row({ day: 2, title: '호도협', routeText: '호도협 - 여강', hotelText: '미정' }),
        row({ day: 3, title: '귀국', routeText: '' }),
      ],
      { destination: '쿤밍' }
    )
    expect(out[0].description).not.toMatch(/출발해/)
  })
  it('귀국일 제목에 명소 이름을 도시로 쓰지 않음(yb-0110 대소석림)', () => {
    const out = finalizeRegisterPackageScheduleRows(
      [
        row({ day: 1, title: '쿤밍', routeText: '인천 - 쿤밍', hotelText: 'H' }),
        row({ day: 2, title: '대소석림', routeText: '대소석림(전통차 탑승) / 구향동굴(리프트) - 곤명', hotelText: 'H' }),
        row({ day: 3, title: '귀국', routeText: '대소석림' }),
      ],
      { destination: '곤명' }
    )
    expect(out[2].title).toBe('곤명 출발 · 귀국')
  })
})
