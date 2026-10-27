import { describe, expect, it } from 'vitest'
import { resolvePublicProductDisplayFullTitle } from '@/lib/supplier-product-title-display'
import {
  normalizeNaeiltourRegisterListingTitle,
  stripNaeiltourBrandTokensForDisplay,
} from '@/lib/naeiltour-register-product-title'
import { buildProductPublicSeoDocumentTitle, buildProductPublicSeoSocialTitle } from '@/lib/product-public-seo-title'

describe('tab/og title = same display clean as detail full-name line (CEO 10/26 rule)', () => {
  it('strips status/promo/home-shopping words, keeps airline·노쇼핑·hashtags', () => {
    const t = resolvePublicProductDisplayFullTitle('출발확정【KE/11일】【인솔자동행/NO옵션】호주 시드니&뉴질랜드 남북섬 완전일주#시드니 5성급')
    expect(t).not.toMatch(/출발확정/)
    expect(t).toContain('KE')
    expect(t).toContain('#시드니 5성급')
    expect(resolvePublicProductDisplayFullTitle('★추석특가★ 이스턴 크루즈 3일 #비너스호 #부산항출발')).toBe('이스턴 크루즈 3일 #비너스호 #부산항출발')
    expect(resolvePublicProductDisplayFullTitle('[NS홈쇼핑] 내몽골(직항/오르도스)+초원+사막+별빛 5일 #사막크리스탈호텔')).not.toMatch(/홈쇼핑/)
    expect(resolvePublicProductDisplayFullTitle('[노쇼핑노옵션] 대만 3박4일 [티웨이항공] 단수이 #지우펀야경')).toContain('노쇼핑')
  })
  it('document/social title built from the cleaned title has no noise', () => {
    const displayTitle = resolvePublicProductDisplayFullTitle('[출발확정] 방콕/파타야 5일 #첫여행추천 #5성호텔')
    const input = { displayTitle, originalTitle: displayTitle, primaryDestination: '방콕', duration: '3박 5일' }
    expect(buildProductPublicSeoDocumentTitle(input)).not.toMatch(/출발확정/)
    expect(buildProductPublicSeoSocialTitle(input)).not.toMatch(/출발확정/)
    expect(buildProductPublicSeoDocumentTitle(input)).toContain('방콕/파타야 5일')
  })
  it('drops broken orphan bracket at edges', () => {
    expect(resolvePublicProductDisplayFullTitle(']<시내4성>타이중 자유여행 4일')).toBe('<시내4성>타이중 자유여행 4일')
    expect(resolvePublicProductDisplayFullTitle('[하노이] 하롱베이 5일')).toBe('[하노이] 하롱베이 5일')
  })
  it('falls back to raw when cleaning empties the title', () => {
    expect(resolvePublicProductDisplayFullTitle('')).toBe('')
    expect(resolvePublicProductDisplayFullTitle('오사카 3일')).toBe('오사카 3일')
  })
})

describe('naeiltour 금까기/진짜 strip leaves no bracket spaces', () => {
  it('ingest: brackets tidied', () => {
    expect(normalizeNaeiltourRegisterListingTitle('[진짜 영국일주 9일] #템즈강크루즈')).toBe('[영국일주 9일] #템즈강크루즈')
    expect(normalizeNaeiltourRegisterListingTitle('[푸꾸옥 인터컨티넨탈 금까기] #롱비치5성 #조식포함')).toBe('[푸꾸옥 인터컨티넨탈] #롱비치5성 #조식포함')
    expect(normalizeNaeiltourRegisterListingTitle('[금까기] 괌 PIC')).toBe('괌 PIC')
  })
  it('display: existing DB leftovers and restored originals come out clean', () => {
    expect(resolvePublicProductDisplayFullTitle('[ 영국일주 9일] #템즈강크루즈 #NO쇼핑&NO옵션')).toBe('[영국일주 9일] #템즈강크루즈 #NO쇼핑&NO옵션')
    expect(resolvePublicProductDisplayFullTitle('[푸꾸옥 인터컨티넨탈 ] #롱비치5성 #조식포함')).toBe('[푸꾸옥 인터컨티넨탈] #롱비치5성 #조식포함')
    expect(resolvePublicProductDisplayFullTitle('[진짜 영국일주 9일] #템즈강크루즈')).toBe('[영국일주 9일] #템즈강크루즈')
    expect(resolvePublicProductDisplayFullTitle('[가볍게 떠나는 여행, LITE TRIP] 후쿠오카 1박 2일 금까기')).toBe('[가볍게 떠나는 여행, LITE TRIP] 후쿠오카 1박 2일')
  })
  it('display keeps ordinary word 진짜 inside text', () => {
    expect(stripNaeiltourBrandTokensForDisplay('오사카 진짜맛집 3일')).toBe('오사카 진짜맛집 3일')
  })
})
