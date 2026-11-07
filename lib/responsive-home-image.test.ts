import { describe, expect, it } from 'vitest'
import { homeHubTrainingSrcSet, preferMobileHubLocalVariant } from '@/lib/home-mobile-hub-tile-images'
import { pexelsResponsiveSrcSet } from '@/lib/responsive-image-srcset'

describe('speed-home-responsive-images', () => {
  // REGRESSION-FREEZE[speed-home-responsive-images]: mobile hub swaps base training — manifest
  it('uses the mobile training file when the bundle points at the base original', () => {
    expect(preferMobileHubLocalVariant('/images/home-hub/base/training.webp')).toBe(
      '/images/home-hub/mobile/training.webp',
    )
  })

  it('leaves remote urls unchanged', () => {
    const ncloud = 'https://kr.object.ncloudstorage.com/bongtour/places/unknown/unknown-pexels-38932251-detail1920.webp'
    expect(preferMobileHubLocalVariant(ncloud)).toBe(ncloud)
  })

  it('builds a training srcset from the two existing files', () => {
    expect(homeHubTrainingSrcSet('/images/home-hub/base/training.webp')).toBe(
      '/images/home-hub/mobile/training.webp 1181w, /images/home-hub/base/training.webp 1600w',
    )
    expect(homeHubTrainingSrcSet('/images/home-hub/base/overseas.webp')).toBeNull()
  })

  it('builds pexels srcset up to the authored width', () => {
    const src = 'https://images.pexels.com/photos/1128318/pexels-photo-1128318.jpeg?auto=compress&cs=tinysrgb&w=1200'
    const set = pexelsResponsiveSrcSet(src)
    expect(set).toContain('w=480')
    expect(set).toContain('480w')
    expect(set).toContain('w=768')
    expect(set).toContain('w=1200')
    expect(set).not.toContain('w=1600')
    expect(pexelsResponsiveSrcSet('https://kr.object.ncloudstorage.com/bongtour/a.webp')).toBeNull()
  })
})
