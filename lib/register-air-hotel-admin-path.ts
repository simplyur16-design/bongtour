/**
 * 관리자 등록 — 항공+호텔(자유여행) 공통 SSOT (6공급사·내일·모두).
 * travelScope=air_hotel_free 는 등록 UI 선택값만 — URL·API 제목 추론 금지.
 */
import { isRegisterAirHotelListing } from '@/lib/register-admin-airtel-listing'
import { buildRegisterAirHotelItineraryDayDrafts } from '@/lib/register-air-hotel-itinerary-day-drafts'

export const REGISTER_AIR_HOTEL_PREVIEW_POLICY_NOTE =
  '항공+호텔(자유여행): 관리자 travelScope=air_hotel_free 선택 SSOT. Fit 예시일정·routeText 보조 imageKeyword.'

export function isRegisterAirHotelAdminPath(
  travelScope?: string | null,
  productType?: string | null,
): boolean {
  return isRegisterAirHotelListing(travelScope, productType)
}

/** 패키지 imageKeyword·vibe description apply — 자유여행 선택 시 skip */
export function shouldApplyRegisterPackageScheduleKeywords(travelScope?: string | null): boolean {
  return !isRegisterAirHotelListing(travelScope)
}

export function resolveRegisterItineraryDayDraftsForAdminPreview<
  TSchedule,
  TDraft extends { day: number },
>(args: {
  parsed: {
    productType?: string | null
    registerFitItineraryGeminiJson?: string | null
    schedule?: TSchedule[] | null
  }
  travelScope: string
  schedule: TSchedule[]
  buildFromSchedule: (schedule: TSchedule[]) => TDraft[]
  finalizePackageDrafts?: (drafts: TDraft[], schedule: TSchedule[]) => TDraft[]
}): TDraft[] {
  if (isRegisterAirHotelListing(args.travelScope, args.parsed.productType)) {
    return buildRegisterAirHotelItineraryDayDrafts(
      args.parsed as Parameters<typeof buildRegisterAirHotelItineraryDayDrafts>[0],
    ) as TDraft[]
  }
  let drafts = args.buildFromSchedule(args.schedule)
  if (args.schedule.length > 0 && args.finalizePackageDrafts) {
    drafts = args.finalizePackageDrafts(drafts, args.schedule)
  }
  return drafts
}
