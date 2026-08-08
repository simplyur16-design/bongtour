import { describe, expect, it } from 'vitest'
import {
  normalizeSimplyurBuyerEmail,
  resolveSimplyurCheckoutBuyerEmail,
  simplyurOAuthCompleteEmailQuery,
} from '@/lib/simplyur/checkout/session-buyer-email'

describe('simplyur checkout session buyer email', () => {
  it('prefers session over query', () => {
    expect(
      resolveSimplyurCheckoutBuyerEmail({
        sessionEmail: 'a@example.com',
        queryBuyerEmail: 'b@example.com',
      }),
    ).toBe('a@example.com')
  })

  it('uses query when session empty (app WebBrowser handoff)', () => {
    expect(
      resolveSimplyurCheckoutBuyerEmail({
        sessionEmail: null,
        queryBuyerEmail: ' guest@example.com ',
      }),
    ).toBe('guest@example.com')
  })

  it('rejects non-emails', () => {
    expect(normalizeSimplyurBuyerEmail('not-an-email')).toBe('')
    expect(simplyurOAuthCompleteEmailQuery(null)).toBe('')
    expect(simplyurOAuthCompleteEmailQuery('x@y.z')).toBe('&email=x%40y.z')
  })
})
