/**
 * 모두투어(modetour) 관리자 등록 — 옵션관광·쇼핑·항공 **입력 해석** 전용 진입점.
 * 비정형 옵션·쇼핑 본문은 `parseUnstructured*ForRegister`만 조합해 소비한다.
 */
import type { FlightStructured, OptionalToursStructured, ShoppingStructured } from '@/lib/detail-body-parser-types'
import { parseFlightSectionModetour } from '@/lib/flight-parser-modetour'
import {
  filterModetourOptionalTourRows,
  modetourOptionalPasteDominatesUnstructured,
  parseModetourOptionalTourPasteSection,
} from '@/lib/register-modetour-options'
import { sanitizeModetourShoppingStructured } from '@/lib/register-modetour-shopping'
import {
  parseUnstructuredOptionalTourBodyForRegister,
  parseUnstructuredShoppingBodyForRegister,
} from '@/lib/register-input-unstructured-body-modetour'

export function parseModetourOptionalInput(optionalSection: string): OptionalToursStructured {
  const optionalParsed = parseUnstructuredOptionalTourBodyForRegister(optionalSection)
  const optionalPasteParsed = parseModetourOptionalTourPasteSection(optionalSection)
  const useModetourOptionalPaste = modetourOptionalPasteDominatesUnstructured(
    optionalSection,
    optionalPasteParsed.rows.length
  )
  return useModetourOptionalPaste
    ? {
        rows: filterModetourOptionalTourRows(optionalPasteParsed.rows),
        reviewNeeded: optionalPasteParsed.reviewNeeded,
        reviewReasons: optionalPasteParsed.reviewReasons,
      }
    : {
        ...optionalParsed,
        rows: filterModetourOptionalTourRows(optionalParsed.rows),
      }
}

export function parseModetourShoppingInput(
  shoppingSection: string,
  shoppingPasteRaw: string | null | undefined
): ShoppingStructured {
  return sanitizeModetourShoppingStructured(
    shoppingSection,
    parseUnstructuredShoppingBodyForRegister(shoppingSection),
    shoppingPasteRaw?.trim() || null
  )
}

export function parseModetourFlightInput(
  flightSection: string,
  fullBodyNormalized: string | null | undefined
): FlightStructured {
  return parseFlightSectionModetour(flightSection, fullBodyNormalized)
}
