import { describe, expect, it } from 'vitest'
import {
  SIMPLYUR_MOBILE_SESSION_RATE_MAX_EMAIL,
  SIMPLYUR_MOBILE_SESSION_RATE_MAX_IP,
  simplyurMobileSessionEmailRateKey,
  simplyurMobileSessionIpRateKey,
} from '@/lib/simplyur/auth/mobile-session-rate-limit'

describe('simplyur mobile-session rate limit keys', () => {
  it('builds stable IP and email keys under auth ceilings', () => {
    expect(SIMPLYUR_MOBILE_SESSION_RATE_MAX_IP).toBeGreaterThan(0)
    expect(SIMPLYUR_MOBILE_SESSION_RATE_MAX_EMAIL).toBeGreaterThan(0)
    expect(SIMPLYUR_MOBILE_SESSION_RATE_MAX_EMAIL).toBeLessThanOrEqual(
      SIMPLYUR_MOBILE_SESSION_RATE_MAX_IP,
    )
    expect(simplyurMobileSessionIpRateKey('1.2.3.4')).toBe('simplyur:mobile-session:ip:1.2.3.4')
    expect(simplyurMobileSessionEmailRateKey(' Traveler@Example.COM ')).toBe(
      'simplyur:mobile-session:email:traveler@example.com',
    )
  })
})
