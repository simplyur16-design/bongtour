import { describe, expect, it } from 'vitest'
import {
  decideMegaMenu,
  type MegaGesturePointer,
  type MegaMenuEvent,
  type MegaMenuEffect,
} from '@/lib/mega-menu-interaction'

type Sim = { open: boolean; armed: boolean; gesture: MegaGesturePointer }

function step(sim: Sim, event: MegaMenuEvent): Sim {
  const decision = decideMegaMenu(sim.gesture, event)
  let open = sim.open
  let armed = false
  if (decision.effect === 'open') open = true
  if (decision.effect === 'toggle') open = !sim.open
  if (decision.effect === 'arm-close') armed = true
  return { open, armed, gesture: decision.gesturePointer }
}

function play(events: MegaMenuEvent[]): Sim {
  return events.reduce(step, { open: false, armed: false, gesture: null })
}

function fireTimeout(sim: Sim): Sim {
  if (!sim.armed) return sim
  return { ...sim, open: false, armed: false }
}

describe('mega-menu input modes', () => {
  // REGRESSION-FREEZE[seo-design-public-fixes]: keyboard focus is not a coarse tap — manifest
  it('fine mouse hover opens, click does not toggle, leave then timeout closes', () => {
    let sim = play([
      { kind: 'pointerenter', pointerType: 'mouse', fineHover: true },
      { kind: 'pointerdown', pointerType: 'mouse' },
      { kind: 'focus' },
      { kind: 'click', detail: 1, fineHover: true },
    ])
    expect(sim.open).toBe(true)
    expect(sim.armed).toBe(false)
    sim = step(sim, { kind: 'pointerleave', pointerType: 'mouse', fineHover: true })
    expect(sim.armed).toBe(true)
    expect(fireTimeout(sim).open).toBe(false)
  })

  it('keyboard focus opens on a coarse device and Enter does not close', () => {
    let sim = play([{ kind: 'focus' }])
    expect(sim.open).toBe(true)
    sim = step(sim, { kind: 'click', detail: 0, fineHover: false })
    expect(sim.open).toBe(true)
    sim = step(sim, { kind: 'escape' })
    expect(sim.open).toBe(true)
  })

  it('coarse tap opens once and a second tap closes', () => {
    const first = play([
      { kind: 'pointerdown', pointerType: 'touch' },
      { kind: 'focus' },
      { kind: 'pointerenter', pointerType: 'touch', fineHover: false },
      { kind: 'click', detail: 1, fineHover: false },
      { kind: 'pointerleave', pointerType: 'touch', fineHover: false },
    ])
    expect(first.open).toBe(true)
    expect(first.armed).toBe(false)
    const second = play([
      { kind: 'pointerdown', pointerType: 'touch' },
      { kind: 'focus' },
      { kind: 'click', detail: 1, fineHover: false },
      { kind: 'pointerdown', pointerType: 'touch' },
      { kind: 'focus' },
      { kind: 'click', detail: 1, fineHover: false },
    ])
    expect(second.open).toBe(false)
  })

  it('keyboard focus still opens after a coarse tap cleared the gesture', () => {
    let sim = play([
      { kind: 'pointerdown', pointerType: 'touch' },
      { kind: 'focus' },
      { kind: 'click', detail: 1, fineHover: false },
    ])
    expect(sim.open).toBe(true)
    expect(sim.gesture).toBeNull()
    sim = step({ open: false, armed: false, gesture: sim.gesture }, { kind: 'focus' })
    expect(sim.open).toBe(true)
  })

  it('hybrid fine-hover device still toggles on touch and keeps mouse hover', () => {
    const touch = play([
      { kind: 'pointerdown', pointerType: 'touch' },
      { kind: 'focus' },
      { kind: 'pointerenter', pointerType: 'touch', fineHover: true },
      { kind: 'click', detail: 1, fineHover: true },
      { kind: 'pointerleave', pointerType: 'touch', fineHover: true },
    ])
    expect(touch.open).toBe(true)
    expect(touch.armed).toBe(false)
    let mouse = play([{ kind: 'pointerenter', pointerType: 'mouse', fineHover: true }])
    expect(mouse.open).toBe(true)
    mouse = step(mouse, { kind: 'click', detail: 1, fineHover: true })
    expect(mouse.open).toBe(true)
    mouse = step(mouse, { kind: 'pointerleave', pointerType: 'mouse', fineHover: true })
    expect(fireTimeout(mouse).open).toBe(false)
  })

  it('keyboard focus opens after mouse hover has closed', () => {
    let sim = play([{ kind: 'pointerenter', pointerType: 'mouse', fineHover: true }])
    sim = step(sim, { kind: 'pointerleave', pointerType: 'mouse', fineHover: true })
    sim = fireTimeout(sim)
    expect(sim.open).toBe(false)
    sim = step(sim, { kind: 'focus' })
    expect(sim.open).toBe(true)
  })

  it('pen follows touch, and escape never closes', () => {
    const sim = play([
      { kind: 'pointerdown', pointerType: 'pen' },
      { kind: 'focus' },
      { kind: 'click', detail: 1, fineHover: true },
      { kind: 'escape' },
    ])
    expect(sim.open).toBe(true)
    const effect: MegaMenuEffect = decideMegaMenu(null, { kind: 'escape' }).effect
    expect(effect).toBe('none')
  })
})
