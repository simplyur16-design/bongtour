/**
 * 이미지 한 장을 제미나이에 보내 도시명·명소명(한글) 추천.
 * 네이밍 규칙 [도시명]_[명소명]_[출처].webp — 한글 그대로 사용.
 */

import { getGenAI, getModelName, geminiTimeoutOpts } from '@/lib/gemini-client'

export type SuggestImageNameResult = {
  city: string
  attraction: string
}

const PROMPT = `사진을 보고 정확한 여행지 도시와 명소를 한글로만 답해줘.

규칙:
- 교토: 전통 목조 거리, 사찰, 대나무 숲, 도리이(후시미 이나리), 기온 골목. 녹색·전통 풍경.
- 오사카: 오사카성(초록 지붕), 도톤보리 네온, 운하·도시. 교토와 혼동하지 말 것.
- 도쿄: 스카이트리, 시부야, 센소지 빨간 등. 다른 도시와 구분.
- 반드시 한글로만 답하고, 도시와 명소를 정확히 구분해줘. 추측하지 말고 확실할 때만 써줘.

아래 JSON만 출력하고 다른 글 없이:
{"city":"도시명 한글","attraction":"명소명 한글"}
예: {"city":"교토","attraction":"후시미 이나리"} 또는 {"city":"오사카","attraction":"오사카성"}. 모르면 city는 "미상", attraction은 "명소"로.`

/**
 * 이미지 버퍼를 제미나이 비전으로 분석해 도시명·명소명(영문) 반환
 */
export async function suggestImageName(
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg'
): Promise<SuggestImageNameResult> {
  const genAI = getGenAI()
  const model = genAI.getGenerativeModel({ model: getModelName() })
  const base64 = imageBuffer.toString('base64')

  const result = await model.generateContent(
    [
      {
        inlineData: {
          mimeType: mimeType === 'image/png' ? 'image/png' : 'image/jpeg',
          data: base64,
        },
      },
      { text: PROMPT },
    ],
    geminiTimeoutOpts()
  )

  const text = result.response.text()?.trim() ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]) as { city?: string; attraction?: string }
    return {
      city: String(parsed.city ?? '미상').trim() || '미상',
      attraction: String(parsed.attraction ?? '명소').trim() || '명소',
    }
  }
  return { city: '미상', attraction: '명소' }
}
