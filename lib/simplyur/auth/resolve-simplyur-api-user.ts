/**
 * simplyur API auth — cookie session OR mobile Bearer.
 * REGRESSION-FREEZE[simplyur-inapp-auth]: Bearer + cookie gate — manifest
 */
import { auth } from '@/auth'
import {
  readBearerToken,
  verifySimplyurMobileAccessToken,
} from '@/lib/simplyur/auth/mobile-access-token'

export type SimplyurApiUser = {
  userId: string
  email: string
}

export async function resolveSimplyurApiUser(req: Request): Promise<SimplyurApiUser | null> {
  const bearer = readBearerToken(req)
  if (bearer) {
    const claims = await verifySimplyurMobileAccessToken(bearer)
    if (claims) return claims
  }

  const session = await auth()
  const email = session?.user?.email?.trim().toLowerCase() ?? ''
  const userId = ((session?.user as { id?: string } | undefined)?.id ?? '').trim()
  if (!email && !userId) return null
  return { userId, email }
}
