import { describe, expect, it } from 'vitest'
import {
  isAiGeneratedPublicOverlayRightLabel,
  publicImageOverlayRightLabelForDisplay,
} from '@/lib/public-image-overlay-ssot'

describe('public-image-overlay-ssot right label display', () => {
  it('detects AI generation label variants', () => {
    expect(isAiGeneratedPublicOverlayRightLabel('AI 생성 이미지')).toBe(true)
    expect(isAiGeneratedPublicOverlayRightLabel('AI 생성 참고 이미지')).toBe(true)
    expect(isAiGeneratedPublicOverlayRightLabel('AI로 만들었습니다')).toBe(true)
    expect(isAiGeneratedPublicOverlayRightLabel('AI로 생성되었습니다.')).toBe(true)
  })

  it('hides non-AI source labels', () => {
    expect(isAiGeneratedPublicOverlayRightLabel('Pexels 스톡 이미지')).toBe(false)
    expect(isAiGeneratedPublicOverlayRightLabel('Pexels 스톡이미지')).toBe(false)
    expect(isAiGeneratedPublicOverlayRightLabel('Photo by Jane on Pexels')).toBe(false)
    expect(isAiGeneratedPublicOverlayRightLabel('iStock 이미지')).toBe(false)
    expect(isAiGeneratedPublicOverlayRightLabel('Gemini 이미지')).toBe(false)
    expect(isAiGeneratedPublicOverlayRightLabel('제공 이미지')).toBe(false)
  })

  it('returns only AI labels for display', () => {
    expect(publicImageOverlayRightLabelForDisplay('AI 생성 이미지')).toBe('AI 생성 이미지')
    expect(publicImageOverlayRightLabelForDisplay('Pexels 스톡 이미지')).toBeNull()
    expect(publicImageOverlayRightLabelForDisplay('Photo by Jane on Pexels')).toBeNull()
    expect(publicImageOverlayRightLabelForDisplay(null)).toBeNull()
  })
})
