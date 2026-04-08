import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { retryImageAssetSheetSync } from '@/lib/image-asset-upload-service'

type RouteCtx = { params: Promise<{ id: string }> }

/**
 * POST /api/admin/image-assets/[id]/retry-sheet
 * 시트 append 재시도 (Storage/DB 는 그대로).
 */
export async function POST(_request: Request, ctx: RouteCtx) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  const { id } = await ctx.params
  const r = await retryImageAssetSheetSync(id)
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.error }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
