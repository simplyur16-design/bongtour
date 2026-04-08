/**
 * 참좋은여행(verygoodtour) 관리자 등록 — 옵션관광·쇼핑·항공 **입력 해석** 전용 진입점.
 */
import type { FlightStructured, OptionalToursStructured, ShoppingStructured } from '@/lib/detail-body-parser-types'
import { parseFlightSectionVerygoodtour } from '@/lib/flight-parser-verygoodtour'
import {
  filterVerygoodOptionalTourRows,
  parseVerygoodOptionalTourPasteSection,
  verygoodOptionalPasteDominatesUnstructured,
} from '@/lib/register-verygoodtour-options'
import { sanitizeVerygoodShoppingStructured } from '@/lib/register-verygoodtour-shopping'
import {
  parseUnstructuredOptionalTourBodyForRegister,
  parseUnstructuredShoppingBodyForRegister,
} from '@/lib/register-input-unstructured-body-verygoodtour'

export function parseVerygoodtourOptionalInput(optionalSection: string): OptionalToursStructured {
  const optionalParsed = parseUnstructuredOptionalTourBodyForRegister(optionalSection)
  const optionalPasteParsed = parseVerygoodOptionalTourPasteSection(optionalSection)
  const useVerygoodOptionalPaste = verygoodOptionalPasteDominatesUnstructured(
    optionalSection,
    optionalPasteParsed.rows.length
  )
  return useVerygoodOptionalPaste
    ? {
        rows: filterVerygoodOptionalTourRows(optionalPasteParsed.rows),
        reviewNeeded: optionalPasteParsed.reviewNeeded,
        reviewReasons: optionalPasteParsed.reviewReasons,
      }
    : {
        ...optionalParsed,
        rows: filterVerygoodOptionalTourRows(optionalParsed.rows),
      }
}

export function parseVerygoodtourShoppingInput(
  shoppingSection: string,
  shoppingPasteRaw: string | null | undefined
): ShoppingStructured {
  return sanitizeVerygoodShoppingStructured(
    shoppingSection,
    parseUnstructuredShoppingBodyForRegister(shoppingSection),
    shoppingPasteRaw?.trim() || null
  )
}

export function parseVerygoodtourFlightInput(
  flightSection: string,
  fullBodyNormalized: string | null | undefined
): FlightStructured {
  return parseFlightSectionVerygoodtour(flightSection, fullBodyNormalized)
}
