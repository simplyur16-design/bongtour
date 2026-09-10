import { describe, expect, it } from 'vitest'
import { parseNaeiltourProgramProcessListHtml } from '@/lib/naeiltour-departures'
import {
  productCountryScheduleMismatchIssues,
} from '@/lib/register-pre-photo-product-country-schedule-guard'
import { verifyRegisterPrePhoto } from '@/lib/register-pre-photo-verify'

// REGRESSION-FREEZE[naeiltour-program-process-departures]: parse fixture — manifest
// REGRESSION-FREEZE[register-pre-photo-product-country-schedule]: malaysia≠vietnam — manifest

describe('parseNaeiltourProgramProcessListHtml', () => {
  it('extracts departDate + adult price from program_process rows', () => {
    const html = `
<tbody id="sublist_product_list">
<tr onclick="location.href='/sub/view.asp?good_cd=MEZZ32084&event_seq=32943921'">
  <td><p class="corange">10/13(화) 10:50</p><p>10/21(수) 14:35</p></td>
  <td><p class="airline"><span class="btxt">아시아나항공</span></p></td>
  <td class="l"><span style="color: #000;font-size: 9pt;">예약 : 5명 / 좌석 : 20석</span></td>
  <td><p class="charge"><span class="disc">4,490,000</span></p></td>
</tr>
<tr onclick="location.href='/sub/view.asp?good_cd=MEZZ32084&event_seq=32943920'">
  <td><p class="corange">10/06(화) 10:50</p></td>
  <td><p class="airline"><span class="btxt">아시아나항공</span></p></td>
  <td class="l"><img alt="마감" />예약 : 22명 / 좌석 : 22석</td>
  <td><p class="charge"><span class="disc">4,790,000</span></p></td>
</tr>
</tbody>`
    const rows = parseNaeiltourProgramProcessListHtml(html, '202610')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      departDate: '2026-10-13',
      adultPrice: 4_490_000,
      eventSeq: '32943921',
      statusRaw: '예약가능',
      seatCount: 20,
    })
    expect(rows[1]).toMatchObject({
      departDate: '2026-10-06',
      adultPrice: 4_790_000,
      statusRaw: '마감',
    })
  })
})

describe('productCountryScheduleMismatchIssues', () => {
  it('blocks malaysia countryKey when schedule is Vietnam Da Nang', () => {
    const issues = productCountryScheduleMismatchIssues({
      countryKey: 'malaysia',
      productTitle: '5성호텔 #바나힐 5일',
      productDestination: '바나',
      rows: [
        { day: 1, routeText: '다낭 - 호이안', imageKeyword: 'Golden Bridge', imageKeyword2: null, description: null, title: null },
        { day: 2, routeText: '바나산 국립공원', imageKeyword: 'Da Nang', imageKeyword2: null, description: null, title: null },
      ],
    })
    expect(issues).toContain('product_country_schedule_mismatch')
  })

  it('blocks malaysia even when imageKeyword hallucinates Kota Kinabalu', () => {
    const issues = productCountryScheduleMismatchIssues({
      countryKey: 'malaysia',
      productTitle: '4일 #아일랜드호핑&랜드투어 #마사지',
      productDestination: '',
      rows: [
        {
          day: 1,
          routeText: '깔리보 - 까띠끌란 - 보라카이',
          imageKeyword: 'Boracay White Beach',
          imageKeyword2: null,
          description: null,
          title: null,
        },
        {
          day: 3,
          routeText: '까띠끌란 - 아일랜드 호핑',
          imageKeyword: 'Kota Kinabalu Island Hopping',
          imageKeyword2: null,
          description: null,
          title: null,
        },
      ],
    })
    expect(issues).toContain('product_country_schedule_mismatch')
  })

  it('blocks malaysia even when last-day schedule title is 쿠알라룸푸르 poison', () => {
    const issues = productCountryScheduleMismatchIssues({
      countryKey: 'malaysia',
      productTitle: '5성호텔 #신라모노그램 망고빙수 #전신마사지 #바나힐 5일',
      productDestination: '바나',
      rows: [
        {
          day: 1,
          routeText: '다낭 - 호이안',
          imageKeyword: 'Golden Bridge',
          imageKeyword2: null,
          description: '인천에서 출발해 다낭에서 도착합니다.',
          title: '다낭',
        },
        {
          day: 5,
          routeText: '',
          imageKeyword: null,
          imageKeyword2: null,
          description: '체크아웃 후 인천으로 귀국합니다.',
          title: '쿠알라룸푸르',
        },
      ],
    })
    expect(issues).toContain('product_country_schedule_mismatch')
  })

  it('blocks when title matches countryKey but schedule body is another country', () => {
    const issues = productCountryScheduleMismatchIssues({
      countryKey: 'japan',
      productTitle: '오사카 자유여행 3일',
      productDestination: '오사카',
      rows: [
        {
          day: 1,
          routeText: '다낭 - 호이안',
          imageKeyword: 'Osaka Castle',
          imageKeyword2: null,
          description: '다낭 시내 관광',
          title: '오사카',
        },
      ],
    })
    expect(issues).toContain('product_country_schedule_mismatch')
  })

  it('allows japan when schedule body has 북해도 evidence', () => {
    const issues = productCountryScheduleMismatchIssues({
      countryKey: 'japan',
      productTitle: '북해도 4일',
      productDestination: '삿포로',
      rows: [
        {
          day: 1,
          routeText: '삿포로 - 오타루',
          imageKeyword: 'Sapporo',
          imageKeyword2: null,
          description: '북해도 도착',
          title: '삿포로',
        },
      ],
    })
    expect(issues).toEqual([])
  })

  it('does not treat 비즈니스 as france Nice', () => {
    const issues = productCountryScheduleMismatchIssues({
      countryKey: 'united-arab-emirates',
      productTitle: '[비즈니스] 두바이 9일',
      productDestination: '두바이',
      rows: [
        {
          day: 1,
          routeText: '두바이 - 아부다비',
          imageKeyword: 'Dubai Marina',
          imageKeyword2: null,
          description: '두바이 시내',
          title: '두바이',
        },
      ],
    })
    expect(issues).toEqual([])
  })
  it('blocks poland when schedule is Baltic 3 countries', () => {
    const issues = productCountryScheduleMismatchIssues({
      countryKey: 'poland',
      productTitle: '발틱3국 8일 #스파',
      productDestination: '유럽',
      rows: [
        {
          day: 1,
          routeText: '바르샤바 - 빌니우스',
          imageKeyword: null,
          imageKeyword2: null,
          description: '빌니우스 구시가지',
          title: '빌니우스',
        },
        {
          day: 2,
          routeText: '리가 - 탈린',
          imageKeyword: null,
          imageKeyword2: null,
          description: '리가 구시가지와 탈린',
          title: '리가',
        },
      ],
    })
    expect(issues).toContain('product_country_schedule_mismatch')
  })

  it('allows nordic-baltic when schedule is Baltic 3 countries', () => {
    const issues = productCountryScheduleMismatchIssues({
      countryKey: 'nordic-baltic',
      productTitle: '발틱3국 8일',
      productDestination: '발틱',
      rows: [
        {
          day: 1,
          routeText: '빌니우스 - 트라카이',
          imageKeyword: null,
          imageKeyword2: null,
          description: null,
          title: '빌니우스',
        },
        {
          day: 2,
          routeText: '리가 - 탈린',
          imageKeyword: null,
          imageKeyword2: null,
          description: null,
          title: '탈린',
        },
      ],
    })
    expect(issues).toEqual([])
  })

  it('allows spain when portugal also appears in body (Iberia)', () => {
    const issues = productCountryScheduleMismatchIssues({
      countryKey: 'spain',
      productTitle: '스페인/포르투갈 9일',
      productDestination: '스페인',
      rows: [
        {
          day: 1,
          routeText: '마드리드 - 톨레도',
          imageKeyword: null,
          imageKeyword2: null,
          description: '마드리드 시내',
          title: '마드리드',
        },
        {
          day: 2,
          routeText: '리스본 - 파티마',
          imageKeyword: null,
          imageKeyword2: null,
          description: '포르투갈 리스본',
          title: '리스본',
        },
      ],
    })
    expect(issues).toEqual([])
  })
  it('allows iceland-only without forcing nordic-baltic', () => {
    const issues = productCountryScheduleMismatchIssues({
      countryKey: 'iceland',
      productTitle: '아이슬란드 8일 #오로라',
      productDestination: '아이슬란드',
      rows: [
        {
          day: 1,
          routeText: '레이캬비크 - 블루라군',
          imageKeyword: null,
          imageKeyword2: null,
          description: '아이슬란드 도착',
          title: '레이캬비크',
        },
      ],
    })
    expect(issues).toEqual([])
  })

  it('blocks nordic-baltic when content is iceland-only (over-broad regional)', () => {
    const issues = productCountryScheduleMismatchIssues({
      countryKey: 'nordic-baltic',
      productTitle: '아이슬란드 8일 #오로라',
      productDestination: '아이슬란드',
      rows: [
        {
          day: 1,
          routeText: '레이캬비크 - 블루라군',
          imageKeyword: null,
          imageKeyword2: null,
          description: '아이슬란드 도착',
          title: '레이캬비크',
        },
      ],
    })
    expect(issues).toContain('product_country_schedule_mismatch')
  })

  it('allows switzerland-only without nordic-baltic cluster', () => {
    const issues = productCountryScheduleMismatchIssues({
      countryKey: 'switzerland',
      productTitle: '스위스여행 9일 #융프라우',
      productDestination: '스위스',
      rows: [
        {
          day: 1,
          routeText: '취리히 - 루체른',
          imageKeyword: null,
          imageKeyword2: null,
          description: '인터라켄',
          title: '취리히',
        },
      ],
    })
    expect(issues).toEqual([])
  })
  it('does not treat 그린델발트 as Baltic marker', () => {
    const issues = productCountryScheduleMismatchIssues({
      countryKey: 'switzerland',
      productTitle: '스위스여행 9일 #융프라우',
      productDestination: '스위스',
      rows: [
        {
          day: 1,
          routeText: '루체른 - 그린델발트 - 융프라우요흐',
          imageKeyword: null,
          imageKeyword2: null,
          description: '그린델발트를 둘러봅니다',
          title: '그린델발트',
        },
      ],
    })
    expect(issues).toEqual([])
  })
})

describe('scrubPoisonedScheduleDayTitlesForCountryKey', () => {
  it('clears 쿠알라룸푸르 return-day title when countryKey is vietnam', async () => {
    const { scrubPoisonedScheduleDayTitlesForCountryKey } = await import(
      '@/lib/register-pre-photo-country-schedule-self-heal'
    )
    const { rows, scrubbedDays } = scrubPoisonedScheduleDayTitlesForCountryKey({
      countryKey: 'vietnam',
      rows: [
        {
          day: 1,
          title: '다낭',
          routeText: '다낭 - 호이안',
          description: null,
          imageKeyword: null,
          imageKeyword2: null,
        },
        {
          day: 5,
          title: '쿠알라룸푸르',
          routeText: '',
          description: '인천 귀국',
          imageKeyword: null,
          imageKeyword2: null,
        },
      ],
    })
    expect(scrubbedDays).toEqual([5])
    expect(rows[1]?.title).toBeNull()
    expect(rows[0]?.title).toBe('다낭')
  })

  it('clears 상세보기 day title', async () => {
    const { scrubPoisonedScheduleDayTitlesForCountryKey } = await import(
      '@/lib/register-pre-photo-country-schedule-self-heal'
    )
    const { scrubbedDays, rows } = scrubPoisonedScheduleDayTitlesForCountryKey({
      countryKey: 'tunisia',
      rows: [
        {
          day: 1,
          title: '상세보기',
          routeText: '튀니스',
          description: null,
          imageKeyword: null,
          imageKeyword2: null,
        },
      ],
    })
    expect(scrubbedDays).toContain(1)
    expect(rows[0]?.title).toBeNull()
  })

  it('flags empty countryKey with strong schedule hints as needing geo heal', async () => {
    const { pendingNeedsCountryScheduleGeoHeal } = await import(
      '@/lib/register-pre-photo-country-schedule-self-heal'
    )
    expect(
      pendingNeedsCountryScheduleGeoHeal({
        countryKey: null,
        productTitle: '보천+태항대협곡/천계산/팔리구_5일',
        productDestination: '제남',
        rows: [
          {
            day: 1,
            title: '제남 · 황하',
            routeText: '제남 - 황하',
            description: null,
            imageKeyword: null,
            imageKeyword2: null,
          },
        ],
      }),
    ).toBe(true)
  })
})

describe('verifyRegisterPrePhoto countryKey gate', () => {
  it('fails live queue when countryKey contradicts schedule', () => {
    const v = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '●추석연휴 발틱3국 8일',
      productDestination: '●추석연휴',
      countryKey: 'malaysia',
      rows: [
        {
          day: 1,
          routeText: '바르샤바 - 빌니우스',
          imageKeyword: 'Warsaw Old Town Square Poland',
          imageKeyword2: null,
          description: null,
          title: null,
        },
        {
          day: 2,
          routeText: '트라카이 성',
          imageKeyword: 'Trakai Island Castle Lithuania',
          imageKeyword2: null,
          description: null,
          title: null,
        },
      ],
    })
    expect(v.ok).toBe(false)
    expect(v.issues).toContain('product_country_schedule_mismatch')
    expect(v.parserFixRequired).toBe(true)
  })

  it('fails when last-day title is 쿠알라룸푸르 hub poison', () => {
    const v = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '북해도 4일',
      productDestination: '삿포로',
      countryKey: 'japan',
      rows: [
        {
          day: 1,
          routeText: '치토세 - 삿포로',
          imageKeyword: 'Sapporo',
          imageKeyword2: null,
          description: '북해도 도착',
          title: '치토세',
        },
        {
          day: 4,
          routeText: '',
          imageKeyword: null,
          imageKeyword2: null,
          description: '귀국',
          title: '쿠알라룸푸르',
        },
      ],
    })
    expect(v.ok).toBe(false)
    expect(v.issues.some((i) => i.includes('title_hub_poison'))).toBe(true)
  })
})
