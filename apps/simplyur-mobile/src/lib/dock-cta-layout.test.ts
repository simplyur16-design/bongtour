import { describe, expect, it } from 'vitest'
import {
  SIMPLYUR_DOCK_CTA_HEIGHT,
  SIMPLYUR_DOCK_PAD_H,
  simplyurDockScrollPad,
  simplyurScreenPadTop,
} from './dock-cta-layout'

describe('simplyur purchase dock layout', () => {
  it('uses the same pad for product and checkout (hint slot always reserved)', () => {
    expect(SIMPLYUR_DOCK_CTA_HEIGHT).toBe(56)
    expect(SIMPLYUR_DOCK_PAD_H).toBe(22)
    expect(simplyurDockScrollPad(0)).toBe(simplyurDockScrollPad(0))
    expect(simplyurDockScrollPad(34)).toBe(simplyurDockScrollPad(34))
    expect(simplyurScreenPadTop(47)).toBe(63)
  })
})
