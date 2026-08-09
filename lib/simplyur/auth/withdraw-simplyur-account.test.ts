import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  findUnique,
  deleteManySession,
  deleteManyAccount,
  updateUser,
  transaction,
} = vi.hoisted(() => {
  const findUnique = vi.fn()
  const deleteManySession = vi.fn()
  const deleteManyAccount = vi.fn()
  const updateUser = vi.fn()
  const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({
      session: { deleteMany: deleteManySession },
      account: { deleteMany: deleteManyAccount },
      user: { update: updateUser },
    }),
  )
  return { findUnique, deleteManySession, deleteManyAccount, updateUser, transaction }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique },
    $transaction: transaction,
  },
}))

import {
  withdrawSimplyurAccount,
  withdrawnPlaceholderEmail,
} from '@/lib/simplyur/auth/withdraw-simplyur-account'

describe('withdrawSimplyurAccount', () => {
  beforeEach(() => {
    findUnique.mockReset()
    deleteManySession.mockReset()
    deleteManyAccount.mockReset()
    updateUser.mockReset()
    transaction.mockClear()
  })

  it('marks active user withdrawn and clears auth bindings', async () => {
    findUnique.mockResolvedValue({ id: 'u1', accountStatus: 'active' })
    const res = await withdrawSimplyurAccount('u1')
    expect(res).toEqual({ ok: true })
    expect(deleteManySession).toHaveBeenCalledWith({ where: { userId: 'u1' } })
    expect(deleteManyAccount).toHaveBeenCalledWith({ where: { userId: 'u1' } })
    expect(updateUser).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({
        accountStatus: 'withdrawn',
        email: withdrawnPlaceholderEmail('u1'),
        passwordHash: null,
      }),
    })
  })

  it('rejects already withdrawn', async () => {
    findUnique.mockResolvedValue({ id: 'u1', accountStatus: 'withdrawn' })
    expect(await withdrawSimplyurAccount('u1')).toEqual({ ok: false, code: 'already_withdrawn' })
    expect(transaction).not.toHaveBeenCalled()
  })

  it('rejects suspended', async () => {
    findUnique.mockResolvedValue({ id: 'u1', accountStatus: 'suspended' })
    expect(await withdrawSimplyurAccount('u1')).toEqual({ ok: false, code: 'restricted' })
  })
})
