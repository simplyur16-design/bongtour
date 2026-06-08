import { describe, expect, it } from 'vitest'
import {
  bookableMinDateYmdForPayload,
  parseProductPublicDetailPayload,
  serializeProductPublicDetailPayload,
} from '@/lib/product-public-detail/payload-io'
import type { ProductPublicDetailAirHotelRenderModel } from '@/lib/product-public-detail/types'

function minimalAirHotelModel(title: string, schedule: unknown): ProductPublicDetailAirHotelRenderModel {
  return {
    variant: 'air-hotel',
    viewProduct: {
      id: 'test-id',
      title,
      schedule: schedule as ProductPublicDetailAirHotelRenderModel['viewProduct']['schedule'],
    } as ProductPublicDetailAirHotelRenderModel['viewProduct'],
    priceRowsForPublic: [],
    priceInfo: {
      departureDateFrom: '',
      departureDateTo: '',
      lowestAdultPrice: 0,
      highestAdultPrice: 0,
      infantPrice: null,
      childBedPrice: 0,
      minPaxPerDeparture: null,
      totalDays: 7,
    },
    masterArg: null,
    adminFlightRaw: null,
    heroImageSeoKeywordOverlay: null,
    travelProductScalars: {
      id: 'test-id',
      originSource: 'hanatour',
      originCode: 'HN',
      bgImageUrl: null,
      bgImagePhotographer: null,
      bgImagePlaceName: null,
      bgImageRehostSearchLabel: null,
      airtelHotelInfoJson: null,
      duration: '5박 7일',
      travelScope: 'overseas',
      listingKind: 'air_hotel_free',
      airportTransferType: null,
      productType: 'air-hotel',
    },
    seo: {
      coverUrl: '',
      productDescription: '',
      offers: null,
      breadcrumbItems: [],
      itinerary: null,
    },
    registrationStatus: 'registered',
  }
}

describe('parseProductPublicDetailPayload empty_shell guard', () => {
  const bookableYmd = bookableMinDateYmdForPayload(new Date('2026-06-08T12:00:00+09:00'))

  it('rejects empty_shell (blank title, no schedule, small bytes)', () => {
    const model = minimalAirHotelModel('', null)
    const raw = serializeProductPublicDetailPayload(model, bookableYmd)
    expect(raw.length).toBeLessThan(8000)
    expect(parseProductPublicDetailPayload(raw, bookableYmd)).toBeNull()
  })

  it('accepts normal air-hotel payload with title', () => {
    const model = minimalAirHotelModel('파리 자유여행 5박 7일', [{ day: 1, description: 'DAY1' }])
    const raw = serializeProductPublicDetailPayload(model, bookableYmd)
    expect(parseProductPublicDetailPayload(raw, bookableYmd)?.viewProduct.title).toBe('파리 자유여행 5박 7일')
  })
})
