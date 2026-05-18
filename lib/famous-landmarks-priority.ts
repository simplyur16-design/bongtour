/**
 * 상품 대표 이미지 키워드 선정 — LLM 실패 시 유명 관광지 점수표.
 */

export const FAMOUS_LANDMARKS_PRIORITY: Record<string, number> = {
  'Mount Fuji': 100,
  'Tokyo Tower': 100,
  'Osaka Castle': 100,
  'Eiffel Tower': 100,
  'Colosseum': 100,
  'Halong Bay': 100,
  'Angkor Wat': 100,
  'Grand Palace': 95,
  'Forbidden City': 95,
  'Great Wall': 95,
  'Sagrada Familia': 95,
  'Kinkaku-ji': 95,
  'Fushimi Inari': 95,
  'Senso-ji': 90,
  'Shibuya Crossing': 90,
  'The Bund': 90,
  'Marina Bay Sands': 90,
  'Ba Na Hills': 90,
  'Golden Bridge': 90,
  'Phi Phi Islands': 95,
  'Wat Arun': 90,
  'Marble Mountains': 85,
  'My Khe Beach': 80,
  'Dotonbori': 88,
  'Universal Studios Japan': 92,
  'Tokyo Disneyland': 90,
  'Taipei 101': 90,
  'Victoria Peak': 88,
  'Petronas Towers': 88,
  'Sydney Opera House': 90,
  'Burj Khalifa': 90,
  'Machu Picchu': 100,
  'Statue of Liberty': 95,
  'Niagara Falls': 92,
  'Stonehenge': 85,
  'Acropolis': 90,
  'Neuschwanstein Castle': 90,
  'Louvre Museum': 88,
  'Big Ben': 88,
  'Tower Bridge': 85,
  'Christ the Redeemer': 95,
  'Table Mountain': 88,
  'Merlion': 85,
  'Hoi An Ancient Town': 85,
  'Po Nagar Cham Towers': 80,
  'Lake Ashi': 82,
  'Hakone Shrine': 80,
  'Jiufen': 82,
  'Nagoya Castle': 85,
  'Hiroshima Peace Memorial': 85,
  'Gyeongbokgung Palace': 88,
  'N Seoul Tower': 85,
  'Jeju Island': 82,
}

/** 키워드 정규화 후 최고 점수 항목 (동점이면 앞 일정 우선) */
export function pickHighestPriorityLandmark(
  keywords: string[],
  normalize: (raw: string) => string,
): { keyword: string; score: number } | null {
  let bestKeyword = ''
  let bestScore = 0
  let bestIndex = Number.MAX_SAFE_INTEGER
  for (let index = 0; index < keywords.length; index++) {
    const kw = normalize(keywords[index] ?? '')
    if (!kw) continue
    const score = FAMOUS_LANDMARKS_PRIORITY[kw] ?? FAMOUS_LANDMARKS_PRIORITY[kw.replace(/^The /, '')] ?? 0
    if (score <= 0) continue
    if (score > bestScore || (score === bestScore && index < bestIndex)) {
      bestKeyword = kw
      bestScore = score
      bestIndex = index
    }
  }
  if (!bestKeyword) return null
  return { keyword: bestKeyword, score: bestScore }
}
