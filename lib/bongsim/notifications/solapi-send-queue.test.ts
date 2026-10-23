import { describe, expect, it } from 'vitest'
import { enqueueSolapiSend } from '@/lib/bongsim/notifications/solapi-send-queue'

// REGRESSION-FREEZE[bongsim-solapi-esim-priority-queue]: eSIM before normal — manifest

describe('solapi-send-queue', () => {
  it('drains esim before normal when both are waiting', async () => {
    const order: string[] = []
    // block the pump until both are queued
    let releaseGate!: () => void
    const gate = new Promise<void>((r) => {
      releaseGate = r
    })

    const esimP = enqueueSolapiSend('esim', async () => {
      await gate
      order.push('esim')
    })
    const normalP = enqueueSolapiSend('normal', async () => {
      order.push('normal')
    })

    // first job (esim) is blocked on gate; normal sits in queue
    await Promise.resolve()
    releaseGate()
    await Promise.all([esimP, normalP])
    expect(order).toEqual(['esim', 'normal'])
  })
})
