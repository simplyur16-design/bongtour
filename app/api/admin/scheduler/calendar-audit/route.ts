import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/require-admin'
import { determineScrapeStrategy } from '@/lib/scraper-schedule-strategy'
import { getCalendarBatchReadiness } from '@/lib/calendar-batch-env'
import { readCalendarBatchSeqState, CALENDAR_BATCH_CHUNK_DAYS } from '@/lib/calendar-batch-seq-state'

export const dynamic = 'force-dynamic'

/** GET — 날짜별 요금 자동 수집(캘린더 배치) 운영 상태 점검 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const now = new Date()
  const strategy = await determineScrapeStrategy()
  const readiness = getCalendarBatchReadiness()
  const seq = readCalendarBatchSeqState()

  const registeredCount = await prisma.product.count({
    where: { registrationStatus: 'registered', originCode: { not: '' } },
  })

  const withFutureDepartures = await prisma.product.count({
    where: {
      registrationStatus: 'registered',
      departures: { some: { departureDate: { gte: now } } },
    },
  })

  const depUpdated7d = await prisma.productDeparture.count({
    where: { syncedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
  })

  const issues: string[] = []
  if (readiness.disabledByFlag) {
    issues.push('DISABLE_INSTRUMENTATION_CALENDAR_CRON=1 로 3h 배치가 명시적으로 꺼져 있습니다.')
  } else if (!readiness.devOptIn) {
    issues.push(
      '3h calendar batch는 기본 OFF입니다. API/HXR SSOT = 공급사별 일 1회 sweep. 복구·테스트만 ENABLE_INSTRUMENTATION_CALENDAR_CRON=1.',
    )
  }
  if (!readiness.bearerConfigured) {
    issues.push('ADMIN_SERVICE_BEARER_SECRET(또는 ADMIN_BYPASS_SECRET)이 없으면 Python 배치가 API를 호출하지 못합니다.')
  }
  if (!readiness.apiBaseConfigured) {
    issues.push(
      'BONGTOUR_API_BASE(또는 NEXT_PUBLIC_SITE_URL / NEXTAUTH_URL)이 비어 있으면 Python이 저장 API를 호출할 수 없습니다.',
    )
  }

  const setupSteps: string[] = [
    '운영: 공급사별 일 1회 sweep(KST 04:00~08:30)이 API/HXR SSOT — 3h batch 기본 OFF',
    '3h batch 테스트만: ENABLE_INSTRUMENTATION_CALENDAR_CRON=1 + 재배포 후 [calendar-cron] registered 확인',
    '관리자 수동 1회: POST /api/admin/scheduler/run-once',
  ]

  return NextResponse.json({
    ok: true,
    at: now.toISOString(),
    readiness,
    environment: {
      nodeEnv: readiness.nodeEnv,
      cronRegistered: readiness.cronCanRegister,
      bearerConfigured: readiness.bearerConfigured,
      apiBaseConfigured: readiness.apiBaseConfigured,
      apiBasePreview: readiness.apiBase || null,
      pythonExecutable: readiness.pythonExecutable,
    },
    strategy,
    sequential: {
      nextProductIndex: seq.nextProductIndex,
      chunkDays: CALENDAR_BATCH_CHUNK_DAYS,
      horizonYmd: strategy.horizonYmd,
    },
    counts: {
      registeredProducts: registeredCount,
      registeredWithFutureDepartures: withFutureDepartures,
      departuresUpdatedLast7Days: depUpdated7d,
    },
    setupSteps,
    scheduleNote:
      '3h calendar batch — 기본 OFF. API/HXR SSOT = 공급사별 일 1회 sweep(성공 시 +7일). opt-in: ENABLE_INSTRUMENTATION_CALENDAR_CRON=1. 수동: POST /api/admin/scheduler/run-once.',
    issues,
  })
}
