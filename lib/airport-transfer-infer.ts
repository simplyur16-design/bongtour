/**
 * 공항 픽업/샌딩 포함 여부 — 등록 본문·포함/불포함 원문에서 파악(SSOT).
 * 자유여행(airtel) 표시·등록 모두 동일 규칙을 쓴다.
 */
export type AirportTransferType = 'NONE' | 'PICKUP' | 'SENDING' | 'BOTH'

export function inferAirportTransferTypeFromText(
  rawText: string | null | undefined
): AirportTransferType {
  const t = (rawText ?? '').toLowerCase()
  if (!t.trim()) return 'NONE'
  const hasPickup = /(공항\s*픽업|픽업\s*포함|pickup)/i.test(t)
  const hasSending = /(공항\s*샌딩|샌딩\s*포함|sending|drop\s*off|dropoff)/i.test(t)
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

/** 본문에 공항↔호텔 이동 주제가 언급됐는지(포함/불포함 원문) */
export function bodyTextMentionsAirportHotelTransfer(text: string | null | undefined): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ')
  if (!t.trim()) return false
  return /공항\s*[<↔↕⇔\-–—~]\s*>?\s*호텔|호텔\s*[<↔↕⇔\-–—~]\s*>?\s*공항|공항.{0,12}호텔.{0,16}(?:이동|픽업|샌딩|송영|차량)|공항\s*(?:픽업|샌딩)|공항에서\s*호텔\s*이동|공항↔호텔/i.test(
    t
  )
}
