// REGRESSION-FREEZE[mega-menu-discover-parents]: 공급사 GNB parent = 그룹·탭 줄기 — manifest
import { describe, expect, it, beforeEach } from 'vitest'
import {
  buildMegaMenuDiscoverParentsMap,
  megaMenuDiscoverParentsForLabel,
  resetMegaMenuDiscoverParentsCache,
} from '@/lib/mega-menu-discover-parents'

describe('mega-menu-discover-parents', () => {
  beforeEach(() => resetMegaMenuDiscoverParentsCache())

  it('일본 도시 leaf → 일본·중분류 그룹 parent', () => {
    const p = megaMenuDiscoverParentsForLabel('오사카')
    expect(p).toContain('일본')
    expect(p).toContain('간사이')
  })

  it('베트남 도시 → 동남아·베트남 (UI 탭 라벨 아님)', () => {
    const p = megaMenuDiscoverParentsForLabel('다낭')
    expect(p).toContain('동남아')
    expect(p).toContain('베트남')
    expect(p).not.toContain('동남아/대만/서남아')
  })

  it('서유럽 국가 LC → 유럽 (파리 city leaf 없이 soft만)', () => {
    const fr = megaMenuDiscoverParentsForLabel('프랑스')
    expect(fr).toContain('유럽')
    const paris = megaMenuDiscoverParentsForLabel('파리')
    expect(paris[0]).toBe('프랑스')
    expect(paris).toContain('유럽')
  })

  it('미동부 도시 → 미주·미국·미동부', () => {
    const p = megaMenuDiscoverParentsForLabel('뉴욕')
    expect(p).toContain('미동부')
    expect(p).toContain('미주')
  })

  it('맵에 UI 탭 복합 라벨을 leaf parent로 넣지 않음', () => {
    const map = buildMegaMenuDiscoverParentsMap()
    for (const parents of Object.values(map)) {
      expect(parents.join(' ')).not.toMatch(/유럽\/중동\/아프리카|동남아\/대만/)
    }
  })
})
