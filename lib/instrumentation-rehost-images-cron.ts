/**
 * 매일 KST 03:30 — DB 잔여 외부 CDN URL 일괄 NCloud 재호스팅 (Memory #5 safety-net).
 * 스크립트 SSOT: `scripts/rehost-all-external-cdn-to-ncloud.ts`
 *
 * production + DATABASE_URL (`instrumentation.ts` 가드).
 * 비활성화: `DISABLE_INSTRUMENTATION_REHOST_IMAGES_CRON=1`
 * Dry-run: `REHOST_IMAGES_CRON_DRY_RUN=1` (`--apply` 생략)
 */
import { spawn } from 'node:child_process'
import path from 'node:path'

const CRON_EXPR = '30 3 * * *'
const BATCH_SUMMARY_RE =
  /\[rehost-all\]\s+scanned=(\d+)\s+changed=(\d+)\s+failed=(\d+)\s+elapsed=(\d+)s/

function isRehostImagesCronDryRun(): boolean {
  return process.env.REHOST_IMAGES_CRON_DRY_RUN === '1'
}

function parseBatchSummary(stdout: string): {
  scanned: number
  changed: number
  failed: number
  elapsedSec: number
} | null {
  const lines = stdout.split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i]?.match(BATCH_SUMMARY_RE)
    if (m) {
      return {
        scanned: Number(m[1]),
        changed: Number(m[2]),
        failed: Number(m[3]),
        elapsedSec: Number(m[4]),
      }
    }
  }
  return null
}

function runRehostAllExternalCdnScript(apply: boolean): Promise<{
  exitCode: number | null
  stdout: string
  stderr: string
}> {
  const scriptPath = path.join(process.cwd(), 'scripts', 'rehost-all-external-cdn-to-ncloud.ts')
  const args = ['tsx', scriptPath]
  if (apply) args.push('--apply')

  return new Promise((resolve, reject) => {
    const child = spawn('npx', args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (chunk: Buffer | string) => {
      const s = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      stdout += s
      process.stdout.write(s)
    })
    child.stderr?.on('data', (chunk: Buffer | string) => {
      const s = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      stderr += s
      process.stderr.write(s)
    })
    child.on('error', reject)
    child.on('close', (exitCode) => {
      resolve({ exitCode, stdout, stderr })
    })
  })
}

async function tickRehostImagesCron(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    return
  }
  if (!(process.env.DATABASE_URL ?? '').trim()) {
    console.warn('[rehost-images-cron] skip: DATABASE_URL')
    return
  }

  const dryRun = isRehostImagesCronDryRun()
  const apply = !dryRun
  const started = Date.now()

  console.log('[rehost-images-cron] tick start', { dryRun, apply })

  try {
    const { exitCode, stdout, stderr } = await runRehostAllExternalCdnScript(apply)
    const parsed = parseBatchSummary(stdout)

    if (exitCode !== 0) {
      console.error('[rehost-images-cron] tick failed', {
        exitCode,
        parsed,
        durationMs: Date.now() - started,
        stderrTail: stderr.slice(-500),
      })
      return
    }

    console.log('[rehost-images-cron] tick done', {
      ...parsed,
      dryRun,
      durationMs: Date.now() - started,
    })
  } catch (e) {
    console.error('[rehost-images-cron] tick error', e)
  }
}

export function startInstrumentationRehostImagesCron(): void {
  if (process.env.DISABLE_INSTRUMENTATION_REHOST_IMAGES_CRON === '1') {
    return
  }

  void import('node-cron')
    .then((m) => {
      const cron = m.default
      cron.schedule(
        CRON_EXPR,
        () => {
          void tickRehostImagesCron()
        },
        { timezone: 'Asia/Seoul' },
      )
      console.log(`[rehost-images-cron] registered: ${CRON_EXPR} (Asia/Seoul)`)
    })
    .catch((e) => {
      console.error('[rehost-images-cron] failed to load node-cron', e)
    })
}
