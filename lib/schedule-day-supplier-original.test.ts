import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  attachScheduleDaySupplierOriginalFromFactDays,
  buildScheduleDaySupplierOriginalView,
  parseScheduleDaySupplierOriginal,
  scheduleDaySupplierOriginalViewText,
  type ScheduleDaySupplierOriginal,
} from '@/lib/schedule-day-supplier-original'
import { ScheduleDaySupplierOriginalToggle } from '@/components/itinerary/ScheduleDaySupplierOriginalToggle'
import { buildRegisterProductScheduleJson } from '@/lib/build-register-product-schedule-json'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'
import { healRegisterPrePhotoSchedule } from '@/lib/register-pre-photo-self-heal'
import { hanatourFactDaysToRegisterSchedule } from '@/lib/hanatour-register-api-detail'

/** 하나투어 FIT 원문 형태의 합성 픽스처 (가격·고객정보 없음) */
const ORIG: ScheduleDaySupplierOriginal = {
  v: 1,
  source: 'hanatour',
  capturedAt: '2026-10-30T10:49:00.000Z',
  items: [
    { label: null, name: '일본 방문객 출입국 절차 안내', text: null },
    { label: null, name: '간사이 국제 공항-아라시야마로 이동 (약 1시간 30분 소요)', text: null },
    { label: '관광', name: '자연과 여유, 아라시야마를 걷다 [ARASHIYAMA:嵐山]', text: '치쿠린 대나무 숲길을 걷습니다.\n도게츠교 산책' },
  ],
  hotelText: '교토 우메코지 카덴쇼 / 카덴쇼, 아라시야마 온센',
  breakfastText: null,
  lunchText: '일정식',
  dinnerText: '카이세키',
}
const DAY = {
  day: 1,
  title: '초록빛 대나무 숲에서 시작하는 힐링의 첫걸음',
  routeText: '자연과 여유, 아라시야마를 걷다 [ARASHIYAMA:嵐山] - 교토 [KYOTO:京都]',
  supplierOriginal: ORIG,
}
const TOKEN_RE = /[0-9A-Za-z가-힣ぁ-んァ-ン一-龥]+/g
const tokens = (s: string) => s.match(TOKEN_RE) ?? []
const decode = (html: string) =>
  html.replace(/<[^>]+>/g, '\n').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

describe('schedule-day-supplier-original', () => {
  it('view: 조식/중식/석식 labels, empty meal hidden, routeText shown when different from title', () => {
    const v = buildScheduleDaySupplierOriginalView(DAY)!
    expect(v.meals).toEqual([
      { label: '중식', value: '일정식' },
      { label: '석식', value: '카이세키' },
    ])
    expect(v.routeLine).toBe(DAY.routeText)
    expect(buildScheduleDaySupplierOriginalView({ ...DAY, title: DAY.routeText })!.routeLine).toBeNull()
  })

  it('view: 없음·불포함·기내식 shown verbatim; blank hotel/meals hidden; internal words never shown', () => {
    const v = buildScheduleDaySupplierOriginalView({
      day: 2,
      title: 't',
      supplierOriginal: {
        ...ORIG,
        items: [{ label: null, name: '(원문 순서) 공항 이동', text: '원문 미기재' }],
        hotelText: '  ',
        breakfastText: '없음',
        lunchText: '불포함',
        dinnerText: '기내식',
      },
    })!
    expect(v.hotelText).toBeNull()
    expect(v.meals.map((m) => m.value)).toEqual(['없음', '불포함', '기내식'])
    const txt = scheduleDaySupplierOriginalViewText(v)
    expect(txt).not.toMatch(/원문\s*순서|원문\s*미기재/)
    expect(txt).toContain('공항 이동')
  })

  it('no stored original → no toggle rendered', () => {
    expect(buildScheduleDaySupplierOriginalView({ day: 1, title: 'x' })).toBeNull()
    expect(renderToStaticMarkup(createElement(ScheduleDaySupplierOriginalToggle, { day: { day: 1, title: 'x' } }))).toBe('')
    expect(parseScheduleDaySupplierOriginal({ v: 1, source: 'x', items: [] })).toBeNull()
  })

  it('toggle: accessible button, closed by default (aria-expanded=false + hidden panel), no dates', () => {
    const html = renderToStaticMarkup(createElement(ScheduleDaySupplierOriginalToggle, { day: DAY }))
    expect(html).toContain('<button type="button" aria-expanded="false"')
    expect(html).toContain('원문 보기')
    expect(html).toMatch(/role="region"[^>]*hidden=""/)
    expect(html).not.toMatch(/20\d\d[.\-/]\s?\d{1,2}[.\-/]\s?\d{1,2}|\d{1,2}월\s?\d{1,2}일|\([월화수목금토일]\)/)
    expect(html).not.toContain('2026-10-30')
    const open = renderToStaticMarkup(createElement(ScheduleDaySupplierOriginalToggle, { day: DAY, defaultOpen: true }))
    expect(open).toContain('aria-expanded="true"')
    expect(open).not.toMatch(/role="region"[^>]*hidden=""/)
  })

  it('token integrity: every token of the stored original (+routeText) appears in the toggle, in order per field', () => {
    const html = renderToStaticMarkup(createElement(ScheduleDaySupplierOriginalToggle, { day: DAY, defaultOpen: true }))
    const shown = tokens(decode(html))
    const src = [
      DAY.routeText,
      ...ORIG.items.flatMap((i) => [i.label, i.name, i.text]),
      ORIG.hotelText,
      ORIG.lunchText,
      ORIG.dinnerText,
    ]
      .filter(Boolean)
      .join('\n')
    const want = tokens(src)
    const bag = new Map<string, number>()
    for (const t of shown) bag.set(t, (bag.get(t) ?? 0) + 1)
    const missing = want.filter((t) => {
      const n = bag.get(t) ?? 0
      if (n <= 0) return true
      bag.set(t, n - 1)
      return false
    })
    expect(missing).toEqual([])
    expect(want.length).toBeGreaterThan(30)
  })

  it('registration JSON keeps supplierOriginal next to the summary; reader parses it back', () => {
    const json = buildRegisterProductScheduleJson([
      { day: 1, title: '요약 제목', description: '요약 3~4문장.', imageKeyword: 'Arashiyama', supplierOriginal: ORIG },
      { day: 2, title: 'd2', description: 'x', imageKeyword: 'Kyoto' },
    ])
    const rows = JSON.parse(json)
    expect(rows[0].supplierOriginal).toEqual(ORIG)
    expect(rows[0].description).toBe('요약 3~4문장.')
    expect('supplierOriginal' in rows[1]).toBe(false)
    const read = getScheduleFromProduct({ schedule: json } as never)
    expect(read[0]!.supplierOriginal?.items.length).toBe(3)
    expect(read[1]!.supplierOriginal).toBeUndefined()
  })

  it('heal keeps supplierOriginal untouched while it regenerates summary fields', () => {
    const healed = healRegisterPrePhotoSchedule(
      [
        { day: 1, routeText: '교토', title: '교토', imageKeyword: 'Kyoto', description: '', supplierOriginal: ORIG },
        { day: 2, routeText: '오사카', title: '오사카', imageKeyword: 'Osaka', description: '오사카를 둘러봅니다.', supplierOriginal: ORIG },
      ] as never,
      { supplierKey: 'hanatour', productDestination: '일본', productTitle: '교토 오사카 3일' },
    )
    for (const r of healed.rows as Array<{ supplierOriginal?: unknown }>) expect(r.supplierOriginal).toEqual(ORIG)
  })

  it('fact days → schedule rows carry a deterministic copy (no rewording)', () => {
    const facts = [
      { day: 1, places: ['아라시야마', '치쿠린'], hotels: ['교토 우메코지 카덴쇼'], meals: ['중식: 일정식', '석식: 카이세키'], transportNote: '간사이공항 - 아라시야마 이동' },
    ]
    const rows = hanatourFactDaysToRegisterSchedule(facts as never) as Array<{ supplierOriginal?: ScheduleDaySupplierOriginal }>
    const o = rows[0]!.supplierOriginal!
    expect(o.source).toBe('hanatour')
    expect(o.items.map((i) => i.name ?? i.text)).toEqual(['간사이공항 - 아라시야마 이동', '아라시야마', '치쿠린'])
    expect(o.hotelText).toBe('교토 우메코지 카덴쇼')
    const generic = attachScheduleDaySupplierOriginalFromFactDays(facts as never, 'x', [{ day: 9 }])
    expect('supplierOriginal' in generic[0]!).toBe(false)
  })
})
