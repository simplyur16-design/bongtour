/**
 * 출발 회차(ProductDeparture) 단위 교통 축. 국내(항공·선박·버스 등)·해외 공통.
 * Product 레벨에 고정하지 않는다.
 */
export const TRANSPORT_TYPES = ['AIR', 'SHIP', 'BUS', 'TRAIN', 'SELF', 'MIXED', 'ETC'] as const
export type TransportType = (typeof TRANSPORT_TYPES)[number]

export function parseTransportType(raw: string | null | undefined): TransportType | null {
  if (!raw?.trim()) return null
  const u = raw.trim().toUpperCase()
  return (TRANSPORT_TYPES as readonly string[]).includes(u) ? (u as TransportType) : null
}
