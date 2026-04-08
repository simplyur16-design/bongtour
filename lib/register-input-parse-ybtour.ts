/**
 * 노랑풍선(ybtour) 관리자 등록 — 옵션관광·쇼핑·항공 **입력 해석** 전용 진입점.
 * 레거시 API `yellowballoon`도 동일 ybtour 핸들러·파서를 탄다.
 */
import type { FlightStructured, OptionalToursStructured, ShoppingStructured } from '@/lib/detail-body-parser-types'
import { parseFlightSectionYbtour } from '@/lib/flight-parser-ybtour'
import {
  filterYbtourOptionalTourRows,
  parseYbtourOptionalTourPasteSection,
  ybtourOptionalPasteDominatesUnstructured,
} from '@/lib/register-ybtour-options'
import { sanitizeYbtourShoppingStructured } from '@/lib/register-ybtour-shopping'
import {
  parseUnstructuredOptionalTourBodyForRegister,
  parseUnstructuredShoppingBodyForRegister,
} from '@/lib/register-input-unstructured-body-ybtour'

export function parseYbtourOptionalInput(optionalSection: string): OptionalToursStructured {
  const optionalParsed = parseUnstructuredOptionalTourBodyForRegister(optionalSection)
  const optionalPasteParsed = parseYbtourOptionalTourPasteSection(optionalSection)
  const useYbtourOptionalPaste = ybtourOptionalPasteDominatesUnstructured(
    optionalSection,
    optionalPasteParsed.rows.length
  )
  return useYbtourOptionalPaste
    ? {
        rows: filterYbtourOptionalTourRows(optionalPasteParsed.rows),
        reviewNeeded: optionalPasteParsed.reviewNeeded,
        reviewReasons: optionalPasteParsed.reviewReasons,
      }
    : {
        ...optionalParsed,
        rows: filterYbtourOptionalTourRows(optionalParsed.rows),
      }
}

export function parseYbtourShoppingInput(
  shoppingSection: string,
  shoppingPasteRaw: string | null | undefined
): ShoppingStructured {
  return sanitizeYbtourShoppingStructured(
    shoppingSection,
    parseUnstructuredShoppingBodyForRegister(shoppingSection),
    shoppingPasteRaw?.trim() || null
  )
}

export function parseYbtourFlightInput(
  flightSection: string,
  fullBodyNormalized: string | null | undefined
): FlightStructured {
  return parseFlightSectionYbtour(flightSection, fullBodyNormalized)
}
