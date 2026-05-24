/**
 * 운영/로컬 DB에서 관리자 계정 상태 확인 (비밀번호 값은 출력하지 않음).
 *
 *   ADMIN_BOOTSTRAP_EMAIL=simplyur@naver.com npx tsx scripts/check-admin-user.ts
 *
 * Railway DB 확인: Railway 대시보드의 DATABASE_URL 을 셸에 넣은 뒤 위와 같이 실행.
 */
import './load-env-for-scripts'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { isAdminBootstrapEmail, isSuperAdminBootstrapEmail } from '../lib/bootstrap-user-role'
import { isAdminPanelRole } from '../lib/user-role'

const EMAIL = (process.env.ADMIN_BOOTSTRAP_EMAIL ?? 'simplyur@naver.com').trim().toLowerCase()
const TEST_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD ?? ''

async function main() {
  const dbUrl = process.env.DATABASE_URL?.trim() ?? ''
  if (dbUrl.startsWith('file:')) {
    console.log('[check-admin-user] DATABASE_URL → SQLite:', dbUrl.replace(/^file:/, ''))
  } else if (dbUrl) {
    console.log('[check-admin-user] DATABASE_URL → (remote, hidden)')
  } else {
    console.warn('[check-admin-user] DATABASE_URL is empty')
  }

  console.log('[check-admin-user] email:', EMAIL)
  console.log('[check-admin-user] bootstrap lists:', {
    adminBootstrap: isAdminBootstrapEmail(EMAIL),
    superAdminBootstrap: isSuperAdminBootstrapEmail(EMAIL),
  })

  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: {
      id: true,
      email: true,
      role: true,
      accountStatus: true,
      signupMethod: true,
      passwordHash: true,
      accounts: { select: { provider: true } },
    },
  })

  if (!user) {
    console.log('[check-admin-user] RESULT: user NOT FOUND in this database')
    console.log(
      '[check-admin-user] Fix: run `npm run admin:bootstrap` with the same DATABASE_URL as production',
    )
    return
  }

  const hasPassword = Boolean(user.passwordHash)
  let passwordOk: boolean | null = null
  if (TEST_PASSWORD && user.passwordHash) {
    passwordOk = await bcrypt.compare(TEST_PASSWORD, user.passwordHash)
  }

  console.log('[check-admin-user] user:', {
    id: user.id,
    email: user.email,
    role: user.role,
    accountStatus: user.accountStatus,
    signupMethod: user.signupMethod,
    adminPanelOk: isAdminPanelRole(user.role),
    hasPasswordHash: hasPassword,
    oauthProviders: user.accounts.map((a) => a.provider),
    passwordMatchesEnv: passwordOk,
  })

  if (!isAdminPanelRole(user.role)) {
    console.log('[check-admin-user] WARN: role is not ADMIN/SUPER_ADMIN — /admin will deny access')
  }
  if (!hasPassword) {
    console.log(
      '[check-admin-user] WARN: no passwordHash — email login will fail; use Kakao/Naver or run admin:bootstrap',
    )
  }
  if (user.accountStatus !== 'active') {
    console.log('[check-admin-user] WARN: accountStatus is', user.accountStatus)
  }
  if (passwordOk === false) {
    console.log('[check-admin-user] WARN: ADMIN_BOOTSTRAP_PASSWORD does not match DB hash')
  }
  if (passwordOk === true && isAdminPanelRole(user.role)) {
    console.log('[check-admin-user] OK: email login + /admin should work after deploy with role sync')
  }
}

main()
  .catch((e) => {
    console.error('[check-admin-user] FAILED:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
