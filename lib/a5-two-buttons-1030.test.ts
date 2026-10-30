import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  airlineOptionsFromPriceRows,
  filterPriceRowsByAirline,
  type AirlineDepartureOption,
  type ProductAirlineFilterData,
} from '@/lib/airline-variant-group'
import {
  A5_HERO_CARD_AIRLINE_LABELS,
  shouldShowHeroCardAirlineSwitch,
  lowestPublicPriceFromRows,
  otherAirlineRows,
  resolveCurrentDepartureAirlineOption,
  shouldShowOtherAirlineButton,
} from '@/lib/detail-airline-two-buttons'
import { alignDepartureFactsToSelectedAirline } from '@/lib/detail-selected-departure-airline'
import type { ProductPriceRow } from '@/app/components/travel/travel-product-detail-types'

function row(id: string, date: string, adult: number): ProductPriceRow {
  return {
    id,
    productId: 'p1',
    date,
    adult,
    childBed: null,
    childNoBed: null,
    infant: null,
    localPrice: null,
    priceGap: 0,
    priceAdult: adult,
    priceChildWithBed: null,
    priceChildNoBed: null,
    priceInfant: null,
  }
}

const twoAirlines: ProductAirlineFilterData = {
  options: airlineOptionsFromPriceRows([
    { row: row('k1', '2026-12-01', 900000), label: '대한항공' },
    { row: row('k2', '2026-12-08', 880000), label: '대한항공' },
    { row: row('j1', '2026-12-01', 610000), label: '제주항공' },
    { row: row('j2', '2026-12-15', 590000), label: '제주항공' },
    { row: row('x1', '2026-12-20', 0), label: '티웨이항공' }, // 가격 0 → 옵션 안 생김
  ]),
}
const oneAirline: ProductAirlineFilterData = {
  options: airlineOptionsFromPriceRows([
    { row: row('a1', '2026-12-01', 700000), label: '아시아나항공' },
    { row: row('a2', '2026-12-02', 720000), label: '아시아나항공' },
  ]),
}

describe('A-5 두 버튼 — 단일 항공사면 버튼 2 숨김', () => {
  it('항공사 1곳: 버튼 2 숨김, 다른 항공사 목록 없음', () => {
    expect(shouldShowOtherAirlineButton(oneAirline)).toBe(false)
    expect(otherAirlineRows(oneAirline, '아시아나항공')).toEqual([])
  })
  it('항공사 2곳 이상: 버튼 2 노출', () => {
    expect(shouldShowOtherAirlineButton(twoAirlines)).toBe(true)
  })
  it('데이터 없음/옵션 없음: 버튼 2 숨김', () => {
    expect(shouldShowOtherAirlineButton(null)).toBe(false)
    expect(shouldShowOtherAirlineButton({ options: [] })).toBe(false)
  })
  it('가격 0 행만 있는 항공사는 옵션 자체가 없음(추측 금지)', () => {
    expect(twoAirlines.options.map((o) => o.label)).toEqual(['제주항공', '대한항공'])
  })
})

describe('A-5 두 버튼 — 상단 항공사 = 지금 출발 회차', () => {
  it('회차 id로 항공사 결정', () => {
    const cur = resolveCurrentDepartureAirlineOption(twoAirlines, null, { rowId: 'k2', ymd: '2026-12-08', factsAirline: null })
    expect(cur?.label).toBe('대한항공')
  })
  it('id 없으면 그 날짜 단일 항공사, 같은 날짜 여러 항공사면 facts 항공사로만, 모르면 null', () => {
    expect(resolveCurrentDepartureAirlineOption(twoAirlines, null, { rowId: null, ymd: '2026-12-15', factsAirline: null })?.label).toBe('제주항공')
    expect(resolveCurrentDepartureAirlineOption(twoAirlines, null, { rowId: null, ymd: '2026-12-01', factsAirline: '대한항공' })?.label).toBe('대한항공')
    expect(resolveCurrentDepartureAirlineOption(twoAirlines, null, { rowId: null, ymd: '2026-12-01', factsAirline: null })).toBeNull()
    expect(resolveCurrentDepartureAirlineOption(twoAirlines, null, { rowId: null, ymd: '2027-01-01', factsAirline: '대한항공' })).toBeNull()
  })
  it('?airline= 선택이 있으면 그 항공사', () => {
    const jeju = twoAirlines.options.find((o) => o.label === '제주항공')!
    expect(resolveCurrentDepartureAirlineOption(twoAirlines, jeju, { rowId: 'k1', ymd: '2026-12-01', factsAirline: '대한항공' })?.label).toBe('제주항공')
  })
})

describe('A-5 두 버튼 — 다른 항공사 목록 가격은 기존 가격행만', () => {
  it('현재 항공사 제외, 가격 = 그 항공사 가격행 최저 성인가', () => {
    const rows = otherAirlineRows(twoAirlines, '제주항공')
    expect(rows).toEqual([{ label: '대한항공', param: rows[0]!.param, lowestPriceKrw: 880000, departureCount: 2 }])
  })
  it('가격행 없음 / 0 / 비정상 → 가격 null(표시 안 함)', () => {
    const empty: AirlineDepartureOption = { label: '진에어', param: 'lj', minPriceKrw: 0, rows: [] }
    const zero: AirlineDepartureOption = { label: '에어부산', param: 'bx', minPriceKrw: 0, rows: [['z1', '2026-12-01', 0]] }
    const nan: AirlineDepartureOption = { label: '이스타항공', param: 'ze', minPriceKrw: Number.NaN, rows: [['n1', '2026-12-01', Number.NaN]] }
    expect(lowestPublicPriceFromRows(empty)).toBeNull()
    expect(lowestPublicPriceFromRows(zero)).toBeNull()
    expect(lowestPublicPriceFromRows(nan)).toBeNull()
    const data: ProductAirlineFilterData = { options: [...twoAirlines.options, empty, zero, nan] }
    const rows = otherAirlineRows(data, '제주항공')
    // 출발 회차 없는 항공사는 목록에서 제외, 가격 없는 항공사는 가격 null 로 뒤에
    expect(rows.map((r) => [r.label, r.lowestPriceKrw])).toEqual([
      ['대한항공', 880000],
      ['에어부산', null],
      ['이스타항공', null],
    ])
    // minPriceKrw 저장값은 쓰지 않음(가격행 기준)
    const fake: AirlineDepartureOption = { label: '가짜항공', param: 'fk', minPriceKrw: 1, rows: [['f1', '2026-12-01', 500000]] }
    expect(lowestPublicPriceFromRows(fake)).toBe(500000)
  })
  it('머리말 위 렌더 금지 — 항공사 UI는 히어로 카드 안에만, 사진 아래 상자 없음', () => {
    const read = (f: string) => readFileSync(resolve(process.cwd(), f), 'utf8')
    const page = read('app/products/[idOrSlug]/product-detail-page-content.tsx')
    expect(page).not.toMatch(/HeroCardAirline|ProductAirlinePricePanelClient/)
    const model = read('lib/product-public-detail/render-from-model.tsx')
    expect(model).not.toMatch(/HeroCardAirline|ProductAirlinePricePanelClient/)
    expect(model.indexOf('<Header />')).toBeGreaterThan(-1)
    expect(model.indexOf('<Header />', model.indexOf('const detailMobile'))).toBeLessThan(model.indexOf('{detailMobile}'))
    for (const f of [
      'app/components/travel/TravelProductDetail.tsx',
      'app/components/travel/ybtour/YbtourTravelProductDetail.tsx',
      'app/components/travel/verygood/VerygoodTravelProductDetail.tsx',
    ]) {
      const src = read(f)
      expect(src.indexOf('<Header />')).toBeGreaterThan(-1)
      expect(src.indexOf('<Header />')).toBeLessThan(src.indexOf('<PackageProductHeroSection'))
    }
    for (const f of [
      'app/components/travel/TravelProductDetail.tsx',
      'app/components/travel/MobileProductDetail.tsx',
      'app/components/travel/ybtour/YbtourTravelProductDetail.tsx',
      'app/components/travel/ybtour/YbtourMobileProductDetail.tsx',
      'app/components/travel/verygood/VerygoodTravelProductDetail.tsx',
      'app/components/travel/verygood/VerygoodMobileProductDetail.tsx',
    ]) {
      const src = read(f)
      expect(src).not.toContain('ProductAirlinePricePanelClient')
      expect(src).toContain('useReportCurrentDepartureAirline({')
    }
    expect(existsSync(resolve(process.cwd(), 'app/components/detail/ProductAirlinePricePanelClient.tsx'))).toBe(false)
  })
})

describe('A-5 두 버튼 — 항공사 바꾸면 달력·가격·편명·귀국 기준 모두 그 항공사', () => {
  it('제주항공 선택 → 달력/가격 행은 제주항공 회차만, 최저가 = 다른 항공사 목록에 보였던 값', () => {
    const model = [row('k1', '2026-12-01', 900000), row('k2', '2026-12-08', 880000), row('j1', '2026-12-01', 610000), row('j2', '2026-12-15', 590000)]
    const jeju = twoAirlines.options.find((o) => o.label === '제주항공')!
    const listed = otherAirlineRows(twoAirlines, '대한항공').find((r) => r.label === '제주항공')!
    const filtered = filterPriceRowsByAirline(model, jeju, 'p1')
    expect(filtered.map((r) => r.id)).toEqual(['j1', 'j2'])
    expect(Math.min(...filtered.map((r) => r.adult))).toBe(listed.lowestPriceKrw)
    // 상단 항공사도 같은 선택
    expect(resolveCurrentDepartureAirlineOption(twoAirlines, jeju, { rowId: 'k1', ymd: '2026-12-01', factsAirline: '대한항공' })?.label).toBe('제주항공')
  })
  it('같은 날짜 다른 항공사 facts 폴백이면 편명·시간은 지우고 항공사는 고른 항공사', () => {
    const aligned = alignDepartureFactsToSelectedAirline(
      {
        airline: '대한항공',
        outbound: { flightNo: 'KE123' } as never,
        inbound: { flightNo: 'KE124' } as never,
        outboundSummary: 'KE123 09:00',
        inboundSummary: 'KE124 18:00',
        meetingSummary: '인천공항 3층',
      },
      { label: '제주항공', param: '7c' },
    )
    expect(aligned?.airline).toBe('제주항공')
    expect(aligned?.outbound).toBeNull()
    expect(aligned?.inbound).toBeNull()
    expect(aligned?.outboundSummary).toBeNull()
    expect(aligned?.meetingSummary).toBe('인천공항 3층')
  })
})

describe('A-5 히어로 가격카드 — 다른 항공사 선택기 (사장님 23:47)', () => {
  const single: ProductAirlineFilterData = {
    options: airlineOptionsFromPriceRows([
      { row: row('t1', '2026-12-01', 1500000), label: '터키항공' },
      { row: row('t2', '2026-12-08', 1400000), label: '터키항공' },
    ]),
  }
  it('항공사 1곳이면 카드 선택기 없음, 2곳 이상이면 있음', () => {
    expect(shouldShowHeroCardAirlineSwitch(single)).toBe(false)
    expect(shouldShowHeroCardAirlineSwitch(null)).toBe(false)
    expect(shouldShowHeroCardAirlineSwitch(twoAirlines)).toBe(true)
  })
  it('카드 목록 가격 = 그 항공사 공개 가격행 성인 1인 중 가장 낮은 값(추정 없음)', () => {
    const others = otherAirlineRows(twoAirlines, '대한항공')
    const jeju = twoAirlines.options.find((o) => o.label === '제주항공')!
    expect(others.map((o) => o.label)).toEqual(['제주항공'])
    expect(others[0].lowestPriceKrw).toBe(lowestPublicPriceFromRows(jeju))
  })
  it('카드 문구: 성인 1인 기준 · 가장 낮은 요금 · 최저가 없음', () => {
    expect(A5_HERO_CARD_AIRLINE_LABELS.listTitle).toBe('다른 항공사 (성인 1인 기준, 예약 가능한 출발일 중 가장 낮은 요금)')
    for (const v of Object.values(A5_HERO_CARD_AIRLINE_LABELS)) expect(v).not.toContain('최저가')
  })
  it('버튼 숫자 N = 목록에 실제로 나오는 항공사 수(지금/고른 항공사 제외)', () => {
    const three: ProductAirlineFilterData = {
      options: airlineOptionsFromPriceRows([
        { row: row('k1', '2026-12-01', 900000), label: '대한항공' },
        { row: row('j1', '2026-12-01', 610000), label: '제주항공' },
        { row: row('b1', '2026-12-08', 700000), label: '에어부산' },
      ]),
    }
    const empty: AirlineDepartureOption = { label: '빈항공', param: 'xx', minPriceKrw: null, rows: [] }
    const data: ProductAirlineFilterData = { options: [...three.options, empty] }
    // 고르기 전(지금 출발 = 대한항공)
    const before = otherAirlineRows(data, resolveCurrentDepartureAirlineOption(data, null, { rowId: 'k1', ymd: '2026-12-01', factsAirline: '대한항공' })?.label ?? null)
    expect(before.map((o) => o.label)).toEqual(['제주항공', '에어부산'])
    // 제주항공 고른 뒤 — 버튼 N 은 같은 함수 결과 길이
    const jeju = data.options.find((o) => o.label === '제주항공')!
    const after = otherAirlineRows(data, resolveCurrentDepartureAirlineOption(data, jeju, { rowId: 'j1', ymd: '2026-12-01', factsAirline: '제주항공' })?.label ?? null)
    expect(after.map((o) => o.label)).toEqual(['에어부산', '대한항공'])
    expect(after.some((o) => o.label === '제주항공')).toBe(false)
    expect(after.length).toBe(2)
    const sw = readFileSync(resolve(process.cwd(), 'app/components/detail/HeroCardAirlineSwitcher.tsx'), 'utf8')
    expect(sw).toContain('${L.openButton} (${others.length}곳)')
    expect(sw).toContain('others.map((o) =>')
  })
  it('소스: 카드 안에서만 렌더(sticky/fixed/portal 없음), 선택은 기존 필터 select → ?airline=', () => {
    const sw = readFileSync(resolve(process.cwd(), 'app/components/detail/HeroCardAirlineSwitcher.tsx'), 'utf8')
    expect(sw).toContain('select(label)')
    expect(sw).not.toMatch(/\bsticky\b|\bfixed\b|createPortal/)
    expect(sw).not.toContain('최저가')
    const card = readFileSync(resolve(process.cwd(), 'app/components/detail/PackageProductHeroInfoPanel.tsx'), 'utf8')
    expect(card).toContain('<HeroCardAirlineSwitchButton')
    expect(card).toContain('{!airlineListOpen && showPriceBlock ? (')
  })
})
