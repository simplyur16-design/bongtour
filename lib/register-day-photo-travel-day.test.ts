import { describe, expect, it } from 'vitest'
import {
  firstDestinationCityEn,
  lastStayCityEn,
  registerTravelDayKind,
  rotatePublicMissingDayPicks,
  scheduleApplyingTravelDayKeywords,
  travelDayPhotoKeyword,
  travelDayTransportWord,
} from '@/lib/register-day-photo-travel-day'
import { missingDayFillAction } from '@/lib/register-auto-photo-missing-day'
import { registerScheduleDayIsCityOnlyPhotoSkip } from '@/lib/register-schedule-city-only-day'

const rows = [
  { day: 1, title: '인천 출발', routeText: '인천국제공항 - 파리', description: '인천 22:10 출발. 기내 숙박.', hotelText: '숙박 없음(기내박)' },
  { day: 2, title: '파리 시내', routeText: '파리 - 에펠탑 - 루브르 박물관', description: '파리 도착 후 시내 관광.' },
  { day: 3, title: '스위스 이동', routeText: '파리 - 취리히', description: '떼제베 기차로 취리히 이동.' },
  { day: 4, title: '인터라켄', routeText: '취리히 - 인터라켄', description: '인터라켄 관광.' },
  { day: 5, title: '귀국', routeText: '인천국제공항 - 기내', description: '인천 도착.' },
]

describe('출국·귀국·이동일 사진 키워드 (사장님 11/21)', () => {
  it('출국일: 기내 숙박·익일 도착이면 공항이 아니라 처음 가는 곳(첫 목적지) 대표', () => {
    expect(registerTravelDayKind(rows[0]!, 5)).toBe('departure')
    expect(firstDestinationCityEn(rows, '프랑스')).toBe('Paris')
    const plan = travelDayPhotoKeyword(rows[0]!, rows, '프랑스')
    expect(plan).toEqual({ kind: 'departure', keyword: 'Paris' })
    expect(plan!.keyword).not.toMatch(/airport|incheon|기내|공항/i)
  })

  it('지방 공항 출발도 첫 목적지(해외)로 고른다', () => {
    const busan = [{ day: 1, title: '부산 출발', routeText: '김해공항 - 오사카', description: '부산 21:40 출발. 익일 00:45 오사카 도착.' }, { day: 2, title: '교토', routeText: '오사카 - 교토' }]
    expect(travelDayPhotoKeyword(busan[0]!, busan, '일본')?.keyword).toBe('Osaka')
  })

  it('귀국일: 마지막 체류지 대표', () => {
    expect(lastStayCityEn(rows, 5, '스위스')).toBe('Interlaken')
    expect(registerTravelDayKind(rows[4]!, 5)).toBe('return')
    expect(travelDayPhotoKeyword(rows[4]!, rows, '스위스')).toEqual({ kind: 'return', keyword: 'Interlaken' })
  })

  it('이동일: 기차·크루즈·국내선은 그 느낌의 사진', () => {
    expect(travelDayTransportWord('떼제베 기차로 취리히 이동')).toBe('scenic train')
    expect(travelDayTransportWord('크루즈 승선 후 선상 숙박')).toBe('cruise ship')
    expect(travelDayTransportWord('국내선 항공 이동')).toBe('airplane view')
    expect(travelDayTransportWord('버스로 호텔 이동')).toBeNull()
    const transit = { day: 3, title: '경유', routeText: '두바이 - 아테네' }
    expect(registerScheduleDayIsCityOnlyPhotoSkip(transit)).toBe(true)
    expect(registerTravelDayKind(transit, 5)).toBe('transit')
  })

  it('글은 그대로, 사진이 빈 출국·귀국일 키워드만 바꾸고 사진 있는 날은 건드리지 않는다', () => {
    const sched = rows.map((r) => ({ ...r, imageKeyword: r.day === 1 ? 'Incheon Airport' : 'x', imageUrl: r.day === 2 || r.day === 4 ? 'https://cdn.example/a.webp' : '' }))
    const out = scheduleApplyingTravelDayKeywords(JSON.stringify(sched), '프랑스')!
    expect(out.changed).toBe(true)
    const next = JSON.parse(out.json) as typeof sched
    expect(next[0]!.imageKeyword).toBe('Paris')
    expect(next[4]!.imageKeyword).toBe('Interlaken')
    expect(next[1]!.imageKeyword).toBe('x')
    for (let i = 0; i < sched.length; i++) {
      expect(next[i]!.title).toBe(sched[i]!.title)
      expect(next[i]!.routeText).toBe(sched[i]!.routeText)
      expect(next[i]!.description).toBe(sched[i]!.description)
      expect(next[i]!.imageUrl).toBe(sched[i]!.imageUrl)
    }
    expect(missingDayFillAction({ ...next[0]!, imageUrl: '' }, 5)).toBe('fill')
    expect(missingDayFillAction({ ...next[4]!, imageUrl: '' }, 5)).toBe('fill')
  })

  it('키워드가 비면 출국·귀국·이동일도 채우지 않는다(근거 없는 검색 금지)', () => {
    expect(missingDayFillAction({ day: 5, title: '귀국', routeText: '인천국제공항 - 기내', imageKeyword: '', imageUrl: '' }, 5)).toBe('skip')
  })

  it('공개 상품 빈 일차는 시각마다 시작 위치를 돌려 실패 상품이 앞을 막지 않는다', () => {
    const list = [1, 2, 3, 4, 5]
    const a = rotatePublicMissingDayPicks(list, 2, new Date(3_600_000 * 0))
    const b = rotatePublicMissingDayPicks(list, 2, new Date(3_600_000 * 1))
    expect(a).toEqual([1, 2])
    expect(b).toEqual([3, 4])
    expect(rotatePublicMissingDayPicks([1], 10, new Date())).toEqual([1])
  })
})
