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

import {
  isRegisterScheduleNoticeOrFareFragment,
  repairRegisterScheduleBrokenTitlePart,
  stripRegisterScheduleRowFragments,
} from '@/lib/register-schedule-row-fragment-filter'

describe('round3 21:35 일정 조각 걸러내기', () => {
  it('안내문·요금 조각 판별', () => {
    expect(isRegisterScheduleNoticeOrFareFragment('결제취소문자가 가지는 않습니다')).toBe(true)
    expect(isRegisterScheduleNoticeOrFareFragment('Customs. BN 어플 다운로드 후 진행')).toBe(true)
    expect(isRegisterScheduleNoticeOrFareFragment('000원/인)')).toBe(true)
    expect(isRegisterScheduleNoticeOrFareFragment('3인/1실 이용시, 트윈베드에 간이침대 추가됩니다.')).toBe(true)
    expect(isRegisterScheduleNoticeOrFareFragment('참고사항')).toBe(true)
    expect(isRegisterScheduleNoticeOrFareFragment('자금성')).toBe(false)
    expect(isRegisterScheduleNoticeOrFareFragment('천안문 광장')).toBe(false)
    expect(isRegisterScheduleNoticeOrFareFragment('반다르 세리 베가완')).toBe(false)
  })
  it('제목·경로·설명에서 조각만 빼고 문장을 만들지 않음 (lt-0096 D1)', () => {
    const r = stripRegisterScheduleRowFragments({
      title: 'Customs. BN 어플 다운로드 후 진행 · 반다르 세리 베가완',
      routeText: 'Customs. BN 어플 다운로드 후 진행 - 반다르 세리 베가완',
      description: '결제취소문자가 가지는 않습니다.',
      hotelText: '상세보기',
    })
    expect(r.title).toBe('반다르 세리 베가완')
    expect(r.routeText).toBe('반다르 세리 베가완')
    expect(r.description).toBe('')
  })
  it('요금 조각 제목은 비워 다음 단계가 도시로 채움 (yb-0110 D6)', () => {
    const r = stripRegisterScheduleRowFragments({
      title: '참고사항 · 3인/1실 이용시, 트윈베드에 간이침대 추가됩니다.',
      routeText: '참고사항 - 000원/인) - 3인/1실 이용시, 트윈베드에 간이침대 추가됩니다.',
      description: null,
    })
    expect(r.title).toBe('')
    expect(r.routeText).toBe('')
  })
  it('경로 속 요금 조각 (yb-0120 D4)', () => {
    const r = stripRegisterScheduleRowFragments({ title: '자금성 · 000원/인', routeText: '자금성 - 천안문 광장 - 북경 - 참고사항 - 000원/인', description: '자금성과 천안문 광장을 둘러봅니다.' })
    expect(r.title).toBe('자금성')
    expect(r.routeText).toBe('자금성 - 천안문 광장 - 북경')
    expect(r.description).toBe('자금성과 천안문 광장을 둘러봅니다.')
  })
  it('숙소 이름만 있는 제목·경로 제거 (new-ky-2 미카즈키)', () => {
    const r = stripRegisterScheduleRowFragments({ title: '미카즈키', routeText: '미카즈키', hotelText: '미카즈키', description: null })
    expect(r.title).toBe('')
    expect(r.routeText).toBe('')
  })
  it('깨진 제목 손질', () => {
    expect(repairRegisterScheduleBrokenTitlePart('000원/인)')).toBe('')
    expect(repairRegisterScheduleBrokenTitlePart('대소석림(전통차 탑승')).toBe('대소석림')
    expect(repairRegisterScheduleBrokenTitlePart('· 하롱베이 -')).toBe('하롱베이')
    expect(repairRegisterScheduleBrokenTitlePart('바티칸 (성 베드로 대성당)')).toBe('바티칸 (성 베드로 대성당)')
  })
  it('설명은 조각 문장만 빼고 원문 문장은 그대로', () => {
    const r = stripRegisterScheduleRowFragments({ title: '연태', routeText: '연태', description: '금사탄 해변을 산책합니다. 3인/1실 이용시, 트윈베드에 간이침대 추가됩니다.' })
    expect(r.description).toBe('금사탄 해변을 산책합니다.')
  })
  it('파이프 끝 제목: 요금 조각 귀국일 → 도시 출발 · 귀국, 숙소명 제목 → 도시', () => {
    const out = finalizeRegisterPackageScheduleRows(
      [
        row({ day: 1, title: '미카즈키', routeText: '미카즈키', hotelText: '미카즈키' }),
        row({ day: 2, title: '다낭 대성당', routeText: '다낭 대성당 - 마블마운틴', hotelText: '미카즈키' }),
        row({ day: 3, title: '참고사항 · 000원/인', routeText: '참고사항 - 000원/인' }),
      ],
      { destination: '다낭' },
    )
    expect(out[0].title).toBe('다낭')
    expect(out[2].title).toBe('다낭 출발 · 귀국')
    for (const r of out) expect(`${r.title} ${r.routeText} ${r.description}`).not.toMatch(/참고사항|원\/인|미카즈키 ·/)
  })
})

import {
  cleanRegisterScheduleUnderscoreAlias,
  dedupeRegisterScheduleLabelParts,
} from '@/lib/register-schedule-row-fragment-filter'

describe('round3 22:03 제목·경로: 밑줄 별칭·중복 문구', () => {
  it('밑줄 별칭은 빼고, 한자 원어·사진 출처 꼬리는 떼어 앞 이름만', () => {
    expect(cleanRegisterScheduleUnderscoreAlias('이색체험_전통객잔숙박')).toBe('')
    expect(cleanRegisterScheduleUnderscoreAlias('육합야시장_六合夜市')).toBe('육합야시장')
    expect(cleanRegisterScheduleUnderscoreAlias('버즈칼리파_관광청제공')).toBe('버즈칼리파')
    expect(cleanRegisterScheduleUnderscoreAlias('용호탑')).toBe('용호탑')
  })
  it('중복 문구: 두가 · 두가 유적지 관람 → 하나, 오사카 · 오사카성은 그대로', () => {
    expect(dedupeRegisterScheduleLabelParts(['두가', '두가 유적지 관람'])).toEqual(['두가 유적지 관람'])
    expect(dedupeRegisterScheduleLabelParts(['오사카', '오사카성'])).toEqual(['오사카', '오사카성'])
    expect(dedupeRegisterScheduleLabelParts(['연태', '연태'])).toEqual(['연태'])
  })
  it('행 손질: 제목·경로 모두 같은 기준', () => {
    const r = stripRegisterScheduleRowFragments({
      title: '이색체험_전통객잔숙박 · 두가 · 두가 유적지 관람',
      routeText: '두가 - 두가 유적지 관람 - 이색체험_전통객잔숙박 - 참고사항',
      description: null,
    })
    expect(r.title).toBe('두가 유적지 관람')
    expect(r.routeText).toBe('두가 유적지 관람')
    const r2 = stripRegisterScheduleRowFragments({ title: '가오슝 · 육합야시장_六合夜市', routeText: '가오슝 - 육합야시장_六合夜市', description: null })
    expect(r2.title).toBe('가오슝 · 육합야시장')
    expect(r2.routeText).toBe('가오슝 - 육합야시장')
  })
})


describe('round3 22:16 자유일정 날은 장소 없는 날이 아님 (사장님 10/30)', () => {
  it.each([
    ['전일 자유일정'],
    ['오사카 - 오사카 추천 1일 자유일정'],
    ['전일 리조트내 부대시설 이용 및 자유시간'],
    ['오사카 - 오후 자유시간'],
    ['반나절 자유일정'],
  ])('%s → 사진·추천일정 대상', (routeText) => {
    expect(isRegisterScheduleNoPlacePhotoDay({ day: 2, title: '', routeText, hotelText: 'H' }, 5)).toBe(false)
  })
  it('귀국일이라도 자유시간이 있으면 대상', () => {
    expect(isRegisterScheduleNoPlacePhotoDay({ day: 5, title: '', routeText: '오전 자유시간 - 공항 이동', hotelText: null }, 5)).toBe(false)
  })
  it('이동일·호텔만 있는 날·귀국일은 장소 없는 날', () => {
    expect(isRegisterScheduleNoPlacePhotoDay({ day: 2, title: '', routeText: '공항 이동', hotelText: 'H' }, 5)).toBe(true)
    expect(isRegisterScheduleNoPlacePhotoDay({ day: 5, title: '귀국', routeText: '', hotelText: null }, 5)).toBe(true)
  })
})

describe('round3 22:16 자유일정 날 제목', () => {
  it('자리표시 제목 + 자유일정 경로 → 도시만이 아니라 자유일정 조각', () => {
    const out = finalizeRegisterPackageScheduleRows(
      [
        row({ day: 1, title: '오사카', routeText: '간사이 공항 - 오사카', hotelText: 'H' }),
        row({ day: 2, title: '2일차', routeText: '전일 자유일정', hotelText: 'H' }),
        row({ day: 3, title: '3일차', routeText: '오사카 - 오후 자유시간', hotelText: 'H' }),
        row({ day: 4, title: '귀국', routeText: '', hotelText: '' }),
      ],
      { destination: '오사카' },
    )
    expect(out[1].title).toBe('오사카 · 전일 자유일정')
    expect(out[2].title).toBe('오사카 · 오후 자유시간')
  })
})

import { isRegisterPendingFreeItineraryDay } from '@/lib/register-pre-photo-verify'

describe('round3 22:16 전일·반나절 자유시간도 제미나이 추천일정 대상', () => {
  it('전일 리조트 자유시간 (new-mt-3 D4 모양)', () => {
    expect(
      isRegisterPendingFreeItineraryDay(
        { day: 4, title: '전일 리조트내 부대시설 이용 및 자유시간', routeText: '전일 리조트내 부대시설 이용 및 자유시간', description: '', hotelText: 'PIC 슈페리어룸' } as any,
        { productTitle: '괌 PIC 5일' },
      ),
    ).toBe(true)
  })
  it("'오사카 - 오사카 추천 1일 자유일정' (mt-0240 D2 모양)도 대상", () => {
    expect(
      isRegisterPendingFreeItineraryDay(
        { day: 2, title: '오사카 추천 1일 자유일정', routeText: '오사카 - 오사카 추천 1일 자유일정', description: '', hotelText: 'H' } as any,
        { productTitle: '[청주출발] 오사카/교토/나라 3일 (1일자유)' },
      ),
    ).toBe(true)
  })
  it('관광지가 있는 날의 짧은 자유시간은 추천일정 대상 아님', () => {
    expect(
      isRegisterPendingFreeItineraryDay(
        { day: 2, title: '오후 자유시간', routeText: '에펠탑 - 루브르 박물관 - 오후 자유시간', description: '', hotelText: 'H' } as any,
        { productTitle: '파리 5일' },
      ),
    ).toBe(false)
  })
})

describe('round3 22:16 요약은 지우거나 원문으로 바꾸지 않고, 상관없는 문장만 다듬음', () => {
  const rows = [
    row({ day: 1, title: '씨엠립', routeText: '씨엠립', hotelText: 'H', description: '' }),
    row({ day: 2, title: '반나절 추천일정', routeText: '펍 스트리트 - 올드 마켓', hotelText: 'H', description: '씨엠립 자유일정 추천. 펍 스트리트 - 올드 마켓를 둘러봅니다. 오후에는 리조트에서 휴식을 취합니다.' }),
    row({ day: 3, title: '자유 일정', routeText: '앙코르와트 국제 하프 마라톤 자유 일정', hotelText: 'H', description: '' }),
    row({ day: 4, title: '앙코르와트 · 바욘 사원', routeText: '앙코르와트 - 바욘 사원', hotelText: 'H', description: '앙코르와트에서 일출을 감상합니다. 바욘 사원의 미소 조각을 둘러봅니다. 결제취소문자가 가지는 않습니다. 저녁에는 압사라 공연을 관람합니다.' }),
    row({ day: 5, title: '귀국', routeText: '', hotelText: '', description: '' }),
  ]
  const out = finalizeRegisterPackageScheduleRows(rows, { destination: '씨엠립' })
  it('제미나이 자유일정 추천 문장은 그대로 (뒤 문장이 있어도)', () => {
    expect(out[1].description).toContain('씨엠립 자유일정 추천. 펍 스트리트 - 올드 마켓를 둘러봅니다. 오후에는 리조트에서 휴식을 취합니다.')
  })
  it("자유일정 조각을 'X를 둘러봅니다'로 합성하지 않음", () => {
    expect(out[2].description).not.toMatch(/자유 일정을 둘러봅니다/)
  })
  it('3~4문장 요약은 유지하고 그날과 상관없는 안내문 조각만 뺌', () => {
    expect(out[3].description).toBe('앙코르와트에서 일출을 감상합니다. 바욘 사원의 미소 조각을 둘러봅니다. 저녁에는 압사라 공연을 관람합니다. 숙소는 H입니다.')
  })
})

import { photoMatchGate, isRegisterPhotoAirportCodeTerm } from '@/lib/register-photo-match-gate'

describe('round3 사진: 공항 코드 키워드·가족 인물 사진', () => {
  const c = { altText: "Father and daughter embrace with a sign saying 'The Best Dad Ever.'", width: 4000, height: 3000, externalId: '1', photographer: 'p', originalLink: 'x' } as any
  it('사람(아버지·딸)이 주인공이면 탈락', () => {
    expect(personIsMainSubject("father and daughter embrace with a sign saying the best dad ever")).toBe(true)
  })
  it("공항 코드 'DAD'는 장소 일치 근거가 아님", () => {
    expect(isRegisterPhotoAirportCodeTerm('DAD')).toBe(true)
    expect(isRegisterPhotoAirportCodeTerm('Da Nang')).toBe(false)
    const r = photoMatchGate({ ...c, altText: 'A dad sign on a wall' }, { placeTerms: ['DAD'], destinationTerms: [], slotText: '다낭 공항 도착', slot: 'day' } as any)
    expect(r.ok).toBe(false)
    const r2 = photoMatchGate({ ...c, altText: "A black mug with 'Dad' printed on it" }, { placeTerms: ['DAD'], destinationTerms: [], slotText: '다낭 국제공항(DAD) 도착', slot: 'day', daySummary: '다낭 국제공항(DAD) 도착 dad' } as any)
    expect(r2.ok).toBe(false)
  })
})
