const PEXELS_API = 'https://api.pexels.com/v1/search'

/**
 * Pexels API로 검색해 고화질 이미지 1장 URL 반환. API 키 없으면 null.
 */
export async function fetchOnePhotoUrl(
  keyword: string,
  apiKey: string | undefined
): Promise<string | null> {
  if (!apiKey?.trim() || !keyword?.trim()) return null
  try {
    const res = await fetch(
      `${PEXELS_API}?query=${encodeURIComponent(keyword)}&per_page=1&orientation=landscape`,
      {
        headers: { Authorization: apiKey },
        next: { revalidate: 0 },
      }
    )
    if (!res.ok) return null
    const data = (await res.json()) as {
      photos?: Array<{ src?: { large?: string; original?: string } }>
    }
    const photo = data.photos?.[0]
    return photo?.src?.original ?? photo?.src?.large ?? null
  } catch {
    return null
  }
}
