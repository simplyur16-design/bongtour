import { prisma } from './prisma'
import { generateGalleryKeywords } from './gallery-keywords'
import { fetchOnePhotoUrl } from './pexels'

export type DestinationGalleryResult = {
  imageUrls: string[]
  keywords: string[]
}

/**
 * 여행지 갤러리 5장. 캐시 있으면 DB에서 반환, 없으면 Gemini 키워드 → Pexels 5장 조회 후 캐시 저장.
 */
export async function getOrFetchDestinationGallery(
  destinationName: string | null | undefined
): Promise<DestinationGalleryResult | null> {
  const name = destinationName?.trim()
  if (!name) return null

  const cached = await prisma.destinationGalleryCache.findUnique({
    where: { destinationName: name },
  })
  if (cached) {
    try {
      const urls = JSON.parse(cached.imageUrls) as string[]
      const keywords = JSON.parse(cached.keywords) as string[]
      if (Array.isArray(urls) && urls.length >= 5) {
        return { imageUrls: urls.slice(0, 5), keywords: keywords?.slice(0, 5) ?? [] }
      }
    } catch {
      // invalid cache, refetch
    }
  }

  const apiKey = process.env.PEXELS_API_KEY
  if (!apiKey?.trim()) return null

  const keywords = await generateGalleryKeywords(name)
  if (keywords.length < 5) return null

  const urls: string[] = []
  for (let i = 0; i < 5; i++) {
    const url = await fetchOnePhotoUrl(keywords[i], apiKey)
    urls.push(url ?? '')
  }

  const imageUrls = urls.length >= 5 ? urls : [...urls, ...Array(5 - urls.length).fill('')].slice(0, 5)
  const keywordsToSave = keywords.slice(0, 5)
  if (imageUrls.every((u) => !u)) return null

  await prisma.destinationGalleryCache.upsert({
    where: { destinationName: name },
    create: {
      destinationName: name,
      imageUrls: JSON.stringify(imageUrls),
      keywords: JSON.stringify(keywordsToSave),
    },
    update: {
      imageUrls: JSON.stringify(imageUrls),
      keywords: JSON.stringify(keywordsToSave),
      fetchedAt: new Date(),
    },
  })

  return { imageUrls, keywords: keywordsToSave }
}
