import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { deleteOgImage, isValidOgPageKey, type OgPageKey } from '@/lib/og-images-db'
import { requireAdmin } from '@/lib/require-admin'

const OG_REVALIDATE_PATHS: Record<OgPageKey, string[]> = {
  default: ['/'],
  overseas: ['/travel/overseas'],
  'private-trip': ['/travel/overseas/private-trip'],
  domestic: ['/travel/domestic'],
  training: ['/training'],
  esim: ['/travel/esim'],
}

function revalidateOgPathsForPageKey(pageKey: OgPageKey): void {
  const paths = OG_REVALIDATE_PATHS[pageKey] ?? []
  for (const path of paths) {
    try {
      revalidatePath(path)
    } catch (e) {
      console.error('[og-images revalidate]', path, e)
    }
  }
}

type RouteContext = { params: Promise<{ pageKey: string }> }

/**
 * DELETE /api/admin/og-images/[pageKey] — DB + Storage 삭제
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })

  const { pageKey: raw } = await context.params
  const pageKey = String(raw ?? '').trim()
  if (!isValidOgPageKey(pageKey)) {
    return NextResponse.json({ ok: false, error: '유효하지 않은 pageKey 입니다.' }, { status: 400 })
  }

  try {
    await deleteOgImage(pageKey)
    revalidateOgPathsForPageKey(pageKey)
    return NextResponse.json({ ok: true, success: true })
  } catch (e) {
    console.error('[og-images DELETE]', e)
    return NextResponse.json(
      { ok: false, error: '삭제 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
