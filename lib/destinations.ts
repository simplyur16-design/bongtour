import { prisma } from './prisma'

export type DestinationInfo = { name: string; imageUrl: string | null }

/**
 * 여행지명으로 대표 이미지 조회. DB에 있으면 imageUrl 반환, 없으면 null (상세페이지에서 플레이스홀더 표시).
 */
export async function getDestinationByName(
  name: string | null | undefined
): Promise<DestinationInfo | null> {
  if (!name?.trim()) return null
  const n = name.trim()
  const dest = await prisma.destination.findUnique({
    where: { name: n },
  })
  if (dest) return { name: dest.name, imageUrl: dest.imageUrl }
  return { name: n, imageUrl: null }
}
