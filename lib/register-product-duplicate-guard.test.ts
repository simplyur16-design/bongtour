import { describe, expect, it } from 'vitest'
import {
  extractRegisterProductDedupeKeys,
  groupProductsByRegisterDedupeKey,
  normalizeRegisterOriginUrl,
  pickDuplicateProductKeeper,
  shouldWarnRegisterOriginUrlDuplicate,
} from '@/lib/register-product-duplicate-guard'

describe('normalizeRegisterOriginUrl', () => {
  it('trims trailing slash', () => {
    expect(normalizeRegisterOriginUrl('https://example.com/a/')).toBe('https://example.com/a')
  })
})

describe('extractRegisterProductDedupeKeys', () => {
  it('extracts modetour productNo from URL', () => {
    const keys = extractRegisterProductDedupeKeys(
      'modetour',
      'https://www.modetour.com/package/12345?foo=1',
    )
    expect(keys.some((k) => k.kind === 'supplierCode' && k.value.includes('12345'))).toBe(true)
  })
})

describe('groupProductsByRegisterDedupeKey', () => {
  it('groups rows sharing normalized URL', () => {
    const rows = [
      {
        id: 'a',
        originSource: 'modetour',
        originCode: 'PSN1',
        originUrl: 'https://www.modetour.com/package/1/',
        registrationStatus: 'registered',
        title: 'A',
        updatedAt: new Date('2026-06-01'),
      },
      {
        id: 'b',
        originSource: 'modetour',
        originCode: 'PSN2',
        originUrl: 'https://www.modetour.com/package/1',
        registrationStatus: 'pending',
        title: 'B',
        updatedAt: new Date('2026-06-02'),
      },
    ]
    const groups = groupProductsByRegisterDedupeKey(rows)
    const urlGroup = groups.find((g) => g.dedupeKey.startsWith('originUrl|'))
    expect(urlGroup?.products).toHaveLength(2)
  })
})

describe('shouldWarnRegisterOriginUrlDuplicate', () => {
  it('excludes rejected so re-register after reject does not false-alarm', () => {
    expect(shouldWarnRegisterOriginUrlDuplicate('rejected')).toBe(false)
    expect(shouldWarnRegisterOriginUrlDuplicate('registered')).toBe(true)
    expect(shouldWarnRegisterOriginUrlDuplicate('pending')).toBe(true)
    expect(shouldWarnRegisterOriginUrlDuplicate(null)).toBe(true)
  })
})

describe('pickDuplicateProductKeeper', () => {
  it('prefers registered over pending', () => {
    const keeper = pickDuplicateProductKeeper([
      {
        id: 'pending',
        originSource: 'hanatour',
        originCode: 'x',
        originUrl: null,
        registrationStatus: 'pending',
        title: 'p',
        updatedAt: new Date('2026-06-10'),
      },
      {
        id: 'registered',
        originSource: 'hanatour',
        originCode: 'y',
        originUrl: null,
        registrationStatus: 'registered',
        title: 'r',
        updatedAt: new Date('2026-06-01'),
      },
    ])
    expect(keeper.id).toBe('registered')
  })
})
