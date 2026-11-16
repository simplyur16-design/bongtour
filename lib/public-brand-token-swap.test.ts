import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function src(path: string) {
  return readFileSync(path, 'utf8')
}

describe('public brand hex uses existing tokens', () => {
  it('상세 견적 카드의 남색·브랜드 블루는 토큰이다', () => {
    const quote = src('app/components/detail/ProductLiveQuoteCard.tsx')
    expect(quote).toContain('bg-bt-text-navy')
    expect(quote).toContain('border-bt-brand-blue-strong')
    expect(quote).not.toMatch(/#1[Ff]1[Bb]2[Dd]|#2[Ff]8[Ff][Cc]7/)
  })

  it('홈 페르소나 탭의 골드는 토큰이다', () => {
    const tabs = src('app/components/home/PersonaTabsClient.tsx')
    expect(tabs).toContain('ring-bt-brand-gold-strong')
    expect(tabs).not.toMatch(/#d9a81e/i)
  })
})
