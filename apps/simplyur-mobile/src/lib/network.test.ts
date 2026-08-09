import { afterEach, describe, expect, it, vi } from 'vitest'
import { probeSimplyurOnline } from './network'

describe('probeSimplyurOnline', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns true on ok health', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200 })),
    )
    await expect(probeSimplyurOnline(1000)).resolves.toBe(true)
  })

  it('returns false on network throw', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )
    await expect(probeSimplyurOnline(1000)).resolves.toBe(false)
  })
})
