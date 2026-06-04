import { describe, expect, it } from 'vitest'
import { applyYbtourScheduleImageKeywordsToRows } from '@/lib/ybtour-schedule-image-keyword'

describe('applyYbtourScheduleImageKeywordsToRows — modetour 우선순위', () => {
  it('유효 LLM 키워드를 routeText보다 우선', () => {
    const rows = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '오사카 관광',
          description: '오사카성과 도톤보리',
          routeText: '오사카 - 오사카성 - 도톤보리',
          imageKeyword: 'Dotonbori',
          imageKeyword2: 'Osaka Castle',
        },
      ],
      { productDestination: '일본' },
    )

    expect(rows[0]?.imageKeyword).toBe('Dotonbori')
    expect(rows[0]?.imageKeyword2).toBe('Osaka Castle')
  })

  it('routeText 없어도 본문·LLM으로 1순위 채움', () => {
    const rows = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '후쿠오카 자유일정',
          description: '다자이후 텐만구 관광 후 자유시간',
          routeText: null,
          imageKeyword: 'Dazaifu Tenmangu',
          imageKeyword2: null,
        },
      ],
      { productDestination: '일본' },
    )

    expect(rows[0]?.imageKeyword).toBe('Dazaifu Tenmangu')
    expect(rows[0]?.imageKeyword2).toBeNull()
  })

  it('이집트 상품에서 Osaka 환각 LLM은 거부하고 본문·routeText 추론', () => {
    const rows = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 6,
          title: '홍해의 휴양지 후르가다로 이동',
          description: '나일강 크루즈에서 하선하여 후르가다로 이동',
          routeText: '룩소르 - 후르가다',
          imageKeyword: 'Osaka Castle',
          imageKeyword2: 'Forbidden City',
        },
      ],
      { productDestination: '이집트' },
    )

    expect(rows[0]?.imageKeyword).toBe('Luxor')
    expect(rows[0]?.imageKeyword2).toBe('Hurghada')
  })

  it('movement/return 일차는 imageKeyword2 null', () => {
    const rows = applyYbtourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '인천 출발 및 홍콩 도착',
          description: '인천 국제공항에서 출발하여 홍콩 국제공항 도착',
          routeText: '인천 - 홍콩',
          imageKeyword: 'Hong Kong',
          imageKeyword2: 'Harbour City',
        },
        {
          day: 4,
          title: '인천 국제공항 도착',
          description: '홍콩 출발 후 인천 국제공항 도착',
          routeText: '홍콩 - 인천',
          imageKeyword: 'Victoria Peak',
          imageKeyword2: 'SoHo',
        },
      ],
      { productDestination: 'Hong Kong' },
    )

    expect(rows[0]?.imageKeyword).toBe('Hong Kong')
    expect(rows[0]?.imageKeyword2).toBeNull()
    expect(rows[1]?.imageKeyword2).toBeNull()
  })
})
