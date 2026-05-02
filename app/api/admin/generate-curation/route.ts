import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { generateMonthlyCuration } from '@/lib/gemini-curation'

/**
 * POST /api/admin/generate-curation
 * body: { targetMonth: "2026-06", overwrite?: boolean }
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }
  const b = (body ?? {}) as Record<string, unknown>
  const targetMonth = typeof b.targetMonth === 'string' ? b.targetMonth.trim() : ''
  const overwrite = b.overwrite === true

  if (!targetMonth) {
    return NextResponse.json({ error: 'targetMonth(YYYY-MM)가 필요합니다.' }, { status: 400 })
  }

  const result = await generateMonthlyCuration(targetMonth, { overwrite })
  if (!result.ok) {
    const status =
      result.code === 'EXISTS'
        ? 409
        : result.code === 'INVALID_MONTH' || result.code === 'NO_PRODUCTS'
          ? 400
          : result.code === 'GEMINI_KEY'
            ? 503
            : 502
    return NextResponse.json({ error: result.error, code: result.code }, { status })
  }

  return NextResponse.json({
    ok: true,
    targetMonth: result.targetMonth,
    created: result.created,
    items: result.items,
  })
}
