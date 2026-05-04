/**
 * 롯데관광(lottetour) 관리자 등록 — 옵션관광·쇼핑·항공 **입력 해석** 전용 진입점.
 * 레거시 식별자 `yellowballoon`도 동일 lottetour 핸들러·파서를 탄다.
 */
import type { FlightStructured, OptionalToursStructured, ShoppingStructured } from '@/lib/detail-body-parser-types'
import { parseFlightSectionLottetour } from '@/lib/flight-parser-lottetour'
import {
  filterLottetourOptionalTourRows,
  parseLottetourOptionalTourPasteSection,
  lottetourOptionalPasteDominatesUnstructured,
} from '@/lib/register-lottetour-options'
import { sanitizeLottetourShoppingStructured } from '@/lib/register-lottetour-shopping'
import {
  parseUnstructuredOptionalTourBodyForRegister,
  parseUnstructuredShoppingBodyForRegister,
} from '@/lib/register-input-unstructured-body-lottetour'

export function parseLottetourOptionalInput(optionalSection: string): OptionalToursStructured {
  const optionalParsed = parseUnstructuredOptionalTourBodyForRegister(optionalSection)
  const optionalPasteParsed = parseLottetourOptionalTourPasteSection(optionalSection)
  const useLottetourOptionalPaste = lottetourOptionalPasteDominatesUnstructured(
    optionalSection,
    optionalPasteParsed.rows.length
  )
  return useLottetourOptionalPaste
    ? {
        rows: filterLottetourOptionalTourRows(optionalPasteParsed.rows),
        reviewNeeded: optionalPasteParsed.reviewNeeded,
        reviewReasons: optionalPasteParsed.reviewReasons,
      }
    : {
        ...optionalParsed,
        rows: filterLottetourOptionalTourRows(optionalParsed.rows),
      }
}

export function parseLottetourShoppingInput(
  shoppingSection: string,
  shoppingPasteRaw: string | null | undefined
): ShoppingStructured {
  return sanitizeLottetourShoppingStructured(
    shoppingSection,
    parseUnstructuredShoppingBodyForRegister(shoppingSection),
    shoppingPasteRaw?.trim() || null
  )
}

export function parseLottetourFlightInput(
  flightSection: string,
  fullBodyNormalized: string | null | undefined
): FlightStructured {
  return parseFlightSectionLottetour(flightSection, fullBodyNormalized)
}
