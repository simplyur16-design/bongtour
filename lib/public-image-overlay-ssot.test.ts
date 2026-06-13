import { describe, expect, it } from 'vitest'
import {
  isGenericPexelsStockPublicOverlayLabel,
  publicImageOverlayHideOnMobile,
  publicImageOverlayRightLabelMobileClass,
} from '@/lib/public-image-overlay-ssot'

describe('public-image-overlay-ssot mobile Pexels stock', () => {
  it('detects Pexels stock label and photographer credit', () => {
    expect(isGenericPexelsStockPublicOverlayLabel('Pexels 스톡 이미지')).toBe(true)
    expect(isGenericPexelsStockPublicOverlayLabel('Pexels 스톡이미지')).toBe(true)
    expect(isGenericPexelsStockPublicOverlayLabel('pexels 스톡 이미지')).toBe(true)
    expect(isGenericPexelsStockPublicOverlayLabel('Photo by Jane on Pexels')).toBe(true)
    expect(isGenericPexelsStockPublicOverlayLabel('Photo by 홍길동 on Pexels')).toBe(true)
  })

  it('keeps AI and non-Pexels sources visible', () => {
    expect(isGenericPexelsStockPublicOverlayLabel('AI로 만들었습니다')).toBe(false)
    expect(isGenericPexelsStockPublicOverlayLabel('AI 생성 이미지')).toBe(false)
    expect(isGenericPexelsStockPublicOverlayLabel('Photo by Jane on Unsplash')).toBe(false)
    expect(isGenericPexelsStockPublicOverlayLabel('iStock 이미지')).toBe(false)
  })

  it('hides overlay on mobile when only Pexels right label', () => {
    expect(publicImageOverlayHideOnMobile(null, 'Pexels 스톡 이미지')).toBe(true)
    expect(publicImageOverlayHideOnMobile(null, 'Photo by Jane on Pexels')).toBe(true)
    expect(publicImageOverlayHideOnMobile('오사카 · 일본', 'Pexels 스톡 이미지')).toBe(false)
    expect(publicImageOverlayHideOnMobile(null, 'AI 생성 이미지')).toBe(false)
  })

  it('adds md:inline for Pexels right labels', () => {
    expect(publicImageOverlayRightLabelMobileClass('Pexels 스톡이미지')).toBe('hidden md:inline')
    expect(publicImageOverlayRightLabelMobileClass('Photo by Jane on Pexels')).toBe('hidden md:inline')
    expect(publicImageOverlayRightLabelMobileClass('AI 생성 이미지')).toBe('')
  })
})
