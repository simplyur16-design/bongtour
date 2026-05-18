import { parseShoppingStopsJson, type ShoppingStopRow } from '@/lib/public-product-extras'
import { isShoppingPublicJunkRow } from '@/lib/shopping-public-row-filter'

export type ModetourShoppingTableInput = {
  stops?: ShoppingStopRow[] | null
  shoppingShopOptions?: string | null
  shoppingItems?: string | null
  shoppingPasteRaw?: string | null
  shoppingNoticeRaw?: string | null
}

function normItemKey(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

function rowsFromShoppingItemsFallback(shoppingItems: string | null | undefined): ShoppingStopRow[] {
  const raw = shoppingItems?.trim() ?? ''
  if (!raw) return []
  return raw
    .split(/[,，、/]\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => ({
      itemType: item,
      placeName: '—',
      durationText: null,
      refundPolicyText: null,
      raw: item,
    }))
}

/** 모두투어 공개 상세 — structured stops → shoppingShopOptions JSON → shoppingItems 요약 */
export function resolveModetourShoppingTableRows(input: ModetourShoppingTableInput): ShoppingStopRow[] {
  const fromStops = (input.stops ?? []).filter((r) => !isShoppingPublicJunkRow(r))
  if (fromStops.length > 0) return fromStops
  const fromDb = parseShoppingStopsJson(input.shoppingShopOptions ?? null).filter((r) => !isShoppingPublicJunkRow(r))
  if (fromDb.length > 0) return fromDb
  return rowsFromShoppingItemsFallback(input.shoppingItems)
}

export type ModetourShoppingRowGroup = {
  row: ShoppingStopRow
  itemRowSpan: number
  isFirstInItemGroup: boolean
}

export function groupModetourShoppingRowsForDisplay(rows: ShoppingStopRow[]): ModetourShoppingRowGroup[] {
  const out: ModetourShoppingRowGroup[] = []
  let i = 0
  while (i < rows.length) {
    const key = normItemKey(rows[i]!.itemsText || rows[i]!.itemType)
    let j = i + 1
    while (j < rows.length && normItemKey(rows[j]!.itemsText || rows[j]!.itemType) === key) {
      j++
    }
    const span = j - i
    for (let k = i; k < j; k++) {
      out.push({
        row: rows[k]!,
        itemRowSpan: span,
        isFirstInItemGroup: k === i,
      })
    }
    i = j
  }
  return out
}

export function hasModetourShoppingDisplayContent(input: ModetourShoppingTableInput): boolean {
  if (resolveModetourShoppingTableRows(input).length > 0) return true
  if (String(input.shoppingPasteRaw ?? '').trim()) return true
  if (String(input.shoppingItems ?? '').trim()) return true
  const notice = String(input.shoppingNoticeRaw ?? '').trim()
  const paste = String(input.shoppingPasteRaw ?? '').trim()
  if (notice && notice !== paste) return true
  return false
}

export function displayModetourShoppingItem(row: ShoppingStopRow): string {
  return String(row.itemsText ?? '').trim() || row.itemType.trim() || '—'
}

export function displayModetourShoppingPlace(row: ShoppingStopRow): string {
  const fromParts = [row.city, row.shopName, row.shopLocation]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ')
  return fromParts || row.placeName.trim() || '—'
}
