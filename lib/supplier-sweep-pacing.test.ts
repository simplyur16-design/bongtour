import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  clearSupplierSweepPause,
  createSupplierSweepPacer,
  getSupplierSweepPause,
  isSupplierRefusalError,
} from './supplier-sweep-pacing'

afterEach(() => clearSupplierSweepPause())

describe('isSupplierRefusalError', () => {
  it('detects block / rate-limit signals', () => {
    expect(isSupplierRefusalError(new Error('HTTP 429 Too Many Requests'))).toBe(true)
    expect(isSupplierRefusalError(new Error('status 403'))).toBe(true)
    expect(isSupplierRefusalError({ status: 503 })).toBe(true)
    expect(isSupplierRefusalError(new Error('captcha challenge page'))).toBe(true)
    expect(isSupplierRefusalError(new Error('Access Denied'))).toBe(true)
    expect(isSupplierRefusalError(new Error('비정상적인 접근입니다'))).toBe(true)
    expect(isSupplierRefusalError(new Error('ybtour fetch failed: 403'))).toBe(true)
    expect(isSupplierRefusalError(new Error('hanatour gw /x HTTP 429: busy'))).toBe(true)
  })
  it('ignores ordinary failures', () => {
    expect(isSupplierRefusalError(new Error('Navigation timeout of 30000 ms exceeded'))).toBe(false)
    expect(isSupplierRefusalError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isSupplierRefusalError(new Error('price 4030000 parse failed'))).toBe(false)
    expect(isSupplierRefusalError(null)).toBe(false)
  })
})

describe('createSupplierSweepPacer', () => {
  it('sleeps between products, not before the first', async () => {
    const sleep = vi.fn(async () => undefined)
    const p = createSupplierSweepPacer('hanatour', { minDelayMs: 100, maxDelayMs: 200, sleep, random: () => 0 })
    expect(await p.beforeProduct()).toBe(true)
    expect(sleep).not.toHaveBeenCalled()
    expect(await p.beforeProduct()).toBe(true)
    expect(sleep).toHaveBeenCalledWith(100)
  })

  it('pauses and alerts once after consecutive refusals, then stops the loop', async () => {
    const alert = vi.fn(async () => undefined)
    const p = createSupplierSweepPacer('ybtour', { minDelayMs: 0, maxDelayMs: 0, alert, refusalThreshold: 2, pauseMs: 60_000 })
    await p.beforeProduct()
    await p.onError(new Error('HTTP 429'))
    expect(p.isPaused()).toBe(false)
    await p.beforeProduct()
    await p.onError(new Error('HTTP 429'))
    expect(p.isPaused()).toBe(true)
    expect(alert).toHaveBeenCalledTimes(1)
    expect(String(alert.mock.calls[0]?.[0])).toContain('ybtour')
    expect(await p.beforeProduct()).toBe(false)
    expect(getSupplierSweepPause('ybtour')).not.toBeNull()
  })

  it('a success between refusals resets the counter; non-refusal errors never pause', async () => {
    const alert = vi.fn(async () => undefined)
    const p = createSupplierSweepPacer('modetour', { minDelayMs: 0, maxDelayMs: 0, alert, refusalThreshold: 2 })
    await p.beforeProduct()
    await p.onError(new Error('HTTP 403'))
    await p.beforeProduct() // success
    await p.beforeProduct()
    await p.onError(new Error('HTTP 403'))
    await p.beforeProduct()
    await p.onError(new Error('timeout'))
    await p.beforeProduct()
    await p.onError(new Error('timeout'))
    expect(p.isPaused()).toBe(false)
    expect(alert).not.toHaveBeenCalled()
  })

  it('a later run in the same process skips while paused, resumes after expiry', async () => {
    let t = 1_000
    const now = () => t
    const a = createSupplierSweepPacer('lottetour', { minDelayMs: 0, maxDelayMs: 0, refusalThreshold: 1, pauseMs: 500, now, alert: async () => undefined })
    await a.beforeProduct()
    await a.onError(new Error('Forbidden'))
    const b = createSupplierSweepPacer('lottetour', { minDelayMs: 0, maxDelayMs: 0, now })
    expect(await b.beforeProduct()).toBe(false)
    const other = createSupplierSweepPacer('hanatour', { minDelayMs: 0, maxDelayMs: 0, now })
    expect(await other.beforeProduct()).toBe(true)
    t = 2_000
    const c = createSupplierSweepPacer('lottetour', { minDelayMs: 0, maxDelayMs: 0, now })
    expect(await c.beforeProduct()).toBe(true)
  })

  it('alert failure does not throw', async () => {
    const p = createSupplierSweepPacer('kyowontour', { minDelayMs: 0, maxDelayMs: 0, refusalThreshold: 1, alert: async () => { throw new Error('sms down') } })
    await p.beforeProduct()
    await expect(p.onError(new Error('captcha'))).resolves.toBeUndefined()
    expect(p.isPaused()).toBe(true)
  })
})
