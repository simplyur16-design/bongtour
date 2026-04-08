import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'

export type ScheduleDayInput = { day: number; description?: string }
export type KeywordResult = { day: number; keyword: string }[]

export async function extractImageKeywords(schedule: ScheduleDayInput[]): Promise<KeywordResult> {
  const model = getGenAI().getGenerativeModel({ model: getModelName() })

  const prompt = `
[Role: Data Auditor for Photo Keywords]
You extract exactly one English keyword per day for Pexels search. Output is dry, mechanical, objective. JSON only; no natural language.

[Photo Keyword Rules]
- Luxury Standard: Use 'Luxury', 'Panoramic', 'High-end' feel. Example: 'Paris' -> 'Eiffel Tower Luxury View'.
- No Creativity: No creative or abstract keywords (e.g. 'Mystical Aura' forbidden).
- Factual Destination: Combine the day's actual place name with 'High-Resolution', 'Realistic'.
- Noun-only, so Pexels returns real stock photos. No adjectives that yield no results.
- 5-Photo Limit: Keywords for [main 1 + schedule 4 = 5 photos] only. One keyword per day, up to 4 days.

Output JSON only: [{"day": 1, "keyword": "Osaka Castle Luxury Panoramic"}]

[Data]
${JSON.stringify(schedule)}
  `.trim()

  const result = await model.generateContent(prompt, geminiTimeoutOpts())
  const response = await result.response
  return JSON.parse(response.text()) as KeywordResult
}

/** extractImageKeywords와 동일. 별칭 제공 */
export const generateImageKeywords = extractImageKeywords
