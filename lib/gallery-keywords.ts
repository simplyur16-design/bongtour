import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'

/**
 * 여행지명을 받아 Pexels 검색용 영어 키워드 5개 생성.
 * 풍경, 음식, 호텔 내부, 랜드마크 등 서로 다른 카테고리로 골고루 생성.
 */
export async function generateGalleryKeywords(
  destinationName: string
): Promise<string[]> {
  if (!destinationName?.trim()) return []
  const model = getGenAI().getGenerativeModel({ model: getModelName() })
  const prompt = `You are a travel image search assistant. Given a travel destination name, output exactly 5 different English search keywords for finding high-quality stock photos. Use varied categories: e.g. landscape/scenery, local food, hotel interior, famous landmark, beach or city view. Output ONLY a JSON array of 5 strings, no other text. Example: ["Da Nang landscape", "Vietnamese food", "Da Nang hotel", "Dragon Bridge Da Nang", "Da Nang beach"].

Destination (may be in Korean or English): ${destinationName.trim()}

Output exactly: ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"]`

  const result = await model.generateContent(prompt, geminiTimeoutOpts())
  const text = result.response.text()
  const match = text.match(/\[[\s\S]*?\]/)
  if (!match) return fallbackKeywords(destinationName)
  try {
    const arr = JSON.parse(match[0]) as unknown
    if (!Array.isArray(arr) || arr.length < 5) return fallbackKeywords(destinationName)
    return arr.slice(0, 5).map((s) => String(s).trim()).filter(Boolean)
  } catch {
    return fallbackKeywords(destinationName)
  }
}

function fallbackKeywords(destinationName: string): string[] {
  const name = destinationName.trim()
  return [
    `${name} landscape`,
    `${name} food`,
    `${name} hotel`,
    `${name} landmark`,
    `${name} travel`,
  ]
}
