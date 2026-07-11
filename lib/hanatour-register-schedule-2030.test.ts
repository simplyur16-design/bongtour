/**
 * REGRESSION-FREEZE[hanatour-register-schedule-2030]
 */
import { describe, expect, it } from 'vitest'
import { hanatourFactDaysToRegisterSchedule } from '@/lib/hanatour-register-api-detail'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'
import {
  applyHanatour2030SchedulePolish,
  extractHanatour2030PoiFromCardLabel,
  filterHanatour2030FactScheduleDays,
  isHanatour2030ProductTitle,
  normalizeHanatour2030ListingTitle,
  polishHanatour2030RegisterBundle,
  resolveHanatour2030ProductTitleForDetect,
} from '@/lib/hanatour-register-schedule-2030'

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
})
