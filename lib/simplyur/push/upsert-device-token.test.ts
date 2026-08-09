import { beforeEach, describe, expect, it, vi } from 'vitest'

const upsert = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  prisma: {
    simplyurDevicePushToken: { upsert },
  },
}))

import { upsertSimplyurDevicePushToken } from '@/lib/simplyur/push/upsert-device-token'

describe('upsertSimplyurDevicePushToken', () => {
  beforeEach(() => {
    upsert.mockReset()
  })

  it('rejects short token', async () => {
    expect(
      await upsertSimplyurDevicePushToken({ userId: 'u1', token: 'short', platform: 'ios' }),
    ).toEqual({ ok: false, code: 'invalid' })
    expect(upsert).not.toHaveBeenCalled()
  })

  it('upserts ios token', async () => {
    upsert.mockResolvedValue({})
    const token = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'
    expect(
      await upsertSimplyurDevicePushToken({ userId: 'u1', token, platform: 'ios' }),
    ).toEqual({ ok: true })
    expect(upsert).toHaveBeenCalledWith({
      where: { userId_token: { userId: 'u1', token } },
      create: { userId: 'u1', token, platform: 'ios' },
      update: { platform: 'ios' },
    })
  })
})
