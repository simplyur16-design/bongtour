import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'
import { revalidateProductListingCaches } from '@/lib/revalidate-product-listing-caches'

const OLD_SLUGS = [
  'fim-mt-0001',
  'fit-mt-0001',
  'fit-mt-0002',
  'fim-mt-0002',
  'fit-mt-0020',
  'fim-mt-0003',
  'fim-mt-0004',
  'fim-mt-0005',
  'fim-mt-0006',
  'fim-mt-0007',
  'fim-mt-0008',
  'fim-mt-0009',
  'fim-mt-0010',
  'fit-mt-0003',
] as const

/** 1회성: modetour slug rename stale cache 무효화. 호출 후 route 제거 예정. */
export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  for (const slug of OLD_SLUGS) {
    revalidatePath(`/products/${slug}`)
  }
  revalidateProductListingCaches()
  return NextResponse.json({
    ok: true,
    revalidated: OLD_SLUGS.length,
    listingCachesInvalidated: true,
  })
}
