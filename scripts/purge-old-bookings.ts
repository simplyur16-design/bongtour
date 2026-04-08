/**
 * 예약(Booking) PII 보관기간 경과분 익명화.
 * - --dry-run (기본): 대상 건수만 로그, DB 변경 없음
 * - --apply: 익명화 실행 (이미 purge된 행은 customerPhone !== 'deleted' 조건으로 제외)
 * - --log-json: 한 줄 JSON 로그
 *
 * 환경: BOOKING_PII_RETENTION_DAYS (기본 365, 최소 30)
 * 알림: BOOKING_PII_PURGE_ALERT_WEBHOOK_URL (실패 시 필수 권장, 성공 시 선택)
 */
import { prisma } from '@/lib/prisma'

const retentionDays = Math.max(30, Number(process.env.BOOKING_PII_RETENTION_DAYS ?? 365))
const dryRun = process.argv.includes('--dry-run') || !process.argv.includes('--apply')
const logJson = process.argv.includes('--log-json')

const BATCH = 500

async function notifyWebhook(payload: Record<string, unknown>) {
  const webhook = process.env.BOOKING_PII_PURGE_ALERT_WEBHOOK_URL
  if (!webhook) return
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'bongtour',
        script: 'purge-old-bookings',
        retentionDays,
        ...payload,
        at: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(8000),
    })
  } catch {
    // noop
  }
}

function logLine(payload: Record<string, unknown>) {
  if (logJson) {
    console.log(JSON.stringify(payload))
    return
  }
  console.log(`[purge-old-bookings] ${payload.event}: ${payload.message}`)
}

function buildWhere(cutoff: Date) {
  return {
    createdAt: { lt: cutoff },
    customerPhone: { not: 'deleted' },
  }
}

async function run() {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  const where = buildWhere(cutoff)

  try {
    const candidateCount = await prisma.booking.count({ where })

    if (dryRun) {
      logLine({
        event: 'dry-run',
        message: `retentionDays=${retentionDays} candidates=${candidateCount} cutoff=${cutoff.toISOString()}`,
        retentionDays,
        candidates: candidateCount,
        cutoff: cutoff.toISOString(),
      })
      if (process.env.BOOKING_PII_PURGE_NOTIFY_DRY_RUN === '1') {
        await notifyWebhook({
          event: 'dry_run',
          message: `candidates=${candidateCount}`,
          candidates: candidateCount,
          cutoff: cutoff.toISOString(),
        })
      }
      return
    }

    let anonymized = 0
    for (;;) {
      const targets = await prisma.booking.findMany({
        where,
        select: { id: true },
        take: BATCH,
      })
      if (targets.length === 0) break
      const ids = targets.map((x) => x.id)
      await prisma.booking.updateMany({
        where: { id: { in: ids } },
        data: {
          customerName: '삭제됨',
          customerPhone: 'deleted',
          customerEmail: null,
          requestNotes: null,
          childInfantBirthDatesJson: null,
          notificationError: null,
        },
      })
      anonymized += ids.length
    }

    logLine({
      event: 'apply',
      message: `anonymized=${anonymized} cutoff=${cutoff.toISOString()}`,
      retentionDays,
      anonymized,
      cutoff: cutoff.toISOString(),
    })
    await notifyWebhook({
      event: 'apply_success',
      message: `anonymized=${anonymized}`,
      anonymized,
      cutoff: cutoff.toISOString(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown'
    logLine({ event: 'error', message })
    await notifyWebhook({
      event: 'apply_failure',
      message,
    })
    console.warn(`[purge-old-bookings] failed: ${message}`)
    process.exitCode = 1
  }
}

run().finally(async () => {
  await prisma.$disconnect()
})
