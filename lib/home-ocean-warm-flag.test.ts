import { describe, expect, it, afterEach } from 'vitest'
import { isHomeOceanWarmEnabled } from '@/lib/home-ocean-warm-flag'

describe('isHomeOceanWarmEnabled', () => {
  const prev = process.env.HOME_OCEAN_WARM
  const prevNode = process.env.NODE_ENV

  afterEach(() => {
    if (prev === undefined) delete process.env.HOME_OCEAN_WARM
    else process.env.HOME_OCEAN_WARM = prev
    process.env.NODE_ENV = prevNode
  })

  it('honors explicit 1 / 0', () => {
    process.env.HOME_OCEAN_WARM = '1'
    expect(isHomeOceanWarmEnabled()).toBe(true)
    process.env.HOME_OCEAN_WARM = '0'
    expect(isHomeOceanWarmEnabled()).toBe(false)
  })

  it('defaults on when unset (production included)', () => {
    delete process.env.HOME_OCEAN_WARM
    process.env.NODE_ENV = 'production'
    expect(isHomeOceanWarmEnabled()).toBe(true)
    process.env.NODE_ENV = 'development'
    expect(isHomeOceanWarmEnabled()).toBe(true)
  })
})
