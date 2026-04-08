/**
 * CI 없이 로컬/배포 전 `npx tsx scripts/verify-hotel-meal-display.ts` 로 포맷터 회귀 확인.
 */
import assert from 'node:assert/strict'
import {
  formatHotelDisplay,
  formatMealDisplay,
  formatScheduleDayHotelLine,
} from '../lib/hotel-meal-display'
import {
  expandVerygoodScheduleDescriptionForPublicDetail,
  shouldOmitVerygoodScheduleDayHotelProductFallback,
} from '../lib/verygood-public-product-detail-patch'

// 호텔 2개 이상 → 외 n
assert.equal(
  formatHotelDisplay({
    hotelNames: ['이도백하 레디언스호텔', '크라운호텔'],
    hotelSummaryText: null,
    dayHotelText: null,
  }),
  '이도백하 레디언스호텔 외 1'
)

// 호텔 1개 → 단일명
assert.equal(
  formatHotelDisplay({ hotelNames: ['하얏트'], hotelSummaryText: null, dayHotelText: null }),
  '하얏트'
)

// 식사 3개 → 한 줄
assert.deepEqual(
  formatMealDisplay({
    breakfastText: '호텔식',
    lunchText: '현지식',
    dinnerText: '한식',
    mealSummaryText: null,
  }),
  ['아침 - 호텔식, 점심 - 현지식, 저녁 - 한식']
)

// mealSummaryText만
assert.deepEqual(
  formatMealDisplay({
    breakfastText: null,
    lunchText: '  ',
    dinnerText: null,
    mealSummaryText: '조식 포함·중식 자유',
  }),
  ['조식 포함·중식 자유']
)

// 모두 없음 (식사는 불포함 명시)
assert.equal(formatHotelDisplay({ hotelNames: [], hotelSummaryText: null, dayHotelText: null }), null)
assert.deepEqual(
  formatMealDisplay({
    breakfastText: null,
    lunchText: null,
    dinnerText: null,
    mealSummaryText: null,
  }),
  ['식사 - 불포함']
)

// day.hotelText 우선
assert.equal(
  formatScheduleDayHotelLine({
    hotelNames: ['A', 'B'],
    hotelSummaryText: '요약',
    dayHotelText: '  당일 투숙 호텔 원문  ',
  }),
  '당일 투숙 호텔 원문'
)

assert.equal(
  formatScheduleDayHotelLine({
    hotelNames: ['A', 'B'],
    hotelSummaryText: null,
    dayHotelText: null,
  }),
  'A 외 1'
)

// verygood 공개 전달: 마지막 행 + 인천 공항 도착 본문 → product 폴백 숨김 (page에서 omitHotelLine)
const descLast = expandVerygoodScheduleDescriptionForPublicDetail(
  '인천\n[13:20] 인천국제공항 제 2터미널 (T2) 도착\n'
)
assert.equal(
  shouldOmitVerygoodScheduleDayHotelProductFallback({
    hotelNames: ['A', 'B'],
    hotelSummaryText: null,
    dayHotelText: null,
    isLastScheduleRow: true,
    dayDescription: descLast,
  }),
  true
)

const junkNames = [
  '이 여행상품의 숙박시설은 현재 미정입니다.',
  '이 여행상품의 숙박시설은 현재 미정입니다.',
  '이 여행상품의 숙박시설은 현재 미정입니다.',
  '이 여행상품의 숙박시설은 현재 미정입니다.',
  '5일차',
  '호텔 투숙 및 휴식',
  '이 여행상품의 숙박시설은 현재 미정입니다.',
  '6일차',
  '7일차',
]
assert.equal(
  shouldOmitVerygoodScheduleDayHotelProductFallback({
    hotelNames: junkNames,
    hotelSummaryText: '이 여행상품의 숙박시설은 현재 미정입니다. 외 8',
    dayHotelText: null,
    isLastScheduleRow: true,
    dayDescription: expandVerygoodScheduleDescriptionForPublicDetail('인천\n도착\n'),
  }),
  true
)

console.log('verify-hotel-meal-display: ok')
