/**
 * 노랑(ybtour) by-goods 기간 섞임 — 상품 기간(박·일)이 같은 출발만 남기는지.
 * 실제 응답 fixture(yb-0007 CHP1128, 2026-11-01 00:44 KST PC 에서 읽기 전용 수집), 네트워크 없음:
 * - scripts/fixtures/ybtour-by-goods-CHP1128-202611-1107-1114.json
 *   by-goods/CHP1128/AADD001/202611 원본(498행, sha256 13bbe2b244c6746079230e54ceef4f84f583110c2435289784613b12ccddb668)에서
 *   출발일 2026-11-07·2026-11-14 행 32개를 손대지 않고 그대로 뽑음 (2박4일·3박4일·2박3일 섞임)
 *   sha256 7a6ca7a8a17f419e8f048574eee6d5845dc94423943ab24e30f00fbf629b73aa
 * - scripts/fixtures/ybtour-papi-CHP1128-meta-20261101.json (available-date/day·first-display·join-event 원본 응답)
 *   sha256 cfb5d7a5b4d366b43072a0f18c3434c1a59e6f28b76921e4df547951acea79eb
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  collectYbtourByGoodsApiDepartureInputsForUrl,
  filterYbtourByGoodsInputsByTripDuration,
  ybtourByGoodsRowToDepartureInput,
  ybtourByGoodsRowTripDuration,
  type YbtourByGoodsEventRow,
} from './ybtour-api-departures'
import { collectYbtourPriceInputsWithE2eFallback } from './ybtour-price-collect'
import { resolveSupplierProductTripDuration } from './supplier-trip-duration'

const fx = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'fixtures', name), 'utf8'))
const BY_GOODS = fx('ybtour-by-goods-CHP1128-202611-1107-1114.json') as { code: string; body: YbtourByGoodsEventRow[] }
const META = fx('ybtour-papi-CHP1128-meta-20261101.json') as Record<string, unknown>

// yb-0007 상품(2박 4일) 원래 URL 형태 — evCd 는 2026-11-07 2박4일 출발(7C01)로 바꿔 둠
const YB_0007_URL = 'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AADD001&evCd=CHP1128-2611077C01'
const YB_3N4D_URL = 'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&dspSid=AADD001&evCd=CHP1128-261107KE00'

function stubYbtourFetch(byGoods: { code: string; body: YbtourByGoodsEventRow[] } = BY_GOODS) {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: unknown) => {
      const u = String(url)
      calls.push(u)
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
      if (u.includes('/available-date/day')) return json(META['available-date-day'])
      if (u.includes('/first-display')) return json(META['first-display'])
      if (u.includes('/pkg/goods/join-event/')) return json(META['join-event'])
      if (u.includes('/pkg/event/by-goods/CHP1128/AADD001/202611')) return json(byGoods)
      if (u.includes('/pkg/event/by-goods/')) return json({ code: '0000', message: 'Success', body: [] })
      return new Response('not stubbed', { status: 404 })
    }),
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const evCdOf = (x: { supplierDepartureCodeCandidate?: string | null }) =>
  String(x.supplierDepartureCodeCandidate ?? '').replace(/^ybtour:/, '')
const durOfEvCd = new Map(BY_GOODS.body.map((r) => [String(r.evCd), String(r.dayStayInfo)]))

describe('ybtour by-goods 실제 응답(CHP1128) 기간 읽기', () => {
  it('행마다 dayStayInfo 로 박·일을 읽는다 — 같은 날 2박4일·3박4일·2박3일 섞임', () => {
    const durs = new Set(BY_GOODS.body.map((r) => {
      const d = ybtourByGoodsRowTripDuration(r)
      return d ? `${d.nights}박${d.days}일` : '?'
    }))
    expect([...durs].sort()).toEqual(['2박3일', '2박4일', '3박4일'])
    // 일수만 보면 2박4일·3박4일이 둘 다 4 — 박 수 없이는 구분 불가
    const fourDay = BY_GOODS.body.filter((r) => r.evDayCntList === '4')
    expect(new Set(fourDay.map((r) => r.dayStayInfo))).toEqual(new Set(['2박4일', '3박4일']))
  })

  it('dayStayInfo 가 없으면 null (추정하지 않음)', () => {
    expect(ybtourByGoodsRowTripDuration({ ...BY_GOODS.body[0], dayStayInfo: null })).toBeNull()
    expect(ybtourByGoodsRowTripDuration({ ...BY_GOODS.body[0], dayStayInfo: '' })).toBeNull()
  })
})

describe('collectYbtourByGoodsApiDepartureInputsForUrl — 상품 기간 거르기', () => {
  it('yb-0007(2박 4일): 2박4일 출발만 남고 다른 기간은 빠지며 경고가 남는다', async () => {
    stubYbtourFetch()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const expected = resolveSupplierProductTripDuration({ duration: '2박 4일', tripNights: null, tripDays: null })
    const out = await collectYbtourByGoodsApiDepartureInputsForUrl(YB_0007_URL, '2026-11-01', '2026-11-30', {
      originCode: 'CHP1128-2607227C01',
      enrichEvCdPrice: false,
      expectedTripDuration: expected,
    })
    // 판매 중(마감 제외) 2박4일 = 11-07 4건 + 11-14 3건
    expect(out.inputs).toHaveLength(7)
    expect(out.inputs.every((x) => durOfEvCd.get(evCdOf(x)) === '2박4일')).toBe(true)
    expect(out.durationAllMismatch).toBe(false)
    expect(out.durationStats).toMatchObject({ kept: 7, droppedMismatch: 10, keptUnknown: 0 })
    expect(out.durationWarnings.join('\n')).toMatch(/상품 기간 2박4일과 다른 출발 10건 제외/)
    expect(warn).toHaveBeenCalled()
  })

  it('상품 기간을 모르면 지금처럼 다 남기고 섞임 경고만', async () => {
    stubYbtourFetch()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = await collectYbtourByGoodsApiDepartureInputsForUrl(YB_0007_URL, '2026-11-01', '2026-11-30', {
      originCode: 'CHP1128-2607227C01',
      enrichEvCdPrice: false,
      expectedTripDuration: null,
    })
    expect(out.inputs).toHaveLength(17)
    expect(out.durationWarnings.join('\n')).toMatch(/기간 섞임 경고 — 상품 기간을 몰라 거르지 않음/)
    expect(out.durationAllMismatch).toBe(false)
  })

  it('옵션을 안 주는 기존 호출은 결과가 그대로(17건)', async () => {
    stubYbtourFetch()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = await collectYbtourByGoodsApiDepartureInputsForUrl(YB_0007_URL, '2026-11-01', '2026-11-30', {
      enrichEvCdPrice: false,
    })
    expect(out.inputs).toHaveLength(17)
  })

  it('등록 경로: 상품 기간이 없으면 URL evCd 행 기간(3박4일)으로 거른다', async () => {
    stubYbtourFetch()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = await collectYbtourByGoodsApiDepartureInputsForUrl(YB_3N4D_URL, '2026-11-01', '2026-11-30', {
      enrichEvCdPrice: false,
      expectedTripDurationFromUrlEvCd: true,
    })
    expect(out.inputs).toHaveLength(9)
    expect(out.inputs.every((x) => durOfEvCd.get(evCdOf(x)) === '3박4일')).toBe(true)
  })

  it('응답이 전부 다른 기간이면 0건 + 상품 기간값 의심 표시', async () => {
    stubYbtourFetch()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = await collectYbtourByGoodsApiDepartureInputsForUrl(YB_0007_URL, '2026-11-01', '2026-11-30', {
      enrichEvCdPrice: false,
      expectedTripDuration: { nights: 4, days: 5 },
    })
    expect(out.inputs).toHaveLength(0)
    expect(out.durationAllMismatch).toBe(true)
    expect(out.durationWarnings.join('\n')).toMatch(/상품 기간값 의심, E2E 폴백·판매종료 처리 생략/)
  })
})

describe('collectYbtourPriceInputsWithE2eFallback — 전부 다른 기간', () => {
  it('E2E 폴백·판매종료(horizonSoldOut) 없이 빈 결과', async () => {
    const calls = stubYbtourFetch()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('YBTOUR_SKIP_EVCD_PRICE_ENRICH', '1')
    const out = await collectYbtourPriceInputsWithE2eFallback(YB_0007_URL, 'CHP1128-2607227C01', '2026-11-01', '2026-11-30', {
      expectedTripDuration: { nights: 4, days: 5 },
    })
    vi.unstubAllEnvs()
    expect(out.inputs).toHaveLength(0)
    expect(out.source).toBeNull()
    expect(out.e2eAttempted).toBe(false)
    expect(out.horizonSoldOut).toBe(false)
    expect((out.warnings ?? []).join('\n')).toMatch(/상품 기간값 의심/)
    expect(calls.some((u) => u.includes('/price'))).toBe(false)
  })

  it('상품 기간이 맞으면 api 결과(2박4일 7건)', async () => {
    stubYbtourFetch()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('YBTOUR_SKIP_EVCD_PRICE_ENRICH', '1')
    const out = await collectYbtourPriceInputsWithE2eFallback(YB_0007_URL, 'CHP1128-2607227C01', '2026-11-01', '2026-11-30', {
      expectedTripDuration: { nights: 2, days: 4 },
    })
    vi.unstubAllEnvs()
    expect(out.source).toBe('api')
    expect(out.horizonSoldOut).toBe(false)
    expect(out.inputs).toHaveLength(7)
  })
})

describe('filterYbtourByGoodsInputsByTripDuration — 같은 날짜', () => {
  it('기간 못 읽는 출발은 남기되 같은 날짜에서는 기간 일치 출발이 앞에 온다', () => {
    const rows = BY_GOODS.body.filter((r) => r.outStartDt === '20261107' && r.evProgDiviNm !== '예약마감')
    // 3박4일 KE00(출발확정) 한 행만 dayStayInfo 를 지워 '기간 모름'으로 만들고 맨 앞에 둠
    const unknown = { ...rows.find((r) => r.dayStayInfo === '3박4일')!, dayStayInfo: null }
    const ordered = [unknown, ...rows.filter((r) => r.evCd !== unknown.evCd)]
    const pairs = ordered.map((row) => ({ row, input: ybtourByGoodsRowToDepartureInput(row)! }))
    const out = filterYbtourByGoodsInputsByTripDuration(pairs, { nights: 2, days: 4 })
    expect(out.stats).toMatchObject({ keptUnknown: 1, droppedMismatch: 2 })
    expect(out.inputs).toHaveLength(5)
    expect(durOfEvCd.get(evCdOf(out.inputs[0]!))).toBe('2박4일')
    expect(evCdOf(out.inputs[out.inputs.length - 1]!)).toBe(unknown.evCd)
    expect(out.warnings.join('\n')).toMatch(/기간을 읽지 못한 출발 1건은 남김/)
    expect(out.allMismatch).toBe(false)
  })
})
