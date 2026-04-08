/**
 * ShoppingStructured 행 → DB/JSON `shoppingStops[]` 1객체 (파서 아님, 직렬화만).
 */
import type { ShoppingStructured } from '@/lib/detail-body-parser-types'

const HANATOUR_MANUAL_NOTE = '__hanatour_manual_shopping__'

export function shoppingStructuredRowToPersistStop(row: ShoppingStructured['rows'][number]): Record<string, unknown> {
  const city = row.city != null && String(row.city).trim() ? String(row.city).trim() : null
  const shopName = row.shopName != null && String(row.shopName).trim() ? String(row.shopName).trim() : null
  const shopLocation =
    row.shopLocation != null && String(row.shopLocation).trim() ? String(row.shopLocation).trim() : null
  const itemsText = row.itemsText != null && String(row.itemsText).trim() ? String(row.itemsText).trim() : null
  const placeFromParts = [city, shopName, shopLocation].filter(Boolean).join(' · ')
  const itemType = itemsText || row.shoppingItem || '쇼핑'
  const placeName = placeFromParts || row.shoppingPlace || row.shoppingItem || ''
  const out: Record<string, unknown> = {
    city,
    shopName,
    shopLocation,
    itemsText,
    itemType,
    placeName,
    durationText: row.durationText || null,
    refundPolicyText: row.refundPolicyText || null,
    raw: itemsText || row.shoppingItem || '',
  }
  if (row.visitNo != null && Number.isFinite(Number(row.visitNo))) {
    out.visitNo = Number(row.visitNo)
  }
  if (row.candidateOnly === true) {
    out.candidateOnly = true
  }
  if (row.candidateGroupKey != null && String(row.candidateGroupKey).trim()) {
    out.candidateGroupKey = String(row.candidateGroupKey).trim()
  }
  const nt = row.noteText != null ? String(row.noteText).trim() : ''
  if (nt && nt !== HANATOUR_MANUAL_NOTE) {
    out.noteText = nt
  }
  return out
}
