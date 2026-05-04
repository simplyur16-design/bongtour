import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getPrivateTripHeroFolderListing } from '@/lib/private-trip-hero-folder'
import { isPrivateTripHeroDirectBrowserUploadConfigured } from '@/lib/private-trip-hero-direct-upload-server'
import { isObjectStorageConfigured } from '@/lib/object-storage'
import { deletePrivateTripHeroImageByPublicUrl } from '@/lib/private-trip-hero-storage-delete'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }
  const { locationNote, publicUrls, source } = await getPrivateTripHeroFolderListing()
  return NextResponse.json({
    ok: true,
    locationNote,
    publicUrls,
    source,
    storageConfigured: isObjectStorageConfigured(),
    count: publicUrls.length,
    /** true면 브라우저가 Ncloud presigned PUT으로 직접 올려 nginx 본문 한도를 피함 */
    directUploadAvailable: isPrivateTripHeroDirectBrowserUploadConfigured(),
  })
}

/** Storage 객체 1건 삭제 — 본문 `{ "publicUrl": "<목록과 동일한 공개 URL>" }` */
export async function DELETE(request: Request) {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }
  if (!isObjectStorageConfigured()) {
    return NextResponse.json({ ok: false, error: 'Object Storage(Ncloud)가 설정되지 않았습니다.' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON 본문이 필요합니다.' }, { status: 400 })
  }
  const publicUrl =
    typeof body === 'object' && body !== null && 'publicUrl' in body && typeof (body as { publicUrl: unknown }).publicUrl === 'string'
      ? (body as { publicUrl: string }).publicUrl.trim()
      : ''

  if (!publicUrl) {
    return NextResponse.json({ ok: false, error: 'publicUrl이 필요합니다.' }, { status: 400 })
  }

  try {
    await deletePrivateTripHeroImageByPublicUrl(publicUrl)
    return NextResponse.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '삭제에 실패했습니다.'
    return NextResponse.json({ ok: false, error: msg }, { status: 400 })
  }
}
