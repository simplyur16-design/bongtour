import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/require-admin'
import { getPrivateTripHeroFolderListing } from '@/lib/private-trip-hero-folder'

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
  })
}
