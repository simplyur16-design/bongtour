import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `npx tsx` 로 돌리는 스크립트는 Next가 아니라서 `.env.local` 을 자동으로 안 읽는다.
 * 이미 설정된 `process.env` 는 덮어쓰지 않는다(쉘에서 export 한 값 우선).
 */
export function applyEnvLocalIfPresent(cwd: string = process.cwd()): void {
  const path = join(cwd, '.env.local')
  if (!existsSync(path)) return
  const raw = readFileSync(path, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    let s = t.startsWith('export ') ? t.slice(7).trim() : t
    const eq = s.indexOf('=')
    if (eq <= 0) continue
    const key = s.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let val = s.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = val
  }
}
