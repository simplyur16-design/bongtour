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

import { finalizeRegisterAirtelScheduleRows } from '@/lib/register-schedule-day-summary-finalize'

describe('round3 21:35 에어텔 일정 손질 (new-ky-2 모양)', () => {
  const rows = [
    row({ day: 1, title: '미카즈키', routeText: '미카즈키', hotelText: '미카즈키', description: '인천에서 출발해 미카즈키에서 도착합니다. 미카즈키에서 첫날 일정을 이어갑니다. 첫날 리듬을 맞추며 일정을 이어갑니다.' }),
    row({ day: 2, title: '다낭 대성당 · 다낭 빈원더스&사파리', routeText: '다낭 대성당 - 마블마운틴 - 다낭 빈원더스&사파리', hotelText: '미카즈키', description: '다낭 대성당과 마블마운틴을 둘러봅니다. 다낭 빈원더스&사파리를 이어서 방문합니다.' }),
    row({ day: 3, title: '미카즈키', routeText: '미카즈키', hotelText: '미카즈키', description: '미카즈키를 둘러봅니다. 미카즈키에서 주변을 이어서 둘러봅니다.' }),
    row({ day: 4, title: '4일차', routeText: null, hotelText: null, description: '4일차 구간을 이어서 둘러봅니다. 4일차 동선을 천천히 이어 갑니다.' }),
    row({ day: 5, title: '귀국', routeText: null, hotelText: null, description: '체크아웃 후 인천으로 귀국합니다. 별도의 관광보다 이동 중심으로 여행을 마무리합니다.' }),
  ]
  const out = finalizeRegisterAirtelScheduleRows(rows, { destination: '다낭', departureText: '' })
  it('숙소명·N일차·귀국 제목은 도시로', () => {
    expect(out.map((r) => r.title)).toEqual(['다낭', '다낭 대성당 · 다낭 빈원더스&사파리', '다낭', '다낭', '다낭 출발 · 귀국'])
  })
  it('원문에 출발지가 없으면 틀 문장·빈 문구 없이 (지어내지 않음)', () => {
    const all = out.map((r) => String(r.description ?? '')).join(' ')
    expect(all).not.toMatch(/인천에서 출발해|일차 구간|리듬을 맞추며|미카즈키를 둘러봅니다|인천으로 귀국/)
    expect(out[1].description).toBe('다낭 대성당과 마블마운틴을 둘러봅니다. 다낭 빈원더스&사파리를 이어서 방문합니다.')
    expect(out[4].description).toBe('체크아웃 후 귀국합니다.')
  })
  it('원문 출발지(김해)가 있으면 그 도시로', () => {
    const o2 = finalizeRegisterAirtelScheduleRows(rows, { destination: '다낭', departureText: '김해국제공항 출발' })
    expect(o2[4].description).toBe('체크아웃 후 김해로 귀국합니다.')
  })
})

import {
  cleanRegisterScheduleUnderscoreAlias,
  dedupeRegisterScheduleLabelParts,
  isRegisterScheduleAiTipSentence,
} from '@/lib/register-schedule-row-fragment-filter'

describe('round3 22:03 제목·경로: 밑줄 별칭·중복 문구·AI 팁', () => {
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
  it('AI 팁 문장 판별', () => {
    expect(isRegisterScheduleAiTipSentence('도나우강이 내려다보이는 파노라마 뷰를 감상해 보세요.')).toBe(true)
    expect(isRegisterScheduleAiTipSentence('공식 택시 승강장을 이용하면 바가지 요금 걱정 없이 안전하게 시내로 이동할 수 있어요.')).toBe(true)
    expect(isRegisterScheduleAiTipSentence('다낭 대성당과 마블마운틴을 둘러봅니다.')).toBe(false)
  })
  it('에어텔: 원문에 없는 AI 팁 문장은 빼고, 원문에 있는 문장은 남김', () => {
    const rows = [
      row({ day: 1, title: '부다페스트', routeText: '부다페스트', description: '부다페스트 공항에 도착해 첫날을 준비해 보세요. 공항 택시를 이용하면 시내로 이동할 수 있어요.' }),
      row({ day: 2, title: '부다 성', routeText: '부다 성 - 어부의 요새', description: '자유롭게 시내를 즐기세요.' }),
    ]
    const out = finalizeRegisterAirtelScheduleRows(rows, { destination: '부다페스트', sourceRows: [{ day: 2, description: '자유롭게 시내를 즐기세요.' }] })
    expect(out[0].description).toBe('')
    expect(out[1].description).toBe('자유롭게 시내를 즐기세요.')
  })
})
