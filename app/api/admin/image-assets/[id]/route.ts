import { NextResponse } from 'next/server'
import { imageAssetRowToApi } from '@/lib/image-asset-api-mapper'
import { requireAdmin } from '@/lib/require-admin'
import { patchImageAsset } from '@/lib/image-asset-upload-service'

type RouteCtx = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/image-assets/[id]
 * body JSON: { isPrimary?, sortOrder?, altKr?, altEn?, sourceType?, sourceNote?, seoTitleKr?, seoTitleEn? }
 */
export async function PATCH(request: Request, ctx: RouteCtx) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  const { id } = await ctx.params
  try {
    const body = (await request.json()) as {
      isPrimary?: boolean
      sortOrder?: number
      altKr?: string | null
      altEn?: string | null
      sourceType?: string | null
      sourceNote?: string | null
      seoTitleKr?: string | null
      seoTitleEn?: string | null
    }
    const updated = await patchImageAsset(id, {
      isPrimary: body.isPrimary,
      sortOrder: body.sortOrder,
      altKr: body.altKr,
      altEn: body.altEn,
      sourceType: body.sourceType,
      sourceNote: body.sourceNote,
      seoTitleKr: body.seoTitleKr,
      seoTitleEn: body.seoTitleEn,
    })
    return NextResponse.json({
      ok: true,
      asset: imageAssetRowToApi(updated),
    })
  } catch (e) {
    console.error('[image-assets/patch]', e)
    const msg = e instanceof Error ? e.message : ''
    if (msg.startsWith('Invalid source_type')) {
      return NextResponse.json({ ok: false, error: 'validation_error', message: msg }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 400 })
  }
}
