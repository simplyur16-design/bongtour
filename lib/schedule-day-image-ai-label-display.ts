/**
 * 공개 화면 일차 사진 칸의 AI 표시(표시만). schedule[].imageSource 에 남긴 AI 기록
 * (lib/register-day-photo-ai-label: isGenerated·aiLabel) 을 읽어 우측에 'AI 생성 이미지' 를 그린다.
 * 실사(Pexels·Unsplash·CC0·풀)는 표시하지 않는다(우측 출처는 AI 문구만 — public-image-overlay-ssot).
 */
import { DAY_PHOTO_AI_LABEL_KO, isGeneratedPhotoSource } from '@/lib/register-day-photo-ai-label'

export function scheduleDayImageIsGenerated(rawSource: unknown, imageUrl?: string | null): boolean {
  if (rawSource && typeof rawSource === 'object') {
    const o = rawSource as Record<string, unknown>
    if (o.isGenerated === true) return true
    if (typeof o.aiLabel === 'string' && o.aiLabel.trim()) return true
    if (o.aiLabel && typeof o.aiLabel === 'object' && (o.aiLabel as { isGenerated?: unknown }).isGenerated === true) return true
    return isGeneratedPhotoSource(typeof o.source === 'string' ? o.source : null, imageUrl)
  }
  if (typeof rawSource === 'string') return isGeneratedPhotoSource(rawSource, imageUrl)
  return isGeneratedPhotoSource(null, imageUrl)
}

export function scheduleDayImageAiRightLabel(isGenerated: boolean | null | undefined): string | null {
  return isGenerated === true ? DAY_PHOTO_AI_LABEL_KO : null
}
