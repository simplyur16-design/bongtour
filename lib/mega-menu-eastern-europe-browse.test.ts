import { describe, expect, it } from 'vitest'
import {
  resolveMegaMenuGroupCountryKeySlugs,
  resolveMegaMenuMenuGroupSlugToCountryKeySlugs,
} from '@/lib/mega-menu-browse-group'

describe('mega menu — 동유럽 browse countryKey', () => {
  it('menuGroup eastern-europe resolves 체코·헝가리·폴란드·크로아티아·슬로베니아', () => {
    const keys = resolveMegaMenuGroupCountryKeySlugs('europe-me', 'eastern-europe')
    for (const want of ['czech', 'hungary', 'poland', 'croatia', 'slovenia']) {
      expect(keys).toContain(want)
    }
    expect(keys).not.toContain('eastern-europe')
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
  })
})
