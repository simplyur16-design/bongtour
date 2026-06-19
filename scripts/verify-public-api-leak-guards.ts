import { readFileSync, readdirSync, statSync } from 'fs'
import { resolve, sep } from 'path'
import { assertNoInternalMetaLeak } from '@/lib/public-response-guard'

function mustContain(file: string, token: string) {
  const full = resolve(process.cwd(), file)
  const text = readFileSync(full, 'utf-8')
  if (!text.includes(token)) {
    throw new Error(`[verify-public-api-leak-guards] missing token "${token}" in ${file}`)
  }
}

function mustContainAny(file: string, tokens: string[]) {
  const full = resolve(process.cwd(), file)
  const text = readFileSync(full, 'utf-8')
  if (!tokens.some((t) => text.includes(t))) {
    throw new Error(
      `[verify-public-api-leak-guards] missing any of tokens [${tokens.join(', ')}] in ${file}`,
    )
  }
}

function collectRouteFiles(dir: string): string[] {
  const out: string[] = []
  const entries = readdirSync(dir)
  for (const name of entries) {
    const full = resolve(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...collectRouteFiles(full))
    else if (name === 'route.ts') out.push(full)
  }
  return out
}

function isExcludedFromLeakGuardScan(rel: string): boolean {
  if (rel.includes('/api/admin/')) return true
  if (rel.includes('/api/auth/')) return true
  /** 로그인 세션(`auth()`)으로 보호 — assertNoInternalMetaLeak 대상 아님 */
  if (rel.includes('/api/mypage/')) return true
  /** 공개 읽기 전용 마스터 데이터 */
  if (rel.includes('/api/public/')) return true
  /** PG·공급사 webhook — 서명/secret 검증 경로 */
  if (/\/webhooks?\//i.test(rel)) return true
  if (rel.includes('welcomepay-vbank-noti')) return true
  return false
}

function verifyRouteCoverage() {
  const apiRoot = resolve(process.cwd(), 'app', 'api')
  const allRoutes = collectRouteFiles(apiRoot)
  const violations: string[] = []
  for (const full of allRoutes) {
    const rel = full.replace(process.cwd() + sep, '').replace(/\\/g, '/')
    if (isExcludedFromLeakGuardScan(rel)) continue
    const text = readFileSync(full, 'utf-8')
    const hasAdminGuard = text.includes('requireAdmin')
    const hasSessionGuard = text.includes("from '@/auth'") || text.includes('from "@/auth"')
    const hasPublicGuard =
      text.includes('assertNoInternalMetaLeak') || text.includes('jsonWithLeakGuard')
    if (!hasAdminGuard && !hasPublicGuard && !hasSessionGuard) {
      violations.push(rel)
    }
  }
  if (violations.length > 0) {
    throw new Error(
      `[verify-public-api-leak-guards] unguarded non-admin routes:\n${violations.map((v) => `- ${v}`).join('\n')}`
    )
  }
}

function run() {
  mustContainAny('app/api/gallery/route.ts', ['assertNoInternalMetaLeak', 'jsonWithLeakGuard'])
  mustContainAny('app/api/featured/route.ts', ['assertNoInternalMetaLeak', 'jsonWithLeakGuard'])
  mustContainAny('app/api/products/[id]/route.ts', ['assertNoInternalMetaLeak', 'jsonWithLeakGuard'])
  mustContainAny('app/api/bookings/route.ts', ['assertNoInternalMetaLeak', 'jsonWithLeakGuard'])
  mustContain('lib/product-public-detail/build-render-model.ts', 'assertNoInternalMetaLeak')
  mustContain('app/api/agent/reports/route.ts', 'requireAdmin')
  mustContain('app/api/analyze/route.ts', 'requireAdmin')
  mustContain('app/api/extract/route.ts', 'requireAdmin')
  mustContain('app/api/parse-product/route.ts', 'requireAdmin')

  assertNoInternalMetaLeak(
    {
      ok: true,
      items: [{ title: 'safe', coverImageUrl: '/a.webp' }],
    },
    'script-safe-check'
  )

  let blocked = false
  try {
    assertNoInternalMetaLeak(
      {
        ok: true,
        items: [{ title: 'unsafe', imageManualSelected: true, mappingStatus: 'x' }],
      },
      'script-unsafe-check'
    )
  } catch {
    blocked = true
  }
  if (!blocked) {
    throw new Error('[verify-public-api-leak-guards] forbidden key was not blocked')
  }
  verifyRouteCoverage()
  console.log('OK: public response leak guards are wired and working')
}

run()
