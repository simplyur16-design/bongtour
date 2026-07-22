/**
 * REGRESSION-FREEZE[register-schedule-sea-poi-kw]: APP232 보홀 2030 live emptyKw — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { enforceRegisterScheduleTripUniqueImageKeywords } from '@/lib/register-schedule-trip-image-keyword-dedupe'
import { mapDestination, mapKoreanPoiSegment } from '@/lib/pexels-keyword'

describe('hanatour 2030 APP232 Bohol imageKeyword live gaps', () => {
  it('사해 maps to Dead Sea not Shanghai', () => {
    expect(mapDestination('사해')).toMatch(/Dead Sea/i)
    expect(mapDestination('상해')).toMatch(/Shanghai/i)
    expect(mapKoreanPoiSegment('사해')).toMatch(/Dead Sea/i)
  })

  it('비치클럽 is not Bali-only; Phu Quoc 소나시 maps locally', () => {
    expect(mapKoreanPoiSegment('비치클럽')).not.toMatch(/Bali/i)
    expect(mapKoreanPoiSegment('소나시 비치바')).toMatch(/Sonashi|Phu Quoc/i)
  })

  it('Phu Quoc twin beach-club days keep non-empty middle keywords', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        { day: 1, title: '1', routeText: '', imageKeyword: '', imageKeyword2: null },
        {
          day: 2,
          title: '호핑',
          routeText: '크레이지 호핑 - 소나시 비치바 푸꾸옥 - 베스트웨스턴 비치클럽 - 핫한 신상 비치클럽',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '호핑2',
          routeText: '크레이지 호핑 - 소나시 비치바 푸꾸옥 - 베스트웨스턴 비치클럽 - 핫한 신상 비치클럽',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '피크',
          routeText: '더 피크 푸꾸옥',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 5,
          title: '귀국',
          routeText: '푸꾸옥 손트랑',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'hanatour',
        productDestination: '푸꾸옥',
        travelScope: 'package',
      },
    )
    for (const d of [1, 2, 3, 4, 5]) {
      expect(String(out.find((r) => r.day === d)?.imageKeyword ?? '').trim().length).toBeGreaterThan(2)
    }
  })

  it('empty Japan return soft-dups Miyazaki/Saga from productDestination', () => {
    const miya = applyRegisterScheduleImageKeywordsBySupplier(
      [
        { day: 1, title: '1', routeText: '우도신궁 미야자키', imageKeyword: '', imageKeyword2: null },
        { day: 2, title: '2', routeText: '가고시마 - 서핑 체험', imageKeyword: '', imageKeyword2: null },
        { day: 3, title: '3일차', routeText: '', imageKeyword: '', imageKeyword2: null },
      ],
      { supplierKey: 'hanatour', productDestination: '미야자키', travelScope: 'package' },
    )
    expect(String(miya.find((r) => r.day === 2)?.imageKeyword ?? '')).not.toMatch(/Okinawa/i)
    expect(String(miya.find((r) => r.day === 3)?.imageKeyword ?? '')).toMatch(/Miyazaki/i)
  })

  it('APP232-like 5-day — Day1 does not steal Bamboo; Day2 keeps it; return soft-dup', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        { day: 1, title: '1일차', routeText: null, imageKeyword: '', imageKeyword2: null },
        {
          day: 2,
          title: '노스젠',
          routeText: '노스젠 밤부브릿지 선셋 - 맹그로브_노스젠 밤부브릿지 - 피시스 바 - 피세스',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '요가',
          routeText: '보홀 징요가 - 자연 속에서 즐기는 힐링 요가 클래스 - 보홀 할로망고',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: 'ICM',
          routeText: '보홀 아일랜드 시티몰 - 보홀_초콜릿힐',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 5,
          title: '물놀이 안전 수칙 출발 및 인천 귀국',
          routeText: '물놀이 안전 수칙',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'hanatour',
        productDestination: '보홀',
        productTitle: '[2030전용] 보홀 5일 #헤난알로나비치',
        travelScope: 'package',
      },
    )
    const by = (d: number) => out.find((r) => r.day === d)!
    expect(String(by(1).imageKeyword ?? '')).toMatch(/Bohol|Alona/i)
    expect(String(by(1).imageKeyword ?? '')).not.toMatch(/Bamboo|Chocolate/i)
    expect(String(by(2).imageKeyword ?? '')).toMatch(/Bamboo Bridge/i)
    expect(String(by(4).imageKeyword ?? '')).toMatch(/Chocolate Hills/i)
    expect(String(by(5).imageKeyword ?? '').trim().length).toBeGreaterThan(2)
    for (const d of [2, 3, 4]) {
      expect(String(by(d).imageKeyword ?? '').trim().length).toBeGreaterThan(2)
    }
  })

  // REGRESSION-FREEZE[register-schedule-sea-poi-kw]: activity-only middle → productDestination soft — manifest
  it('JWP141 surfing-only middle soft-dups Okinawa (not empty after D1 edge)', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          title: '오키나와 입국',
          routeText: '오키나와 입국',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '서핑 · 서핑체험6',
          routeText: '서핑 - 서핑체험6 - 서핑 체험2 - 서핑 체험 3',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '류큐무라',
          routeText: '오키나와 현지투어 플러스 - 류큐무라 - 카비라만 - 츄라우미 수족관',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '슈리성',
          routeText: '슈리성 - 우미카지 테라스',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'hanatour',
        productDestination: '오키나와',
        productTitle: '오키나와 4일 #서핑체험 (2030)',
        travelScope: 'package',
      },
    )
    const d2 = out.find((r) => r.day === 2)!
    expect(String(d2.imageKeyword ?? '').trim()).toMatch(/Okinawa/i)
  })

  it('JWP141 surfing soft-dup survives enforceRegisterScheduleTripUniqueImageKeywords', () => {
    const applied = applyRegisterScheduleImageKeywordsBySupplier(
      [
        {
          day: 1,
          title: '오키나와 입국',
          routeText: '오키나와 입국',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '서핑',
          routeText: '서핑 - 서핑체험6 - 서핑 체험2',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '류큐무라',
          routeText: '류큐무라 - 카비라만',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '슈리성',
          routeText: '슈리성',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      {
        supplierKey: 'hanatour',
        productDestination: '오키나와',
        productTitle: '오키나와 4일 (2030)',
        travelScope: 'package',
      },
    )
    const enforced = enforceRegisterScheduleTripUniqueImageKeywords(applied)
    expect(String(enforced.find((r) => r.day === 2)?.imageKeyword ?? '')).toMatch(/Okinawa/i)
  })
})
