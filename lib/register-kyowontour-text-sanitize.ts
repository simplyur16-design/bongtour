/**
 * 교보이지 등록 분석 결과 — 항공 라벨 문자열 모지바케 방어.
 * 깨진 원문을 `??`로 되살리지 않는다(sanitize 실패 시 null).
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-kyowontour'
import type { FlightStructured } from '@/lib/detail-body-parser-types'
import { normalizeYbtourFlightLabelStrict } from '@/lib/text-encoding-guard'

function sanitizeFlightStructured(fs: FlightStructured): FlightStructured {
  return {
    ...fs,
    airlineName: normalizeYbtourFlightLabelStrict(fs.airlineName),
  }
}

export function sanitizeKyowontourRegisterParsedStrings(parsed: RegisterParsed): RegisterParsed {
  const base = parsed.detailBodyStructured
  const nextDetail =
    base && base.flightStructured
      ? { ...base, flightStructured: sanitizeFlightStructured(base.flightStructured) }
      : base
  return {
    ...parsed,
    airlineName: normalizeYbtourFlightLabelStrict(parsed.airlineName),
    airline: normalizeYbtourFlightLabelStrict(parsed.airline),
    departureSegmentText: normalizeYbtourFlightLabelStrict(parsed.departureSegmentText),
    returnSegmentText: normalizeYbtourFlightLabelStrict(parsed.returnSegmentText),
    detailBodyStructured: nextDetail,
  }
}
