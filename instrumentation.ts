/**
 * Next.js instrumentation: 서버 기동 시 한 번 실행.
 * 개발: BONGTOUR_DEV_ADMIN_BYPASS + DEV_ADMIN_BYPASS_SECRET(또는 구 ADMIN_BYPASS_SECRET).
 *
 * 주의: `@next/env` 는 instrumentation 번들(일부 타깃)에서 Node 내장 모듈 해석이 깨져
 * `Can't resolve 'crypto'|'fs'` 로 프로덕션 빌드가 실패할 수 있다. Node 런타임에서만
 * 동적 import 로 로드한다.
 */
import { isDevAdminBypassRuntimeAllowed } from '@/lib/admin-bypass'
import { getDevAdminBypassSecret } from '@/lib/admin-secrets'
import { assertProductionServerEnv } from '@/lib/server-env'

export async function register() {
  // PM2·systemd 등에서 cwd가 앱 루트일 때도, instrumentation이 일반 서버 부팅보다 빨리 돌면
  // `.env` / `.env.production` 이 아직 process.env에 없는 경우가 있다. Next와 동일 규칙으로 한 번 더 로드한다.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { loadEnvConfig } = await import('@next/env')
    loadEnvConfig(process.cwd())
    const { bootstrapHomeHubActiveFromDb } = await import('@/lib/home-hub-active-bootstrap')
    await bootstrapHomeHubActiveFromDb()
  }
  assertProductionServerEnv()
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_RUNTIME === 'nodejs') {
    console.warn(
      '[Bong투어] ChunkLoadError·layout.js timeout: `next dev -p 3000` 고정. 브라우저·NEXTAUTH_URL·NEXT_PUBLIC_*는 모두 http://localhost:3000 로 맞추세요.'
    )
    if (!isDevAdminBypassRuntimeAllowed()) {
      console.log(
        '\n[Bong투어] 관리자 임시 접속(URL)은 비활성입니다. `.env.local` 에 BONGTOUR_DEV_ADMIN_BYPASS=true 와 DEV_ADMIN_BYPASS_SECRET(또는 구 ADMIN_BYPASS_SECRET)을 설정하세요.\n'
      )
      return
    }
    const port = process.env.PORT || '3000'
    const base = (process.env.NEXTAUTH_URL || `http://localhost:${port}`).replace(/\/$/, '')
    const nurl = process.env.NEXTAUTH_URL
    if (nurl && nurl.includes('localhost')) {
      const m = nurl.match(/:(\d+)(?:\/|$)/)
      if (m && m[1] !== port) {
        console.warn(
          `[Bong투어] NEXTAUTH_URL 포트(${m[1]})와 PORT(${port}) 불일치. ChunkLoadError 시 브라우저 주소·NEXTAUTH_URL·PORT를 맞추세요.`
        )
      }
    }
    const secret = getDevAdminBypassSecret()
    if (!secret) {
      console.log(
        '\n[Bong투어] DEV_ADMIN_BYPASS_SECRET(또는 구 ADMIN_BYPASS_SECRET)이 비어 있습니다. 임시 접속 URL을 표시하지 않습니다.\n'
      )
      return
    }
    const url = `${base}/admin?auth=${secret}`
    console.log('\n[Bong투어] 관리자 임시 접속 URL:', url)
    console.log(
      `[Bong투어] dev 서버 PORT env=${port}. 로컬은 npm run dev가 -p 3000으로만 리슨합니다(3000 점유 시 Next가 다른 포트로 넘어가지 않고 기동 실패).`
    )
    console.log(
      '[Bong투어] 브라우저는 터미널 Local URL과 동일한 호스트·포트로 접속하세요. stylesheet·static chunk 오류는 `.next` 꼬임일 수 있어 `npm run dev:clean` 을 권장합니다.\n'
    )
  }
}
