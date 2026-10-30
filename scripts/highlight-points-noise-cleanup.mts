/**
 * 등록(registered) 상품 `Product.highlightPoints` 의 공급사 URL·브랜드 프로그램·자사 홍보 줄 일괄 정리.
 * 필터 = lib/highlight-points-supplier-noise.ts (상세 표시 필터·등록 힐과 동일). 줄 통째 제거 + URL 조각 제거만.
 * highlightPointsRaw · title · 일정/ItineraryDay · 가격 · updatedAt 은 건드리지 않음.
 *
 * 모드
 *   --plan   (기본, 읽기 전용 BEGIN READ ONLY) → <out>/plan.json, plan.csv
 *   --backup (읽기 전용) → <out>/highlightPoints-backup-<ts>.json (+ .sha256), plan 도 함께
 *   --apply  APPLY_CONFIRM=YES + --backup-file <path> + --sha256 <hex> 필수. plan 을 DB에서 다시 만들고
 *            백업과 before 가 같은 행만, `WHERE id AND registrationStatus='registered' AND highlightPoints=<before>` 로 씀.
 * 옵션: --out <dir>  --only-slug a,b  --max-rows N  --skip-context-only  --batch N(기본 20)  --delay-ms N(기본 500)
 *       --pg-dir <pg 가 있는 폴더>  --env-dir <.env 폴더>
 * 출력: 건수·요약만(접속 정보·가격·고객 데이터 없음). 제거 줄은 plan 파일에만.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { argValue, connectPg, hasFlag, intArg, loadLibs, redact, sleep, timestampTag, withReadOnly } from './highlight-points-noise-shared.mts'

const mode = hasFlag('apply') ? 'apply' : hasFlag('backup') ? 'backup' : 'plan'

async function main() {
  const { noise, core } = await loadLibs()
  const outDir = resolve(argValue('out') || join(process.cwd(), 'tmp', `highlight-noise-cleanup-${timestampTag()}`))
  const onlySlugs = (argValue('only-slug') ?? '').split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
  const maxRows = intArg('max-rows', 0, 0, 1_000_000)
  const batch = intArg('batch', 20, 1, 200)
  const delayMs = intArg('delay-ms', 500, 0, 60_000)
  /** 문맥(program_block)으로만 지워지는 줄이 있는 행은 계획에서 뺌 — 검토 전 보수적 실행용 */
  const skipContextOnly = hasFlag('skip-context-only')

  let backup: ReturnType<typeof core.parseVerifiedBackup> | null = null
  if (mode === 'apply') {
    if (process.env.APPLY_CONFIRM !== 'YES') throw new Error('APPLY_CONFIRM=YES required')
    const bf = argValue('backup-file')
    const sha = argValue('sha256') ?? ''
    if (!bf || !existsSync(bf)) throw new Error('--backup-file <path> required (file must exist)')
    backup = core.parseVerifiedBackup(readFileSync(bf), sha)
    const side = `${bf}.sha256`
    if (existsSync(side) && !readFileSync(side, 'utf8').trim().toLowerCase().startsWith(sha.trim().toLowerCase())) {
      throw new Error('backup_sidecar_sha256_mismatch')
    }
    console.error(`[highlight-noise] backup verified rows=${backup.count}`)
  }

  const c = await connectPg()
  try {
    const { rows, scanned } = await withReadOnly(c, async () => {
      const params: unknown[] = []
      let where = `p."registrationStatus" = 'registered' AND p."highlightPoints" IS NOT NULL AND btrim(p."highlightPoints") <> ''`
      if (onlySlugs.length) {
        params.push(onlySlugs)
        where += ` AND (p.slug = ANY($1::text[]) OR p.id = ANY($1::text[]))`
      }
      const r = await c.query(
        `SELECT p.id, p.slug, COALESCE(b."brandKey", p."originSource") AS supplier, p."highlightPoints" AS "highlightPoints"
           FROM "Product" p LEFT JOIN "Brand" b ON b.id = p."brandId"
          WHERE ${where} ORDER BY p.id`,
        params,
      )
      return { rows: r.rows as Array<{ id: string; slug: string | null; supplier: string | null; highlightPoints: string | null }>, scanned: r.rows.length }
    })
    let plan = core.buildHighlightCleanupPlan(rows, noise.filterHighlightPointsSupplierNoise, noise.classifyHighlightNoiseLine)
    if (skipContextOnly) plan = plan.filter((p) => p.contextOnlyRemoved.length === 0)
    if (maxRows > 0) plan = plan.slice(0, maxRows)
    const summary = core.summarizePlan(plan, scanned)

    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, `plan-${mode}.json`), JSON.stringify({ mode, createdAt: new Date().toISOString(), summary, rows: core.planRowsForReport(plan) }, null, 1))
    writeFileSync(join(outDir, `plan-${mode}.csv`), core.planToCsv(plan))
    console.log(JSON.stringify({ mode, outDir, ...summary }))

    if (mode === 'backup') {
      const b = core.buildHighlightCleanupBackup(plan, new Date().toISOString())
      const file = join(outDir, `highlightPoints-backup-${timestampTag()}.json`)
      const bytes = Buffer.from(JSON.stringify(b, null, 1), 'utf8')
      writeFileSync(file, bytes)
      const sha = core.sha256Hex(bytes)
      writeFileSync(`${file}.sha256`, `${sha}  ${basename(file)}\n`)
      console.log(JSON.stringify({ backupFile: file, sha256: sha, rows: b.count }))
      return
    }
    if (mode !== 'apply' || !backup) return

    const decisions = core.decideApply(plan, backup)
    const writes = decisions.filter((d) => d.action === 'write') as Array<{ action: 'write'; id: string; before: string; after: string | null }>
    const counts: Record<string, number> = { ...core.countBy(decisions), written: 0, lost_race: 0, failed: 0 }
    const writtenIds: string[] = []
    for (let i = 0; i < writes.length; i += batch) {
      const chunk = writes.slice(i, i + batch)
      try {
        await c.query('BEGIN')
        await c.query(`SET LOCAL statement_timeout = '15s'`)
        for (const w of chunk) {
          const r = await c.query(
            `UPDATE "Product" SET "highlightPoints" = $2
              WHERE id = $1 AND "registrationStatus" = 'registered' AND "highlightPoints" = $3`,
            [w.id, w.after, w.before],
          )
          if ((r.rowCount ?? 0) === 1) {
            counts.written += 1
            writtenIds.push(w.id)
          } else counts.lost_race += 1
        }
        await c.query('COMMIT')
      } catch (e) {
        await c.query('ROLLBACK').catch(() => {})
        counts.failed += chunk.length
        console.error('[highlight-noise] batch failed (rolled back)', i / batch, redact(e))
      }
      console.error(`[highlight-noise] apply progress ${Math.min(i + batch, writes.length)}/${writes.length} written=${counts.written}`)
      if (i + batch < writes.length) await sleep(delayMs)
    }
    writeFileSync(join(outDir, 'apply-result.json'), JSON.stringify({ createdAt: new Date().toISOString(), counts, writtenIds }, null, 1))
    console.log(JSON.stringify({ mode, counts, resultFile: join(outDir, 'apply-result.json') }))
  } finally {
    await c.end().catch(() => {})
  }
}

main().catch((e) => {
  console.error('[highlight-noise] ERROR', redact(e))
  process.exit(1)
})
