import { NextResponse } from 'next/server'
import { imageAssetRowToApi } from '@/lib/image-asset-api-mapper'
import { listRecentImageAssets } from '@/lib/image-assets-db'
import { requireAdmin } from '@/lib/require-admin'

/**
 * GET /api/admin/image-assets/recent?take=1..50
 * Prisma ImageAsset — 관리자 최근 목록 (Ncloud public_url)
 */
export async function GET(request: Request) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const take = Math.min(50, Math.max(1, Number(searchParams.get('take') ?? 20)))
  try {
    const rows = await listRecentImageAssets(take)
    return NextResponse.json({
      ok: true,
      items: rows.map((r) => imageAssetRowToApi(r)),
    })
  } catch (e) {
    console.error('[image-assets/recent]', e)
    return NextResponse.json(
      { ok: false, error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 500 }
    )
  }
}
