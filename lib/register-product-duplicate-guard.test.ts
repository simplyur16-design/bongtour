import { describe, expect, it } from 'vitest'
import {
  extractRegisterProductDedupeKeys,
  groupProductsByRegisterDedupeKey,
  normalizeRegisterIngestSameTitleKey,
  normalizeRegisterOriginUrl,
  pickDuplicateProductKeeper,
  registrationStatusBlocksSameTitleIngest,
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

  it('extracts kyowontour tourCode from URL', () => {
    const keys = extractRegisterProductDedupeKeys(
      'kyowontour',
      'https://www.kyowontour.com/goods/goodsEventDetail?tourCode=MCP160260622WS01&menuCode=M510602',
    )
    expect(keys.some((k) => k.kind === 'supplierCode' && k.value.includes('MCP160260622WS01'))).toBe(true)
  })

  it('extracts ybtour evCd from URL', () => {
    const keys = extractRegisterProductDedupeKeys(
      'ybtour',
      'https://prdt.ybtour.co.kr/product/detailPackage?menu=PKG&evCd=ALP1122-260706QV00',
    )
    expect(keys.some((k) => k.kind === 'supplierCode' && k.value.includes('ALP1122'))).toBe(true)
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

// REGRESSION-FREEZE[register-ingest-same-title-dedupe]: 같은 상품명(항공사만 다른 코드) 수집 금지 — manifest
describe('normalizeRegisterIngestSameTitleKey', () => {
  it('collapses airline badge / IATA variants to the same key', () => {
    const a = normalizeRegisterIngestSameTitleKey('[KE] 오사카 3일 #미식여행')
    const b = normalizeRegisterIngestSameTitleKey('[OZ] 오사카 3일 #미식여행')
    const c = normalizeRegisterIngestSameTitleKey('대한항공 오사카 3일 #미식여행')
    expect(a).toBeTruthy()
    expect(a).toBe(b)
    expect(a).toBe(c)
  })

  it('returns empty for placeholder titles', () => {
    expect(normalizeRegisterIngestSameTitleKey('미입력')).toBe('')
    expect(normalizeRegisterIngestSameTitleKey('')).toBe('')
  })
})

describe('registrationStatusBlocksSameTitleIngest', () => {
  it('allows re-ingest after reject / auto_unpublished only', () => {
    expect(registrationStatusBlocksSameTitleIngest('pending')).toBe(true)
    expect(registrationStatusBlocksSameTitleIngest('registered')).toBe(true)
    expect(registrationStatusBlocksSameTitleIngest(null)).toBe(true)
    expect(registrationStatusBlocksSameTitleIngest('rejected')).toBe(false)
    expect(registrationStatusBlocksSameTitleIngest('auto_unpublished')).toBe(false)
  })
})
