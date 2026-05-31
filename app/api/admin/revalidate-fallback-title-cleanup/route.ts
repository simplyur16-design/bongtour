import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'

const AFFECTED_SLUGS = [
  // 삭제 6건
  'pkg-mt-0025',
  'pkg-mt-0027',
  'pkg-mt-0043',
  'pkg-mt-0044',
  'pkg-mt-0045',
  'pkg-mt-0052',
  // title UPDATE 4건
  'pkg-mt-0030',
  'pkg-mt-0058',
  'pkg-vg-0001',
  'pkg-vg-0010',
] as const

/** 1회성: fallback title 정리 10건 stale cache 무효화. 호출 후 route 제거 예정. */
export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  for (const slug of AFFECTED_SLUGS) {
    revalidatePath(`/products/${slug}`)
  }
  revalidateProductListingCaches()
  return NextResponse.json({
    ok: true,
    revalidatedPaths: AFFECTED_SLUGS.length,
    listingCachesInvalidated: true,
  })
}
