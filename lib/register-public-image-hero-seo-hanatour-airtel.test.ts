import { describe, expect, it } from 'vitest'
import { buildRegisterPublicImageHeroSeoKeywords } from '@/lib/register-public-image-hero-seo-line-candidate'

const SYDNEY_AIRTEL_SNIPPET = `[자유여행] 시드니 6일 #항공권+호텔+여행자보험 #5성급 시드니 파라독스 호텔
해시태그
#편안한여행#로맨틱한하루#설레는시드니#시드니여행#호주자유여행#파라독스호텔#시드니항공권#블루마운틴투어#포트스티븐스투어
4박 6일`

describe('hanatour airtel register SEO keywords', () => {
  it('harvests glued hashtags from 해시태그 block', () => {
    const kw = buildRegisterPublicImageHeroSeoKeywords({
      rawBodyText: SYDNEY_AIRTEL_SNIPPET,
      title: '[자유여행] 시드니 6일 #항공권+호텔+여행자보험 #5성급 시드니 파라독스 호텔',
      primaryDestination: '시드니',
      destination: '시드니',
      duration: '4박 6일',
      scheduleDayTitles: [],
      originSourceForFallback: 'hanatour',
    })
    expect(kw).not.toBeNull()
    expect(kw!.length).toBeGreaterThanOrEqual(2)
    expect(kw!.join(' ')).toMatch(/시드니|호주|블루마운틴|포트스티븐|파라독스/)
  })
})
