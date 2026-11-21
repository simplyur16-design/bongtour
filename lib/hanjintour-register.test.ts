import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CANONICAL_OVERSEAS_SUPPLIER_KEYS } from '@/lib/overseas-supplier-canonical-keys'
import { HANJINTOUR_EXISTING_SUPPLIERS } from '@/lib/hanjintour-region-filter'
import { ADMIN_PRODUCT_ORIGIN_FILTERS, HANJINTOUR_SUPPLIER_KEY } from '@/lib/hanjintour-supplier-key'
import { applyHanjintourPendingPlan, planHanjintourPendingEnqueue } from '@/lib/hanjintour-register'
import { normalizeSupplierOrigin } from '@/lib/normalize-supplier-origin'
import type { HanjintourDeparture, HanjintourScheduleDay } from '@/lib/hanjintour-parse'

const TODAY = '2026-11-15'

const day: HanjintourScheduleDay = {
  day: 1,
  cities: ['발레타'],
  spots: ['발레타 구시가지'],
  descriptions: ['발레타 구시가지 도보'],
  hotels: ['발레타 호텔'],
  meals: { breakfast: '호텔식', lunch: null, dinner: null },
}

function dep(over: Partial<HanjintourDeparture> = {}): HanjintourDeparture {
  return { evtNo: 'OP1', date: '2027-03-21', rawDate: '20270321', status: '예약가능', adultPrice: 1990000, ...over }
}

const malta = {
  gdsNo: 'KWWEU0048',
  title: '몰타 일주 4일',
  categoryPaths: [['유럽', '몰타']],
  existingRows: [{ originSource: 'hanatour', title: '도쿄 3일', city: '도쿄' }],
  todayIso: TODAY,
  days: [day],
}

describe('hanjintour pending enqueue', () => {
  it('미래 원문 성인 요금만 등록대기 계획이고 아동 요금은 비어 있으면 null', () => {
    const plan = planHanjintourPendingEnqueue({ ...malta, departures: [dep({ childPrice: null, infantPrice: null })] })
    expect(plan.ok).toBe(true)
    if (!plan.ok) return
    expect(plan.registrationStatus).toBe('pending')
    expect(plan.originSource).toBe('hanjintour')
    expect(plan.priceFrom).toBe(1990000)
    expect(plan.departures[0]?.adultPrice).toBe(1990000)
    expect(plan.departures[0]?.childBedPrice).toBeNull()
    expect(plan.departures[0]?.infantPrice).toBeNull()
    const schedule = JSON.parse(plan.scheduleJson) as Array<{ day: number; spots: string[] }>
    expect(schedule[0]?.spots).toEqual(['발레타 구시가지'])
  })

  it('기존 7곳에 있는 도시도 지역 필터 없이 등록대기 계획을 만든다', () => {
    const plan = planHanjintourPendingEnqueue({
      ...malta,
      title: '도쿄 자유여행',
      categoryPaths: [['일본', '도쿄']],
      departures: [dep()],
    })
    expect(plan).toMatchObject({ ok: true, registrationStatus: 'pending' })
  })

  it('출발일이나 원문 성인 요금이 없으면 등록대기에 넣지 않는다', () => {
    expect(planHanjintourPendingEnqueue({ ...malta, departures: [] })).toMatchObject({ ok: false, reason: 'no_departure' })
    expect(planHanjintourPendingEnqueue({ ...malta, departures: [dep({ adultPrice: null })] })).toMatchObject({ ok: false, reason: 'no_departure' })
    expect(planHanjintourPendingEnqueue({ ...malta, departures: [dep({ date: '2020-01-01' })] })).toMatchObject({ ok: false, reason: 'no_departure' })
  })

  it('소수·0원 가격은 거절하고 성인가로 아동가를 만들지 않는다', () => {
    expect(planHanjintourPendingEnqueue({ ...malta, departures: [dep({ adultPrice: 10.5 })] })).toMatchObject({ ok: false, reason: 'bad_price' })
    expect(planHanjintourPendingEnqueue({ ...malta, departures: [dep({ adultPrice: 0 })] })).toMatchObject({ ok: false, reason: 'bad_price' })
  })

  it('이미 공개된 상품은 갱신하지 않고, 신규 쓰기는 pending 만', async () => {
    const plan = planHanjintourPendingEnqueue({ ...malta, departures: [dep()] })
    expect(plan.ok).toBe(true)
    const writes: Array<Record<string, unknown>> = []
    const prisma = {
      brand: { upsert: async () => ({ id: 'brand-hanjin', brandKey: 'hanjintour', displayName: '한진관광' }) },
      product: {
        findUnique: async () => ({ id: 'pub', registrationStatus: 'registered' }),
        update: async () => {
          throw new Error('public row must not be updated')
        },
        create: async () => {
          throw new Error('public row must not be recreated')
        },
      },
      productDeparture: { upsert: async () => { throw new Error('departures must not be written') } },
    }
    const skipped = await applyHanjintourPendingPlan(prisma as never, plan)
    expect(skipped).toEqual({ ok: false, reason: 'already_public' })

    const fresh = {
      brand: { upsert: async () => ({ id: 'brand-hanjin', brandKey: 'hanjintour', displayName: '한진관광' }) },
      product: {
        findUnique: async () => null,
        update: async () => { throw new Error('no update') },
        create: async ({ data }: { data: Record<string, unknown> }) => {
          writes.push(data)
          return { id: 'new-id' }
        },
      },
      productDeparture: {
        upsert: async (args: { create: { adultPrice: number; childBedPrice: number | null } }) => {
          writes.push(args.create)
          return {}
        },
      },
    }
    const applied = await applyHanjintourPendingPlan(fresh as never, plan)
    expect(applied).toEqual({ ok: true, productId: 'new-id', registrationStatus: 'pending' })
    expect(writes[0]).toMatchObject({ originSource: 'hanjintour', registrationStatus: 'pending', priceFrom: 1990000, brandId: 'brand-hanjin' })
    expect(writes[1]).toMatchObject({ adultPrice: 1990000, childBedPrice: null })
    const statuses = new Set((plan.ok ? [plan.registrationStatus] : []))
    expect(statuses).toEqual(new Set(['pending']))
  })

  it('수집 코드에 공개 전환 분기가 없다', () => {
    const files = [
      'lib/hanjintour-register.ts',
      'lib/parse-and-register-hanjintour-handler.ts',
      'app/api/travel/parse-and-register-hanjintour/route.ts',
    ]
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      expect(src).not.toMatch(/registrationStatus:\s*'registered'/)
      expect(src).not.toContain('register-auto-photo-register-job')
    }
    expect(readFileSync('lib/hanjintour-register.ts', 'utf8')).toContain("registrationStatus: HANJINTOUR_PENDING_STATUS")
    expect(readFileSync('scripts/hanjintour-dry-run.ts', 'utf8')).toContain('planHanjintourPendingEnqueue(')
  })

  it('공급사 키는 관리자 필터에만 더하고 기존 7곳 canonical 에는 넣지 않는다', () => {
    expect(HANJINTOUR_SUPPLIER_KEY).toBe('hanjintour')
    expect(CANONICAL_OVERSEAS_SUPPLIER_KEYS).not.toContain('hanjintour')
    expect(CANONICAL_OVERSEAS_SUPPLIER_KEYS).toHaveLength(7)
    expect([...ADMIN_PRODUCT_ORIGIN_FILTERS]).toEqual([...HANJINTOUR_EXISTING_SUPPLIERS, 'hanjintour'])
    expect(normalizeSupplierOrigin('hanjintour')).toBe('hanjintour')
    expect(normalizeSupplierOrigin('한진관광')).toBe('hanjintour')
  })
})
