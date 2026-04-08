/**
 * 텍스트 전용 메시지 생성. 아이콘·감성 문구 없이 정보만 전달.
 */

import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'

export type BookingForMessage = {
  productTitle: string
  selectedDate: Date | string
  adultCount: number
  childBedCount: number
  childNoBedCount: number
  infantCount: number
  totalKrwAmount: number
  totalLocalAmount: number
  localCurrency: string
  customerName: string
  customerPhone: string
  product?: {
    originSource: string
    originCode: string
    title: string
  } | null
}

export type AdminBookingAlertMessagePayload = {
  customerName: string
  customerPhone: string
  customerEmail: string
  productTitle?: string | null
  originSource: string
  preferredOrSelectedDate: string | null
  paxSummary: string
  singleRoomRequested: boolean
  preferredContactChannel: 'phone' | 'kakao' | 'email'
  childInfantBirthDates: string[]
  requestNotes: string | null
  adminLink: string
}

/** 인원 구성: 0보다 큰 항목만 나열. 예: "성인 2, 아동(노베드) 1" */
export function formatPaxSummary(booking: BookingForMessage): string {
  const parts: string[] = []
  if (booking.adultCount > 0) parts.push(`성인 ${booking.adultCount}`)
  if (booking.childBedCount > 0) parts.push(`아동(베드) ${booking.childBedCount}`)
  if (booking.childNoBedCount > 0) parts.push(`아동(노베드) ${booking.childNoBedCount}`)
  if (booking.infantCount > 0) parts.push(`유아 ${booking.infantCount}`)
  return parts.length ? parts.join(', ') : '0'
}

/** 출발일: YYYY년 MM월 DD일(요일) */
export function formatDepartureDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const weekdays = ['일', '월', '화', '수', '목', '금', '토']
  const weekday = weekdays[d.getDay()]
  return `${y}년 ${m}월 ${day}일(${weekday})`
}

/**
 * 견적 병기: 한국 결제액과 현지 지불 외화를 합산하지 않음.
 * 포맷: ${formattedKrw}원 + ${currencySymbol}${totalLocal}
 * 모든 금액 천 단위 콤마 적용.
 */
export function formatTotalQuotation(
  totalKrw: number,
  totalLocal: number,
  localCurrency: string
): string {
  const formattedKrw = totalKrw.toLocaleString('ko-KR')
  const formattedLocal = totalLocal.toLocaleString('ko-KR')
  return `${formattedKrw}원 + ${localCurrency}${formattedLocal}`
}

/**
 * 관리자 SMS 알림 (한 줄 포맷, 솔라피 즉시 전송용)
 * 스펙: [Bong투어] ${여행사}/${코드}/${상품명} - 날짜: ${날짜} - 인원: ${인원구성} - 견적: ${원화합계}+${외화합계}
 */
export function buildAdminNotificationMessage(booking: BookingForMessage): string {
  const originSource = formatOriginSourceForDisplay(booking.product?.originSource) || '-'
  const originCode = booking.product?.originCode ?? '-'
  const title = (booking.product?.title ?? booking.productTitle).slice(0, 40)
  const formattedDate = formatDepartureDate(booking.selectedDate)
  const paxSummary = formatPaxSummary(booking)
  const totalQuotation = formatTotalQuotation(
    booking.totalKrwAmount,
    booking.totalLocalAmount,
    booking.localCurrency
  )
  return `[Bong투어] ${originSource}/${originCode}/${title} - 날짜: ${formattedDate} - 인원: ${paxSummary} - 견적: ${totalQuotation}`
}

/**
 * 예약 접수 DTO 기반 관리자 알림 메시지.
 * PII 최소화 원칙: 필요 정보만 포함.
 */
export function buildAdminNotificationMessageFromPayload(p: AdminBookingAlertMessagePayload): string {
  const title = (p.productTitle ?? '').slice(0, 40)
  const birth = p.childInfantBirthDates.length > 0 ? p.childInfantBirthDates.join(', ') : '-'
  const date = p.preferredOrSelectedDate ?? '-'
  const note = (p.requestNotes ?? '-').slice(0, 80)
  const singleRoom = p.singleRoomRequested ? '1인실 요청' : '1인실 미요청'
  const originLabel = formatOriginSourceForDisplay(p.originSource) || p.originSource
  return `[Bong투어예약접수] ${originLabel}/${title} - 고객:${p.customerName} (${p.customerPhone}) - 이메일:${p.customerEmail} - 출발:${date} - 인원:${p.paxSummary} - 연락선호:${p.preferredContactChannel} - ${singleRoom} - 아동/유아생년:${birth} - 요청:${note} - 링크:${p.adminLink}`
}
