/**
 * highlight-points-noise-cleanup / -rollback 공용: 인자·env·pg 연결·lib 로드.
 * 의존: `pg` 하나(createRequire 로 --pg-dir 또는 cwd 에서 찾음). Prisma·tsx 불필요 —
 * node 24 (type stripping 기본) 로 `node scripts/highlight-points-noise-cleanup.mts` 실행 가능, `npx tsx` 도 가능.
 * DATABASE_URL·접속 정보는 절대 출력하지 않는다.
 */
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function argValue(name: string): string | undefined {
  const pre = `--${name}=`
  const i = process.argv.findIndex((a) => a === `--${name}` || a.startsWith(pre))
  if (i < 0) return undefined
  const a = process.argv[i]
  if (a.startsWith(pre)) return a.slice(pre.length)
  const n = process.argv[i + 1]
  return n && !n.startsWith('--') ? n : ''
}
export function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}
export function intArg(name: string, dflt: number, min: number, max: number): number {
  const v = Number(argValue(name))
  return Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : dflt
}
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function redact(msg: unknown): string {
  return String((msg as { message?: string })?.message ?? msg)
    .replace(/postgres(ql)?:\/\/\S+/gi, '[redacted-url]')
    .slice(0, 300)
}

function parseEnvFile(p: string): Record<string, string> {
  const o: Record<string, string> = {}
  if (!existsSync(p)) return o
  for (const l of readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    o[m[1]] = v
  }
  return o
}

/** DATABASE_URL: 프로세스 env 우선, 없으면 --env-dir(기본 cwd)의 .env → .env.local(뒤가 우선). 값은 반환만, 출력 금지. */
export function resolveDatabaseUrl(): { url: string; source: string } {
  if ((process.env.DATABASE_URL ?? '').trim()) return { url: process.env.DATABASE_URL!.trim(), source: 'process.env' }
  const dir = resolve(argValue('env-dir') || process.cwd())
  const merged = { ...parseEnvFile(join(dir, '.env')), ...parseEnvFile(join(dir, '.env.local')) }
  const url = (merged.DATABASE_URL ?? '').trim()
  if (!url) throw new Error('DATABASE_URL not found (process env or --env-dir .env/.env.local)')
  return { url, source: existsSync(join(dir, '.env.local')) && parseEnvFile(join(dir, '.env.local')).DATABASE_URL ? '.env.local' : '.env' }
}

type PgClient = {
  connect(): Promise<void>
  query(sql: string, params?: unknown[]): Promise<{ rows: any[]; rowCount: number | null }>
  end(): Promise<void>
}

export async function connectPg(): Promise<PgClient> {
  const pgDir = resolve(argValue('pg-dir') || process.env.PG_MODULE_DIR || process.cwd())
  let pg: any
  for (const base of [pgDir, REPO_ROOT]) {
    try {
      pg = createRequire(join(base, 'package.json'))('pg')
      break
    } catch {
      /* next */
    }
  }
  if (!pg) throw new Error(`pg module not found (looked in --pg-dir/PG_MODULE_DIR, cwd, repo). No install is done by this script.`)
  const { url, source } = resolveDatabaseUrl()
  const u = new URL(url)
  const sslmode = u.searchParams.get('sslmode')
  u.searchParams.delete('sslmode')
  const internal = /\.railway\.internal$|^localhost$|^127\./.test(u.hostname)
  const noSsl = sslmode === 'disable' || process.env.PGSSL === 'disable' || (internal && process.env.PGSSL !== 'require')
  const client: PgClient = new pg.Client({
    connectionString: u.toString(),
    ssl: noSsl ? false : { rejectUnauthorized: false },
    application_name: 'highlight-points-noise-cleanup',
  })
  await client.connect()
  console.error(`[highlight-noise] db connected (source=${source}, ssl=${noSsl ? 'off' : 'on'})`)
  return client
}

export async function loadLibs() {
  const noise = await import(pathToFileURL(join(REPO_ROOT, 'lib/highlight-points-supplier-noise.ts')).href)
  const core = await import(pathToFileURL(join(REPO_ROOT, 'lib/highlight-points-noise-cleanup.ts')).href)
  return { noise, core } as {
    noise: typeof import('../lib/highlight-points-supplier-noise.ts')
    core: typeof import('../lib/highlight-points-noise-cleanup.ts')
  }
}

/** 읽기 전용 트랜잭션 안에서 fn 실행 후 ROLLBACK. */
export async function withReadOnly<T>(c: PgClient, fn: () => Promise<T>): Promise<T> {
  await c.query('BEGIN READ ONLY')
  try {
    const ro = await c.query('SHOW transaction_read_only')
    if (ro.rows[0]?.transaction_read_only !== 'on') throw new Error('read_only_tx_not_on')
    return await fn()
  } finally {
    await c.query('ROLLBACK')
  }
}

export function timestampTag(d = new Date()): string {
  const k = new Date(d.getTime() + 9 * 3600_000).toISOString().replace(/[-:]/g, '').replace(/\..+$/, '')
  return `${k}KST`
}
