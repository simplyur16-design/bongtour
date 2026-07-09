import { describe, expect, it } from 'vitest'
import { resolveBrowseCountryParamToCountryKeySlugs } from '@/lib/browse-country-url-resolve'
import {
  findMegaMenuGroup,
  resolveMegaMenuEuropeMenuGroupExclusiveFilter,
  resolveMegaMenuGroupCountryKeySlugs,
  resolveMegaMenuMenuGroupSlugToCountryKeySlugs,
} from '@/lib/mega-menu-browse-group'

describe('mega menu — 동유럽 browse countryKey', () => {
  it('findMegaMenuGroup accepts Korean column labels (서유럽·동유럽·북유럽)', () => {
    expect(findMegaMenuGroup('europe-me', '서유럽')?.countryLabel).toBe('서유럽')
    expect(findMegaMenuGroup('europe-me', '동유럽')?.countryLabel).toBe('동유럽')
    expect(findMegaMenuGroup('europe-me', '북유럽')?.countryLabel).toBe('북유럽')
    expect(findMegaMenuGroup('europe-me', 'western-europe')?.countryLabel).toBe('서유럽')
  })

  it('menuGroup eastern-europe resolves 체코·헝가리·폴란드·크로아티아·슬로베니아', () => {
    const keys = resolveMegaMenuGroupCountryKeySlugs('europe-me', 'eastern-europe')
    for (const want of ['czech', 'hungary', 'poland', 'croatia', 'slovenia']) {
      expect(keys).toContain(want)
    }
    expect(keys).not.toContain('eastern-europe')
    expect(keys).not.toContain('prague')
    expect(keys).not.toContain('warsaw')
  })

  it('Korean 동유럽 slug resolves same country keys as eastern-europe', () => {
    const en = resolveMegaMenuGroupCountryKeySlugs('europe-me', 'eastern-europe')
    const kr = resolveMegaMenuGroupCountryKeySlugs('europe-me', '동유럽')
    expect(kr.sort()).toEqual(en.sort())
  })

  it('region slug eastern-europe maps across tabs to 동유럽 leaf countries', () => {
    const keys = resolveMegaMenuMenuGroupSlugToCountryKeySlugs('eastern-europe')
    expect(keys).toContain('czech')
    expect(keys).toContain('hungary')
    expect(keys).not.toContain('eastern-europe')
  })

  it('menuGroup western-europe resolves 서유럽 LC countries', () => {
    const keys = resolveMegaMenuGroupCountryKeySlugs('europe-me', 'western-europe')
    for (const want of ['italy', 'france', 'switzerland', 'uk', 'germany', 'austria']) {
      expect(keys).toContain(want)
    }
    expect(keys).not.toContain('poland')
    expect(keys).not.toContain('czech')
    expect(keys).not.toContain('london')
  })

  it('menuGroup northern-europe resolves 북유럽 LC countries', () => {
    const keys = resolveMegaMenuGroupCountryKeySlugs('europe-me', 'northern-europe')
    for (const want of ['denmark', 'norway', 'sweden', 'finland', 'iceland']) {
      expect(keys).toContain(want)
    }
    expect(keys).not.toContain('italy')
    expect(keys).not.toContain('czech')
  })

  it('austria slug does not pull poland via 동유럽 bucket', () => {
    const keys = resolveBrowseCountryParamToCountryKeySlugs('austria')
    expect(keys).toContain('austria')
    expect(keys).not.toContain('poland')
  })

  it('서유럽 menuGroup excludes 동유럽·북유럽 countryKeys', () => {
    const filter = resolveMegaMenuEuropeMenuGroupExclusiveFilter('europe-me', 'western-europe')
    expect(filter).not.toBeNull()
    expect(filter!.include).toContain('austria')
    expect(filter!.exclude).toContain('czech')
    expect(filter!.exclude).toContain('hungary')
    expect(filter!.exclude).toContain('norway')
    expect(filter!.include).not.toContain('poland')
  })

  it('동유럽 menuGroup includes eastern keys without excluding western (오스트리아+체코 3국)', () => {
    const filter = resolveMegaMenuEuropeMenuGroupExclusiveFilter('europe-me', '동유럽')
    expect(filter).not.toBeNull()
    expect(filter!.include).toContain('czech')
    expect(filter!.include).toContain('hungary')
    expect(filter!.exclude).not.toContain('austria')
    expect(filter!.exclude.length).toBe(0)
  })

  it('북유럽 menuGroup excludes 서유럽·동유럽 countryKeys', () => {
    const filter = resolveMegaMenuEuropeMenuGroupExclusiveFilter('europe-me', '북유럽')
    expect(filter).not.toBeNull()
    expect(filter!.include).toContain('denmark')
    expect(filter!.exclude).toContain('italy')
    expect(filter!.exclude).toContain('czech')
  })
})
