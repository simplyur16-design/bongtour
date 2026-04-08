/**
 * 미팅정보 최종 SSOT: `ICN_TERMINAL_MAP_BY_AIRLINE_KEY` 기반 사전 정의 운영 메타만 사용.
 * 본문·입력란·rawMeta.meetingOperatorFinal·출발행 DB 미팅 필드는 노출에 사용하지 않는다.
 */
import { ICN_TERMINAL_MAP_BY_AIRLINE_KEY, resolveAirlineTerminalKey } from '@/lib/meeting-terminal-rules'
import { DEFAULT_MEETING_FALLBACK } from '@/lib/meeting-operator-ssot'

export function pickPrimaryAirlineNameForOperationalMeeting(args: {
  departureCarrierFirst: string | null | undefined
  structuredAirlineName: string | null | undefined
  productAirline: string | null | undefined
}): string | null {
  const a = args.departureCarrierFirst?.trim()
  if (a) return a
  const b = args.structuredAirlineName?.trim()
  if (b) return b
  return args.productAirline?.trim() || null
}

export function resolveOperationalMeetingDisplay(airlineName: string | null | undefined): {
  meetingInfoRaw: string | null
  meetingPlaceRaw: string | null
  meetingNoticeRaw: string | null
  meetingFallbackText: string | null
} {
  const key = resolveAirlineTerminalKey(airlineName)
  if (!key) {
    return {
      meetingInfoRaw: null,
      meetingPlaceRaw: null,
      meetingNoticeRaw: null,
      meetingFallbackText: DEFAULT_MEETING_FALLBACK,
    }
  }
  const info = ICN_TERMINAL_MAP_BY_AIRLINE_KEY[key]
  if (!info) {
    return {
      meetingInfoRaw: null,
      meetingPlaceRaw: null,
      meetingNoticeRaw: null,
      meetingFallbackText: DEFAULT_MEETING_FALLBACK,
    }
  }
  const tLabel = info.terminal === 'T1' ? '제1터미널' : '제2터미널'
  const meetingInfoRaw = `인천공항 ${tLabel} 출발 예정 · ${info.airline_name_kr} 체크인 ${info.checkin_counter} 구역.`
  return {
    meetingInfoRaw,
    meetingPlaceRaw: null,
    meetingNoticeRaw: null,
    meetingFallbackText: null,
  }
}
