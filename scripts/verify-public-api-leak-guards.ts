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

function verifyRouteCoverage() {
  const apiRoot = resolve(process.cwd(), 'app', 'api')
  const allRoutes = collectRouteFiles(apiRoot)
  const violations: string[] = []
  for (const full of allRoutes) {
    const rel = full.replace(process.cwd() + sep, '').replace(/\\/g, '/')
    if (rel.includes('/api/admin/')) continue
    if (rel.includes('/api/auth/')) continue
    const text = readFileSync(full, 'utf-8')
    const hasAdminGuard = text.includes('requireAdmin')
    const hasPublicGuard = text.includes('assertNoInternalMetaLeak')
    if (!hasAdminGuard && !hasPublicGuard) {
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
  mustContain('app/api/gallery/route.ts', 'assertNoInternalMetaLeak')
  mustContain('app/api/featured/route.ts', 'assertNoInternalMetaLeak')
  mustContain('app/api/products/[id]/route.ts', 'assertNoInternalMetaLeak')
  mustContain('app/api/bookings/route.ts', 'assertNoInternalMetaLeak')
  mustContain('app/products/[id]/page.tsx', 'assertNoInternalMetaLeak')
  mustContain('app/api/agent/reports/route.ts', 'requireAdmin')
  mustContain('app/api/analyze/route.ts', 'requireAdmin')
  mustContain('app/api/extract/route.ts', 'requireAdmin')
  mustContain('app/api/parse-product/route.ts', 'requireAdmin')
  mustContain('app/api/agent/scrape/route.ts', 'requireAdmin')

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
