import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { finalizePrivateTripHeroIncomingUpload } from '@/lib/private-trip-hero-direct-upload-server'

/**
 * incoming 객체를 서버에서 WebP로 변환해 최종 키에 저장하고 incoming을 삭제한다.
 */
export async function POST(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { incomingPath?: string; originalFileName?: string }
    const incomingPath = typeof body.incomingPath === 'string' ? body.incomingPath.trim() : ''
    const originalFileName = typeof body.originalFileName === 'string' ? body.originalFileName : 'upload'
    if (!incomingPath) {
      return NextResponse.json({ ok: false, error: 'incomingPath가 필요합니다.' }, { status: 400 })
    }
    const saved = await finalizePrivateTripHeroIncomingUpload(incomingPath, originalFileName)
    return NextResponse.json({
      ok: true,
      fileName: saved.fileName,
      publicUrl: saved.publicUrl,
      bytesWritten: saved.bytesWritten,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '처리 실패'
    console.error('[private-trip-hero-folder/upload-finalize]', e)
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }
}
