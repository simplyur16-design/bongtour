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
    issues.push('DISABLE_INSTRUMENTATION_CALENDAR_CRON=1 로 자동 배치가 꺼져 있습니다.')
  }
  if (!readiness.bearerConfigured) {
    issues.push('ADMIN_SERVICE_BEARER_SECRET(또는 ADMIN_BYPASS_SECRET)이 없으면 Python 배치가 API를 호출하지 못합니다.')
  }
  if (!readiness.apiBaseConfigured) {
    issues.push(
      'BONGTOUR_API_BASE(또는 NEXT_PUBLIC_SITE_URL / NEXTAUTH_URL)이 비어 있으면 Python이 저장 API를 호출할 수 없습니다.',
    )
  }
  if (readiness.nodeEnv !== 'production' && !readiness.devOptIn) {
    issues.push(
      '로컬(dev)에서는 기본적으로 자동 크론이 꺼져 있습니다. 테스트 시 .env에 ENABLE_INSTRUMENTATION_CALENDAR_CRON=1 을 넣고 서버를 재시작하세요.',
    )
  }

  const setupSteps: string[] = [
    '운영 .env: ADMIN_SERVICE_BEARER_SECRET, BONGTOUR_API_BASE=https://bongtour.com (도메인과 동일)',
    'PYTHON=/var/www/bongtour/.venv/bin/python + playwright install (deploy/README.md)',
    'pm2 restart bongtour --update-env 후 로그에 [calendar-cron] registered 확인',
    '선택: 배포 직후 1회 실행 CALENDAR_CRON_RUN_ON_STARTUP=1',
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
      '3시간 1회 (KST) — sequential: 등록 상품 순번대로 상품별 30일 창(cursor+1~+30), 창 안 전부 수집. non-modetour는 실패 시에도 상품별 cursor 전진(공급사 일괄 차단 없음). modetour는 레거시(today~horizon). 수동: POST /api/admin/scheduler/run-once.',
    issues,
  })
}
