/**
 * tsx로 실행하는 스크립트가 프로젝트 루트 env 파일을 읽도록 함.
 * 순서: `.env.local` → `.env` → `.env.production` (각 키는 이미 셸/앞선 파일에 있으면 덮어쓰지 않음).
 * 운영 서버에서 `DATABASE_URL` 등은 보통 `.env.production`에만 있을 수 있음.
 *
 * **주의:** 이미 `process.env` 에 값이 있으면(IDE/터미널/Windows 사용자 환경변수 등) **파일 값으로 덮어쓰지 않음**.
 * 네이버 535가 나오는데 `.env.local` 은 맞다고 느껴지면, 셸에 남은 `SMTP_USER` / `SMTP_PASS` 를 먼저 확인한다.
 */
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

function parseLine(line: string): { key: string; val: string } | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  const eq = trimmed.indexOf('=')
  if (eq <= 0) return null
  const key = trimmed.slice(0, eq).trim()
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null
  let val = trimmed.slice(eq + 1).trim()
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1)
  }
  return { key, val }
}

export function loadEnvForScripts(): void {
  for (const name of ['.env.local', '.env', '.env.production']) {
    const p = join(process.cwd(), name)
    if (!existsSync(p)) continue
    const content = readFileSync(p, 'utf8')
    for (const line of content.split(/\r?\n/)) {
      const parsed = parseLine(line)
      if (!parsed) continue
      if (process.env[parsed.key] === undefined) {
        process.env[parsed.key] = parsed.val
      }
    }
  }
}

loadEnvForScripts()
