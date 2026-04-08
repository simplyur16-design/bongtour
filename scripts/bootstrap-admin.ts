/**
 * 운영/로컬 SQLite에 관리자 계정을 생성하거나 동일 이메일을 ADMIN으로 승격합니다.
 * DATABASE_URL이 가리키는 DB에 적용됩니다.
 */
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'

const EMAIL = 'simplyur@naver.com'.toLowerCase()
const NAME = '황일연'
const PASSWORD = 'Simplyur!2026'
const PRIVACY_VERSION = 'member-privacy-v1'

async function main() {
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
    return
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: common,
    select: { id: true, email: true, name: true, role: true, accountStatus: true, signupMethod: true },
  })
  console.log('[bootstrap-admin] OK: updated existing user (previous role: %s)', existing.role ?? 'null')
  console.log('[bootstrap-admin] user:', JSON.stringify(user, null, 2))
}

main()
  .catch((e) => {
    console.error('[bootstrap-admin] FAILED:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
