/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: ModeTour EMP151 Cairo Coptic — Day1/Day2 empty 금지 — manifest
 * REGRESSION-FREEZE[register-schedule-trip-image-keyword-dedupe]: ModeTour EMP151 day-route evidence — Coptic≠empty — manifest
 *
 * Fixture: modetour package 109642938 (EMP151EK0A Egypt 10일) — truncated 카이 + 콥트 교회 route.
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { mapDestination, mapKoreanPoiSegment } from '@/lib/pexels-keyword'

const EMP151_ROWS = [
  {
    day: 1,
    title: '*확정 일정표를 통한 인솔자 연락처 확인이 가능합니다.',
    routeText: '',
    imageKeyword: '',
    imageKeyword2: null as string | null,
  },
  {
    day: 2,
    title: '카이 · 행잉 교회',
    routeText: '카이 - 아기예수 피난 교회 - 성조지 교회 - 행잉 교회',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 3,
    title: '멤피스 · 멤피스 야외 박물관',
    routeText: '멤피스 - 카이 - 사카라 피라미드 - 멤피스 야외 박물관',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 4,
    title: '카이 · 기자의 피라미드와 스핑크스',
    routeText: '카이 - 기자 주 - 아스완 - 칸 엘 칼릴리 - 피라미드 내부 - 문명박물관 - 기자의 피라미드와 스핑크스',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 5,
    title: '아스완 · 미완성의 오벨리스크',
    routeText: '아스완 - 필레신전 - 누비안 빌리지 - 미완성의 오벨리스크',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 6,
    title: '아부심벨 신전 · 콤옴보 신전',
    routeText: '아부심벨 신전 - 아스완 - 콤옴보 - 아스완 하이댐 - 콤옴보 신전',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 7,
    title: '에드푸 · 카르나크 신전',
    routeText: '에드푸 - 룩소르 - 에드푸 신전 (호루스 신전) - 멤논의 거상 - 왕가의 계곡 - 핫셉수트 여왕의 장제전 - 카르나크 신전',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 8,
    title: '후루가다 · 사파리+잠수정',
    routeText: '후루가다 - 후르가다 - 사파리+잠수정',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 9,
    title: '카이 · 행잉 교회',
    routeText: '카이 - 그랜드뮤지엄 - 행잉 교회',
    imageKeyword: '',
    imageKeyword2: null,
  },
  {
    day: 10,
    title: '귀국',
    routeText: '',
    imageKeyword: '',
    imageKeyword2: null,
  },
]

describe('ModeTour EMP151 Egypt Coptic Day1/Day2 keywords', () => {
  it('maps 카이 truncation and Coptic church POIs', () => {
    expect(mapDestination('카이')).toBe('Cairo')
    expect(mapKoreanPoiSegment('행잉 교회')).toBe('Hanging Church')
    expect(mapKoreanPoiSegment('성조지 교회')).toBe('Saint George Church')
    expect(mapKoreanPoiSegment('아기예수 피난 교회')).toBe('Abu Serga Church')
    expect(mapKoreanPoiSegment('그랜드뮤지엄')).toBe('Grand Egyptian Museum')
    expect(firstMatchingScheduleSpotEn('행잉 교회')).toBe('Hanging Church')
    expect(firstMatchingScheduleSpotEn('그랜드뮤지엄')).toBe('Grand Egyptian Museum')
  })

  it('Day1/Day2 must not stay empty after apply (supplierKey: modetour)', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      EMP151_ROWS.map((r) => ({ ...r })),
      {
        supplierKey: 'modetour',
        productDestination: '이집트',
        productTitle:
          '[출발확정/유류할증료 고정] 이집트 일주 10일 <노쇼핑/나일강크루즈/후루가다/그랜드뮤지엄/투탕카멘무덤내부>',
        travelScope: 'package',
      },
    )
    const byDay = new Map(out.map((r) => [Number(r.day), r]))

    const d1 = byDay.get(1)!
    const d2 = byDay.get(2)!
    expect(String(d1.imageKeyword || '').trim().length).toBeGreaterThan(0)
    expect(String(d2.imageKeyword || '').trim().length).toBeGreaterThan(0)

    // Day2 owns Coptic Cairo route — not empty soft city only after churches mapped
    const d2hay = `${d2.imageKeyword} ${d2.imageKeyword2 || ''}`.toLowerCase()
    expect(
      /hanging\s*church|abu\s*serga|saint\s*george|cairo/i.test(d2hay),
    ).toBe(true)

    // Day1 soft-fill from next Cairo visit — not empty contact-only card
    expect(/cairo|hanging|church/i.test(String(d1.imageKeyword))).toBe(true)

    // Day9 owns Grand Museum — primary must not be Kom Ombo bleed
    const d9 = byDay.get(9)!
    expect(String(d9.imageKeyword || '')).toMatch(/Grand Egyptian Museum/i)
    expect(String(d9.imageKeyword || '')).not.toMatch(/Kom\s*Ombo/i)
  })
})
