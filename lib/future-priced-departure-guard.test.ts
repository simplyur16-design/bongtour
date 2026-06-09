import { describe, expect, it } from 'vitest'
import { applyDbFutureDepartureGuardToRuleAMarkers } from '@/lib/future-priced-departure-guard'

describe('applyDbFutureDepartureGuardToRuleAMarkers', () => {
  it('keeps live markers when live found future departures', () => {
    const live = {
      marked: false,
      noFutureDepartureConfirmedAt: null,
      lastFutureDepartureDate: new Date('2026-08-01T00:00:00.000Z'),
    }
    expect(
      applyDbFutureDepartureGuardToRuleAMarkers(live, true, new Date('2026-09-01T00:00:00.000Z')),
    ).toEqual(live)
  })

  it('keeps no-future marker when DB also has no future priced departures', () => {
    const markedAt = new Date('2026-06-09T00:00:00.000Z')
    const live = {
      marked: true,
      noFutureDepartureConfirmedAt: markedAt,
      lastFutureDepartureDate: null,
    }
    expect(applyDbFutureDepartureGuardToRuleAMarkers(live, false, null)).toEqual(live)
  })

  it('clears marker when live says none but DB still has future priced departures', () => {
    const markedAt = new Date('2026-06-09T00:00:00.000Z')
    const dbLast = new Date('2026-10-22T00:00:00.000Z')
    const live = {
      marked: true,
      noFutureDepartureConfirmedAt: markedAt,
      lastFutureDepartureDate: null,
    }
    expect(applyDbFutureDepartureGuardToRuleAMarkers(live, true, dbLast)).toEqual({
      marked: false,
      noFutureDepartureConfirmedAt: null,
      lastFutureDepartureDate: dbLast,
    })
  })
})
