import { describe, expect, it } from 'vitest'
import {
  buildProductPublicSeoDocumentTitle,
  buildProductPublicSeoSocialTitle,
} from '@/lib/product-public-seo-title'

describe('buildProductPublicSeoDocumentTitle', () => {
  it('enriches meta title with destination and hashtags from original', () => {
    const t = buildProductPublicSeoDocumentTitle({
      displayTitle: '[동유럽] 체코·헝가리 9일 #노팁노옵션',
      originalTitle: '코카서스 3국 10일 KE #두바이관광 #인솔자동행',
      primaryDestination: '체코',
      duration: '7박 9일',
    })
    expect(t).toContain('체코')
    expect(t).toMatch(/#두바이관광|#인솔자동행/)
    expect(t).toContain('|')
  })
})

describe('buildProductPublicSeoSocialTitle', () => {
  it('uses display title and site name', () => {
    expect(
      buildProductPublicSeoSocialTitle({
        displayTitle: '베트남 다낭·호이안 5일',
        siteName: 'Bong투어',
      }),
    ).toBe('베트남 다낭·호이안 5일 | Bong투어')
  })
})
