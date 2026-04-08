/**
 * @deprecated 세부 구현은 `flight-preferred-legs-*`, `flight-verygoodtour-pipe-leg`로 분리됨.
 * 기존 import 경로 호환용 re-export만 유지한다.
 */
export type { PreferredFlightLegs } from '@/lib/flight-preferred-legs-types'
export type { VerygoodTourPipeLeg } from '@/lib/flight-verygoodtour-pipe-leg'
export { tryParseVerygoodTourPipeJoinedLeg } from '@/lib/flight-verygoodtour-pipe-leg'
