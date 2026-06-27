import type { FlightStructured } from '@/lib/detail-body-parser-types'
import { parseFlightSectionGeneric } from '@/lib/flight-parser-generic'

/**
 * 내일투어(naeiltour) 관리자 항공 붙여넣기 — API/tab1 구조화가 SSOT이며,
 * 수동 붙여넣기는 generic 후보 스캔으로 보조 추출한다.
 */
export function parseFlightSectionNaeiltour(
  section: string,
  fullBodyForSecondary: string | null | undefined
): FlightStructured {
  return parseFlightSectionGeneric(section, fullBodyForSecondary, {
    expectFlightNumber: true,
    supplierBrandKey: 'naeiltour',
    genericFlightFallbackNote: '내일투어 항공 붙여넣기 — generic fallback',
  })
}
