/**
 * highlight-points-noise-cleanup --apply 되돌리기: 백업 JSON 의 highlightPoints 로 복원.
 * ROLLBACK_CONFIRM=YES + --backup-file <path> + --sha256 <hex> 필수.
 * 기본: 현재값 == apply 가 쓴 값(plannedAfter) 인 행만 복원(그 뒤 운영 수정은 보존, changed_after_apply 로 건너뜀).
 * ROLLBACK_FORCE=YES: 현재값과 무관하게 백업값으로 덮어씀.
 * --dry-run: 읽기 전용으로 건수만. 옵션 --batch --delay-ms --pg-dir --env-dir --out
 * highlightPoints 외 컬럼·updatedAt 무변경. 출력은 건수만.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { argValue, connectPg, hasFlag, intArg, loadLibs, redact, sleep, withReadOnly } from './highlight-points-noise-shared.mts'

async function main() {
  const { core } = await loadLibs()
  const dryRun = hasFlag('dry-run')
  if (!dryRun && process.env.ROLLBACK_CONFIRM !== 'YES') throw new Error('ROLLBACK_CONFIRM=YES required (or --dry-run)')
  const force = process.env.ROLLBACK_FORCE === 'YES'
  const bf = argValue('backup-file')
  const sha = argValue('sha256') ?? ''
  if (!bf || !existsSync(bf)) throw new Error('--backup-file <path> required (file must exist)')
  const backup = core.parseVerifiedBackup(readFileSync(bf), sha)
  const batch = intArg('batch', 20, 1, 200)
  const delayMs = intArg('delay-ms', 500, 0, 60_000)
  const outDir = resolve(argValue('out') || dirname(resolve(bf)))

  const c = await connectPg()
  try {
    const ids = backup.rows.map((r) => r.id)
    const current = await withReadOnly(c, async () => {
      const m = new Map<string, string | null>()
      for (let i = 0; i < ids.length; i += 500) {
        const r = await c.query(`SELECT id, "highlightPoints" FROM "Product" WHERE id = ANY($1::text[])`, [ids.slice(i, i + 500)])
        for (const row of r.rows) m.set(row.id, row.highlightPoints ?? null)
      }
      return m
    })
    const decisions = core.decideRollback(backup, current, force)
    const counts: Record<string, number> = { ...core.countBy(decisions), restored: 0, lost_race: 0, failed: 0 }
    const restores = decisions.filter((d) => d.action === 'restore') as Array<{ action: 'restore'; id: string; expectCurrent: string | null; restoreTo: string }>
    if (dryRun) {
      console.log(JSON.stringify({ mode: 'rollback-dry-run', force, counts }))
      return
    }
    for (let i = 0; i < restores.length; i += batch) {
      const chunk = restores.slice(i, i + batch)
      try {
        await c.query('BEGIN')
        await c.query(`SET LOCAL statement_timeout = '15s'`)
        for (const d of chunk) {
          const r = await c.query(
            `UPDATE "Product" SET "highlightPoints" = $2 WHERE id = $1 AND "highlightPoints" IS NOT DISTINCT FROM $3`,
            [d.id, d.restoreTo, d.expectCurrent],
          )
          if ((r.rowCount ?? 0) === 1) counts.restored += 1
          else counts.lost_race += 1
        }
        await c.query('COMMIT')
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {})
        counts.failed += chunk.length
        console.error('[highlight-noise-rollback] batch failed (rolled back)', i / batch, redact(e))
      }
      if (i + batch < restores.length) await sleep(delayMs)
    }
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'rollback-result.json'), JSON.stringify({ createdAt: new Date().toISOString(), force, counts }, null, 1))
    console.log(JSON.stringify({ mode: 'rollback', force, counts }))
  } finally {
    await c.end().catch(() => {})
  }
}

main().catch((e) => {
  console.error('[highlight-noise-rollback] ERROR', redact(e))
  process.exit(1)
})
