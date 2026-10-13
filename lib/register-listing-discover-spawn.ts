/**
 * 목록 수집 Python CLI stdin/stdout 만 — 딜레이·UA·타임아웃 SSOT 아님.
 * REGRESSION-FREEZE[register-listing-discover-playwright]: spawn -m listing_discover_* — manifest
 * REGRESSION-FREEZE[register-listing-discover-spawn-drain-stderr]: stderr 항상 drain · 상한 — manifest
 */
import { spawn } from 'child_process'
import { resolvePythonExecutable, resolvePythonRepoRoot } from '@/lib/resolve-python-executable'

export type ListingDiscoverSlotIn = {
  id: string
  searchWord: string
  seedOriginUrl: string
  listingMenu?: 'PKG' | 'FIT'
}

export type ListingDiscoverSlotOut = {
  id: string
  urls: string[]
}

export async function spawnListingDiscoverPython(args: {
  module: string
  slots: ListingDiscoverSlotIn[]
  timeoutMs: number
}): Promise<ListingDiscoverSlotOut[]> {
  if (args.slots.length === 0) return []
  const cwd = resolvePythonRepoRoot()
  const py = resolvePythonExecutable()
  const payload = JSON.stringify({ slots: args.slots })

  console.error('[listing-discover-spawn] start', args.module, 'slots', args.slots.length)
  const { stdout } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(py, ['-m', args.module], {
      cwd,
      env: {
        ...process.env,
        PYTHONPATH: cwd,
        PYTHONUTF8: '1',
        PYTHONIOENCODING: 'utf-8',
      },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL')
      } catch {
        /* ignore */
      }
      if (!settled) {
        settled = true
        reject(new Error(`listing-discover timeout ${args.module}`))
      }
    }, args.timeoutMs)
    child.stdout?.on('data', (d: Buffer | string) => {
      const chunk = typeof d === 'string' ? d : d.toString('utf8')
      if (stdout.length < 2_000_000) stdout += chunk
    })
    child.stderr?.on('data', (d: Buffer | string) => {
      const chunk = typeof d === 'string' ? d : d.toString('utf8')
      // 파이프 데드락 방지: 항상 drain. 로그·버퍼만 상한.
      if (stderr.length < 8000) {
        stderr += chunk
        const line = chunk.trim()
        if (line) console.error(line.slice(0, 400))
      }
    })
    child.on('error', (err) => {
      clearTimeout(timer)
      if (!settled) {
        settled = true
        reject(err)
      }
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      console.error('[listing-discover-spawn] close', args.module, 'code', code, 'stdout', stdout.length)
      if (settled) return
      settled = true
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(new Error(`listing-discover exit ${code} ${args.module} ${stderr.slice(0, 300)}`))
    })
    child.stdin?.write(Buffer.from(payload, 'utf8'))
    child.stdin?.end()
  })

  const parsed = JSON.parse(String(stdout || '').trim() || '{}') as {
    ok?: unknown
    results?: unknown
  }
  if (parsed.ok !== true || !Array.isArray(parsed.results)) return []
  const out: ListingDiscoverSlotOut[] = []
  for (const row of parsed.results) {
    if (!row || typeof row !== 'object') continue
    const rec = row as { id?: unknown; urls?: unknown }
    const id = typeof rec.id === 'string' ? rec.id : ''
    if (!id) continue
    const urls = Array.isArray(rec.urls)
      ? rec.urls.filter((u): u is string => typeof u === 'string' && u.trim().length > 0)
      : []
    out.push({ id, urls })
  }
  return out
}
