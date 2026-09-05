import { describe, expect, it } from 'vitest'
import { shouldFireOnOnline } from './offline-online-transition'

describe('shouldFireOnOnline', () => {
  it('does not reload while already online (stops catalog spinner loop)', () => {
    expect(shouldFireOnOnline(false, true)).toBe(false)
    expect(shouldFireOnOnline(false, false)).toBe(false)
  })

  it('reloads only on offline → online', () => {
    expect(shouldFireOnOnline(true, true)).toBe(true)
    expect(shouldFireOnOnline(true, false)).toBe(false)
  })
})
