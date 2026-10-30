import type { DepartureKeyFacts } from '@/lib/departure-key-facts'
import type { TravelProduct } from '@/app/components/travel/TravelProductDetail'
import {
  normalizeDepartureKeyFactsForPayload,
  normalizeDepartureKeyFactsRecordForPayload,
} from '@/lib/product-public-detail/normalize-departure-key-facts-for-payload'

/** DTO 저장용 — 출발 키팩트 상한(메모리 #4 캐시·전송 균형). 공개 가격행 키를 모를 때만 적용 */
export const PAYLOAD_DEPARTURE_KEY_FACTS_MAX_ENTRIES = 30

/**
 * 공개 가격행(달력에서 고를 수 있는 회차)에 해당하는 키팩트 상한.
 * 이전엔 cuid/날짜 정렬 앞 30건만 남겨, 최저가 기본 선택 회차(예: 제주항공·LOT 회차)의 키팩트가 빠지고
 * 같은 날 다른 항공사 날짜키 팩트·상품 대표 항공사로 대체돼 상단/하단 항공사가 어긋났다.
 */
export const PAYLOAD_DEPARTURE_KEY_FACTS_MAX_PRICE_ROW_ENTRIES = 400

export function slimDepartureKeyFactsForPayload(facts: DepartureKeyFacts): DepartureKeyFacts {
  return normalizeDepartureKeyFactsForPayload(facts)
}

export function slimDepartureKeyFactsRecordForPayload(
  facts: Record<string, DepartureKeyFacts> | undefined | null,
  keepKeys?: ReadonlySet<string> | null,
): Record<string, DepartureKeyFacts> | undefined {
  if (!facts || Object.keys(facts).length === 0) return undefined
  const sorted = Object.entries(facts).sort(([a], [b]) => a.localeCompare(b))
  const kept =
    keepKeys && keepKeys.size > 0
      ? sorted.filter(([k]) => keepKeys.has(k)).slice(0, PAYLOAD_DEPARTURE_KEY_FACTS_MAX_PRICE_ROW_ENTRIES)
      : []
  // 가격행 키와 하나도 안 맞으면(키 체계 다른 공급사) 기존 앞 30건 그대로 — 동작 후퇴 없음
  const capped = kept.length > 0 ? kept : sorted.slice(0, PAYLOAD_DEPARTURE_KEY_FACTS_MAX_ENTRIES)
  const normalized = normalizeDepartureKeyFactsRecordForPayload(
    Object.fromEntries(capped) as Record<string, DepartureKeyFacts>,
  )
  return normalized
}

/** 공개 가격행 id·날짜 — 키팩트는 이 회차들만(상한 400) 남긴다 */
export function publicPriceRowFactKeys(product: Pick<TravelProduct, 'prices'>): {
  ids: Set<string>
  dates: Set<string>
} {
  const ids = new Set<string>()
  const dates = new Set<string>()
  const rows = Array.isArray(product.prices) ? product.prices : []
  for (const r of rows) {
    const id = String((r as { id?: unknown }).id ?? '').trim()
    if (id) ids.add(id)
    const date = String((r as { date?: unknown }).date ?? '').trim().slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) dates.add(date)
  }
  return { ids, dates }
}

export function slimTravelProductDepartureFactsForPayload(product: TravelProduct): TravelProduct {
  const { ids, dates } = publicPriceRowFactKeys(product)
  return {
    ...product,
    departureKeyFactsByDate: slimDepartureKeyFactsRecordForPayload(
      product.departureKeyFactsByDate ?? undefined,
      dates.size > 0 ? dates : null,
    ),
    departureKeyFactsByDepartureId: slimDepartureKeyFactsRecordForPayload(
      product.departureKeyFactsByDepartureId ?? undefined,
      ids.size > 0 ? ids : null,
    ),
  }
}
