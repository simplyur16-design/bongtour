import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getPrivateTripHeroFolderListing } from '@/lib/private-trip-hero-folder'
import { isPrivateTripHeroDirectBrowserUploadConfigured } from '@/lib/private-trip-hero-direct-upload-server'
import { getImageStorageBucket } from '@/lib/object-storage'

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) {
    return NextResponse.json({ ok: false, error: '인증이 필요합니다.' }, { status: 401 })
  }
  const { diskPath, publicUrls, source } = await getPrivateTripHeroFolderListing()
  return NextResponse.json({
    ok: true,
    diskPath,
    publicUrls,
    source,
    count: publicUrls.length,
    /** true면 브라우저가 Supabase로 직접 올려 nginx 본문 한도를 피함 */
    directUploadAvailable: isPrivateTripHeroDirectBrowserUploadConfigured(),
    storageBucket: getImageStorageBucket(),
  })
}
