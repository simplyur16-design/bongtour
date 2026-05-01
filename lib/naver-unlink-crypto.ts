import crypto from 'crypto'

const BLOCK = 16

export function md5First16BytesFromClientSecret(clientSecret: string): Buffer {
  return crypto.createHash('md5').update(clientSecret, 'utf8').digest().subarray(0, BLOCK)
}

/** Apache Commons style URL-safe Base64 → Buffer */
export function base64UrlDecode(s: string): Buffer {
  const normalized = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = '='.repeat((4 - (normalized.length % 4)) % 4)
  return Buffer.from(normalized + pad, 'base64')
}

/**
 * 네이버 로그인 연결 끊기 알림 — Appendix 4.4.2
 * encryptUniqueId = base64url( iv(16) || aes128cbc(ciphertext) )
 */
export function decryptNaverEncryptUniqueId(encryptUniqueId: string, clientSecret: string): string | null {
  try {
    const key = md5First16BytesFromClientSecret(clientSecret)
    const raw = base64UrlDecode(encryptUniqueId.trim())
    if (raw.length < BLOCK + BLOCK) return null
    const iv = raw.subarray(0, BLOCK)
    const ciphertext = raw.subarray(BLOCK)
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv)
    decipher.setAutoPadding(true)
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()])
    return plain.toString('utf8')
  } catch {
    return null
  }
}

/** 네이버 로그인 연결 끊기 알림 — Appendix 4.4.3 */
export function verifyNaverUnlinkSignature(params: {
  clientId: string
  encryptUniqueId: string
  timestamp: string
  signature: string
  clientSecret: string
}): boolean {
  try {
    const key = md5First16BytesFromClientSecret(params.clientSecret)
    const baseString = `clientId=${params.clientId}&encryptUniqueId=${params.encryptUniqueId}&timestamp=${params.timestamp}`
    const mac = crypto.createHmac('sha256', key).update(baseString, 'utf8').digest()
    const sig = base64UrlDecode(params.signature.trim())
    if (sig.length !== mac.length) return false
    return crypto.timingSafeEqual(sig, mac)
  } catch {
    return false
  }
}
