import { NextResponse } from 'next/server'
import { getPgPool } from '@/lib/bongsim/db/pool'
import { requireAdmin } from '@/lib/require-admin'

export const dynamic = 'force-dynamic'

const CONFIRM_PHRASE = 'PURGE_BONGSIM_ORDERS'

function purgeAllowed(): boolean {
  if (process.env.NODE_ENV !== 'production') return true
  return process.env.ALLOW_BONGSIM_PAYMENTS_PURGE === '1'
}

/**
 * POST — eSIM 테스트·미완료 주문 일괄 삭제 (CASCADE).
 * body: { confirm: "PURGE_BONGSIM_ORDERS", mode?: "unfinished" | "all" }
 */
export async function POST(req: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  if (!purgeAllowed()) {
    return NextResponse.json(
      {
        error: 'purge_disabled',
        message:
          '운영 환경에서는 ALLOW_BONGSIM_PAYMENTS_PURGE=1 일 때만 삭제할 수 있습니다. 로컬·스테이징에서 사용하세요.',
      },
      { status: 403 },
    )
  }

  const pool = getPgPool()
  if (!pool) return NextResponse.json({ error: 'db_unconfigured' }, { status: 503 })

  let body: { confirm?: string; mode?: string } = {}
  try {
    body = ((await req.json()) as { confirm?: string; mode?: string }) ?? {}
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if ((body.confirm ?? '').trim() !== CONFIRM_PHRASE) {
    return NextResponse.json(
      { error: 'confirm_required', message: `confirm 필드에 "${CONFIRM_PHRASE}" 를 보내야 합니다.` },
      { status: 400 },
    )
  }

  const mode = (body.mode ?? 'unfinished').trim()
  if (mode !== 'unfinished' && mode !== 'all') {
    return NextResponse.json({ error: 'invalid_mode' }, { status: 400 })
  }

  if (mode === 'all' && process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      {
        error: 'all_mode_blocked_in_production',
        message: '운영에서는 mode=all 를 사용할 수 없습니다. unfinished 만 허용됩니다.',
      },
      { status: 403 },
    )
  }

  try {
    const whereSql =
      mode === 'all'
        ? 'TRUE'
        : `status IN ('pending', 'awaiting_payment', 'failed', 'cancelled')`

    const countR = await pool.query<{ c: string }>(
      `SELECT COUNT(*)::text AS c FROM bongsim_order WHERE ${whereSql}`,
    )
    const toDelete = Number.parseInt(countR.rows[0]?.c ?? '0', 10)

    const delR = await pool.query<{ order_id: string }>(
      `DELETE FROM bongsim_order WHERE ${whereSql} RETURNING order_id::text`,
    )

    return NextResponse.json({
      ok: true,
      mode,
      deletedCount: delR.rowCount ?? delR.rows.length,
      scannedCount: toDelete,
    })
  } catch (e) {
    console.error('[admin/bongsim/payments/purge POST]', e)
    return NextResponse.json({ error: 'purge_failed' }, { status: 500 })
  }
}
