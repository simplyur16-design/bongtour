import { afterEach, describe, expect, it, vi } from 'vitest'
import { debugLog, isBongMarketingDebugEnabled } from '@/lib/bong-marketing/debug-log'

describe('debug-log', () => {
  const orig = process.env.DEBUG_BONG_MARKETING

  afterEach(() => {
    if (orig === undefined) delete process.env.DEBUG_BONG_MARKETING
    else process.env.DEBUG_BONG_MARKETING = orig
    vi.restoreAllMocks()
  })

  it('is disabled by default', () => {
    delete process.env.DEBUG_BONG_MARKETING
    expect(isBongMarketingDebugEnabled()).toBe(false)
  })

  it('logs when DEBUG_BONG_MARKETING=1', () => {
    process.env.DEBUG_BONG_MARKETING = '1'
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    debugLog('test', 'hello')
    expect(spy).toHaveBeenCalledWith('[bong-marketing:test]', 'hello')
  })

  it('does not log when disabled', () => {
    process.env.DEBUG_BONG_MARKETING = '0'
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    debugLog('test', 'hello')
    expect(spy).not.toHaveBeenCalled()
  })
})
