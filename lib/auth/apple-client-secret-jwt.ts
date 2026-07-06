import { createSign } from 'node:crypto'

function base64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

/** Sign in with Apple client secret (JWT, ES256). 유효기간 최대 6개월. */
export function createAppleClientSecretJwt(args: {
  clientId: string
  teamId: string
  keyId: string
  privateKey: string
  /** seconds from now — default 180일 */
  expiresInSec?: number
}): string {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + (args.expiresInSec ?? 86400 * 180)
  const header = base64UrlJson({ alg: 'ES256', kid: args.keyId })
  const payload = base64UrlJson({
    iss: args.teamId,
    iat: now,
    exp,
    aud: 'https://appleid.apple.com',
    sub: args.clientId,
  })
  const unsigned = `${header}.${payload}`
  const sign = createSign('SHA256')
  sign.update(unsigned)
  sign.end()
  const signature = sign.sign({ key: args.privateKey, dsaEncoding: 'ieee-p1363' })
  return `${unsigned}.${signature.toString('base64url')}`
}
