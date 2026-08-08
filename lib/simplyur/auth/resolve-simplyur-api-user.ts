/**
 * simplyur API auth — cookie session OR mobile Bearer.
 * REGRESSION-FREEZE[simplyur-inapp-auth]: Bearer + cookie gate — manifest
 * REGRESSION-FREEZE[simplyur-mobile-auth-hardening]: accountStatus re-check — manifest
 */
import { auth } from '@/auth'
import { isRestrictedAccountStatus } from '@/lib/account-status'
import { prisma } from '@/lib/prisma'
import {
  readBearerToken,
  verifySimplyurMobileAccessToken,
} from '@/lib/simplyur/auth/mobile-access-token'

export type SimplyurApiUser = {
  userId: string
  email: string
}

async function loadActiveSimplyurUserById(userId: string): Promise<SimplyurApiUser | null> {
  const id = userId.trim()
  if (!id) return null
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, accountStatus: true },
  })
  if (!user || isRestrictedAccountStatus(user.accountStatus)) return null
  const email = (user.email ?? '').trim().toLowerCase()
  if (!email.includes('@')) return null
  return { userId: user.id, email }
}

async function loadActiveSimplyurUserByEmail(emailRaw: string): Promise<SimplyurApiUser | null> {
  const email = emailRaw.trim().toLowerCase()
  if (!email.includes('@')) return null
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, accountStatus: true },
  })
  if (!user || isRestrictedAccountStatus(user.accountStatus)) return null
  return { userId: user.id, email: (user.email ?? email).trim().toLowerCase() }
}

export async function resolveSimplyurApiUser(req: Request): Promise<SimplyurApiUser | null> {
  const bearer = readBearerToken(req)
  if (bearer) {
    const claims = await verifySimplyurMobileAccessToken(bearer)
    if (claims) {
      // Re-check DB — suspended/withdrawn must not keep using a 30d Bearer.
      return loadActiveSimplyurUserById(claims.userId)
    }
  }

  const session = await auth()
  const email = session?.user?.email?.trim().toLowerCase() ?? ''
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? '').trim()
  if (userId) return loadActiveSimplyurUserById(userId)
  if (email) return loadActiveSimplyurUserByEmail(email)
  return null
}
