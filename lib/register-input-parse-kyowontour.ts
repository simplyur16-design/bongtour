/**
 * 교보이지(kyowontour) 관리자 등록 — 옵션관광·쇼핑·항공 **입력 해석** 전용 진입점.
 * 과거 `yellowballoon` 등록 경로는 노랑풍선 핸들러와 파서 계열을 공유한다(이행 참고).
 */
import type { FlightStructured, OptionalToursStructured, ShoppingStructured } from '@/lib/detail-body-parser-types'
import { parseFlightSectionKyowontour } from '@/lib/flight-parser-kyowontour'
import {
  filterKyowontourOptionalTourRows,
  parseKyowontourOptionalTourPasteSection,
  kyowontourOptionalPasteDominatesUnstructured,
} from '@/lib/register-kyowontour-options'
import { sanitizeKyowontourShoppingStructured } from '@/lib/register-kyowontour-shopping'
import {
  parseUnstructuredOptionalTourBodyForRegister,
  parseUnstructuredShoppingBodyForRegister,
} from '@/lib/register-input-unstructured-body-kyowontour'

export function parseKyowontourOptionalInput(optionalSection: string): OptionalToursStructured {
  const optionalParsed = parseUnstructuredOptionalTourBodyForRegister(optionalSection)
  const optionalPasteParsed = parseKyowontourOptionalTourPasteSection(optionalSection)
  const useKyowontourOptionalPaste = kyowontourOptionalPasteDominatesUnstructured(
    optionalSection,
    optionalPasteParsed.rows.length
  )
  return useKyowontourOptionalPaste
    ? {
        rows: filterKyowontourOptionalTourRows(optionalPasteParsed.rows),
        reviewNeeded: optionalPasteParsed.reviewNeeded,
        reviewReasons: optionalPasteParsed.reviewReasons,
      }
    : {
        ...optionalParsed,
        rows: filterKyowontourOptionalTourRows(optionalParsed.rows),
      }
}

export function parseKyowontourShoppingInput(
  shoppingSection: string,
  shoppingPasteRaw: string | null | undefined
): ShoppingStructured {
  return sanitizeKyowontourShoppingStructured(
    shoppingSection,
    parseUnstructuredShoppingBodyForRegister(shoppingSection),
    shoppingPasteRaw?.trim() || null
  )
}

export function parseKyowontourFlightInput(
  flightSection: string,
  fullBodyNormalized: string | null | undefined
): FlightStructured {
  return parseFlightSectionKyowontour(flightSection, fullBodyNormalized)
}
