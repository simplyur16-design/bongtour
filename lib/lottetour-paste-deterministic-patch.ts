/**
 * 롯데관광 본문에서 duration·잔여/최소·쇼핑·가격표 보강 (LLM 실패 시 보조).
 */
import type { RegisterParsed } from '@/lib/register-llm-schema-lottetour'
import { extractLottetourThreeSlotPricesFromBlob } from '@/lib/register-lottetour-price'

function pickDuration(blob: string): string | null {
  const m = blob.match(/(\d+)\s*박\s*(\d+)\s*일/)
  if (!m) return null
  return `${m[1]}박 ${m[2]}일`
}

function pickSeatsMin(blob: string): { rem: number | null; min: number | null } {
  let rem: number | null = null
  let min: number | null = null
  const r1 = blob.match(/잔여\s*(\d+)\s*석/)
  if (r1) rem = parseInt(r1[1]!, 10)
  if (rem == null) {
    const r1b = blob.match(/남은\s*좌석\s*[:：]?\s*(\d+)\s*석/)
    if (r1b) rem = parseInt(r1b[1]!, 10)
  }
  const r2 = blob.match(/최소\s*출발\s*(\d+)\s*명/)
  if (r2) min = parseInt(r2[1]!, 10)
  const r3 = blob.match(/최소출발\s*(\d+)\s*명/)
  if (min == null && r3) min = parseInt(r3[1]!, 10)
  return { rem, min }
}

function pickCurrentReservation(blob: string): number | null {
  const r = blob.match(/현재\s*예약\s*[:：]?\s*(\d+)\s*명/)
  if (r) return parseInt(r[1]!, 10)
  return null
}

function pickShoppingCount(blob: string): number | null {
  const m = blob.match(/쇼핑\s*(\d+)\s*회/)
  if (m) return parseInt(m[1]!, 10)
  return null
}

/** URL·붙여넣기 blob에서 godId·evtCd·categoryMenuNo(경로 세그먼트) 추출 — trip anchors·merge 공용. */
export function extractLottetourMasterIdsFromBlob(blob: string): {
  godId: string | null
  evtCd: string | null
  categoryMenuNo: { no1: string; no2: string; no3: string; no4: string } | null
} {
  const god =
    blob.match(/\/evtList\/\d+\/\d+\/\d+\/\d+[^\n\r?#]*\?[^\n\r#]*godId=(\d+)/i)?.[1]?.trim() ??
    blob.match(/[?&]godId=(\d+)/i)?.[1]?.trim() ??
    null
  const evt =
    blob.match(/[?&]evtCd=([^&\s#'"<>]+)/i)?.[1]?.trim() ??
    blob.match(/\bevtCd\s*[:：=]\s*([A-Za-z0-9_-]{8,34})\b/i)?.[1]?.trim() ??
    blob.match(/evtCd=([A-Z]\d{2}[A-Z]\d{6}[A-Z]{2}\d{3})\b/i)?.[1]?.trim() ??
    null
  const menuDetail = blob.match(/\/evtDetail\/(\d+)\/(\d+)\/(\d+)\/(\d+)/i)
  const menuList = blob.match(/\/evtList\/(\d+)\/(\d+)\/(\d+)\/(\d+)/i)
  const menu = menuDetail ?? menuList
  const categoryMenuNo =
    menu?.[1] && menu[2] && menu[3] && menu[4]
      ? { no1: menu[1]!, no2: menu[2]!, no3: menu[3]!, no4: menu[4]! }
      : null
  return { godId: god, evtCd: evt, categoryMenuNo }
}

export function mergeLottetourDeterministicFieldsFromPaste(parsed: RegisterParsed, rawText: string): RegisterParsed {
  const blob = rawText.replace(/\r/g, '\n')
  let next = { ...parsed }
  const dur = pickDuration(blob)
  if (dur && !(parsed.duration ?? '').trim()) {
    next = { ...next, duration: dur }
  }
  const { rem, min } = pickSeatsMin(blob)
  if (rem != null && next.remainingSeatsCount == null) {
    next = { ...next, remainingSeatsCount: rem }
  }
  const booked = pickCurrentReservation(blob)
  if (booked != null && next.currentBookedCount == null) {
    next = { ...next, currentBookedCount: booked }
  }
  if (min != null && next.minimumDepartureCount == null) {
    next = { ...next, minimumDepartureCount: min }
  }
  const shop = pickShoppingCount(blob)
  if (shop != null && (next.shoppingVisitCount == null || next.shoppingVisitCount === 0)) {
    next = { ...next, shoppingVisitCount: shop, hasShopping: true }
  }
  const px = extractLottetourThreeSlotPricesFromBlob(blob)
  if (px && (px.adultPrice != null || px.childPrice != null || px.infantPrice != null)) {
    const prev = next.productPriceTable ?? {}
    next = {
      ...next,
      productPriceTable: {
        adultPrice: px.adultPrice ?? prev.adultPrice ?? null,
        childExtraBedPrice: px.childPrice ?? prev.childExtraBedPrice ?? null,
        childNoBedPrice: prev.childNoBedPrice ?? null,
        infantPrice: px.infantPrice ?? prev.infantPrice ?? null,
      },
    }
  }
  const ids = extractLottetourMasterIdsFromBlob(blob)
  if (ids.godId && !(next.godId ?? '').trim()) {
    next = { ...next, godId: ids.godId }
  }
  if (ids.evtCd && !(next.evtCd ?? '').trim()) {
    next = { ...next, evtCd: ids.evtCd }
  }
  if (ids.categoryMenuNo && !next.categoryMenuNo) {
    next = { ...next, categoryMenuNo: ids.categoryMenuNo }
  }
  return next
}
