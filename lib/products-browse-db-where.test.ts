import { describe, expect, it } from 'vitest'
import { AIR_HOTEL_LISTING_KIND, AIR_HOTEL_PRODUCT_TYPE } from '@/lib/air-hotel-product-ssot'
import { prismaWhereClausesForBrowseListingSlice } from '@/lib/products-browse-db-where'

describe('prismaWhereClausesForBrowseListingSlice overseas hub type', () => {
  it('type=travel excludes FIT listingKind and productTypes', () => {
    const clauses = prismaWhereClausesForBrowseListingSlice({
      scope: 'overseas',
      typeParam: 'travel',
      listingKindParsed: null,
    })
    const blob = JSON.stringify(clauses)
    expect(blob).toContain(AIR_HOTEL_LISTING_KIND)
    expect(blob).toContain(AIR_HOTEL_PRODUCT_TYPE)
    expect(blob).toContain('"NOT"')
  })

  it('no type keeps package and FIT (no FIT exclude)', () => {
    const clauses = prismaWhereClausesForBrowseListingSlice({
      scope: 'overseas',
      typeParam: null,
      listingKindParsed: null,
    })
    const blob = JSON.stringify(clauses)
    expect(blob).not.toContain(AIR_HOTEL_LISTING_KIND)
  })
})
