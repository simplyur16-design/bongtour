import Apple from 'next-auth/providers/apple'
import type { Provider } from 'next-auth/providers'
import { createAppleClientSecretJwt } from '@/lib/auth/apple-client-secret-jwt'

function readAppleOAuthEnv() {
  const clientId = process.env.AUTH_APPLE_ID?.trim() || process.env.APPLE_ID?.trim() || ''
  const staticSecret = process.env.AUTH_APPLE_SECRET?.trim() || ''
  const teamId = process.env.AUTH_APPLE_TEAM_ID?.trim() || process.env.APPLE_TEAM_ID?.trim() || ''
  const keyId = process.env.AUTH_APPLE_KEY_ID?.trim() || process.env.APPLE_KEY_ID?.trim() || ''
  const privateKeyRaw =
    process.env.AUTH_APPLE_PRIVATE_KEY?.trim() || process.env.APPLE_PRIVATE_KEY?.trim() || ''
  return { clientId, staticSecret, teamId, keyId, privateKeyRaw }
}

export function normalizeApplePrivateKeyPem(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.includes('BEGIN PRIVATE KEY')) {
    return trimmed.replace(/\\n/g, '\n')
  }
  const body = trimmed.replace(/\\n/g, '\n').replace(/\s+/g, '')
  const lines = body.match(/.{1,64}/g) ?? []
  return ['-----BEGIN PRIVATE KEY-----', ...lines, '-----END PRIVATE KEY-----'].join('\n')
}

/** Sign in with Apple — Services ID + (.p8 키 또는 사전 생성 JWT secret) */
export function isAppleOAuthConfigured(): boolean {
  const { clientId, staticSecret, teamId, keyId, privateKeyRaw } = readAppleOAuthEnv()
  if (!clientId) return false
  if (staticSecret) return true
  return Boolean(teamId && keyId && privateKeyRaw)
}

export function appleOAuthProvider(): Provider | null {
  const { clientId, staticSecret, teamId, keyId, privateKeyRaw } = readAppleOAuthEnv()
  if (!clientId) return null

  const common = {
    clientId,
    allowDangerousEmailAccountLinking: true,
  } as const

  if (staticSecret) {
    return Apple({ ...common, clientSecret: staticSecret })
  }

  const privateKey = normalizeApplePrivateKeyPem(privateKeyRaw)
  if (!teamId || !keyId || !privateKey) return null

  const clientSecret = createAppleClientSecretJwt({
    clientId,
    teamId,
    keyId,
    privateKey,
  })

  return Apple({
    ...common,
    clientSecret,
  })
}
