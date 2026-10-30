/**
 * 일차 사진 AI 표시 기록 (사장님 10/30 19:34 "AI 표시 칸 추가해" — 일차 사진까지).
 * 생성 이미지(Gemini/Imagen)면 schedule JSON 의 imageSource 에 isGenerated·prompt·labeledAt·aiLabel 을 남긴다.
 * schedule JSON 안에 기록하므로 DB 칸(마이그레이션) 추가 없음. 실사(Pexels·Unsplash·풀)는 표시하지 않는다.
 * REGRESSION-FREEZE[register-day-photo-ai-label]: 생성 일차 사진 = isGenerated + prompt + labeledAt — manifest
 */
export const DAY_PHOTO_AI_LABEL_KO = 'AI 생성 이미지'

export type DayPhotoAiLabel = {
  isGenerated: true
  prompt: string
  /** exact = 생성에 쓴 문장 그대로, keyword = 문장을 몰라 생성 키워드로 기록 */
  promptRecorded: 'exact' | 'keyword'
  labeledAt: string
  aiLabel: typeof DAY_PHOTO_AI_LABEL_KO
}

export function isGeneratedPhotoSource(source: string | null | undefined, url?: string | null): boolean {
  if (/gemini|imagen|generated/i.test(String(source ?? ''))) return true
  return /\/gemini[-_/]|[-_]gemini[-_.]/i.test(String(url ?? ''))
}

export function dayPhotoAiLabel(
  photo: { source: string | null | undefined; url?: string | null },
  prompt: string | null | undefined,
  keywordFallback: string,
  now: Date = new Date()
): DayPhotoAiLabel | null {
  if (!isGeneratedPhotoSource(photo.source, photo.url)) return null
  const exact = String(prompt ?? '').trim()
  const kw = String(keywordFallback ?? '').trim()
  return {
    isGenerated: true,
    prompt: (exact || kw || 'travel photo').slice(0, 500),
    promptRecorded: exact ? 'exact' : 'keyword',
    labeledAt: now.toISOString(),
    aiLabel: DAY_PHOTO_AI_LABEL_KO,
  }
}
