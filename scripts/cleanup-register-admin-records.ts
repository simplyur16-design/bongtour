/**
 * RegisterAdminInputSnapshot 만료 행 물리삭제 (자식 RegisterAdminAnalysis는 Prisma cascade).
 *
 * 사용:
 *   npx tsx scripts/cleanup-register-admin-records.ts              # dry-run
 *   npx tsx scripts/cleanup-register-admin-records.ts --apply        # 실제 삭제
 *   npx tsx scripts/cleanup-register-admin-records.ts --apply --legacy-failed-days=120
 *
 * 환경: DATABASE_URL (.env)
 */
import { prisma } from '../lib/prisma'

const ISO = (d: Date) => d.toISOString()

function argvFlag(name: string): boolean {
  return process.argv.includes(name)
}

function argvNumber(name: string): number | null {
  const prefix = `${name}=`
  const raw = process.argv.find((a) => a.startsWith(prefix))
  if (!raw) return null
  const n = Number(raw.slice(prefix.length))
  return Number.isFinite(n) && n > 0 ? n : null
}

async function main() {
  const apply = argvFlag('--apply')
  const batchLimit = argvNumber('--batch') ?? 500
  const legacyFailedDays = argvNumber('--legacy-failed-days')
  const now = new Date()

  const expired = await prisma.registerAdminInputSnapshot.findMany({
    where: {
      retentionExpiresAt: { not: null, lt: now },
    },
    select: {
      id: true,
      status: true,
      retentionExpiresAt: true,
      createdAt: true,
      originSource: true,
      originCode: true,
    },
    orderBy: { retentionExpiresAt: 'asc' },
    take: batchLimit,
  })

  console.log(
    JSON.stringify({
      at: ISO(now),
      mode: apply ? 'apply' : 'dry-run',
      phase: 'retentionExpiresAt_elapsed',
      candidateCount: expired.length,
      batchLimit,
    })
  )

  for (const row of expired) {
    console.log(
      JSON.stringify({
        action: apply ? 'delete' : 'would_delete',
        snapshotId: row.id,
        status: row.status,
        retentionExpiresAt: row.retentionExpiresAt ? ISO(row.retentionExpiresAt) : null,
        createdAt: ISO(row.createdAt),
        originSource: row.originSource,
        originCode: row.originCode,
      })
    )
  }

  if (apply && expired.length > 0) {
    const ids = expired.map((r) => r.id)
    const result = await prisma.registerAdminInputSnapshot.deleteMany({
      where: { id: { in: ids } },
    })
    console.log(JSON.stringify({ deletedSnapshots: result.count, cascadeAnalyses: 'onDelete_Cascade' }))
  }

  if (legacyFailedDays != null) {
    const cutoff = new Date(now)
    cutoff.setUTCDate(cutoff.getUTCDate() - legacyFailedDays)
    const legacy = await prisma.registerAdminInputSnapshot.findMany({
      where: {
        retentionExpiresAt: null,
        status: 'analysis_failed',
        updatedAt: { lt: cutoff },
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
        createdAt: true,
        originSource: true,
      },
      take: batchLimit,
    })
    console.log(
      JSON.stringify({
        at: ISO(now),
        mode: apply ? 'apply' : 'dry-run',
        phase: 'legacy_analysis_failed_no_retention_field',
        olderThanDays: legacyFailedDays,
        candidateCount: legacy.length,
      })
    )
    for (const row of legacy) {
      console.log(
        JSON.stringify({
          action: apply ? 'delete' : 'would_delete',
          snapshotId: row.id,
          status: row.status,
          updatedAt: ISO(row.updatedAt),
        })
      )
    }
    if (apply && legacy.length > 0) {
      const result = await prisma.registerAdminInputSnapshot.deleteMany({
        where: { id: { in: legacy.map((r) => r.id) } },
      })
      console.log(JSON.stringify({ legacyDeletedSnapshots: result.count }))
    }
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  try {
    await prisma.$disconnect()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
