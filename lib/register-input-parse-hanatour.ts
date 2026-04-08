/**
 * 하나투어(hanatour) 관리자 등록 — 옵션관광·쇼핑·항공 **입력 해석** 전용 진입점.
 */
import type { FlightStructured, OptionalToursStructured, ShoppingStructured } from '@/lib/detail-body-parser-types'
import { parseFlightSectionHanatour } from '@/lib/flight-parser-hanatour'
import {
  filterHanatourOptionalTourRows,
  parseHanatourOptionalTourPasteSection,
} from '@/lib/register-hanatour-options'
import {
  EMPTY_HANATOUR_SHOPPING,
  sanitizeHanatourShoppingStructured,
} from '@/lib/register-hanatour-shopping'
import {
  parseUnstructuredOptionalTourBodyForRegister,
  parseUnstructuredShoppingBodyForRegister,
} from '@/lib/register-input-unstructured-body-hanatour'

export function parseHanatourOptionalInput(optionalSection: string): OptionalToursStructured {
  const optionalParsed = parseUnstructuredOptionalTourBodyForRegister(optionalSection)
  const optionalPasteParsed = parseHanatourOptionalTourPasteSection(optionalSection)
  const useHanatourOptionalPaste = optionalPasteParsed.rows.length > 0
  return useHanatourOptionalPaste
    ? {
        rows: filterHanatourOptionalTourRows(optionalPasteParsed.rows),
        reviewNeeded: optionalPasteParsed.reviewNeeded,
        reviewReasons: optionalPasteParsed.reviewReasons,
      }
    : {
        ...optionalParsed,
        rows: filterHanatourOptionalTourRows(optionalParsed.rows),
      }
}

export function parseHanatourShoppingInput(
  shoppingSection: string,
  shoppingPasteRaw: string | null | undefined
): ShoppingStructured {
  if (!shoppingPasteRaw?.trim()) {
    return { ...EMPTY_HANATOUR_SHOPPING }
  }
  return sanitizeHanatourShoppingStructured(
    shoppingSection,
    parseUnstructuredShoppingBodyForRegister(shoppingSection),
    shoppingPasteRaw.trim()
  )
}

/** `출발 :` → outbound, `도착 :` → inbound(하나투어 전용 라벨 예외). */
export function parseHanatourFlightInput(
  flightSection: string,
  fullBodyNormalized: string | null | undefined
): FlightStructured {
  return parseFlightSectionHanatour(flightSection, fullBodyNormalized)
}
