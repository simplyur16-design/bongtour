import { describe, expect, it } from 'vitest'
import {
  blocksAutomaticDayPhotoGeneration,
  dayPhotoContextFromFacts,
  dayPhotoFactsFromScheduleFields,
  keptDayImagesWhenConfirmedPlaceSkipped,
  selectScheduleDayPhoto,
} from '@/lib/register-photo-day-confirmed-place'
import {
  registerScheduleDayIsCityOnlyPhotoSkip,
  registerScheduleRouteHasNamedSight,
} from '@/lib/register-schedule-city-only-day'
import { isRegisterScheduleNoPlacePhotoDay } from '@/lib/register-schedule-day-summary-finalize'

const SIGHTS = [
  {
    title: '다낭 · 내원교',
    routeText: '다낭 - 마블마운틴 - 호이안 바구니배 - 호이안 구시가지 - 내원교',
    description: '다낭과 마블마운틴을 둘러봅니다. 호이안 구시가지와 내원교를 이어서 방문합니다.',
  },
  {
    title: '교토 · 후시미이나리 신사',
    routeText: '교토 - 은각사 - 교토타워 - 이조성 - 뵤도인 - 후시미이나리 신사',
    description: '은각사와 후시미이나리 신사를 둘러봅니다.',
  },
  {
    title: '비크 · 스카프타펠',
    routeText: '비크 - 요쿨살론 - 스카프타펠',
    description: '요쿨살론과 스카프타펠을 둘러봅니다.',
  },
]

describe('route summary sights are searched, empty and move days are not', () => {
  it('does not skip a day whose summary names a sight', async () => {
    for (const row of SIGHTS) {
      expect(registerScheduleRouteHasNamedSight(row.routeText)).toBe(true)
      const facts = dayPhotoFactsFromScheduleFields({ ...row, imageKeyword: 'place', supplierOriginal: null })
      expect(dayPhotoContextFromFacts(facts).kind).toBe('supplier')
      expect(keptDayImagesWhenConfirmedPlaceSkipped({ ...row, imageUrl: null }).skipped).toBe(false)
      let chain = 0
      const picked = await selectScheduleDayPhoto({
        facts,
        existing: { imageUrl: null, title: row.title, description: row.description, routeText: row.routeText },
        isUsed: () => false,
        sameSightReuse: () => false,
        loadPool: async () => null,
        loadHero: async () => null,
        loadChain: async () => {
          chain += 1
          return null
        },
      })
      expect(chain).toBe(1)
      expect(picked.unresolvedReason).not.toBe('no_confirmed_sightseeing')
    }
  })

  it('keeps a free day on the recommendation path', () => {
    const facts = dayPhotoFactsFromScheduleFields({
      title: '전일 자유일정',
      description: '전일 자유일정. 추천 관광지.',
      routeText: '파리 - 에펠탑',
      imageKeyword: 'Eiffel Tower',
      supplierOriginal: null,
    })
    expect(dayPhotoContextFromFacts(facts).kind).toBe('recommendation')
    expect(keptDayImagesWhenConfirmedPlaceSkipped({
      title: '전일 자유일정',
      description: '전일 자유일정. 추천 관광지.',
      routeText: '파리 - 에펠탑',
      imageUrl: null,
    }).skipped).toBe(false)
  })

  it('still skips a day with no place and a city-only day, and does not turn a move day into sightseeing', () => {
    expect(isRegisterScheduleNoPlacePhotoDay(
      { day: 1, title: '출발', routeText: '인천국제공항 - 기내', hotelText: null },
      4,
    )).toBe(true)
    expect(registerScheduleDayIsCityOnlyPhotoSkip({ title: '경유', routeText: '두바이 - 아테네' })).toBe(true)
    expect(registerScheduleRouteHasNamedSight('인천국제공항 - 기내')).toBe(false)
    expect(registerScheduleRouteHasNamedSight('아디스 아바바 - 상파울루')).toBe(false)
    const empty = keptDayImagesWhenConfirmedPlaceSkipped({
      title: '휴식',
      description: '호텔 투숙 후 휴식. 관광 없음.',
      routeText: '인천국제공항 - 기내',
      imageUrl: 'https://cdn.example/kept.webp',
    })
    expect(empty.skipped).toBe(true)
    expect(empty.imageUrl).toBe('https://cdn.example/kept.webp')
    const move = dayPhotoFactsFromScheduleFields({
      title: '부산, 계림',
      description: '부산 21:40 출발. 익일 00:45 계림 도착. 호텔로 이동하여 투숙 및 휴식. 방문 관광지 없음.',
      routeText: '부산 - 계림공항 - 호텔',
      supplierOriginal: null,
    })
    expect(dayPhotoContextFromFacts(move).kind).toBe('upcoming')
    expect(blocksAutomaticDayPhotoGeneration(move)).toBe(true)
  })
})
