/**
 * Soft-delete Simplyur / Bongtour account for App Store account-deletion.
 * REGRESSION-FREEZE[simplyur-mobile-p1-account-settings]: withdraw — manifest
 */
import { prisma } from '@/lib/prisma'
import { isRestrictedAccountStatus } from '@/lib/account-status'

export type WithdrawSimplyurAccountResult =
  | { ok: true }
  | { ok: false; code: 'not_found' | 'already_withdrawn' | 'restricted' }

/** Scramble unique email so the address can be re-used after withdrawal. */
export function withdrawnPlaceholderEmail(userId: string): string {
  const safe = userId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'user'
  return `withdrawn+${safe}@deleted.simplyur.invalid`
}

export async function withdrawSimplyurAccount(userId: string): Promise<WithdrawSimplyurAccountResult> {
  const id = userId.trim()
  if (!id) return { ok: false, code: 'not_found' }

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, accountStatus: true },
  })
  if (!user) return { ok: false, code: 'not_found' }
  if (user.accountStatus === 'withdrawn') return { ok: false, code: 'already_withdrawn' }
  if (isRestrictedAccountStatus(user.accountStatus)) return { ok: false, code: 'restricted' }

  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId: id } })
    await tx.account.deleteMany({ where: { userId: id } })
    await tx.user.update({
      where: { id },
      data: {
        accountStatus: 'withdrawn',
        email: withdrawnPlaceholderEmail(id),
        emailVerified: null,
        passwordHash: null,
        phone: null,
        name: null,
        image: null,
        socialProvider: null,
        socialProviderUserId: null,
      },
    })
  })

  return { ok: true }
}
