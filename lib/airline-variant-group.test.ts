import { describe, expect, it } from 'vitest'
import {
  airlineLabelFromParam,
  airlineParamForLabel,
  capCarrierPriceLines,
  carrierPriceLinesFromSummaries,
  departureCarrierPublicLabel,
  duplicateCandidateIds,
  duplicateGroupKey,
  groupDuplicateProducts,
  normalizeTitleForDuplicateGroup,
  parseSupplierMasterCode,
  summarizeBookableDepartures,
  type DuplicateGroupInput,
  type ProductBookableSummary,
} from '@/lib/airline-variant-group'

type Row = DuplicateGroupInput & { slug: string }
const row = (id: string, originSource: string, originCode: string, title: string, duration: string, localDepartureTag: string[] = []): Row => ({
  id,
  slug: id,
  originSource,
  originCode,
  title,
  duration,
  localDepartureTag,
})

// 실데이터(2026-10-27 13:52 KST) 제목·코드 그대로
const EAST_EU = '동유럽 3국 9일 #비엔나음악회 #프라하시내호텔 #잘츠카머구트 유람선,케이블카 #로컬미식 #할슈타트 #2대야간투어'
const EAST_EU_OZ = '동유럽 3국 9일 #비엔나음악회 #프라하시내호텔 #잘츠캄머구트유람선,케이블카 #베르히테스가덴 #소금광산 #맛집체험 #2대야간투어 #체코,오스트리아,헝가리'
const KK = '[2030전용] 코타키나발루 5일 #노을맛집 #핫플휴양 #5성급 #월드체인 #인피니트풀 #아일랜드투어 #선셋반딧불이 #Late Night 밍글링타임 #레이트체크아'
const ROWS: Row[] = [
  row('pkg-hn-0072', 'hanatour', 'AYP261260825AKH', KK, '3박 5일'),
  row('pkg-hn-0105', 'hanatour', 'AYP2612609307CH', KK, '3박 5일'),
  row('pkg-yb-0026', 'ybtour', 'CHP1128-2609017C01', '홍콩 4일 # 반나절자유', '2박 4일'),
  row('pkg-yb-0007', 'ybtour', 'CHP1128-2607227C01', '홍콩 4일 # 반나절자유', '2박 4일'),
  row('pkg-yb-0047', 'ybtour', 'CHP1128', '홍콩/마카오 4일 #핵심관광 #풀패키지 #OZ', ''),
  row('pkg-hn-0037', 'hanatour', 'EEP133260701KEY', EAST_EU, '7박 9일'),
  row('pkg-hn-0049', 'hanatour', 'EEP133260801KEZ', EAST_EU, '7박 9일'),
  row('pkg-hn-0113', 'hanatour', 'EEP133261108OZN', EAST_EU_OZ, '7박 9일'),
  row('fit-hn-0039', 'hanatour', 'EEP133270124OZN', EAST_EU_OZ, '8박 9일'),
  row('pkg-hn-0096', 'hanatour', 'EEP133261110KEM', '*[출발임박] 동유럽 3국 9일 #비엔나음악회 #프라하시내호텔 #잘츠카머구트 유람선 #로컬미식 #베르히테스가덴 #2대야간투어', '7박 9일'),
  row('pkg-hn-0124', 'hanatour', 'JKP140261109TWA', '규슈 4일#럭셔리오션뷰호텔 #오이타힐링온천2박 #가이세키 #스파클링사케시음 #유후인산책 #라라포트자유쇼핑 #감성끝판왕 #전일정3인실가능', '3박 4일'),
  row('pkg-hn-0009', 'hanatour', 'JKP140260628RSH', '규슈 4일 #온천의 진수 #완벽한 동선 #천연 온천 루프탑 아마네크 유라리 2박 #후쿠오카 시내 숙박 #일본 폭포 100선 #일본 100대 야경 슈몬지바루', '3박 4일'),
  row('pkg-hn-0005', 'hanatour', 'AVP2512604179GA', '푸꾸옥 5일 #5성급 호텔 #씨쉘 #중부위치 #야시장 #자유일정포함', '3박 5일'),
  row('pkg-hn-0117', 'hanatour', 'AVP251270105TWD', '푸꾸옥 5일 #5성급 리조트 #핵심일정정복 #$130상당혜택 #호핑투어 #바구니배 #그랜드월드 #선셋타운 #야시장 #전신마사지 #자유일정포함', '3박 5일'),
  row('pkg-hn-0142', 'hanatour', 'CTP6272610177C2', '[대구출발] 태항산/석가장 6일 #多드림 #스타가이드와 함께하는 #보천대협곡 #팔리구 #천계산 #태항대협곡 #팔천협 #통천협 #마사지2회 #BBQ푸드트럭', '4박 6일', ['daegu']),
  row('pkg-hn-0139', 'hanatour', 'CTP6272610177C1', '태항산/석가장 6일 #ALL포함 #보천대협곡 #천계산 #태항대협곡 #팔천협 #통천협 #광부고성 #마사지90분', '4박 6일', ['daegu']),
]

const sum = (id: string, min: number, carriers: Record<string, number>): ProductBookableSummary => ({
  productId: id,
  slug: id,
  minPriceKrw: min,
  carrierMinPrice: carriers,
})
const SUMMARIES = new Map<string, ProductBookableSummary>([
  ['pkg-hn-0072', sum('pkg-hn-0072', 899000, { 제주항공: 899000, 에어아시아: 899000 })],
  ['pkg-hn-0105', sum('pkg-hn-0105', 899000, { 제주항공: 899000, 에어아시아: 899000 })],
  ['pkg-yb-0026', sum('pkg-yb-0026', 549900, { 에어부산: 549900, 대한항공: 699900 })],
  ['pkg-yb-0007', sum('pkg-yb-0007', 559900, { 에어부산: 559900, 아시아나항공: 649900 })],
  ['pkg-yb-0047', sum('pkg-yb-0047', 799000, { 아시아나항공: 799000 })],
  ['pkg-hn-0037', sum('pkg-hn-0037', 3249000, { 대한항공: 3249000, LOT폴란드항공: 3249000 })],
  ['pkg-hn-0049', sum('pkg-hn-0049', 3299000, { 대한항공: 3299000, 아시아나항공: 3399000 })],
  ['pkg-hn-0113', sum('pkg-hn-0113', 3249000, { 아시아나항공: 3249000 })],
  ['fit-hn-0039', sum('fit-hn-0039', 3599000, { 아시아나항공: 3599000 })],
  ['pkg-hn-0096', sum('pkg-hn-0096', 3349000, { 대한항공: 3349000 })],
  ['pkg-hn-0124', sum('pkg-hn-0124', 1069900, { 이스타항공: 1069900, 에어서울: 1090000 })],
  ['pkg-hn-0009', sum('pkg-hn-0009', 1100500, { 에어서울: 1100500, 트리니티항공: 1150000 })],
  ['pkg-hn-0005', sum('pkg-hn-0005', 609000, { 진에어: 609000 })],
  ['pkg-hn-0117', sum('pkg-hn-0117', 569000, { 비엣젯항공: 569000 })],
  ['pkg-hn-0142', sum('pkg-hn-0142', 1249900, { 제주항공: 1249900 })],
  ['pkg-hn-0139', sum('pkg-hn-0139', 1099900, { 제주항공: 1099900 })],
])

describe('airline-variant-group (설계 C + 항공사별 가격)', () => {
  it('마스터코드만 파싱 — 코드 접미는 쓰지 않음', () => {
    expect(parseSupplierMasterCode('hanatour', 'EEP133261108OZN')).toEqual({ supplier: 'hanatour', masterCode: 'EEP133' })
    expect(parseSupplierMasterCode('ybtour', 'CHP1128-2609017C01')).toEqual({ supplier: 'ybtour', masterCode: 'CHP1128' })
    expect(parseSupplierMasterCode('ybtour', 'CHP1128')).toBeNull()
    expect(parseSupplierMasterCode('modetour', 'ABC123')).toBeNull()
  })

  it('제목 정규화 — # 태그 유지, [..출발]·앞머리 *[출발임박]·항공사·편명만 제거', () => {
    const base = normalizeTitleForDuplicateGroup('동유럽 3국 9일 #할슈타트')
    expect(normalizeTitleForDuplicateGroup('*[출발임박] 동유럽 3국 9일 #할슈타트')).toBe(base)
    expect(normalizeTitleForDuplicateGroup('[부산출발] 동유럽 3국 9일 대한항공 KE0933 #할슈타트')).toBe(base)
    expect(normalizeTitleForDuplicateGroup('동유럽 3국 9일 #베르히테스가덴')).not.toBe(base)
  })

  it('반드시 묶임: AYP261 AK/7C, CHP1128 yb-0026/yb-0007, EEP133 KEY/KEZ', () => {
    const r = groupDuplicateProducts(ROWS, (x) => x, SUMMARIES)
    const m = r.membersByKeptId
    expect(m.get('pkg-hn-0072')).toEqual(['pkg-hn-0072', 'pkg-hn-0105'])
    expect(m.get('pkg-yb-0026')).toEqual(['pkg-yb-0026', 'pkg-yb-0007'])
    expect(m.get('pkg-hn-0037')).toEqual(['pkg-hn-0037', 'pkg-hn-0049'])
    expect(m.size).toBe(3)
    expect(r.kept.length).toBe(ROWS.length - 3)
  })

  it('절대 안 묶임: JKP140 TW/RS, AVP251 9G/TW, CTP627 7C1/7C2, EEP133 OZN(7박·8박)·KEM 과 KE', () => {
    const k = (id: string) => duplicateGroupKey(ROWS.find((x) => x.id === id)!)
    expect(k('pkg-hn-0124')).not.toBe(k('pkg-hn-0009'))
    expect(k('pkg-hn-0005')).not.toBe(k('pkg-hn-0117'))
    expect(k('pkg-hn-0142')).not.toBe(k('pkg-hn-0139'))
    expect(k('pkg-hn-0113')).not.toBe(k('pkg-hn-0037'))
    expect(k('fit-hn-0039')).not.toBe(k('pkg-hn-0113'))
    expect(k('pkg-hn-0096')).not.toBe(k('pkg-hn-0037'))
    const keptIds = groupDuplicateProducts(ROWS, (x) => x, SUMMARIES).kept.map((x) => x.id)
    for (const id of ['pkg-hn-0124', 'pkg-hn-0009', 'pkg-hn-0005', 'pkg-hn-0117', 'pkg-hn-0142', 'pkg-hn-0139', 'pkg-hn-0113', 'fit-hn-0039', 'pkg-hn-0096', 'pkg-yb-0047']) {
      expect(keptIds).toContain(id)
    }
  })

  it('대표 = 실계산 최저가 멤버, 첫 멤버 위치 유지', () => {
    const rows = [ROWS[3]!, ROWS[0]!, ROWS[2]!]
    const r = groupDuplicateProducts(rows, (x) => x, SUMMARIES)
    expect(r.kept.map((x) => x.id)).toEqual(['pkg-yb-0026', 'pkg-hn-0072'])
  })

  it('예약가능 요약 없는 상품은 묶지 않음', () => {
    const s = new Map(SUMMARIES)
    s.delete('pkg-hn-0049')
    expect(groupDuplicateProducts(ROWS, (x) => x, s).membersByKeptId.has('pkg-hn-0037')).toBe(false)
  })

  it('후보 id = 같은 키 2개 이상만', () => {
    expect(new Set(duplicateCandidateIds(ROWS, (x) => x))).toEqual(
      new Set(['pkg-hn-0072', 'pkg-hn-0105', 'pkg-yb-0026', 'pkg-yb-0007', 'pkg-hn-0037', 'pkg-hn-0049']),
    )
  })

  it('항공사명 = 회차 carrierName(없으면 편명) → SSOT, 모르면 생략', () => {
    expect(departureCarrierPublicLabel({ carrierName: '티웨이항공' })).toBe('트리니티항공')
    expect(departureCarrierPublicLabel({ carrierName: '트리니티항공(구)티웨이항공' })).toBe('트리니티항공')
    expect(departureCarrierPublicLabel({ carrierName: '제주에어' })).toBe('제주항공')
    expect(departureCarrierPublicLabel({ carrierName: 'LOT폴란드 항공' })).toBe('LOT폴란드항공')
    expect(departureCarrierPublicLabel({ carrierName: null, outboundFlightNo: 'KE0933' })).toBe('대한항공')
    expect(departureCarrierPublicLabel({ carrierName: null, outboundFlightNo: 'XX123' })).toBeNull()
    expect(departureCarrierPublicLabel({ carrierName: '선박' })).toBeNull()
    expect(departureCarrierPublicLabel({ carrierName: null, outboundFlightNo: null })).toBeNull()
  })

  it('?airline= 값 — SSOT IATA 우선, 없으면 공개명; 역변환', () => {
    expect(airlineParamForLabel('대한항공')).toBe('KE')
    expect(airlineParamForLabel('트리니티항공')).toBe('TW')
    expect(airlineParamForLabel('에어아시아')).toBe('에어아시아')
    expect(airlineLabelFromParam('KE')).toBe('대한항공')
    expect(airlineLabelFromParam('ke')).toBe('대한항공')
    expect(airlineLabelFromParam('에어아시아')).toBe('에어아시아')
    expect(airlineLabelFromParam('ZZ')).toBeNull()
    expect(airlineLabelFromParam('')).toBeNull()
  })

  it('요약 — 가격 있는 예약가능 회차만, 항공사별 최저가', () => {
    const s = summarizeBookableDepartures('p', 'p', [
      { departureYmd: '2026-11-01', adultPrice: 1000, carrierName: '대한항공' },
      { departureYmd: '2026-11-02', adultPrice: 900, carrierName: '아시아나항공' },
      { departureYmd: '2026-11-03', adultPrice: 800, carrierName: null },
      { departureYmd: '2026-11-04', adultPrice: null, carrierName: '진에어' },
    ])
    expect(s.minPriceKrw).toBe(800)
    expect(s.carrierMinPrice).toEqual({ 대한항공: 1000, 아시아나항공: 900 })
  })

  it('항공사별 가격줄 — 멤버 합산, 싼 순, 최저가 멤버 slug, 상위 3 + 외 N', () => {
    const lines = carrierPriceLinesFromSummaries([SUMMARIES.get('pkg-yb-0026')!, SUMMARIES.get('pkg-yb-0007')!])
    expect(lines.map((l) => [l.label, l.priceKrw, l.slug])).toEqual([
      ['에어부산', 549900, 'pkg-yb-0026'],
      ['아시아나항공', 649900, 'pkg-yb-0007'],
      ['대한항공', 699900, 'pkg-yb-0026'],
    ])
    expect(lines[2]!.param).toBe('KE')
    const many = carrierPriceLinesFromSummaries([sum('x', 1, { 대한항공: 4, 아시아나항공: 3, 진에어: 2, 제주항공: 1, 에어부산: 5 })])
    const c = capCarrierPriceLines(many)
    expect(c.shown.map((l) => l.label)).toEqual(['제주항공', '진에어', '아시아나항공'])
    expect(c.moreCount).toBe(2)
  })
})
