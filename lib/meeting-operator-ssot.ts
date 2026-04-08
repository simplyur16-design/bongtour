/**
 * 등록 파이프라인: 본문/LLM/출발행 미팅 원문은 structuredSignals에 저장하지 않는다.
 * 공개 미팅 문구 SSOT는 `meeting-airline-operational-ssot` 의 항공사별 사전 정의값만 사용한다.
 */

export const DEFAULT_MEETING_FALLBACK = '미팅장소는 상담 시 확인하여 안내드리겠습니다.'

/** 등록 파싱 결과에서 본문 기반 미팅·출발행 미팅 주입 제거 */
export function stripBodyDerivedMeetingFromRegisterParsed<T extends { prices?: unknown }>(parsed: T): T {
  const prices = Array.isArray(parsed.prices)
    ? (parsed.prices as Array<Record<string, unknown>>).map((p) => ({
        ...p,
        meetingInfoRaw: null,
        meetingPointRaw: null,
        meetingTerminalRaw: null,
        meetingGuideNoticeRaw: null,
      }))
    : parsed.prices
  return {
    ...parsed,
    meetingInfoRaw: null,
    meetingPlaceRaw: null,
    meetingNoticeRaw: null,
    meetingFallbackText: null,
    prices: prices as T['prices'],
  }
}

/**
 * mergeRawMeta 시: 파서 meeting* / 레거시 meetingOperatorFinal 저장 안 함.
 */
export function attachPreservedMeetingOperatorToStructuredSignals(
  _base: Record<string, unknown>,
  structuredFromParse: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...structuredFromParse,
    meetingInfoRaw: null,
    meetingPlaceRaw: null,
    meetingNoticeRaw: null,
    meetingFallbackText: null,
    meetingOperatorFinal: null,
  }
}
