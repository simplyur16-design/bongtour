/**
 * 롯데관광(naeiltour) 관리자 등록 — 옵션관광·쇼핑·항공 **입력 해석** 전용 진입점.
 * 레거시 식별자 `yellowballoon`도 동일 naeiltour 핸들러·파서를 탄다.
 */
import type { FlightStructured, OptionalToursStructured, ShoppingStructured } from '@/lib/detail-body-parser-types'
import { parseFlightSectionNaeiltour } from '@/lib/flight-parser-naeiltour'
import {
  filterNaeiltourOptionalTourRows,
  parseNaeiltourOptionalTourPasteSection,
  naeiltourOptionalPasteDominatesUnstructured,
} from '@/lib/register-naeiltour-options'
import { sanitizeNaeiltourShoppingStructured } from '@/lib/register-naeiltour-shopping'
import {
  parseUnstructuredOptionalTourBodyForRegister,
  parseUnstructuredShoppingBodyForRegister,
} from '@/lib/register-input-unstructured-body-naeiltour'

export function parseNaeiltourOptionalInput(optionalSection: string): OptionalToursStructured {
  const optionalParsed = parseUnstructuredOptionalTourBodyForRegister(optionalSection)
  const optionalPasteParsed = parseNaeiltourOptionalTourPasteSection(optionalSection)
  const useNaeiltourOptionalPaste = naeiltourOptionalPasteDominatesUnstructured(
    optionalSection,
    optionalPasteParsed.rows.length
  )
  return useNaeiltourOptionalPaste
    ? {
        rows: filterNaeiltourOptionalTourRows(optionalPasteParsed.rows),
        reviewNeeded: optionalPasteParsed.reviewNeeded,
        reviewReasons: optionalPasteParsed.reviewReasons,
      }
    : {
        ...optionalParsed,
        rows: filterNaeiltourOptionalTourRows(optionalParsed.rows),
      }
}

export function parseNaeiltourShoppingInput(
  shoppingSection: string,
  shoppingPasteRaw: string | null | undefined
): ShoppingStructured {
  return sanitizeNaeiltourShoppingStructured(
    shoppingSection,
    parseUnstructuredShoppingBodyForRegister(shoppingSection),
    shoppingPasteRaw?.trim() || null
  )
}

export function parseNaeiltourFlightInput(
  flightSection: string,
  fullBodyNormalized: string | null | undefined
): FlightStructured {
  return parseFlightSectionNaeiltour(flightSection, fullBodyNormalized)
}
