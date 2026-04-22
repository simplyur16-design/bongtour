import { prisma } from '@/lib/prisma'
import { decryptNaverEncryptUniqueId, verifyNaverUnlinkSignature } from '@/lib/naver-unlink-crypto'

/**
 * 연결 끊기 알림 처리: 서명 검증 → 고유 ID 복호화 → naver Account 삭제·세션 무효화·User 소셜 필드 정리.
 * @returns HTTP status (204 성공, 400/403 오류)
 */
export async function handleNaverUnlinkNotificationFromBody(body: URLSearchParams): Promise<number> {
  const clientId = body.get('clientId')?.trim() ?? ''
  const encryptUniqueId = body.get('encryptUniqueId')?.trim() ?? ''
  const timestamp = body.get('timestamp')?.trim() ?? ''
  const signature = body.get('signature')?.trim() ?? ''

  if (!clientId || !encryptUniqueId || !timestamp || !signature) {
    console.warn('[naver-unlink] missing parameter(s)')
    return 400
  }

  const expectedClientId = process.env.NAVER_CLIENT_ID?.trim()
  const clientSecret = process.env.NAVER_CLIENT_SECRET?.trim()
  if (!expectedClientId || !clientSecret) {
    console.error('[naver-unlink] NAVER_CLIENT_ID / NAVER_CLIENT_SECRET not configured')
    return 500
  }

  if (clientId !== expectedClientId) {
    console.warn('[naver-unlink] clientId mismatch')
    return 403
  }

  if (!verifyNaverUnlinkSignature({ clientId, encryptUniqueId, timestamp, signature, clientSecret })) {
    console.warn('[naver-unlink] signature verification failed')
    return 403
  }

  const naverUniqueId = decryptNaverEncryptUniqueId(encryptUniqueId, clientSecret)
  if (!naverUniqueId) {
    console.warn('[naver-unlink] decrypt failed')
    return 400
  }

  const account = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: 'naver', providerAccountId: naverUniqueId } },
    select: { id: true, userId: true },
  })

  if (!account) {
    console.log('[naver-unlink] no linked account (idempotent):', naverUniqueId.slice(0, 8) + '…')
    return 204
  }

  const userId = account.userId

  await prisma.$transaction(async (tx) => {
    await tx.account.delete({ where: { id: account.id } })
    await tx.session.deleteMany({ where: { userId } })

    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { accounts: true },
    })
    if (!user) return

    const kakaoAcc = user.accounts.find((a) => a.provider === 'kakao')
    if (kakaoAcc) {
      await tx.user.update({
        where: { id: userId },
        data: {
          socialProvider: 'kakao',
          socialProviderUserId: kakaoAcc.providerAccountId,
        },
      })
      return
    }

    await tx.user.update({
      where: { id: userId },
      data: {
        socialProvider: null,
        socialProviderUserId: null,
        ...(user.signupMethod === 'naver'
          ? { signupMethod: user.passwordHash ? 'email' : null }
          : {}),
      },
    })
  })

  console.log('[naver-unlink] processed for user', userId)
  return 204
}
