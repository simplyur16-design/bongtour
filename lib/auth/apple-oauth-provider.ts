import Apple from 'next-auth/providers/apple'
import type { Provider } from 'next-auth/providers'
import { createAppleClientSecretJwt } from '@/lib/auth/apple-client-secret-jwt'
import {
  isApplePrivateKeyPemPlausible,
  normalizeApplePrivateKeyPem,
} from '@/lib/auth/apple-private-key-pem'

function readAppleOAuthEnv() {
  const clientId = process.env.AUTH_APPLE_ID?.trim() || process.env.APPLE_ID?.trim() || ''
  const staticSecret = process.env.AUTH_APPLE_SECRET?.trim() || ''
  const teamId = process.env.AUTH_APPLE_TEAM_ID?.trim() || process.env.APPLE_TEAM_ID?.trim() || ''
  const keyId = process.env.AUTH_APPLE_KEY_ID?.trim() || process.env.APPLE_KEY_ID?.trim() || ''
  const privateKeyRaw =
    process.env.AUTH_APPLE_PRIVATE_KEY?.trim() || process.env.APPLE_PRIVATE_KEY?.trim() || ''
  return { clientId, staticSecret, teamId, keyId, privateKeyRaw }
}

/** @deprecated — use `@/lib/auth/apple-private-key-pem` */
export { normalizeApplePrivateKeyPem } from '@/lib/auth/apple-private-key-pem'

function canBuildAppleClientSecretFromP8(args: {
  clientId: string
  teamId: string
  keyId: string
  privateKey: string
}): boolean {
  if (!isApplePrivateKeyPemPlausible(args.privateKey)) return false
  try {
    createAppleClientSecretJwt({ ...args, expiresInSec: 60 })
    return true
  } catch {
    return false
  }
}

/** Sign in with Apple — Services ID + (.p8 키 또는 사전 생성 JWT secret) */
export function isAppleOAuthConfigured(): boolean {
  const { clientId, staticSecret, teamId, keyId, privateKeyRaw } = readAppleOAuthEnv()
  if (!clientId) return false
  if (staticSecret) return true
  if (!teamId || !keyId || !privateKeyRaw) return false
  const privateKey = normalizeApplePrivateKeyPem(privateKeyRaw)
  return canBuildAppleClientSecretFromP8({ clientId, teamId, keyId, privateKey })
}

// REGRESSION-FREEZE[apple-oauth-invalid-p8-no-crash]: 불완전 .p8 시 provider null — manifest
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
  if (!teamId || !keyId || !privateKeyRaw) return null

  if (!canBuildAppleClientSecretFromP8({ clientId, teamId, keyId, privateKey })) {
    console.error(
      '[auth:apple] AUTH_APPLE_PRIVATE_KEY is missing, truncated, or invalid — paste the full .p8 PEM (BEGIN…END). Apple Sign In disabled until fixed.'
    )
    return null
  }

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
