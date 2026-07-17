/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 하노이·하롱 — Montenegro Titov 오매칭 금지 — manifest
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: 마사지·쇼핑센터 — manifest
 * REGRESSION-FREEZE[lottetour-schedule-expression]: 하노이·하롱 vibe — manifest
 * REGRESSION-FREEZE[kyowontour-schedule-expression]: AVP024 하노이·하롱 — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyKyowontourScheduleExpressionToRows } from '@/lib/kyowontour-register-api-schedule'
import { applyKyowontourScheduleImageKeywordsToRows } from '@/lib/kyowontour-schedule-image-keyword'
import { sanitizeRegisterScheduleRouteText } from '@/lib/register-schedule-route-place-noise'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { mapKoreanPoiSegment } from '@/lib/pexels-keyword'

describe('kyowontour Hanoi–Halong AVP024 schedule quality', () => {
  it('maps Halong/Hanoi landmarks — never Montenegro Titov/Limestone Cave', () => {
    expect(mapKoreanPoiSegment('티톱섬 전망대')).toMatch(/Ti Top|Halong/i)
    expect(mapKoreanPoiSegment('석회동굴')).toMatch(/Surprise Cave|Halong/i)
    expect(mapKoreanPoiSegment('티톱섬 전망대')).not.toMatch(/Montenegro|Titov/i)
    expect(firstMatchingScheduleSpotEn('티톱섬 전망대')).toMatch(/Ti Top|Halong/i)
    expect(firstMatchingScheduleSpotEn('석회동굴')).toMatch(/Surprise Cave|Halong/i)
    expect(firstMatchingScheduleSpotEn('호치민생가')).toMatch(/Stilt House|Hanoi/i)
    expect(firstMatchingScheduleSpotEn('호치민생가')).not.toMatch(/skyline|City$/i)
    expect(firstMatchingScheduleSpotEn('쩐꾸옥 사원')).toMatch(/Tran Quoc|Hanoi/i)
    expect(firstMatchingScheduleSpotEn("하노이에서 가장 큰 호수 '서호")).toMatch(/West Lake Hanoi/i)
  })

  it('strips massage and shopping-center route noise', () => {
    expect(
      sanitizeRegisterScheduleRouteText('옌뜨 국립공원+케이블카 - 전신마사지 1시간 - 하롱베이 테마파크'),
    ).not.toMatch(/마사지/)
    expect(
      sanitizeRegisterScheduleRouteText('쇼핑센터 - 바딘광장 - 한기둥사원'),
    ).toMatch(/바딘|한기둥/)
    expect(sanitizeRegisterScheduleRouteText('쇼핑센터 - 바딘광장')).not.toMatch(/쇼핑/)
  })

  it('apply keywords — Halong not Montenegro; Hanoi not HCMC skyline; no skyline vibe', () => {
    const expressed = applyKyowontourScheduleExpressionToRows([
      {
        day: 1,
        title: '쩐꾸옥 사원',
        description: '',
        routeText: "쩐꾸옥 사원 - 하노이에서 가장 큰 호수 '서호",
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '옌뜨',
        description: '',
        routeText: '옌뜨 국립공원+케이블카 - 전신마사지 1시간 - 하롱베이 테마파크',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '하롱',
        description: '',
        routeText: '선착장으로 이동하여 유람선 타고 하롱베이 - 석회동굴 - 티톱섬 전망대',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '하노이',
        description: '',
        routeText: '쇼핑센터 - 바딘광장 - 한기둥사원 - 호치민생가 - 스트릿카 - 호안끼엠 호수',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 5,
        title: '귀국',
        description: '귀국',
        routeText: '',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ])
    const out = applyKyowontourScheduleImageKeywordsToRows(expressed, {
      productDestination: '베트남',
      productTitle: '[하노이&하롱베이5일] #VJ961',
    })

    const joined = out.map((r) => `${r.imageKeyword ?? ''} ${r.imageKeyword2 ?? ''}`).join(' | ')
    expect(joined).not.toMatch(/Montenegro|Titov|skyline/i)
    expect(out[0]?.imageKeyword ?? '').toMatch(/Tran Quoc|West Lake/i)
    expect(out[2]?.imageKeyword ?? '').toMatch(/Halong|Surprise Cave|Ti Top/i)
    expect(out[2]?.description ?? '').not.toMatch(/스카이라인/)
    expect(out[2]?.description ?? '').toMatch(/석회|만|선상|유람/)
    expect(out[3]?.imageKeyword ?? '').toMatch(/Ba Dinh|One Pillar|Stilt House|Hoan Kiem|Hanoi/i)
    expect(out[3]?.imageKeyword2 ?? '').toMatch(/Hoan Kiem|Stilt House|One Pillar/i)
    expect(out[3]?.imageKeyword ?? '').not.toMatch(/Ho Chi Minh City|skyline/i)
    expect(out[1]?.routeText ?? '').not.toMatch(/마사지/)
    expect(out[0]?.routeText ?? '').not.toMatch(/서호서호/)
    expect(out[4]?.title).toBe('귀국')
    expect(out[4]?.description).toMatch(/귀국|마무리|이동 중심/)
    expect(String(out[4]?.imageKeyword ?? '').trim()).toBe('')
  })
})
