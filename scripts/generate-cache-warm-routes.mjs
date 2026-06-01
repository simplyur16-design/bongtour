/**
 * app/ 정적 page 라우트 스캔 → lib/cache-warm-routes.ts 생성.
 * 라우트 추가·삭제 후: node scripts/generate-cache-warm-routes.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const appDir = path.join(root, 'app')
const outFile = path.join(root, 'lib', 'cache-warm-routes.ts')

const PAGE_RE = /^page\.(tsx|ts|jsx|js)$/
const DYNAMIC_SEG_RE = /^\[.+\]$/
const ROUTE_GROUP_RE = /^\(.+\)$/

/** URL에 포함되지 않는 route group 세그먼트 제외 */
function filePathToRoute(relFromApp) {
  const dir = path.dirname(relFromApp).replace(/\\/g, '/')
  if (dir === '.') return '/'
  const segments = dir.split('/').filter((s) => s.length > 0 && !ROUTE_GROUP_RE.test(s))
  if (segments.length === 0) return '/'
  return `/${segments.join('/')}`
}

function shouldExcludeRoute(route) {
  const segments = route.split('/').filter(Boolean)
  if (segments.some((s) => DYNAMIC_SEG_RE.test(s))) return true
  if (segments.some((s) => s === 'admin' || s === 'api' || s.startsWith('_'))) return true
  const top = segments[0]
  if (top === 'auth' || top === 'mypage' || top === 'preview') return true
  if (segments.includes('checkout')) return true
  return false
}

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name)
    if (name.isDirectory()) {
      walk(full, acc)
      continue
    }
    if (!PAGE_RE.test(name.name)) continue
    const rel = path.relative(appDir, full)
    acc.push(rel)
  }
  return acc
}

const routes = [
  ...new Set(
    walk(appDir)
      .map((rel) => filePathToRoute(rel))
      .filter((r) => !shouldExcludeRoute(r))
  ),
].sort((a, b) => a.localeCompare(b))

if (routes.length > 50) {
  console.error(`[generate-cache-warm-routes] ${routes.length} routes (>50) — review before committing:`)
  for (const r of routes) console.error(' ', r)
  process.exit(1)
}

const body = `/**
 * 공개 정적 hub·카테고리 페이지 — cache warm cron 대상.
 * 재생성: \`node scripts/generate-cache-warm-routes.mjs\`
 * @see lib/instrumentation-cache-warm-cron.ts
 */
export const CACHE_WARM_ROUTES = [
${routes.map((r) => `  '${r}',`).join('\n')}
] as const

export type CacheWarmRoute = (typeof CACHE_WARM_ROUTES)[number]
`

fs.writeFileSync(outFile, body, 'utf8')
console.log(`[generate-cache-warm-routes] wrote ${routes.length} routes → ${path.relative(root, outFile)}`)
