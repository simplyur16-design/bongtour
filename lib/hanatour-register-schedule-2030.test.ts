/**
 * REGRESSION-FREEZE[hanatour-register-schedule-2030]
 */
import { describe, expect, it } from 'vitest'
import { hanatourFactDaysToRegisterSchedule } from '@/lib/hanatour-register-api-detail'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import {
  applyHanatour2030SchedulePolish,
  applyHanatour2030RegisterConfirmGuard,
  collectHanatour2030RegisterScheduleConfirmIssues,
  extractHanatour2030PoiFromCardLabel,
  filterHanatour2030FactScheduleDays,
  hanatour2030ConfirmScheduleBlockReason,
  hanatour2030RegisterScheduleOkAtConfirm,
  isHanatour2030ProductTitle,
  mergeHanatour2030SportsThemeTagForRegister,
  normalizeHanatour2030ListingTitle,
  polishHanatour2030RegisterBundle,
  repolishHanatour2030ParsedAtRegisterConfirm,
  resolveHanatour2030ProductTitleForDetect,
  stripHanatour2030ChildInfantPrices,
} from '@/lib/hanatour-register-schedule-2030'
import { hanatourConfirmHasScheduleExpressionLayer } from '@/lib/parse-and-register-hanatour-schedule'
import type { RegisterParsed } from '@/lib/register-llm-schema-hanatour'

const JOP191_TITLE =
  ' [2030전용] 고베/오사카/교토/이네후나야 3일 #밍글링Light #일본속베네치아 #낭만가득고베의밤 #천연온천 #요나키소바야식 #오사카성공원 #쇼핑메카'

const JOP191_FACT_DAYS: RegisterFactScheduleDay[] = [
  {
    day: 1,
    places: [
      '일본 방문객 출입국 절차 안내',
      '✨밍글링 투어 Light✨',
      '#모토마치 #고베 대표번화가 #전통상점가&현대식쇼핑거리',
      '노미타베호다이',
      '#체크인 후에도 낭만가득 고베의 밤 만끽 #Dormy Inn Kobe Motomachi',
    ],
    hotels: [],
    meals: ['석식'],
    transportNote: null,
  },
  {
    day: 2,
    places: [
      '자연이 만들어낸 신비로운 절경 #아마노하시다테',
      '일정식 요리',
      '교토에서 만나는 바다, 수상가옥 이네후나야(伊根舟屋)',
      '#이네후나야 속 밍글 : ) 자유시간 #추천일정 #포토스팟',
    ],
    hotels: [],
    meals: ['조식', '중식', '석식'],
    transportNote: null,
  },
  {
    day: 3,
    places: [
      '인생샷 가능! 오사카 랜드마크 오사카성(Osaka Castle)',
      '신세카이',
      '#내가 만들어서 더 특별한, 오사카 명물 타코야키 체험 #업로드가자',
    ],
    hotels: [],
    meals: ['조식', '중식'],
    transportNote: null,
  },
]

describe('hanatour 2030 schedule polish', () => {
  it('detects 2030 product title', () => {
    expect(isHanatour2030ProductTitle(JOP191_TITLE)).toBe(true)
    expect(isHanatour2030ProductTitle('홍콩 3일 #베스트')).toBe(false)
  })

  it('extractHanatour2030PoiFromCardLabel — 밍글링·안내 제외, POI만', () => {
    expect(extractHanatour2030PoiFromCardLabel('✨밍글링 투어 Light✨')).toBeNull()
    expect(extractHanatour2030PoiFromCardLabel('일본 방문객 출입국 절차 안내')).toBeNull()
    expect(extractHanatour2030PoiFromCardLabel('#모토마치 #고베 대표번화가')).toBe('모토마치')
    expect(extractHanatour2030PoiFromCardLabel('자연이 만들어낸 신비로운 절경 #아마노하시다테')).toBe(
      '아마노하시다테',
    )
    expect(
      extractHanatour2030PoiFromCardLabel('교토에서 만나는 바다, 수상가옥 이네후나야(伊根舟屋)'),
    ).toBe('이네후나야')
    expect(extractHanatour2030PoiFromCardLabel('인생샷 가능! 오사카 랜드마크 오사카성(Osaka Castle)')).toBe(
      '오사카성',
    )
    expect(extractHanatour2030PoiFromCardLabel('신세카이')).toBe('신세카이')
  })

  it('detects 2030 from normalized listing title (2030) suffix', () => {
    expect(isHanatour2030ProductTitle('고베·오사카·이네 3일 (2030)')).toBe(true)
  })

  it('resolveHanatour2030ProductTitleForDetect — saleProdNm 우선(원제 보존)', () => {
    expect(
      resolveHanatour2030ProductTitleForDetect(
        JOP191_TITLE,
        '고베·오사카 3일 (2030)',
      ),
    ).toBe(JOP191_TITLE.trim())
    expect(
      resolveHanatour2030ProductTitleForDetect(
        '고베·오사카 3일 (2030)',
      ),
    ).toBe('고베·오사카 3일 (2030)')
  })

  it('JOP191 — routeText must not contain 밍글링', () => {
    const filtered = filterHanatour2030FactScheduleDays(JOP191_FACT_DAYS, JOP191_TITLE)
    expect(filtered[0]?.places).toEqual(['모토마치'])
    expect(filtered[1]?.places).toEqual(['아마노하시다테', '이네후나야'])
    expect(filtered[2]?.places).toEqual(['오사카성', '신세카이'])

    const base = hanatourFactDaysToRegisterSchedule(filtered)
    const out = applyHanatour2030SchedulePolish({
      schedule: base,
      factDays: filtered,
      productTitle: JOP191_TITLE,
    })

    expect(out[0]?.title).toBe('고베 입국 · 모토마치')
    expect(out[0]?.routeText).toBe('모토마치')
    expect(out[0]?.description).not.toBe(out[0]?.routeText)
    expect(out[0]?.description).toMatch(/이자카야|2030/)

    expect(out[1]?.title).toBe('아마노하시다테 · 이네후나야')
    expect(out[1]?.routeText).toBe('아마노하시다테 - 이네후나야')
    expect(out[1]?.description).toMatch(/자유|사진|2030/)

    expect(out[2]?.title).toBe('오사카성 · 신세카이')
    expect(out[2]?.routeText).toBe('오사카성 - 신세카이')
    expect(out[2]?.description).not.toMatch(/밍글|미션/)
    for (const row of out) {
      expect(String(row.routeText ?? '')).not.toMatch(/밍글|미션|출입국\s*절차/)
      expect(String(row.title ?? '')).not.toMatch(/밍글|Light/)
    }
  })

  it('wipes pre-polish mingling route and expands bare city middle day', () => {
    // REGRESSION-FREEZE[hanatour-register-schedule-2030]: mingling wipe + NY 시내 — manifest
    const title = '[2030전용] 뉴욕 7일 #밍글링Light'
    const polluted = [
      {
        day: 1,
        title: '밍글링 투어 Light - 밍글링 타임',
        description: 'x',
        routeText: '밍글링 투어 Light - 밍글링 타임',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 6,
        title: '뉴욕',
        description: 'x',
        routeText: '뉴욕',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 7,
        title: '3일차',
        description: 'x',
        routeText: '',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ]
    const out = applyHanatour2030SchedulePolish({
      productTitle: title,
      schedule: polluted,
      factDays: [
        { day: 1, places: ['밍글링 투어 Light', '밍글링 타임'], hotels: [], meals: [], transportNote: null },
        { day: 6, places: ['뉴욕'], hotels: [], meals: [], transportNote: null },
        { day: 7, places: [], hotels: [], meals: [], transportNote: '인천 귀국' },
      ],
    })
    expect(out[0]?.title).toMatch(/뉴욕\s*입국/)
    expect(out[0]?.routeText).not.toMatch(/밍글/)
    expect(out[0]?.title).not.toMatch(/^\d+\s*일차$/)
    expect(out[1]?.routeText).toBe('뉴욕 시내')
    expect(out[1]?.title).toMatch(/뉴욕/)
    expect(out[2]?.title).toMatch(/출발 및 인천 귀국/)
    expect(out[2]?.title).not.toMatch(/^\d+\s*일차$/)
  })

  it('free-day transportNote + bare city → route 「도시 자유 일정」 (not bare short)', () => {
    const title = '[2030전용] 뉴욕 7일 #2일 자유일정'
    const out = applyHanatour2030SchedulePolish({
      productTitle: title,
      schedule: [
        {
          day: 6,
          title: '뉴욕',
          description: 'x',
          routeText: '뉴욕',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      factDays: [{ day: 6, places: ['뉴욕'], hotels: [], meals: [], transportNote: '자유 일정' }],
    })
    expect(out[0]?.title).toMatch(/자유\s*일정/)
    expect(out[0]?.routeText).toBe('뉴욕 자유 일정')
    expect(out[0]?.routeText.length).toBeGreaterThanOrEqual(4)
  })

  it('HEP172 free day — transportNote 「도시; 도시 - 인천」 must not yield bare city route', () => {
    const title = '[2030전용] 뉴욕 7일 #2일 자유일정'
    const out = applyHanatour2030SchedulePolish({
      productTitle: title,
      schedule: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        title: 'x',
        description: 'x',
        routeText: 'x',
        imageKeyword: '',
        imageKeyword2: null,
      })),
      factDays: [
        { day: 1, places: ['뉴욕'], hotels: [], meals: [], transportNote: null },
        { day: 2, places: ['리틀 아일랜드'], hotels: [], meals: [], transportNote: null },
        { day: 3, places: ['타임스퀘어'], hotels: [], meals: [], transportNote: null },
        { day: 4, places: ['센트럴 파크'], hotels: [], meals: [], transportNote: null },
        { day: 5, places: ['파크'], hotels: [], meals: [], transportNote: '뉴욕' },
        {
          day: 6,
          places: [],
          hotels: ['뉴욕 맨해튼 중심에 위치한 시내 호텔'],
          meals: [],
          transportNote: '뉴욕; 뉴욕 - 인천',
        },
        { day: 7, places: [], hotels: [], meals: [], transportNote: '인천' },
      ],
    })
    const d6 = out.find((r) => r.day === 6)!
    expect(d6.title).toMatch(/자유\s*일정/)
    expect(d6.routeText).toBe('뉴욕 자유 일정')
    expect(d6.routeText).not.toBe('뉴욕')
  })

  it('splits dashed CMS place blob into title middot (not full route paste)', () => {
    const title = '[2030전용] 푸꾸옥 5일'
    const out = applyHanatour2030SchedulePolish({
      productTitle: title,
      schedule: [
        {
          day: 2,
          title: 'x',
          description: 'x',
          routeText: 'x',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      factDays: [
        {
          day: 2,
          places: ['크레이지 호핑 - 소나시 비치바 푸꾸옥 - 베스트웨스턴 비치클럽'],
          hotels: [],
          meals: [],
          transportNote: null,
        },
      ],
    })
    expect(out[0]?.title).toBe('크레이지 호핑 · 소나시 비치바 푸꾸옥')
    expect(out[0]?.routeText).toContain(' - ')
    expect(out[0]?.title).not.toBe(out[0]?.routeText)
  })

  it('normalizeHanatour2030ListingTitle — (2030) 접미·밍글링 해시 제거', () => {
    const t = normalizeHanatour2030ListingTitle(JOP191_TITLE)
    expect(t).toMatch(/\(2030\)\s*$/)
    expect(t).not.toMatch(/밍글링|2030전용/)
    expect(t).toMatch(/고베·오사카/)
  })

  it('polishHanatour2030RegisterBundle — 비2030은 no-op', () => {
    const days = [{ day: 1, places: ['방콕'], hotels: [], meals: [], transportNote: null }]
    const sched = hanatourFactDaysToRegisterSchedule(days)
    const out = polishHanatour2030RegisterBundle({
      productTitle: '방콕 3일',
      factDays: days,
      schedule: sched,
      listingTitle: '방콕 3일',
    })
    expect(out.schedule).toEqual(sched)
    expect(out.listingTitle).toBe('방콕 3일')
  })

  it('confirm guard — 오염 일정은 이슈, 재정제 후 통과', () => {
    const pollutedSchedule = hanatourFactDaysToRegisterSchedule(JOP191_FACT_DAYS)
    const polluted: RegisterParsed = {
      originSource: 'hanatour',
      originCode: 'JOP191',
      title: JOP191_TITLE,
      supplierListingTitleRaw: JOP191_TITLE,
      destination: '일본',
      schedule: pollutedSchedule,
      prices: [],
    }
    expect(collectHanatour2030RegisterScheduleConfirmIssues(polluted).length).toBeGreaterThan(0)

    const repolished = repolishHanatour2030ParsedAtRegisterConfirm(polluted)
    expect(hanatour2030RegisterScheduleOkAtConfirm(repolished)).toBe(true)

    const guarded = applyHanatour2030RegisterConfirmGuard(polluted)
    expect(hanatour2030RegisterScheduleOkAtConfirm(guarded)).toBe(true)
    expect(guarded.title).toMatch(/\(2030\)\s*$/)
    expect(guarded.schedule[0]?.routeText).toBe('모토마치')
    expect(guarded.extractionFieldIssues?.some((i) => i.field === 'hanatour2030.price.adultOnly')).toBe(
      true,
    )
  })

  it('hanatourConfirmHasScheduleExpressionLayer — 2030 미충족 시 false', () => {
    const pollutedSchedule = hanatourFactDaysToRegisterSchedule(JOP191_FACT_DAYS)
    const polluted: RegisterParsed = {
      originSource: 'hanatour',
      originCode: 'JOP191',
      title: JOP191_TITLE,
      supplierListingTitleRaw: JOP191_TITLE,
      destination: '일본',
      schedule: pollutedSchedule,
      prices: [],
    }
    expect(hanatourConfirmHasScheduleExpressionLayer(polluted, [])).toBe(false)
    const guarded = applyHanatour2030RegisterConfirmGuard(polluted)
    expect(hanatourConfirmHasScheduleExpressionLayer(guarded, [])).toBe(true)
    expect(hanatour2030ConfirmScheduleBlockReason(polluted)).toMatch(/2030 TRP/)
    expect(hanatour2030ConfirmScheduleBlockReason(guarded)).toBeNull()
  })

  it('JKP135 Light 제목 — confirm reuse 스킵 후에도 guard면 (2030) 접미·게이트 통과', () => {
    const title =
      '규슈·후쿠오카 3일 투어 Light #해안가 사이클링 #유유자적 섬마을 시카노시마 #일본감성 풀충전 #주류무한 이자카야 #공항↔호텔 왕복 송영 #또래 친구 만들기'
    const schedule = [
      {
        day: 1,
        title: '규슈 입국',
        description: '현지에 도착한 뒤 도심을 걸으며 일정 리듬을 맞추는 첫날입니다.',
        routeText: '후쿠오카',
      },
      {
        day: 2,
        title: '시카노시마',
        description: '도심과 근교를 오가며 걷기 좋은 동선입니다.',
        routeText: '시카노시마',
      },
      {
        day: 3,
        title: '귀국',
        description: '랜드마크와 로컬 거리를 걸으며 마무리하는 하루입니다.',
        routeText: '인천',
      },
    ]
    const persisted: RegisterParsed = {
      originSource: 'hanatour',
      originCode: 'JKP135260729ZEC',
      title,
      supplierListingTitleRaw: title,
      destination: '일본',
      schedule,
      productPriceTable: {
        adultPrice: 1_179_900,
        childExtraBedPrice: 1_079_900,
        childNoBedPrice: 999_000,
        infantPrice: 150_000,
      },
      prices: [
        {
          departureDate: '2026-07-29',
          adultPrice: 1_179_900,
          status: 'available',
          childBedBase: 1_079_900,
          childNoBedBase: 999_000,
          infantBase: 150_000,
          childFuel: 50_000,
          infantFuel: 10_000,
        },
      ],
    }
    expect(isHanatour2030ProductTitle(title)).toBe(true)
    expect(hanatourConfirmHasScheduleExpressionLayer(persisted, [])).toBe(false)
    const guarded = applyHanatour2030RegisterConfirmGuard(persisted)
    expect(guarded.title).toMatch(/\(2030\)\s*$/)
    expect(hanatourConfirmHasScheduleExpressionLayer(guarded, [])).toBe(true)
    expect(hanatour2030ConfirmScheduleBlockReason(guarded)).toBeNull()
    expect(guarded.productPriceTable?.adultPrice).toBe(1_179_900)
    expect(guarded.productPriceTable?.childExtraBedPrice).toBeNull()
    expect(guarded.productPriceTable?.childNoBedPrice).toBeNull()
    expect(guarded.productPriceTable?.infantPrice).toBeNull()
    expect(guarded.prices[0]?.childBedBase).toBeUndefined()
    expect(guarded.prices[0]?.childNoBedBase).toBeUndefined()
    expect(guarded.prices[0]?.infantBase).toBeUndefined()
    expect(guarded.prices[0]?.childFuel).toBe(0)
    expect(guarded.prices[0]?.infantFuel).toBe(0)
    expect(guarded.extractionFieldIssues?.some((i) => i.field === 'hanatour2030.price.adultOnly')).toBe(
      true,
    )
  })

  it('stripHanatour2030ChildInfantPrices — 비2030은 아동·유아 유지', () => {
    const parsed: RegisterParsed = {
      originSource: 'hanatour',
      originCode: 'BKK001',
      title: '방콕 3일',
      destination: '태국',
      schedule: [],
      productPriceTable: {
        adultPrice: 900_000,
        childExtraBedPrice: 800_000,
        childNoBedPrice: null,
        infantPrice: 100_000,
      },
      prices: [
        {
          departureDate: '2026-08-01',
          adultPrice: 900_000,
          status: 'available',
          childBedBase: 800_000,
          infantBase: 100_000,
          childFuel: 0,
          infantFuel: 0,
        },
      ],
    }
    const out = stripHanatour2030ChildInfantPrices(parsed)
    expect(out).toBe(parsed)
    expect(out.productPriceTable?.childExtraBedPrice).toBe(800_000)
    expect(out.prices[0]?.childBedBase).toBe(800_000)
  })

  it('hanatourConfirmHasScheduleExpressionLayer — 자유여행(air-hotel)은 일정 없어도 통과', () => {
    const parsed: RegisterParsed = {
      originSource: 'hanatour',
      originCode: 'FIT001',
      title: '방콕 자유여행 3박 5일',
      destination: '태국',
      productType: 'air-hotel',
      schedule: [],
      prices: [{ departureDate: '2026-08-01', adultPrice: 890000, status: 'available' }],
    }
    expect(hanatourConfirmHasScheduleExpressionLayer(parsed, [])).toBe(true)
  })

  it('mergeHanatour2030SportsThemeTagForRegister — 2030 TRP는 sportsThemeTag 2030 자동', () => {
    expect(mergeHanatour2030SportsThemeTagForRegister([], { title: JOP191_TITLE })).toEqual(['2030'])
    expect(
      mergeHanatour2030SportsThemeTagForRegister(['running'], {
        title: '고베·오사카 3일 (2030)',
      }),
    ).toEqual(['2030', 'running'])
    expect(mergeHanatour2030SportsThemeTagForRegister([], { title: '방콕 3일' })).toEqual([])
  })
})
