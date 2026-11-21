import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function src(path: string) {
  return readFileSync(path, 'utf8')
}

describe('public brand hex uses existing tokens', () => {
  it('상세 견적 카드의 남색은 토큰이고, 사실 비교 블루는 여행사별 비교 리스트에 있다', () => {
    const quote = src('app/components/detail/ProductLiveQuoteCard.tsx')
    expect(quote).toContain('bg-bt-text-navy')
    expect(quote).not.toMatch(/#1[Ff]1[Bb]2[Dd]|#2[Ff]8[Ff][Cc]7/)
    const shelf = src('app/components/detail/SimilarItineraryDetailShelf.tsx')
    expect(shelf).toContain('border-bt-brand-blue-strong')
  })

  it('홈 페르소나 탭의 골드는 토큰이다', () => {
    const tabs = src('app/components/home/PersonaTabsClient.tsx')
    expect(tabs).toContain('ring-bt-brand-gold-strong')
    expect(tabs).not.toMatch(/#d9a81e/i)
  })
})
