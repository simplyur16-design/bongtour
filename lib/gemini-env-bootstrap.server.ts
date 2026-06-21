import 'server-only'
import fs from 'fs'
import path from 'path'

/**
 * Next.js 외부(node/tsx 등)에서 `.env`만 넘기고 `.env.local`을 안 읽으면 키가 비어 403이 난다.
 * 키가 비어 있을 때만 프로젝트 루트 `.env` → `.env.local` 순으로 파싱해 process.env에 채운다(.env.local이 우선).
 * REGRESSION-FREEZE[gemini-client-client-bundle]: fs는 server-only — manifest
 */
export function bootstrapGeminiEnvFilesWhenKeyMissing(): void {
  if (typeof process === 'undefined' || !process.cwd) return
  const hasKey = () =>
    Boolean((process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? '').trim())
  if (hasKey()) return
  try {
    const root = process.cwd()
    for (const name of ['.env', '.env.local'] as const) {
      const p = path.join(root, name)
      if (!fs.existsSync(p)) continue
      const raw = fs.readFileSync(p, 'utf8')
      for (const line of raw.split('\n')) {
        const t = line.trim()
        if (!t || t.startsWith('#')) continue
        const eq = t.indexOf('=')
        if (eq <= 0) continue
        const k = t.slice(0, eq).trim()
        if (!/^[\w.-]+$/.test(k)) continue
        let v = t.slice(eq + 1).trim()
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1)
        }
        if (name === '.env.local') process.env[k] = v
        else if (process.env[k] === undefined) process.env[k] = v
      }
    }
  } catch {
    /* ignore: Edge 등에서 fs 불가 */
  }
}
