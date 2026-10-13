/**
 * REGRESSION-FREEZE[schedule-poi-turkey-rose-valley-balat]: 로즈밸리·발랏·피에르로티 — manifest
 */
import { describe, expect, it } from 'vitest'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { healRegisterPrePhotoSchedule } from '@/lib/register-pre-photo-self-heal'
import { verifyRegisterPrePhoto } from '@/lib/register-pre-photo-verify'

describe('schedule-poi-turkey-rose-valley-balat', () => {
  it('maps Rose Valley / Pierre Loti / Camlica / Kuzguncuk spots', () => {
    expect(firstMatchingScheduleSpotEn('로즈밸리 트레킹')).toMatch(/Rose Valley Cappadocia/i)
    expect(firstMatchingScheduleSpotEn('로즈벨리')).toMatch(/Rose Valley Cappadocia/i)
    expect(firstMatchingScheduleSpotEn('피에르 로티 언덕')).toMatch(/Pierre Loti Hill/i)
    expect(firstMatchingScheduleSpotEn('참르자 언덕')).toMatch(/Camlica Hill/i)
    expect(firstMatchingScheduleSpotEn('쿠즈군주크 감성 골목')).toMatch(/Kuzguncuk/i)
    expect(firstMatchingScheduleSpotEn('발랏 지구')).toMatch(/Balat/i)
  })

  it('2030 Turkey 9-day — day3 Rose Valley + day8 Pierre Loti pass verify', { timeout: 20_000 }, () => {
    const rows = [
      {
        day: 1,
        title: '튀르키예 입국 · 이스탄불 야경',
        routeText: '이스탄불 야경',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '카파도키아 · 괴츠파사르',
        routeText: '카파도키아 - 괴츠파사르 - 파샤바계곡 - 야베 야외박물관',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '괴레메 시내 · 로즈밸리 트레킹',
        routeText: '괴레메 시내 - 로즈밸리 트레킹 - 카파도키아 로즈밸리 선셋요가 - 로즈벨리',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '추천일정 1day',
        routeText: '돌마바흐체 궁전 - 오르타쾨이 모스크 - 루멜리 요새 - 갈라타 탑',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 5,
        title: '그랜드 바자르 · 이스탄불 전통시장',
        routeText: '그랜드 바자르 - 이스탄불 전통시장',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 6,
        title: '참르자 언덕 · Kuzguncuk 쿠즈군주크 감성 골목',
        routeText: '참르자 언덕 - Kuzguncuk 쿠즈군주크 감성 골목',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 7,
        title: '하기아 소피아 성당 · 블루 모스크',
        routeText: '하기아 소피아 성당 - 블루 모스크 - 힙포드럼',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 8,
        title: '발랏 지구 · 피에르 로티 언덕',
        routeText: '발랏 지구 - 피에르 로티 언덕',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 9,
        title: '튀르키예 출발 · 인천 귀항',
        routeText: '튀르키예 출발 · 인천 귀항',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ]
    const allocated = applyRegisterScheduleImageKeywordsBySupplier(rows, {
      supplierKey: 'hanatour',
      productDestination: '이스탄불',
      productTitle: '[2030전용] 튀르키예 일주 9일 #카파도키아3박 #열기구도전 #로즈밸리',
      travelScope: 'package',
    })
    const healed = healRegisterPrePhotoSchedule(allocated, {
      supplierKey: 'hanatour',
      productDestination: '이스탄불',
      productTitle: '[2030전용] 튀르키예 일주 9일 #카파도키아3박 #열기구도전 #로즈밸리',
      lane: 'package',
      countryKey: 'TR',
    })
    const day3 = healed.rows.find((r) => r.day === 3)
    const day8 = healed.rows.find((r) => r.day === 8)
    expect(String(day3?.imageKeyword ?? '')).toMatch(/Rose Valley Cappadocia/i)
    expect(String(day8?.imageKeyword ?? '')).toMatch(/Pierre Loti Hill|Balat/i)
    const v = verifyRegisterPrePhoto({
      lane: 'package',
      listingKind: 'travel',
      productDestination: '이스탄불',
      productTitle: '[2030전용] 튀르키예 일주 9일 #카파도키아3박 #열기구도전 #로즈밸리',
      countryKey: 'TR',
      rows: healed.rows.map((r) => ({
        day: Number(r.day) || 0,
        title: r.title ?? null,
        description: r.description ?? null,
        routeText: r.routeText ?? null,
        imageKeyword: r.imageKeyword ?? null,
        imageKeyword2: r.imageKeyword2 ?? null,
      })),
    })
    expect(v.ok).toBe(true)
    expect(v.issues).toEqual([])
  })
})
