import { describe, expect, it } from 'vitest'
import {
  buildBrandGuide,
  detectIdentityViolations,
  ensureRequiredHashtags,
  validateRequiredHashtags,
} from '@/lib/bong-marketing/bongtour-brand-guide'

describe('bongtour-brand-guide', () => {
  describe('buildBrandGuide', () => {
    it('패키지 트랙 가이드 포함', () => {
      const guide = buildBrandGuide('package')
      expect(guide).toContain('무제한 봉심 eSIM')
      expect(guide).toContain('성인 1인당 1 eSIM')
      expect(guide).toContain('판매대행')
      expect(guide).toContain('여행사의 모든 혜택을 다 챙겨드립니다')
    })

    it('자유여행 트랙은 eSIM 자동 포함 안 됨 명시', () => {
      const guide = buildBrandGuide('airtel')
      expect(guide).toContain('자유여행')
      expect(guide).toContain('별도')
    })

    it('Bong투어 표기 명시', () => {
      const guide = buildBrandGuide('package')
      expect(guide).toContain('Bong투어')
    })
  })

  describe('detectIdentityViolations', () => {
    it('가이드 단어 단독 사용 감지', () => {
      const v = detectIdentityViolations('전문 가이드가 동행합니다')
      expect(v.length).toBeGreaterThan(0)
      expect(v[0].message).toContain('가이드')
    })

    it('Bong투어 자체 가이드 표현 감지', () => {
      const v = detectIdentityViolations('Bong투어 자체 가이드가 동행합니다')
      expect(v.length).toBeGreaterThan(0)
    })

    it('Bong투어 큐레이터가 일정 설계 표현 감지', () => {
      const v = detectIdentityViolations('Bong투어 큐레이터가 일정을 세심하게 설계했어요')
      expect(v.length).toBeGreaterThan(0)
    })

    it('단정형 무제한 표현 감지', () => {
      const v = detectIdentityViolations('절대 무제한 데이터')
      expect(v.length).toBeGreaterThan(0)
    })

    it('정직한 표현은 통과 (가이드 단어 제외)', () => {
      const v = detectIdentityViolations(
        'Bong투어 추천상품이에요. 평점 좋은 상품으로 골랐어요.',
      )
      expect(v.length).toBe(0)
    })
  })

  describe('validateRequiredHashtags', () => {
    it('필수 해시태그 둘 다 있으면 통과', () => {
      const result = validateRequiredHashtags(['#봉투어', '#Bong투어', '#다낭'])
      expect(result.valid).toBe(true)
      expect(result.missing).toHaveLength(0)
    })

    it('#봉투어 누락 감지', () => {
      const result = validateRequiredHashtags(['#Bong투어', '#다낭'])
      expect(result.valid).toBe(false)
      expect(result.missing).toContain('#봉투어')
    })

    it('#Bong투어 누락 감지', () => {
      const result = validateRequiredHashtags(['#봉투어', '#다낭'])
      expect(result.valid).toBe(false)
      expect(result.missing).toContain('#Bong투어')
    })

    it('둘 다 누락', () => {
      const result = validateRequiredHashtags(['#다낭', '#여행'])
      expect(result.valid).toBe(false)
      expect(result.missing).toEqual(['#봉투어', '#Bong투어'])
    })
  })

  describe('ensureRequiredHashtags', () => {
    it('누락된 필수 태그를 앞에 추가', () => {
      const tags = ensureRequiredHashtags(['#다낭', '#여행'], 5)
      expect(tags[0]).toBe('#봉투어')
      expect(tags[1]).toBe('#Bong투어')
      expect(tags).toHaveLength(5)
    })
  })
})
