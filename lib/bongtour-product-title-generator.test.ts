/**
 * REGRESSION-FREEZE[bongtour-product-title-r5]: LLM 비활성·검증 실패 시 marketing_compose 폴백 — manifest
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateBongtourProductTitle } from '@/lib/bongtour-product-title-generator'
import { buildBongtourProductTitleFieldsForRegisterPreview } from '@/lib/bongtour-product-title-register-bridge'

const B41A =
  '[KE][NO옵션][ALL STAY POOL VILLA]푸꾸옥 5일▶[멜리아 빈펄 푸꾸옥(풀빌라)]'

describe('generateBongtourProductTitle marketing_compose fallback', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('when LLM disabled — still returns compose suggestion', async () => {
    vi.stubEnv('BONGTOUR_PRODUCT_TITLE_LLM_ENABLED', '0')
    const gen = await generateBongtourProductTitle({
      brandKey: 'lottetour',
      supplierDisplayLabel: '롯데관광',
      originalProductTitle: B41A,
      pastedBodyText: '',
      duration: '3박 5일',
      destination: '푸꾸옥',
      scheduleDayTitles: ['푸꾸옥'],
    })
    expect(gen.source).toBe('marketing_compose')
    expect(gen.title).toMatch(/푸꾸옥/)
    expect(gen.title).toMatch(/5일|3박/)
  })

  it('preview bridge exposes R-5 when listing title is acceptable', async () => {
    vi.stubEnv('BONGTOUR_PRODUCT_TITLE_LLM_ENABLED', '0')
    const prev = await buildBongtourProductTitleFieldsForRegisterPreview({
      brandKey: 'lottetour',
      originalProductTitle: B41A,
      supplierListingTitleRaw: B41A,
      pastedBodyText: '',
      duration: '3박 5일',
      destination: '푸꾸옥',
      scheduleDayTitles: ['푸꾸옥'],
    })
    expect(prev.listingTitleAcceptable).toBe(true)
    expect(prev.bongtourProductTitle?.trim()).toBeTruthy()
    expect(prev.bongtourProductTitle).toMatch(/푸꾸옥/)
  })
})
