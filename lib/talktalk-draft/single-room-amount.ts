/**
 * 1인실 추가금은 Product.rawMeta.structuredSignals 에 이미 저장된 값만 쓴다.
 * 원문 문장이 있으면 그 문장, 없으면 저장 통화 코드와 숫자를 그대로 붙인다.
 */
export const SINGLE_ROOM_CONFIRM_LATER = '해당 상품은 1인실 금액 확인 후 안내'

export type StoredSingleRoomAmount = {
  displayText?: string | null
  raw?: string | null
  amount?: number | null
  currency?: string | null
}

function textWithDigit(value: string | null | undefined): string | null {
  const t = value?.trim()
  if (!t || !/\d/.test(t)) return null
  return t
}

export function singleRoomAmountLabelFromStored(input: StoredSingleRoomAmount | null | undefined): string {
  const original = textWithDigit(input?.raw) ?? textWithDigit(input?.displayText)
  if (original) return original
  const amount = input?.amount
  const currency = input?.currency?.trim()
  if (typeof amount === 'number' && Number.isFinite(amount) && amount !== 0 && currency) {
    return `${currency} ${String(amount)}`
  }
  return SINGLE_ROOM_CONFIRM_LATER
}
