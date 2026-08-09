/**
 * REGRESSION-FREEZE[simplyur-mobile-p2-ops]: device token upsert — manifest
 */
import { prisma } from '@/lib/prisma'

export async function upsertSimplyurDevicePushToken(args: {
  userId: string
  token: string
  platform: string
}): Promise<{ ok: true } | { ok: false; code: 'invalid' }> {
  const userId = args.userId.trim()
  const token = args.token.trim()
  const platform = args.platform.trim().toLowerCase()
  if (!userId || !token || token.length < 20) return { ok: false, code: 'invalid' }
  if (platform !== 'ios' && platform !== 'android') return { ok: false, code: 'invalid' }

  await prisma.simplyurDevicePushToken.upsert({
    where: { userId_token: { userId, token } },
    create: { userId, token, platform },
    update: { platform },
  })
  return { ok: true }
}
