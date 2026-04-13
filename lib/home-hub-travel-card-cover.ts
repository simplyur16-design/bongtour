/**
 * 메인 허브 4카드 중 해외/국내 카드용 커버 URL.
 * `getScheduleFromProduct` + 메인 전용 `getHomeHubCoverImageUrl`(동일 필드, URL 후보만 비교).
 * 풀 확장·주기적 슬라이드(15~30초)는 이후 `pool` 배열·클라이언트 타이머로 확장 가능.
 */

import { prisma } from '@/lib/prisma'
import { getHomeHubCoverImageUrl } from '@/lib/final-image-selection'
import { getScheduleFromProduct } from '@/lib/schedule-from-product'

export type HomeHubTravelCardCoverScope = 'overseas' | 'domestic'

export type HomeHubTravelCardCoverPick = {
  imageSrc: string
  productId: string
  title: string
  /** 디버그·운영 확인용 — 풀에서 실제 고른 행 기준 */
  travelScope: string | null
  originSource: string
  bgImageUrl: string | null
  /** 일정 행 중 imageUrl 이 있는 항목만 짧게 요약 */
  scheduleImageSummary: string | null
}

const CANDIDATE_LIMIT = 120

/**
 * 등록 완료 + 해당 travelScope 상품만 스캔해 커버 URL이 있는 풀을 만든 뒤, 요청마다 1건 무작위 선택.
 * 풀이 비면 null → 호출부에서 `resolveHomeHubCardHybridImageSrc` 가 정적 폴백까지 처리.
 */
export async function pickHomeHubTravelCardCover(
  scope: HomeHubTravelCardCoverScope,
): Promise<HomeHubTravelCardCoverPick | null> {
  const rows = await prisma.product.findMany({
    where: {
      registrationStatus: 'registered',
      travelScope: scope,
    },
    orderBy: { updatedAt: 'desc' },
    take: CANDIDATE_LIMIT,
    select: {
      id: true,
      title: true,
      travelScope: true,
      originSource: true,
      bgImageUrl: true,
      schedule: true,
      itineraries: {
        select: { day: true, description: true },
        orderBy: { day: 'asc' },
        take: 60,
      },
    },
  })

  const pool: HomeHubTravelCardCoverPick[] = []
  for (const p of rows) {
    /** Prisma where 외에 행 단위 재검증 — DB/마이그레이션 오염 시 해외·국내 풀 혼입 방지 */
    if ((p.travelScope ?? '').trim() !== scope) continue
    const scheduleDays = getScheduleFromProduct(p)
    const url = getHomeHubCoverImageUrl({ bgImageUrl: p.bgImageUrl, scheduleDays })
    const trimmed = (url ?? '').trim()
    if (!trimmed) continue
    const scheduleImageSummary =
      scheduleDays
        .filter((d) => (d.imageUrl ?? '').trim().length > 0)
        .slice(0, 5)
        .map((d) => `d${d.day}:${String(d.imageUrl).trim().slice(0, 72)}`)
        .join(' | ') || null
    pool.push({
      imageSrc: trimmed,
      productId: p.id,
      title: p.title,
      travelScope: p.travelScope ?? null,
      originSource: p.originSource,
      bgImageUrl: p.bgImageUrl ?? null,
      scheduleImageSummary,
    })
  }

  if (pool.length === 0) return null
  const idx = Math.floor(Math.random() * pool.length)
  return pool[idx]!
}
