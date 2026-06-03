import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('ProductDetailTransitionShell', () => {
  it('renders children without hidden gate (skeleton overlay only)', () => {
    const src = readFileSync(
      join(process.cwd(), 'components/products/ProductDetailTransitionShell.tsx'),
      'utf8',
    )
    expect(src).toContain('showSkeleton')
    expect(src).toContain('ProductDetailPageSkeleton')
    expect(src).not.toMatch(/className=\{[^}]*\bhidden\b[^}]*\}[^>]*>\s*\{children\}/)
    expect(src).not.toMatch(/children[\s\S]{0,80}className="[^"]*\bhidden\b/)
  })
})
