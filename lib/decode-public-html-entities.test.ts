import { describe, expect, it } from 'vitest'
import {
  collapseAdjacentDuplicateTitlePhrases,
  decodePublicHtmlEntities,
} from '@/lib/decode-public-html-entities'

describe('decodePublicHtmlEntities', () => {
  it('decodes rarr harr and hearts with or without semicolon', () => {
    expect(decodePublicHtmlEntities('A &rarr; B')).toBe('A → B')
    expect(decodePublicHtmlEntities('A &rarr B')).toBe('A → B')
    expect(decodePublicHtmlEntities('A &harr; B')).toBe('A ↔ B')
    expect(decodePublicHtmlEntities('A &harr B')).toBe('A ↔ B')
    expect(decodePublicHtmlEntities('love &hearts;')).toBe('love ♥')
    expect(decodePublicHtmlEntities('love &hearts')).toBe('love ♥')
  })

  it('decodes middot amp and numeric', () => {
    expect(decodePublicHtmlEntities('a &middot; b')).toBe('a · b')
    expect(decodePublicHtmlEntities('하노이&amp;하롱')).toBe('하노이&하롱')
    expect(decodePublicHtmlEntities('&#8594;')).toBe('→')
  })

  it('leaves unknown entities', () => {
    expect(decodePublicHtmlEntities('&notanentity;')).toBe('&notanentity;')
  })

  it('collapses adjacent duplicate title phrases', () => {
    expect(collapseAdjacentDuplicateTitlePhrases('홍콩실속 홍콩실속 금까2박3일')).toBe(
      '홍콩실속 금까2박3일',
    )
  })
})
