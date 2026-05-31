import type { Prisma } from '@prisma/client'
import type { ListingKind } from '@/lib/product-listing-kind'

function parseBrowseTypeForWhere(raw: string | null): 'airtel' | 'travel' | 'private' | 'semi' | null {
  if (!raw) return null
  const u = raw.toLowerCase().trim()
  if (u === 'free' || u === 'airtel') return 'airtel'
  if (u === 'travel' || u === 'semi' || u === 'private') return u
  return null
}

/**
 * browse `findMany` — listingKind·허브 슬라이스를 DB where로 push-down.
 * 메모리 필터(`products-browse-build-payload`)와 동일 의미만 적용 (동작 변경 없음).
 */
export function prismaWhereClausesForBrowseListingSlice(input: {
  scope: string | null
  typeParam: string | null
  listingKindParsed: ListingKind | null
  airtelCategory: boolean
}): Prisma.ProductWhereInput[] {
  const clauses: Prisma.ProductWhereInput[] = [{ NOT: { listingKind: 'overseas_training' } }]

  const wantsAirtelHubSlice =
    parseBrowseTypeForWhere(input.typeParam) === 'airtel' ||
    input.airtelCategory ||
    input.listingKindParsed === 'air_hotel_free'

  if (wantsAirtelHubSlice) {
    clauses.push({ listingKind: 'air_hotel_free' })
    return clauses
  }

  if (input.listingKindParsed) {
    if (input.listingKindParsed === 'travel') {
      clauses.push({
        OR: [{ listingKind: 'travel' }, { listingKind: null }, { listingKind: '' }],
      })
    } else {
      clauses.push({ listingKind: input.listingKindParsed })
    }
    return clauses
  }

  const scope = (input.scope ?? '').trim().toLowerCase()
  if (scope === 'domestic' && !wantsAirtelHubSlice) {
    clauses.push({
      OR: [{ listingKind: null }, { listingKind: '' }, { listingKind: { not: 'air_hotel_free' } }],
    })
  }

  return clauses
}
