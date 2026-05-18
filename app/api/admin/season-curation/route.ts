import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runSeasonCurationJob } from '@/lib/season-curation-job'
import {
  getCurrentCycle,
  getKstMonthlySeasonWindowForOffset,
} from '@/lib/season-curation'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

async function cityLabelsForKeys(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return {}
  const rows = await prisma.city.findMany({
    where: { cityKey: { in: keys } },
    select: { cityKey: true, koreanLabel: true },
  })
  return Object.fromEntries(rows.map((r) => [r.cityKey, r.koreanLabel]))
}

/** GET: 현재·+1/+2/+3월 사이클 상태 */
export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const now = new Date()
  const current = await getCurrentCycle(now)
  const offsets = [1, 2, 3] as const
  const ahead = await Promise.all(
    offsets.map(async (offset) => {
      const { startDate, endDate } = getKstMonthlySeasonWindowForOffset(now, offset)
      const row = await prisma.seasonalDestinationCuration.findUnique({
        where: { cycleStartDate: startDate },
      })
      const cityKeys = row?.cityKeys ?? []
      return {
        offset,
        cycleStartDate: startDate.toISOString(),
        cycleEndDate: endDate.toISOString(),
        exists: Boolean(row),
        id: row?.id ?? null,
        cityKeys,
        cityLabels: await cityLabelsForKeys(cityKeys),
      }
    }),
  )

  const currentKeys = current?.cityKeys ?? []
  return NextResponse.json({
    ok: true,
    at: now.toISOString(),
    current: current
      ? {
          id: current.id,
          cycleStartDate: current.cycleStartDate.toISOString(),
          cycleEndDate: current.cycleEndDate.toISOString(),
          cityKeys: currentKeys,
          fallbackKeys: current.fallbackKeys,
          cityLabels: await cityLabelsForKeys(currentKeys),
        }
      : null,
    ahead,
    scheduleNote: '서버 기동 시 1회 시드 · 매월 15일 00:00 KST 자동 갱신(instrumentation)',
  })
}

/** POST: 수동 실행 — `{ "force": true }` 시 현재 사이클 강제 재생성 */
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let force = false
  try {
    const body = (await req.json()) as { force?: boolean }
    force = body?.force === true
  } catch {
    force = false
  }

  try {
    const result = await runSeasonCurationJob(new Date(), { force })
    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          rotated: result.rotated,
          message: result.message ?? 'job_failed',
          cycleId: result.cycle?.id ?? null,
        },
        { status: 500 },
      )
    }
    return NextResponse.json({
      ok: true,
      rotated: result.rotated,
      cycleId: result.cycle?.id ?? null,
      cityKeys: result.cycle?.cityKeys ?? [],
      message: result.message ?? null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[admin/season-curation POST]', e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
