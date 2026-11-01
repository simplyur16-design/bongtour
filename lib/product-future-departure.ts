/**
 * 향후 출발일 — 오늘(한국 날짜) 이후 출발일이 하나도 없는 상품은 등록하지 않는다(사장님 11/01 19:01, 지우지 않고 등록에서만 뺌).
 * REGRESSION-FREEZE[fit-gemini-recommended-itinerary-1101]: 향후 출발일 없으면 registered 금지 — manifest
 */
/** '오늘 이후' = 한국 날짜 기준 내일 00:00 부터. 출발일은 날짜만 저장(00:00Z 또는 KST 자정) — 둘 다 같은 날로 맞게 비교 */
export function kstTomorrowStartUtc(now: Date = new Date()): Date {
  const kst = new Date(now.getTime() + 9 * 3600_000)
  const y = kst.getUTCFullYear()
  const m = kst.getUTCMonth()
  const d = kst.getUTCDate()
  // 내일 KST 00:00 = 오늘 15:00 UTC. 내일 날짜를 00:00Z 로 저장한 행(내일 09:00 KST)도, KST 자정으로 저장한 행도 포함.
  // 오늘 날짜를 00:00Z 로 저장한 행(오늘 09:00 KST)은 빠진다.
  return new Date(Date.UTC(y, m, d + 1) - 9 * 3600_000)
}

export function futureDepartureWhere(now: Date = new Date()) {
  return { departureDate: { gte: kstTomorrowStartUtc(now) } }
}

export async function countFutureDepartures(productId: string, now: Date = new Date()): Promise<number> {
  const { prisma } = await import('@/lib/prisma')
  return prisma.productDeparture.count({ where: { productId, ...futureDepartureWhere(now) } })
}
