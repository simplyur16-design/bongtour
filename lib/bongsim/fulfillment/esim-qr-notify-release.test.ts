import { beforeEach, describe, expect, it, vi } from 'vitest'

// outbox 풀(max 2)에서 조기 return 경로가 client를 반납하지 않으면 2 tick 후 connect timeout.
type Q = { sql: string }
const state: { pickRows: unknown[]; orderStatus: string | null; throwOnPick: boolean; queries: Q[] } = {
  pickRows: [],
  orderStatus: null,
  throwOnPick: false,
  queries: [],
}
const release = vi.fn()

const client = {
  release,
  query: vi.fn(async (sql: string) => {
    state.queries.push({ sql })
    if (/FOR UPDATE SKIP LOCKED/.test(sql)) {
      if (state.throwOnPick) throw new Error('pick failed')
      return { rows: state.pickRows, rowCount: state.pickRows.length }
    }
    if (/FROM bongsim_order/.test(sql)) {
      return { rows: state.orderStatus ? [{ status: state.orderStatus }] : [], rowCount: 1 }
    }
    return { rows: [], rowCount: 1 }
  }),
}
const pool = { connect: vi.fn(async () => client), query: vi.fn(async () => ({ rows: [], rowCount: 1 })) }

vi.mock('@/lib/bongsim/db/pool', () => ({
  getBongsimFulfillOutboxPool: () => pool,
  getPgPool: () => pool,
}))
vi.mock('@/lib/bongsim/fulfillment/outbox-defer', () => ({
  deferOrTerminalOutboxAfterFailure: vi.fn(async () => 'terminal'),
}))
vi.mock('@/lib/instrumentation-process-role', () => ({
  shouldDrainOrderPaidInThisProcess: () => false,
}))

const validPayload = {
  order_id: '00000000-0000-0000-0000-000000000001',
  qr_code_url: 'https://example.invalid/qr.png',
  download_link: 'https://example.invalid/dl',
}

describe('processNextEsimQrNotifyOutbox releases the pool client on every exit path', () => {
  beforeEach(() => {
    release.mockClear()
    pool.connect.mockClear()
    state.pickRows = []
    state.orderStatus = null
    state.throwOnPick = false
    state.queries = []
  })

  it('no row (empty) → release once', async () => {
    const { processNextEsimQrNotifyOutbox } = await import('@/lib/bongsim/fulfillment/esim-qr-notify-outbox')
    const r = await processNextEsimQrNotifyOutbox()
    expect(r.outcome).toBe('empty')
    expect(pool.connect).toHaveBeenCalledTimes(1)
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('invalid payload (terminal) → release once', async () => {
    state.pickRows = [{ id: 'ob1', payload: { bad: true } }]
    const { processNextEsimQrNotifyOutbox } = await import('@/lib/bongsim/fulfillment/esim-qr-notify-outbox')
    const r = await processNextEsimQrNotifyOutbox()
    expect(r.outcome).toBe('terminal')
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('refunded order (terminal skip) → release once', async () => {
    state.pickRows = [{ id: 'ob2', payload: validPayload }]
    state.orderStatus = 'refunded'
    const { processNextEsimQrNotifyOutbox } = await import('@/lib/bongsim/fulfillment/esim-qr-notify-outbox')
    const r = await processNextEsimQrNotifyOutbox()
    expect(r.outcome).toBe('terminal')
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('pick error → release once (no double release)', async () => {
    state.throwOnPick = true
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { processNextEsimQrNotifyOutbox } = await import('@/lib/bongsim/fulfillment/esim-qr-notify-outbox')
    const r = await processNextEsimQrNotifyOutbox()
    err.mockRestore()
    expect(r.outcome).toBe('error')
    expect(release).toHaveBeenCalledTimes(1)
  })
})
