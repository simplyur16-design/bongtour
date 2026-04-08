/**
 * 운영/로컬 SQLite에 관리자 계정을 생성하거나 동일 이메일을 ADMIN으로 승격합니다.
 * DATABASE_URL이 가리키는 DB에 적용됩니다.
 *
 * 이메일/비밀번호는 환경변수로 덮어쓸 수 있습니다 (`.env.local` — scripts/load-env-for-scripts.ts 로 로드).
 * - ADMIN_BOOTSTRAP_EMAIL
 * - ADMIN_BOOTSTRAP_NAME
 * - ADMIN_BOOTSTRAP_PASSWORD
 */
import './load-env-for-scripts'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'

const EMAIL = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'simplyur@naver.com').trim().toLowerCase()
const NAME = (process.env.ADMIN_BOOTSTRAP_NAME ?? '황일연').trim()
const PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? 'Simplyur!2026'
const PRIVACY_VERSION = 'member-privacy-v1'

function logDatabaseTarget(): void {
  const raw = process.env.DATABASE_URL?.trim() ?? ''
  if (!raw) {
    console.log('[bootstrap-admin] DATABASE_URL: (empty — lib/prisma may throw)')
    return
  }
  if (raw.startsWith('file:')) {
    console.log('[bootstrap-admin] DATABASE_URL → SQLite file:', raw.replace(/^file:/, ''))
  } else {
    console.log('[bootstrap-admin] DATABASE_URL: (non-file, hidden)')
  }
}

async function main() {
  logDatabaseTarget()
  console.log('[bootstrap-admin] target email:', EMAIL, '(set ADMIN_BOOTSTRAP_EMAIL to override)')
  if (!EMAIL || !PASSWORD) {
    throw new Error('[bootstrap-admin] email and password are required')
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  const existing = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, email: true, role: true },
  })

  const common = {
    name: NAME,
    passwordHash,
    role: 'ADMIN',
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
    console.log('[bootstrap-admin] OK: created new user')
    console.log('[bootstrap-admin] user:', JSON.stringify(user, null, 2))
  } else {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: common,
      select: { id: true, email: true, name: true, role: true, accountStatus: true, signupMethod: true },
    })
    console.log('[bootstrap-admin] OK: updated existing user')
    console.log('[bootstrap-admin] previous role:', existing.role ?? 'null')
    console.log('[bootstrap-admin] user:', JSON.stringify(user, null, 2))
  }

  const check = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { passwordHash: true },
  })
  if (!check?.passwordHash) {
    throw new Error('[bootstrap-admin] user missing passwordHash after upsert')
  }
  const verifyOk = await bcrypt.compare(PASSWORD, check.passwordHash)
  console.log('[bootstrap-admin] bcrypt verify (same password):', verifyOk ? 'OK' : 'FAILED')
  if (!verifyOk) {
    throw new Error('[bootstrap-admin] password hash verify failed after upsert')
  }
}

main()
  .catch((e) => {
    console.error('[bootstrap-admin] FAILED:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
