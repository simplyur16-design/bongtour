/**
 * 등록 API·관리자 미리보기용 ProductDeparture 직렬화 행.
 * SSOT 키는 prisma ProductDeparture / DepartureInput 과 동일; Date 필드는 JSON용 문자열.
 */
import { deriveDepartureFlags, type DepartureInput } from '@/lib/upsert-product-departures-hanatour'

export type DeparturePreviewRow = {
  departureDate: string
  adultPrice: number | null
  childBedPrice: number | null
  childNoBedPrice: number | null
  infantPrice: number | null
  localPriceText: string | null
  /** 출발일 행 상태·진행 문구 원문(마감·확정 등). 좌석 표기와 구분. */
  statusRaw: string | null
  /** 잔여석·예약석 등 좌석/예약 관련 표기 원문. statusRaw 와 별도. */
  seatsStatusRaw: string | null
  isConfirmed: boolean | null
  isBookable: boolean | null
  minPax: number | null
  carrierName: string | null
  outboundFlightNo: string | null
  outboundDepartureAirport: string | null
  outboundDepartureAt: string | null
  outboundArrivalAirport: string | null
  outboundArrivalAt: string | null
  inboundFlightNo: string | null
  inboundDepartureAirport: string | null
  inboundDepartureAt: string | null
  inboundArrivalAirport: string | null
  inboundArrivalAt: string | null
  meetingInfoRaw: string | null
  meetingPointRaw: string | null
  meetingTerminalRaw: string | null
  meetingGuideNoticeRaw: string | null
  meetingDateRaw: string | null
  statusLabelsRaw: string | null
  reservationCount: number | null
  seatCount: number | null
  fuelSurchargeIncluded: boolean | null
  taxIncluded: boolean | null
  isDepartureConfirmed: boolean | null
  isAirConfirmed: boolean | null
  isScheduleConfirmed: boolean | null
  isHotelConfirmed: boolean | null
  isPriceConfirmed: boolean | null
  supplierDepartureCodeCandidate: string | null
  matchingTraceRaw: string | null
  transportType: string | null
  boardingPlace: string | null
  departureTimeText: string | null
  returnTimeText: string | null
  vehicleNote: string | null
  transportSegmentRaw: string | null
  supplierPriceKey: string | null
}

export function toDeparturePreviewRows(inputs: DepartureInput[]): DeparturePreviewRow[] {
  return inputs.map((d) => {
    const rawDate =
      d.departureDate instanceof Date ? d.departureDate.toISOString().slice(0, 10) : String(d.departureDate).slice(0, 10)
    const { isConfirmed, isBookable } = deriveDepartureFlags(d.statusRaw, d.seatsStatusRaw)
    return {
      departureDate: rawDate,
      adultPrice: d.adultPrice ?? null,
      childBedPrice: d.childBedPrice ?? null,
      childNoBedPrice: d.childNoBedPrice ?? null,
      infantPrice: d.infantPrice ?? null,
      localPriceText: d.localPriceText ?? null,
      statusRaw: d.statusRaw ?? null,
      seatsStatusRaw: d.seatsStatusRaw ?? null,
      isConfirmed,
      isBookable,
      minPax: d.minPax ?? null,
      carrierName: d.carrierName ?? null,
      outboundFlightNo: d.outboundFlightNo ?? null,
      outboundDepartureAirport: d.outboundDepartureAirport ?? null,
      outboundDepartureAt: d.outboundDepartureAt != null ? String(d.outboundDepartureAt) : null,
      outboundArrivalAirport: d.outboundArrivalAirport ?? null,
      outboundArrivalAt: d.outboundArrivalAt != null ? String(d.outboundArrivalAt) : null,
      inboundFlightNo: d.inboundFlightNo ?? null,
      inboundDepartureAirport: d.inboundDepartureAirport ?? null,
      inboundDepartureAt: d.inboundDepartureAt != null ? String(d.inboundDepartureAt) : null,
      inboundArrivalAirport: d.inboundArrivalAirport ?? null,
      inboundArrivalAt: d.inboundArrivalAt != null ? String(d.inboundArrivalAt) : null,
      meetingInfoRaw: d.meetingInfoRaw ?? null,
      meetingPointRaw: d.meetingPointRaw ?? null,
      meetingTerminalRaw: d.meetingTerminalRaw ?? null,
      meetingGuideNoticeRaw: d.meetingGuideNoticeRaw ?? null,
      meetingDateRaw: d.meetingDateRaw ?? null,
      statusLabelsRaw: d.statusLabelsRaw ?? null,
      reservationCount: d.reservationCount ?? null,
      seatCount: d.seatCount ?? null,
      fuelSurchargeIncluded: d.fuelSurchargeIncluded ?? null,
      taxIncluded: d.taxIncluded ?? null,
      isDepartureConfirmed: d.isDepartureConfirmed ?? null,
      isAirConfirmed: d.isAirConfirmed ?? null,
      isScheduleConfirmed: d.isScheduleConfirmed ?? null,
      isHotelConfirmed: d.isHotelConfirmed ?? null,
      isPriceConfirmed: d.isPriceConfirmed ?? null,
      supplierDepartureCodeCandidate: d.supplierDepartureCodeCandidate ?? null,
      matchingTraceRaw: d.matchingTraceRaw ?? null,
      transportType: d.transportType ?? null,
      boardingPlace: d.boardingPlace ?? null,
      departureTimeText: d.departureTimeText ?? null,
      returnTimeText: d.returnTimeText ?? null,
      vehicleNote: d.vehicleNote ?? null,
      transportSegmentRaw: d.transportSegmentRaw ?? null,
      supplierPriceKey: d.supplierPriceKey ?? null,
    }
  })
}
