/**
 * 공항 픽업/샌딩 포함 여부 — 등록 본문·포함/불포함 원문에서 파악(SSOT).
 * 자유여행(airtel) 표시·등록 모두 동일 규칙을 쓴다.
 */
export type AirportTransferType = 'NONE' | 'PICKUP' | 'SENDING' | 'BOTH'

const VALID_AIRPORT_TRANSFER_TYPES = new Set<string>(['NONE', 'PICKUP', 'SENDING', 'BOTH'])

export function isValidAirportTransferType(value: string | null | undefined): value is AirportTransferType {
  return typeof value === 'string' && VALID_AIRPORT_TRANSFER_TYPES.has(value)
}

export function inferAirportTransferTypeFromText(
  rawText: string | null | undefined
): AirportTransferType {
  const t = (rawText ?? '').replace(/\s+/g, ' ')
  if (!t.trim()) return 'NONE'
  const hasPickup =
    /(공항\s*픽업|호텔\s*픽업|픽업\s*(?:포함|서비스)?|공항.{0,12}픽업|공항에서\s*호텔|pickup)/i.test(t)
  const hasSending =
    /(공항\s*샌딩|호텔\s*샌딩|샌딩\s*포함|공항.{0,12}송영|호텔.{0,12}송영|sending|drop\s*off|dropoff)/i.test(
      t,
    )
  if (hasPickup && hasSending) return 'BOTH'
  if (hasPickup) return 'PICKUP'
  if (hasSending) return 'SENDING'
  return 'NONE'
}

export function airportTransferIncludedFromType(type: string | null | undefined): boolean {
  return type === 'BOTH' || type === 'PICKUP' || type === 'SENDING'
}

/** 본문·등록 필드 기준 공항↔호텔 이동 포함 여부(픽업/샌딩 infer + DB airportTransferType) */
export function resolveAirportTransferIncludedFromProduct(input: {
  airportTransferType?: string | null
  includedText?: string | null
  excludedText?: string | null
}): boolean {
  const combinedText = [input.includedText, input.excludedText].filter(Boolean).join('\n')
  const type =
    input.airportTransferType?.trim() ||
    inferAirportTransferTypeFromText(combinedText)
  return airportTransferIncludedFromType(type)
}

export const AIRTEL_AIRPORT_TRANSFER_EXCLUDED_LABEL = '공항↔호텔 이동'

const LINE_AIRPORT_HOTEL_TRANSFER =
  /공항\s*[<↔↕⇔\-–—~]\s*>?\s*호텔|호텔\s*[<↔↕⇔\-–—~]\s*>?\s*공항|공항.{0,12}호텔.{0,16}(?:이동|픽업|샌딩|송영|차량|미팅)|공항\s*(?:픽업|샌딩|미팅)|픽업.{0,8}샌딩|공항에서\s*호텔|공항↔호텔|전용\s*차량|차량\s*비용?/i

export function isAirportHotelTransferLine(line: string): boolean {
  return LINE_AIRPORT_HOTEL_TRANSFER.test(line.replace(/\s+/g, ' ').trim())
}

/** 본문에 공항↔호텔 이동 주제가 언급됐는지(포함/불포함 원문) */
export function bodyTextMentionsAirportHotelTransfer(text: string | null | undefined): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ')
  if (!t.trim()) return false
  return LINE_AIRPORT_HOTEL_TRANSFER.test(t)
}

function linesFromMultilineText(text: string | null | undefined): string[] {
  if (!text?.trim()) return []
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/** 포함란·본문 — 공항↔호텔 이동이 실질 포함된 문구(노랑풍선 「전용차량비용」 등) */
export function includedDeclaresAirportTransferLoose(haystack: string | null | undefined): boolean {
  const t = (haystack ?? '').replace(/\s+/g, ' ')
  if (!t.trim()) return false
  if (bodyTextMentionsAirportHotelTransfer(t)) return true
  return /전용\s*차량|차량\s*비용|차량비|공항.{0,12}(송영|미팅|픽업|셔틀|이동)|호텔.{0,12}송영/i.test(t)
}

function excludedDeclaresAirportTransferNotIncluded(
  excludedLines: string[],
  excludedText: string | null | undefined,
  includedHaystack: string
): boolean {
  if (includedDeclaresAirportTransferLoose(includedHaystack)) return false
  if (excludedLines.some(isAirportHotelTransferLine)) return true
  const hay = [excludedText ?? '', ...excludedLines].join('\n').replace(/\s+/g, ' ')
  if (!hay.trim()) return false
  return /공항\s*이동\s*불포함|공항.{0,16}호텔.{0,24}(?:이동|픽업|샌딩|송영).{0,20}(?:불포함|미포함|없음|별도|고객|개별)|(?:픽업|샌딩).{0,12}불포함/i.test(
    hay
  )
}

function includedDeclaresAirportTransfer(includedLines: string[]): boolean {
  return includedLines.some(isAirportHotelTransferLine)
}

/**
 * 자유여행(air_hotel_free) — 카드·상세 배지용 airportTransferType.
 * 포함란에 공항↔호텔 이동·픽업/샌딩이 없으면 NONE(「공항 이동 불포함」).
 */
export function resolveAirportTransferTypeForAirHotelFree(input: {
  airportTransferType?: string | null
  includedText?: string | null
  excludedText?: string | null
  includedItems?: string[] | null
  excludedItems?: string[] | null
  extraHaystack?: string | null
}): AirportTransferType {
  const includedLines = [...(input.includedItems ?? []), ...linesFromMultilineText(input.includedText)]
  const excludedLines = [...(input.excludedItems ?? []), ...linesFromMultilineText(input.excludedText)]
  const stored = input.airportTransferType?.trim()

  if (stored && isValidAirportTransferType(stored) && stored !== 'NONE') {
    return stored
  }

  if (includedDeclaresAirportTransfer(includedLines)) {
    const includedHaystack = [input.includedText, input.extraHaystack, ...includedLines]
      .filter(Boolean)
      .join('\n')
    const inferred = inferAirportTransferTypeFromText(includedHaystack)
    if (inferred !== 'NONE') return inferred
    return 'BOTH'
  }

  const includedOnlyHaystack = [input.includedText, ...includedLines].filter(Boolean).join('\n')
  const pickupSendingFromIncluded = inferAirportTransferTypeFromText(includedOnlyHaystack)
  if (pickupSendingFromIncluded !== 'NONE') return pickupSendingFromIncluded

  const includedHaystackFull = [input.includedText, input.extraHaystack, ...includedLines]
    .filter(Boolean)
    .join('\n')
  if (includedDeclaresAirportTransferLoose(includedHaystackFull)) {
    const loose = inferAirportTransferTypeFromText(includedHaystackFull)
    return loose !== 'NONE' ? loose : 'BOTH'
  }

  if (
    excludedDeclaresAirportTransferNotIncluded(excludedLines, input.excludedText, includedHaystackFull)
  ) {
    return 'NONE'
  }

  const combinedHaystack = [
    input.includedText,
    input.excludedText,
    input.extraHaystack,
    ...includedLines,
    ...excludedLines,
  ]
    .filter(Boolean)
    .join('\n')
  const inferredCombined = inferAirportTransferTypeFromText(combinedHaystack)
  if (inferredCombined !== 'NONE') return inferredCombined

  if (stored && isValidAirportTransferType(stored)) return stored

  return 'NONE'
}

/** 등록·browse 저장/표시 — listingKind가 자유여행일 때만 resolve, 아니면 DB 값 유지 */
export function airportTransferTypeForListingKind(
  listingKind: string | null | undefined,
  input: {
    airportTransferType?: string | null
    includedText?: string | null
    excludedText?: string | null
    includedItems?: string[] | null
    excludedItems?: string[] | null
    extraHaystack?: string | null
  }
): AirportTransferType | null {
  if (listingKind !== 'air_hotel_free') {
    const stored = input.airportTransferType?.trim()
    return stored && isValidAirportTransferType(stored) ? stored : null
  }
  return resolveAirportTransferTypeForAirHotelFree(input)
}
