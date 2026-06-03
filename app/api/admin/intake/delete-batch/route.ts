import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import {
  deleteAdminIntakesBatch,
  type IntakeDeleteKind,
  type IntakeDeleteRef,
} from '@/lib/admin-intake-delete'

const MAX_BATCH = 100

function parseItems(raw: unknown): IntakeDeleteRef[] | null {
  if (!Array.isArray(raw)) return null
  const out: IntakeDeleteRef[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') return null
    const kind = (row as { kind?: unknown }).kind
    const id = (row as { id?: unknown }).id
    if (kind !== 'inquiry' && kind !== 'booking') return null
    if (kind === 'inquiry') {
      if (typeof id !== 'string' || !id.trim()) return null
      out.push({ kind: 'inquiry' as IntakeDeleteKind, id: id.trim() })
      continue
    }
    const n = typeof id === 'number' ? id : parseInt(String(id), 10)
    if (Number.isNaN(n)) return null
    out.push({ kind: 'booking', id: n })
  }
  return out
}

/**
 * POST /api/admin/intake/delete-batch — 선택 접수 일괄 삭제 (ADMIN).
 * body: { items: [{ kind: "inquiry"|"booking", id }] }
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  let body: { items?: unknown }
  try {
    body = (await request.json()) as { items?: unknown }
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 })
  }

  const items = parseItems(body.items)
  if (!items || items.length === 0) {
    return NextResponse.json({ error: '삭제할 항목을 선택해 주세요.' }, { status: 400 })
  }
  if (items.length > MAX_BATCH) {
    return NextResponse.json(
      { error: `한 번에 최대 ${MAX_BATCH}건까지 삭제할 수 있습니다.` },
      { status: 400 },
    )
  }

  try {
    const { deleted, failed } = await deleteAdminIntakesBatch(items)
    return NextResponse.json({
      ok: true,
      deletedCount: deleted.length,
      failedCount: failed.length,
      deleted,
      failed,
    })
  } catch (e) {
    console.error('[POST /api/admin/intake/delete-batch]', e)
    return NextResponse.json(
      { error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 },
    )
  }
}
