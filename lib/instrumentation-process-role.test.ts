import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  resolveBongsimFulfillmentOwner,
  resolveInstrumentationProcessRole,
  shouldDrainOrderPaidInThisProcess,
  shouldRunBackgroundCrons,
  shouldRunFulfillmentCrons,
  shouldRunWebCriticalCrons,
} from '@/lib/instrumentation-process-role'

// REGRESSION-FREEZE[bongsim-fulfill-owner-split]: role + fulfill owner — manifest

describe('instrumentation-process-role', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.BONGTOUR_INSTRUMENTATION_ROLE
    delete process.env.RAILWAY_SERVICE_NAME
    delete process.env.BONGSIM_FULFILL_OWNER
    delete process.env.DISABLE_INSTRUMENTATION_BONGSIM_ORDER_PAID_OUTBOX_CRON
  })

  afterEach(() => {
    process.env = env
  })

  it('defaults production to web owning fulfill (solo compat)', () => {
    process.env.NODE_ENV = 'production'
    expect(resolveInstrumentationProcessRole()).toBe('web')
    expect(shouldRunWebCriticalCrons('web')).toBe(true)
    expect(shouldRunBackgroundCrons('web')).toBe(false)
    expect(resolveBongsimFulfillmentOwner('web')).toBe('web')
    expect(shouldRunFulfillmentCrons('web')).toBe(true)
  })

  it('infers worker from Railway service name and owns fulfill by default', () => {
    process.env.NODE_ENV = 'production'
    process.env.RAILWAY_SERVICE_NAME = 'bongtour-worker'
    expect(resolveInstrumentationProcessRole()).toBe('worker')
    expect(shouldRunBackgroundCrons('worker')).toBe(true)
    expect(shouldRunWebCriticalCrons('worker')).toBe(false)
    expect(resolveBongsimFulfillmentOwner('worker')).toBe('worker')
    expect(shouldRunFulfillmentCrons('worker')).toBe(true)
  })

  it('infers fulfill role from service name', () => {
    process.env.NODE_ENV = 'production'
    process.env.RAILWAY_SERVICE_NAME = 'bongtour-fulfill'
    expect(resolveInstrumentationProcessRole()).toBe('fulfill')
    expect(shouldRunBackgroundCrons('fulfill')).toBe(false)
    expect(shouldRunFulfillmentCrons('fulfill')).toBe(true)
  })

  it('web stops draining when FULFILL_OWNER=worker', () => {
    process.env.BONGSIM_FULFILL_OWNER = 'worker'
    expect(resolveBongsimFulfillmentOwner('web')).toBe('worker')
    expect(shouldRunFulfillmentCrons('web')).toBe(false)
    expect(shouldDrainOrderPaidInThisProcess('web')).toBe(false)
    expect(shouldRunFulfillmentCrons('worker')).toBe(true)
  })

  it('respects explicit role', () => {
    process.env.BONGTOUR_INSTRUMENTATION_ROLE = 'worker'
    expect(resolveInstrumentationProcessRole()).toBe('worker')
  })

  it('disable flag turns off fulfillment crons', () => {
    process.env.DISABLE_INSTRUMENTATION_BONGSIM_ORDER_PAID_OUTBOX_CRON = '1'
    expect(shouldRunFulfillmentCrons('worker')).toBe(false)
  })
})
