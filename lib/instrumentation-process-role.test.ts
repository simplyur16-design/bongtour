import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  resolveInstrumentationProcessRole,
  shouldRunBackgroundCrons,
  shouldRunWebCriticalCrons,
} from '@/lib/instrumentation-process-role'

describe('instrumentation-process-role', () => {
  const env = process.env

  beforeEach(() => {
    process.env = { ...env }
    delete process.env.BONGTOUR_INSTRUMENTATION_ROLE
    delete process.env.RAILWAY_SERVICE_NAME
  })

  afterEach(() => {
    process.env = env
  })

  it('defaults production to web', () => {
    process.env.NODE_ENV = 'production'
    expect(resolveInstrumentationProcessRole()).toBe('web')
    expect(shouldRunWebCriticalCrons('web')).toBe(true)
    expect(shouldRunBackgroundCrons('web')).toBe(false)
  })

  it('infers worker from Railway service name', () => {
    process.env.NODE_ENV = 'production'
    process.env.RAILWAY_SERVICE_NAME = 'bongtour-worker'
    expect(resolveInstrumentationProcessRole()).toBe('worker')
    expect(shouldRunBackgroundCrons('worker')).toBe(true)
    expect(shouldRunWebCriticalCrons('worker')).toBe(false)
  })

  it('respects explicit role', () => {
    process.env.BONGTOUR_INSTRUMENTATION_ROLE = 'worker'
    expect(resolveInstrumentationProcessRole()).toBe('worker')
  })
})
