/**
 * 출발일·요금 on-demand 수집 중 **UI 문구·단계**만 정의한다.
 * 공급사 스크래퍼/어댑터 로직과 분리 — 프론트 표시·상태 공통화용.
 */

/** 8~15초 권장 범위의 중간값: 이 시간 경과 시 지연 안내(2단계) 표시 */
export const DEPARTURE_COLLECT_UI_DELAYED_AFTER_MS = 12_000

export type DeparturePriceCollectUiPhase = 'idle' | 'collecting' | 'delayed_collecting' | 'pending_quote'

export function resolveDeparturePriceCollectUiPhase(
  collecting: boolean,
  collectingDelayed: boolean,
  pendingQuoteNoRow: boolean
): DeparturePriceCollectUiPhase {
  if (collecting) {
    return collectingDelayed ? 'delayed_collecting' : 'collecting'
  }
  if (pendingQuoteNoRow) return 'pending_quote'
  return 'idle'
}

/** 오버레이·카드·모달에서 동일 톤으로 사용 */
export const departurePriceCollectUiCopy = {
  /** 1단계 — 제목 */
  overlayTitlePrimary: '가격을 확인하고 있습니다.',
  /** 1단계 — 본문 */
  overlayBodyPrimary: '선택하신 날짜 기준으로 요금을 확인 중입니다.',
  /** 2단계 — 지연 안내(과장 없이) */
  overlayDelayLine1: '선택하신 날짜의 요금을 확인하고 있습니다.',
  overlayDelayLine2: '확인에 시간이 다소 걸릴 수 있습니다.',
  overlayDelayLine3: '담당자가 예약 가능 금액을 확인해 전화로 연락드리겠습니다.',
  /** 접수 차단이 아님을 분명히 */
  overlayContinueBookingCta: '예약 요청 접수 진행하기',
  overlayContinueBookingHint: '요금 확인이 끝나기 전에도 접수 폼을 열 수 있습니다. 선택하신 상품·날짜·인원은 그대로 반영됩니다.',
  /** 카드·모달 상단 */
  modalBannerCollecting: '선택하신 날짜의 요금을 확인하고 있습니다. 접수는 지금도 가능합니다.',
  modalBannerDelayed:
    '요금 확인이 다소 지연되고 있습니다. 담당자가 예약 가능 금액을 확인해 연락드릴 수 있습니다. 접수는 계속 진행해 주세요.',
  cardCollectingPrimary: '요금을 확인하고 있습니다.',
  cardCollectingDelayed: '확인에 시간이 다소 걸릴 수 있습니다. 담당자가 금액 확인 후 연락드릴 수 있습니다.',
  cardPendingQuoteHint:
    '해당 출발일 요금 행이 아직 없을 수 있습니다. 접수는 가능하며, 금액은 담당자 확인 후 안내됩니다.',
  ctaHintWhileCollecting: '요금 확인 중이어도 아래 버튼으로 상담 요약을 보낼 수 있습니다.',
  ctaHintPendingQuote: '금액 행이 없어도 상품번호·출발일·인원은 요약에 포함됩니다.',
} as const
