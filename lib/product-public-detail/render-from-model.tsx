import Link from 'next/link'
import Header from '@/app/components/Header'
import TravelProductDetail from '@/app/components/travel/TravelProductDetail'
import PrivateTravelProductDetail from '@/app/components/travel/PrivateTravelProductDetail'
import MobileProductDetail from '@/app/components/travel/MobileProductDetail'
import VerygoodTravelProductDetail from '@/app/components/travel/verygood/VerygoodTravelProductDetail'
import VerygoodMobileProductDetail from '@/app/components/travel/verygood/VerygoodMobileProductDetail'
import YbtourTravelProductDetail from '@/app/components/travel/ybtour/YbtourTravelProductDetail'
import YbtourMobileProductDetail from '@/app/components/travel/ybtour/YbtourMobileProductDetail'
import ProductJsonLd from '@/app/components/seo/ProductJsonLd'
import ProductDetailCopyGuard from '@/app/components/travel/ProductDetailCopyGuard'
import { ItineraryViewLazy } from '@/components/itinerary/ItineraryViewLazy'
import { formatDepartureConditionForProduct } from '@/lib/minimum-departure-extract'
import { buildProductMetaChips } from '@/lib/product-meta-chips'
import type { ProductPublicDetailRenderModel } from '@/lib/product-public-detail/types'
import type { ProductDetailViewRow } from '@/lib/product-public-detail/build-render-model'

export function renderProductDetailFromModel(
  model: ProductPublicDetailRenderModel,
  travelProduct: Pick<ProductDetailViewRow, 'id' | 'registrationStatus'>,
  isMobile: boolean,
) {
  const isAdminDraftPreview = travelProduct.registrationStatus !== 'registered'

  if (model.variant === 'airtel') {
    const product = model.viewProduct
    const airtelDefaultDate = model.priceInfo.departureDateFrom
    const airtelDefaultFacts = product.departureKeyFactsByDate?.[airtelDefaultDate] ?? null
    const airtelTravelCitiesLine = (() => {
      const raw = [product.primaryDestination, product.destination]
        .filter((x): x is string => Boolean(x?.trim()))
        .join(',')
      const parts = raw
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
      const uniq = [...new Set(parts)]
      return uniq.length ? uniq.join(', ') : product.destination?.trim() || '—'
    })()
    const airtelMeetingDefault = (() => {
      const merged = [product.meetingInfoRaw, product.meetingPlaceRaw]
        .filter((x): x is string => Boolean(x?.trim()))
        .join(' · ')
      if (merged.trim()) return merged.trim()
      const fb = product.meetingFallbackText?.trim()
      if (fb) return fb
      return '미팅장소는 상담 시 확인하여 안내드리겠습니다.'
    })()

    const { seo } = model
    return (
      <>
        {model.registrationStatus === 'registered' ? (
          <ProductJsonLd
            productId={travelProduct.id}
            name={product.title ?? ''}
            description={seo.productDescription}
            imageUrl={seo.coverUrl}
            offers={seo.offers}
            breadcrumbItems={seo.breadcrumbItems}
            itinerary={seo.itinerary}
          />
        ) : null}
        <ProductDetailCopyGuard>
          {isAdminDraftPreview ? (
            <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950">
              관리자 미리보기 · 등록 확정 전 상품입니다. 일반 사용자에게는 표시되지 않습니다.
              <Link href="/admin/pending" className="ml-2 underline">
                등록대기
              </Link>
            </div>
          ) : null}
          <Header />
          <ItineraryViewLazy
            mode="example"
            master={model.masterArg}
            travelCoreInfo={{
              productAirline: product.airline ?? null,
              travelCitiesLine: airtelTravelCitiesLine,
              meetingDefault: airtelMeetingDefault,
              productMetaChips: buildProductMetaChips(product, { departureFactsOverride: airtelDefaultFacts }),
              flightExposurePolicy: product.flightExposurePolicy ?? null,
              departureKeyFactsByDate: product.departureKeyFactsByDate,
              departureKeyFactsByDepartureId: product.departureKeyFactsByDepartureId,
              departureConditionLine: formatDepartureConditionForProduct(product),
              duration: product.duration,
              originSource: product.originSource,
              applyFlightManualCorrectionOverlay: product.applyFlightManualCorrectionOverlay,
              flightManualCorrection: product.flightManualCorrection ?? null,
            }}
            product={{
              id: String(product.id),
              title: product.title,
              productType: model.travelProductScalars.productType,
              originSource: model.travelProductScalars.originSource,
              originCode: model.travelProductScalars.originCode,
              bgImageUrl: model.travelProductScalars.bgImageUrl,
              bgImagePhotographer: model.travelProductScalars.bgImagePhotographer,
              primaryDestination: product.primaryDestination ?? null,
              schedule: product.schedule ?? null,
              bgImageSource: product.bgImageSource ?? null,
              bgImageIsGenerated: product.bgImageIsGenerated ?? null,
              bgImagePlaceName: model.travelProductScalars.bgImagePlaceName,
              bgImageRehostSearchLabel: model.travelProductScalars.bgImageRehostSearchLabel,
              heroImageSeoKeywordOverlay: model.heroImageSeoKeywordOverlay,
              flightStructured: product.flightStructured ?? null,
              minimumDepartureCount: product.minimumDepartureCount ?? null,
              minimumDepartureText: product.minimumDepartureText ?? null,
              hotelSummaryText: product.hotelSummaryText ?? null,
              hotelNames: product.hotelNames ?? null,
              includedText: product.includedText ?? null,
              excludedText: product.excludedText ?? null,
              optionalToursStructured: product.optionalToursStructured ?? null,
              optionalToursPasteRaw: product.optionalToursPasteRaw ?? null,
              optionalTourSummaryRaw:
                product.optionalToursPasteRaw?.trim() ||
                product.optionalTourDisplayNoticeFinal?.trim() ||
                product.optionalTourNoticeRaw?.trim() ||
                null,
              shoppingCount: product.shoppingCount ?? null,
              shoppingItems: product.shoppingItems ?? null,
              shoppingCautionNoticeRaw: product.shoppingNoticeRaw ?? null,
              airtelHotelInfoJson: model.travelProductScalars.airtelHotelInfoJson,
              flightAdminJson: model.adminFlightRaw,
              duration: model.travelProductScalars.duration,
              reservationNoticeRaw: product.reservationNoticeRaw ?? null,
              mustKnowItems: product.mustKnowItems ?? null,
              travelScope: model.travelProductScalars.travelScope,
              listingKind: model.travelProductScalars.listingKind,
              airportTransferType: model.travelProductScalars.airportTransferType,
            }}
            prices={model.priceRowsForPublic}
            priceInfo={model.priceInfo}
          />
        </ProductDetailCopyGuard>
      </>
    )
  }

  const { viewProduct, ybtourDetailProduct, showEsimCrossSell, seo } = model

  const packageDetailMobile = <MobileProductDetail product={viewProduct} showEsimCrossSell={showEsimCrossSell} />
  const packageDetailDesktop = model.isPrivateOrSemi ? (
    <PrivateTravelProductDetail product={viewProduct} showEsimCrossSell={showEsimCrossSell} />
  ) : (
    <TravelProductDetail product={viewProduct} showEsimCrossSell={showEsimCrossSell} />
  )

  const detailMobile = model.isPackageItineraryBody
    ? packageDetailMobile
    : model.publicConsumptionModuleKey === 'verygoodtour' ? (
        <VerygoodMobileProductDetail product={viewProduct} showEsimCrossSell={showEsimCrossSell} />
      ) : model.publicConsumptionModuleKey === 'ybtour' && ybtourDetailProduct ? (
        <YbtourMobileProductDetail product={ybtourDetailProduct} showEsimCrossSell={showEsimCrossSell} />
      ) : (
        packageDetailMobile
      )

  const detailDesktop = model.isPackageItineraryBody
    ? packageDetailDesktop
    : model.publicConsumptionModuleKey === 'verygoodtour' ? (
        <VerygoodTravelProductDetail product={viewProduct} showEsimCrossSell={showEsimCrossSell} />
      ) : model.publicConsumptionModuleKey === 'ybtour' && ybtourDetailProduct ? (
        <YbtourTravelProductDetail product={ybtourDetailProduct} showEsimCrossSell={showEsimCrossSell} />
      ) : (
        packageDetailDesktop
      )

  return (
    <>
      {model.registrationStatus === 'registered' ? (
        <ProductJsonLd
          productId={travelProduct.id}
          name={viewProduct.title ?? ''}
          description={seo.productDescription}
          imageUrl={seo.coverUrl}
          offers={seo.offers}
          breadcrumbItems={seo.breadcrumbItems}
          itinerary={seo.itinerary}
        />
      ) : null}
      <ProductDetailCopyGuard>
        {isAdminDraftPreview ? (
          <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-950">
            관리자 미리보기 · 등록 확정 전 상품입니다. 일반 사용자에게는 표시되지 않습니다.
            <Link href="/admin/pending" className="ml-2 underline">
              등록대기
            </Link>
          </div>
        ) : null}
        {isMobile ? (
          <>
            <Header />
            {detailMobile}
          </>
        ) : (
          detailDesktop
        )}
      </ProductDetailCopyGuard>
    </>
  )
}
