/**
 * 로컬 검증: 네이버 연결 끊기 — 암호화/서명 규격 + Prisma 연동.
 * 사용: 프로젝트 루트에서 `npm run verify:naver-unlink`
 * — 시작 시 `.env.local` 을 읽음(네이버 키·DATABASE_URL 등). Next `npm run dev` 와 동일 소스.
 */
import assert from 'node:assert/strict'
import crypto from 'crypto'
import {
  decryptNaverEncryptUniqueId,
  md5First16BytesFromClientSecret,
  verifyNaverUnlinkSignature,
} from '../lib/naver-unlink-crypto'
import { applyEnvLocalIfPresent } from './load-env-local'

function mirrorEncryptNaverUniqueId(uniqueId: string, clientSecret: string): string {
  const key = md5First16BytesFromClientSecret(clientSecret)
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-128-cbc', key, iv)
  const enc = Buffer.concat([cipher.update(uniqueId, 'utf8'), cipher.final()])
  return Buffer.concat([iv, enc]).toString('base64url')
}

function mirrorSignNaverUnlink(
  clientId: string,
  encryptUniqueId: string,
  timestamp: string,
  clientSecret: string
): string {
  const key = md5First16BytesFromClientSecret(clientSecret)
  const baseString = `clientId=${clientId}&encryptUniqueId=${encryptUniqueId}&timestamp=${timestamp}`
  return crypto.createHmac('sha256', key).update(baseString, 'utf8').digest('base64url')
}

function part1Crypto(): void {
  const clientSecret = 'local_test_client_secret_value'
  const clientId = 'local_test_client_id_xx'
  const uniqueId = 'naver_unique_verify_001'
  const ts = '1730000000'

  const enc = mirrorEncryptNaverUniqueId(uniqueId, clientSecret)
  assert.equal(decryptNaverEncryptUniqueId(enc, clientSecret), uniqueId, 'AES 복호화 불일치')

  const sig = mirrorSignNaverUnlink(clientId, enc, ts, clientSecret)
  assert.ok(
    verifyNaverUnlinkSignature({ clientId, encryptUniqueId: enc, timestamp: ts, signature: sig, clientSecret }),
    'HMAC 검증 실패'
  )

  assert.ok(
    !verifyNaverUnlinkSignature({
      clientId,
      encryptUniqueId: enc,
      timestamp: ts,
      signature: sig + 'x',
      clientSecret,
    }),
    '잘못된 서명이 통과하면 안 됨'
  )

  console.log('[verify-naver-unlink] part1 crypto: ok')
}

async function part2Prisma(): Promise<void> {
  process.env.NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID || 'local_verify_cid'
  process.env.NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET || 'local_verify_secret_key_16b'
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'file:./dev.db'

  const { handleNaverUnlinkNotificationFromBody } = await import('../lib/naver-unlink-callback')
  const { prisma } = await import('../lib/prisma')

  const clientId = process.env.NAVER_CLIENT_ID!
  const clientSecret = process.env.NAVER_CLIENT_SECRET!
  const naverPid = `unlink_test_${Date.now()}`
  const email = `unlink-test-${Date.now()}@example.invalid`

  const user = await prisma.user.create({
    data: {
      email,
      name: 'unlink-tester',
      signupMethod: 'naver',
      socialProvider: 'naver',
      socialProviderUserId: naverPid,
      accounts: {
        create: {
          type: 'oauth',
          provider: 'naver',
          providerAccountId: naverPid,
        },
      },
    },
    include: { accounts: true },
  })

  const enc = mirrorEncryptNaverUniqueId(naverPid, clientSecret)
  const ts = String(Math.floor(Date.now() / 1000))
  const sig = mirrorSignNaverUnlink(clientId, enc, ts, clientSecret)
  const body = new URLSearchParams({ clientId, encryptUniqueId: enc, timestamp: ts, signature: sig })

  const status = await handleNaverUnlinkNotificationFromBody(body)
  assert.equal(status, 204, `handleNaverUnlinkNotificationFromBody expected 204, got ${status}`)

  const acc = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider: 'naver', providerAccountId: naverPid } },
  })
  assert.equal(acc, null, 'naver Account 가 삭제되어야 함')

  await prisma.user.delete({ where: { id: user.id } })

  console.log('[verify-naver-unlink] part2 prisma: ok')
}

async function main(): Promise<void> {
  applyEnvLocalIfPresent()
  part1Crypto()
  try {
    await part2Prisma()
  } catch (e) {
    console.error(
      '[verify-naver-unlink] part2 skipped or failed (SQLite·DATABASE_URL 확인):',
      e instanceof Error ? e.message : e
    )
    process.exitCode = 1
  }
}

void main()
