/**
 * 테스트용 이메일·비밀번호 계정 생성/갱신 (일반 USER, active).
 *
 * 기본값:
 * - TEST_USER_EMAIL=welcome-test@test.bongtour
 * - TEST_USER_PASSWORD=welcome-test
 *
 * `.env.local` 의 DATABASE_URL 대상 DB에 upsert 합니다.
 */
import './load-env-for-scripts'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'

const EMAIL = (process.env.TEST_USER_EMAIL ?? 'welcome-test@test.bongtour').trim().toLowerCase()
const PASSWORD = process.env.TEST_USER_PASSWORD ?? 'welcome-test'
const NAME = (process.env.TEST_USER_NAME ?? 'welcome-test').trim()
const PRIVACY_VERSION = 'member-privacy-v1'

function logDatabaseTarget(): void {
  const raw = process.env.DATABASE_URL?.trim() ?? ''
  if (!raw) {
    console.log('[bootstrap-test-user] DATABASE_URL: (empty — lib/prisma may throw)')
    return
  }
  if (raw.startsWith('file:')) {
    console.log('[bootstrap-test-user] DATABASE_URL → SQLite file:', raw.replace(/^file:/, ''))
  } else {
    console.log('[bootstrap-test-user] DATABASE_URL: (non-file, hidden)')
  }
}

async function main() {
  logDatabaseTarget()
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      '[bootstrap-test-user] Set TEST_USER_EMAIL and TEST_USER_PASSWORD (or use defaults).',
    )
  }
  console.log('[bootstrap-test-user] target email:', EMAIL)

  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  const existing = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, email: true, role: true },
  })

  const common = {
    name: NAME,
    passwordHash,
    signupMethod: 'email',
    accountStatus: 'active',
    privacyNoticeConfirmedAt: new Date(),
    privacyNoticeVersion: PRIVACY_VERSION,
    marketingConsent: false,
    marketingConsentAt: null,
    marketingConsentVersion: null,
  }

  if (!existing) {
    const user = await prisma.user.create({
      data: {
        email: EMAIL,
        ...common,
      },
      select: { id: true, email: true, name: true, role: true, accountStatus: true, signupMethod: true },
    })
    console.log('[bootstrap-test-user] OK: created new user')
    console.log('[bootstrap-test-user] user:', JSON.stringify(user, null, 2))
  } else {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: common,
      select: { id: true, email: true, name: true, role: true, accountStatus: true, signupMethod: true },
    })
    console.log('[bootstrap-test-user] OK: updated existing user')
    console.log('[bootstrap-test-user] previous role:', existing.role ?? 'null')
    console.log('[bootstrap-test-user] user:', JSON.stringify(user, null, 2))
  }

  const check = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { passwordHash: true },
  })
  if (!check?.passwordHash) {
    throw new Error('[bootstrap-test-user] user missing passwordHash after upsert')
  }
  const verifyOk = await bcrypt.compare(PASSWORD, check.passwordHash)
  console.log('[bootstrap-test-user] bcrypt verify (same password):', verifyOk ? 'OK' : 'FAILED')
  if (!verifyOk) {
    throw new Error('[bootstrap-test-user] password hash verify failed after upsert')
  }

  console.log('[bootstrap-test-user] login → /auth/signin')
  console.log('[bootstrap-test-user]   email:', EMAIL)
  console.log('[bootstrap-test-user]   password: (TEST_USER_PASSWORD)')
}

main()
  .catch((e) => {
    console.error('[bootstrap-test-user] FAILED:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
