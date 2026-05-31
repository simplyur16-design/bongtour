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
