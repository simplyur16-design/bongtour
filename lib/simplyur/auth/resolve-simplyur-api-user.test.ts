import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
const authMock = vi.fn()
const verifyMock = vi.fn()
const readBearerMock = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique },
  },
}))

vi.mock('@/auth', () => ({
  auth: () => authMock(),
}))

vi.mock('@/lib/simplyur/auth/mobile-access-token', () => ({
  readBearerToken: (req: Request) => readBearerMock(req),
  verifySimplyurMobileAccessToken: (token: string) => verifyMock(token),
}))

describe('resolveSimplyurApiUser — accountStatus gate', () => {
  beforeEach(() => {
    findUnique.mockReset()
    authMock.mockReset()
    verifyMock.mockReset()
    readBearerMock.mockReset()
    authMock.mockResolvedValue(null)
    readBearerMock.mockReturnValue('')
  })

  it('rejects Bearer for suspended user even when JWT verifies', async () => {
    const { resolveSimplyurApiUser } = await import('@/lib/simplyur/auth/resolve-simplyur-api-user')
    readBearerMock.mockReturnValue('good.jwt')
    verifyMock.mockResolvedValue({ userId: 'u1', email: 'a@example.com' })
    findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@example.com',
      accountStatus: 'suspended',
    })
    const req = new Request('https://bongtour.com/api/simplyur/mypage/orders')
    await expect(resolveSimplyurApiUser(req)).resolves.toBeNull()
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'u1' },
      select: { id: true, email: true, accountStatus: true },
    })
  })

  it('accepts Bearer for active user', async () => {
    const { resolveSimplyurApiUser } = await import('@/lib/simplyur/auth/resolve-simplyur-api-user')
    readBearerMock.mockReturnValue('good.jwt')
    verifyMock.mockResolvedValue({ userId: 'u2', email: 'b@example.com' })
    findUnique.mockResolvedValue({
      id: 'u2',
      email: 'b@example.com',
      accountStatus: 'active',
    })
    const req = new Request('https://bongtour.com/api/simplyur/mypage/orders')
    await expect(resolveSimplyurApiUser(req)).resolves.toEqual({
      userId: 'u2',
      email: 'b@example.com',
    })
  })

  it('uses JWT email when DB email empty but account active', async () => {
    const { resolveSimplyurApiUser } = await import('@/lib/simplyur/auth/resolve-simplyur-api-user')
    readBearerMock.mockReturnValue('good.jwt')
    verifyMock.mockResolvedValue({ userId: 'u4', email: 'relay@privaterelay.appleid.com' })
    findUnique.mockResolvedValue({
      id: 'u4',
      email: null,
      accountStatus: 'active',
    })
    const req = new Request('https://bongtour.com/api/simplyur/mypage/orders')
    await expect(resolveSimplyurApiUser(req)).resolves.toEqual({
      userId: 'u4',
      email: 'relay@privaterelay.appleid.com',
    })
  })

  it('rejects withdrawn cookie session user', async () => {
    const { resolveSimplyurApiUser } = await import('@/lib/simplyur/auth/resolve-simplyur-api-user')
    authMock.mockResolvedValue({
      user: { id: 'u3', email: 'c@example.com' },
    })
    findUnique.mockResolvedValue({
      id: 'u3',
      email: 'c@example.com',
      accountStatus: 'withdrawn',
    })
    const req = new Request('https://bongtour.com/api/simplyur/mypage/orders')
    await expect(resolveSimplyurApiUser(req)).resolves.toBeNull()
  })
})
