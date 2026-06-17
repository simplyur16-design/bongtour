import { prisma } from '@/lib/prisma'
import { debugAccessToken, refreshLongLivedToken, tokenExpiresAtFromResponse } from '@/lib/meta-graph-client'
import { debugError, debugLog } from '@/lib/bong-marketing/debug-log'

const REFRESH_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

/** 만료 30일 이내면 갱신 대상 */
export function shouldRefreshMetaToken(expiresAt: Date, now = new Date()): boolean {
  return expiresAt.getTime() - now.getTime() <= REFRESH_WINDOW_MS
}

/** 유효한 Meta 연결. 만료 30일 전이면 자동 갱신 시도. */
export async function getValidMetaConnection() {
  const conn = await prisma.bongMetaConnection.findUnique({
    where: { provider: 'meta' },
  })

  if (!conn) return null

  if (conn.userTokenExpiresAt < new Date()) {
    debugError('meta-token', '토큰 만료됨, 재인증 필요')
    return null
  }

  if (shouldRefreshMetaToken(conn.userTokenExpiresAt)) {
    debugLog('meta-token', '토큰 만료 임박, 자동 갱신 시도')
    try {
      const newToken = await refreshLongLivedToken(conn.userAccessToken)
      const updated = await prisma.bongMetaConnection.update({
        where: { provider: 'meta' },
        data: {
          userAccessToken: newToken.access_token,
          userTokenExpiresAt: tokenExpiresAtFromResponse(newToken),
          lastRefreshedAt: new Date(),
        },
      })
      return updated
    } catch (err) {
      debugError('meta-token', '토큰 갱신 실패:', err)
      return conn
    }
  }

  return conn
}

export async function checkTokenValidity(token: string) {
  const info = await debugAccessToken(token)
  return {
    valid: info?.is_valid ?? false,
    expiresAt: info?.expires_at ? new Date(info.expires_at * 1000) : null,
  }
}
