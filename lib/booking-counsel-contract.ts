/**
 * 상담 채널(카카오 오픈채팅 등)과 운영 알림에서 공유하는 **고정 vs 변동** 계약.
 * - 고정(A): 상품·출발일·인원·접수 id·페이지·메모 — 상담 요약·접수 SSOT의 중심.
 * - 변동(B): 가격·견적·일정 상태·수집 플래그 등 — 참고 블록으로만 덧붙임(절대값 고정 금지).
 */
import { formatOriginSourceForDisplay } from '@/lib/supplier-origin'

export type CounselPaxBreakdown = {
  adult: number
  childBed: number
  childNoBed: number
  infant: number
}

/** 상담 요약·채널 공통 고정 스냅샷 */
export type OperatorCounselFixedSnapshot = {
  /** 채널 첫 줄 배너, 예: `[예약 상담]` */
  channelBanner: string
  productSystemId: string
  /** 공급사 노출 상품코드(리스트) */
  originCode: string
  /** 리스트 번호 별도 표기 시(없으면 originCode 사용) */
  productListingOverride?: string | null
  productTitle: string
  /** 공급사 표시용(한글 라벨 등) */
  originSourceDisplay: string
  selectedDepartureDateYmd: string | null
  selectedDepartureRowId: string | null
  preferredDepartureDateYmd: string | null
  pax: CounselPaxBreakdown
  bookingRequestId: number | null
  pageUrl: string | null
  /** 접수/상세에서 넘기는 고객 메모(있을 때만) */
  customerMemo: string | null
}

/** 가격·상태 등 변동 — 요약 하단 참고 블록 */
export type OperatorCounselVolatileAppendix = {
  quotationKrwTotal: number | null
  localFeePerPerson: number | null
  localFeeCurrency: string | null
  advisoryLabel: string | null
  pricingMode: string | null
  isCollectingPrices: boolean
}

export function formatCounselPaxLine(pax: CounselPaxBreakdown): string {
  if (pax.adult + pax.childBed + pax.childNoBed + pax.infant <= 0) {
    return '성인 / 아동 / 유아'
  }
  return `성인 ${pax.adult} / 아동 ${pax.childBed + pax.childNoBed} / 유아 ${pax.infant}`
}

function buildVolatileAppendixLines(v: OperatorCounselVolatileAppendix): string[] {
  const lines: string[] = ['', '--- 참고(실시간·변동 가능) ---']
  if (v.advisoryLabel?.trim()) {
    lines.push(`일정·접수 상태(참고): ${v.advisoryLabel.trim()}`)
  }
  if (v.isCollectingPrices) {
    lines.push('출발일 정보 수집 중: 예')
  }
  if (v.pricingMode?.trim()) {
    lines.push(`pricingMode(참고): ${v.pricingMode.trim()}`)
  }
  if (v.quotationKrwTotal != null && Number.isFinite(v.quotationKrwTotal)) {
    lines.push(`견적 합계(참고·변동): ₩${v.quotationKrwTotal.toLocaleString('ko-KR')}`)
  } else {
    lines.push('견적 합계(참고·변동): (미산정 또는 상담 후 확정)')
  }
  if (v.localFeePerPerson != null && v.localFeeCurrency?.trim()) {
    lines.push(
      `현지비(인당·참고): ${v.localFeeCurrency.trim()} ${v.localFeePerPerson.toLocaleString('ko-KR')}`
    )
  }
  return lines
}

/**
 * 운영자·고객이 채팅에 붙여넣을 **상담 요약 본문** SSOT.
 * 카카오/네이버 동일 본문을 쓰고, 채널별로 `channelBanner`만 바꾼다.
 */
export function buildOperatorCounselSummaryBody(
  fixed: OperatorCounselFixedSnapshot,
  volatile?: OperatorCounselVolatileAppendix | null
): string {
  const listing =
    (fixed.productListingOverride ?? fixed.originCode ?? '').trim() ||
    String(fixed.productSystemId).trim()
  const listingLine = `상품번호(리스트·노출): ${listing || '(미지정)'}`

  const departureHint =
    fixed.selectedDepartureDateYmd?.trim() ||
    fixed.preferredDepartureDateYmd?.trim() ||
    ''
  const rowId = (fixed.selectedDepartureRowId ?? '').trim()
  const bookingLine =
    fixed.bookingRequestId != null && Number.isFinite(Number(fixed.bookingRequestId))
      ? `접수번호: ${fixed.bookingRequestId}`
      : null
  const link = fixed.pageUrl?.trim() || '상품 링크 확인 필요'
  const memo = (fixed.customerMemo ?? '').trim()
  const memoBlock =
    memo.length > 0
      ? ['', '고객 요청·메모:', memo]
      : ['', '고객 요청·메모:', '(없음)']

  const core = [
    fixed.channelBanner,
    '',
    `상품번호(시스템): ${fixed.productSystemId}`,
    listingLine,
    `상품명: ${fixed.productTitle}`,
    `공급사: ${fixed.originSourceDisplay}`,
    `상품링크: ${link}`,
    '',
    `선택 출발일: ${departureHint || '(미지정)'}`,
    `인원 구성: ${formatCounselPaxLine(fixed.pax)}`,
    rowId ? `선택 출발행 ID: ${rowId}` : null,
    bookingLine,
    ...memoBlock,
    '',
    '전화번호(권장):',
    '문의 내용:',
  ].filter((x): x is string => Boolean(x))

  if (
    volatile &&
    (volatile.advisoryLabel?.trim() ||
      volatile.isCollectingPrices ||
      volatile.pricingMode?.trim() ||
      volatile.quotationKrwTotal != null ||
      (volatile.localFeePerPerson != null && volatile.localFeeCurrency?.trim()))
  ) {
    return [...core, ...buildVolatileAppendixLines(volatile)].join('\n')
  }
  return core.join('\n')
}

/** kakao-counsel 등에서 originSource 문자열을 표시용으로 통일 */
export function counselOriginDisplay(originSource: string): string {
  return formatOriginSourceForDisplay(originSource) || originSource.trim() || '-'
}

/** 카카오·네이버 등 채널 공통 입력(고정 + 변동 원천) */
export type CounselChannelCommonInput = {
  productId: string
  originCode: string
  listingProductNumber?: string | null
  productTitle: string
  originSource: string
  selectedDepartureDate?: string | null
  selectedDepartureId?: string | null
  preferredDepartureDate?: string | null
  pax: CounselPaxBreakdown
  bookingId?: number | null
  pageUrl?: string | null
  customerMemo?: string | null
  advisoryLabel?: string | null
  pricingMode?: string | null
  isCollectingPrices?: boolean
  quotationKrwTotal?: number | null
  localFeePerPerson?: number | null
  localFeeCurrency?: string | null
}

export function buildCounselChannelSummary(channelBanner: string, input: CounselChannelCommonInput): string {
  const fixed: OperatorCounselFixedSnapshot = {
    channelBanner,
    productSystemId: String(input.productId),
    originCode: input.originCode,
    productListingOverride: input.listingProductNumber ?? null,
    productTitle: input.productTitle,
    originSourceDisplay: counselOriginDisplay(input.originSource),
    selectedDepartureDateYmd: input.selectedDepartureDate?.trim() || null,
    selectedDepartureRowId: input.selectedDepartureId?.trim() || null,
    preferredDepartureDateYmd: input.preferredDepartureDate?.trim() || null,
    pax: input.pax,
    bookingRequestId: input.bookingId ?? null,
    pageUrl: input.pageUrl ?? null,
    customerMemo: input.customerMemo ?? null,
  }
  const hasVolatile =
    (input.advisoryLabel ?? '').trim().length > 0 ||
    Boolean(input.isCollectingPrices) ||
    (input.pricingMode ?? '').trim().length > 0 ||
    input.quotationKrwTotal != null ||
    (input.localFeePerPerson != null && (input.localFeeCurrency ?? '').trim())
  const volatile: OperatorCounselVolatileAppendix | null = hasVolatile
    ? {
        quotationKrwTotal: input.quotationKrwTotal ?? null,
        localFeePerPerson: input.localFeePerPerson ?? null,
        localFeeCurrency: input.localFeeCurrency ?? null,
        advisoryLabel: input.advisoryLabel ?? null,
        pricingMode: input.pricingMode ?? null,
        isCollectingPrices: Boolean(input.isCollectingPrices),
      }
    : null
  return buildOperatorCounselSummaryBody(fixed, volatile)
}
