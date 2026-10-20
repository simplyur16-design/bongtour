import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/** REGRESSION-FREEZE[product-detail-departure-url-no-searchparams]: 상품 상세 깜빡임 가드 — manifest */
describe('product detail flicker guards', () => {
  it('departure deep-link hook never imports next/navigation', () => {
    const src = readFileSync(join(process.cwd(), 'lib/use-product-departure-url-param.ts'), 'utf8')
    expect(src).toContain('REGRESSION-FREEZE[product-detail-departure-url-no-searchparams]')
    expect(src).not.toMatch(/from ['"]next\/navigation['"]/)
    expect(src).not.toMatch(/\buseSearchParams\b\s*\(/)
  })

  it('transition shell does not pulse-overlay skeleton or InstantFromCard on SSR body', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/products/ProductDetailTransitionShell.tsx'),
      'utf8',
    )
    expect(src).toContain('REGRESSION-FREEZE[product-detail-departure-url-no-searchparams]')
    expect(src).not.toContain('showSkeleton')
    expect(src).not.toContain('ProductDetailPageSkeleton')
    expect(src).not.toContain('ProductDetailInstantFromCard')
    expect(src).not.toContain('showCardOverlay')
    expect(src).not.toMatch(/className=\{[^}]*\bhidden\b[^}]*\}[^>]*>\s*\{children\}/)
  })

  it('product detail Suspense uses skeleton fallback not null', () => {
    const src = readFileSync(join(process.cwd(), 'app/products/[idOrSlug]/page.tsx'), 'utf8')
    expect(src).toContain('ProductDetailPageSkeleton')
    expect(src).not.toMatch(/Suspense\s+fallback=\{null\}/)
  })
})
