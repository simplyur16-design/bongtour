import { describe, expect, it } from 'vitest'
import {
  airlineCodeFromFlightNo,
  airlineVariantChipLabel,
  airlineVariantGroupKey,
  airlineVariantOptionText,
  groupAirlineVariants,
  normalizeTitleForAirlineVariant,
  parseSupplierProductCodeForAirlineVariant,
  resolveAirlineVariantAirlineCode,
  type AirlineVariantInput,
} from '@/lib/airline-variant-group'

const EEP_KE_TITLE =
  '동유럽 3국 9일 #비엔나음악회 #프라하시내호텔 #잘츠카머구트 유람선,케이블카 #로컬미식 #할슈타트'
const EEP_OZ_TITLE =
  '동유럽 3국 9일 #비엔나음악회 #프라하시내호텔 #잘츠캄머구트유람선,케이블카 #베르히테스가덴 #소금광산'

function inp(p: Partial<AirlineVariantInput> & { id: string; originCode: string }): AirlineVariantInput {
  return { originSource: 'hanatour', title: EEP_KE_TITLE, duration: '7박 9일', ...p }
}

describe('parseSupplierProductCodeForAirlineVariant', () => {
  it('hanatour: master = code[:6], airline = 접미 2자리', () => {
    expect(parseSupplierProductCodeForAirlineVariant('hanatour', 'EEP133261108OZN')).toEqual({
      supplier: 'hanatour',
      masterCode: 'EEP133',
      airlineCode: 'OZ',
    })
    expect(parseSupplierProductCodeForAirlineVariant('hanatour', 'AYP2612609307CH')?.airlineCode).toBe('7C')
  })
  it('ybtour: master = `-` 앞, airline = 날짜 뒤 2자리', () => {
    expect(parseSupplierProductCodeForAirlineVariant('ybtour', 'CHP1128-2607227C01')).toEqual({
      supplier: 'ybtour',
      masterCode: 'CHP1128',
      airlineCode: '7C',
    })
  })
  it('숫자만 접미(00)는 항공사 아님 · 다른 공급사/형식은 null', () => {
    expect(parseSupplierProductCodeForAirlineVariant('hanatour', 'EEP133261108001')?.airlineCode).toBeNull()
    expect(parseSupplierProductCodeForAirlineVariant('modetour', 'JOA6037CP4')).toBeNull()
    expect(parseSupplierProductCodeForAirlineVariant('ybtour', 'CXP2511')).toBeNull()
  })
})

describe('airline resolution — 추측 금지', () => {
  it('코드 접미 없으면 편명만, 둘 다 없으면 null', () => {
    expect(airlineCodeFromFlightNo('OZ541')).toBe('OZ')
    expect(airlineCodeFromFlightNo('7C 1101')).toBe('7C')
    expect(airlineCodeFromFlightNo('대한항공')).toBeNull()
    expect(resolveAirlineVariantAirlineCode(inp({ id: 'a', originCode: 'EEP133261108001', outboundFlightNo: 'KE931' }))).toBe('KE')
    expect(resolveAirlineVariantAirlineCode(inp({ id: 'a', originCode: 'EEP133261108001' }))).toBeNull()
    expect(airlineVariantGroupKey(inp({ id: 'a', originCode: 'EEP133261108001' }))).toBeNull()
  })
})

describe('group key', () => {
  it('항공사·해시태그만 다른 같은 마스터는 같은 키', () => {
    const a = airlineVariantGroupKey(inp({ id: 'a', originCode: 'EEP133260701KEY', title: EEP_KE_TITLE }))
    const b = airlineVariantGroupKey(inp({ id: 'b', originCode: 'EEP133261108OZN', title: EEP_OZ_TITLE }))
    expect(a).not.toBeNull()
    expect(a).toBe(b)
  })
  it('지방출발·박일·마스터가 다르면 다른 키', () => {
    const base = airlineVariantGroupKey(inp({ id: 'a', originCode: 'EEP133260701KEY' }))
    expect(airlineVariantGroupKey(inp({ id: 'b', originCode: 'EEP133261108OZN', localDepartureTag: ['busan'] }))).not.toBe(base)
    expect(airlineVariantGroupKey(inp({ id: 'c', originCode: 'EEP133261108OZN', duration: '8박 10일', title: '동유럽 3국 10일' }))).not.toBe(base)
    expect(airlineVariantGroupKey(inp({ id: 'd', originCode: 'EEP134261108OZN' }))).not.toBe(base)
  })
  it('제목 정규화: [X출발]·항공사명·편명 제거', () => {
    expect(normalizeTitleForAirlineVariant('[청주출발] 다낭/호이안 5일 #5성 RS511')).toBe(
      normalizeTitleForAirlineVariant('다낭/호이안 5일 에어서울'),
    )
    expect(normalizeTitleForAirlineVariant('규슈 4일 티웨이항공')).toBe(normalizeTitleForAirlineVariant('규슈 4일 트리니티항공'))
  })
})

describe('groupAirlineVariants', () => {
  type E = { id: string; code: string; price: number | null; title?: string }
  const run = (es: E[]) =>
    groupAirlineVariants(es, (e) => ({
      input: inp({ id: e.id, originCode: e.code, title: e.title ?? EEP_KE_TITLE }),
      slug: null,
      priceKrw: e.price,
      earliestDeparture: null,
    }))

  it('그룹당 카드 1장 — 최저가 대표가 첫 멤버 자리에', () => {
    const { kept, variantsByKeptId } = run([
      { id: 'x', code: 'AVP238261013WEA', price: 100, title: '모드 단독 상품' },
      { id: 'ke', code: 'EEP133260701KEY', price: 3249000 },
      { id: 'other', code: 'JKP140261109TWA', price: 500, title: '규슈 4일' },
      { id: 'oz', code: 'EEP133261108OZN', price: 2999000 },
      { id: 'oz2', code: 'EEP133270124OZN', price: null },
    ])
    expect(kept.map((e) => e.id)).toEqual(['x', 'oz', 'other'])
    const opts = variantsByKeptId.get('oz')!
    expect(opts.map((o) => o.productId)).toEqual(['oz', 'ke', 'oz2'])
    expect(airlineVariantChipLabel(opts)).toBe('아시아나항공 · 대한항공')
    expect(variantsByKeptId.has('x')).toBe(false)
  })

  it('항공사 미확인 상품은 묶지 않음', () => {
    const { kept, variantsByKeptId } = run([
      { id: 'ke', code: 'EEP133260701KEY', price: 1 },
      { id: 'unknown', code: 'EEP133261108001', price: 2 },
    ])
    expect(kept.map((e) => e.id)).toEqual(['ke', 'unknown'])
    expect(variantsByKeptId.size).toBe(0)
  })

  it('같은 항공사 날짜 분할은 한 카드 + 일정 개수 칩', () => {
    const { kept, variantsByKeptId } = run([
      { id: 'a', code: 'AVP250261005LJA', price: 949000, title: '[하나LIVE] 푸꾸옥 5일 #모벤픽' },
      { id: 'b', code: 'AVP250260930LJA', price: null, title: '[하나LIVE] 푸꾸옥 5일 #모벤픽' },
    ])
    expect(kept.map((e) => e.id)).toEqual(['a'])
    expect(airlineVariantChipLabel(variantsByKeptId.get('a')!)).toBe('진에어 · 일정 2개')
  })
})

describe('option text', () => {
  it('항공사 · 출발 · 가격', () => {
    expect(
      airlineVariantOptionText({
        productId: 'p',
        slug: null,
        airlineCode: 'TW',
        airlineLabel: '트리니티항공',
        priceKrw: 699000,
        earliestDeparture: '2026-10-02T00:00:00.000Z',
      }),
    ).toBe('트리니티항공 · 10/2~ · 699,000원~')
  })
})
