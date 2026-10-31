import { describe, expect, it } from 'vitest'
import {
  buildProductSlugRedirectLocation,
  fetchProductPathStatus,
  parseProductDetailPathSegment,
  parseProductPathStatus,
} from '@/lib/product-path-status'

const h = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null })

describe('product-path-status', () => {
  it('parses only single-segment detail paths', () => {
    expect(parseProductDetailPathSegment('/products/pkg-hn-0018')).toBe('pkg-hn-0018')
    expect(parseProductDetailPathSegment('/products/cmabc123/')).toBe('cmabc123')
    expect(parseProductDetailPathSegment('/products')).toBeNull()
    expect(parseProductDetailPathSegment('/products/a/b')).toBeNull()
    expect(parseProductDetailPathSegment('/products/%E0%A4%A')).toBeNull()
  })

  it('parses API bodies strictly', () => {
    expect(parseProductPathStatus({ kind: 'redirect', slug: 'pkg-x' })).toEqual({ kind: 'redirect', slug: 'pkg-x' })
    expect(parseProductPathStatus({ kind: 'redirect', slug: '' })).toBeNull()
    expect(parseProductPathStatus({ kind: 'not_found' })).toEqual({ kind: 'not_found' })
    expect(parseProductPathStatus({ error: 'x' })).toBeNull()
  })

  it('keeps public https host and query in Location', () => {
    expect(
      buildProductSlugRedirectLocation('pkg-hn-0018', '?d=1', h({ 'x-forwarded-host': 'bongtour.com', 'x-forwarded-proto': 'https' })),
    ).toBe('https://bongtour.com/products/pkg-hn-0018?d=1')
    expect(buildProductSlugRedirectLocation('pkg-a', '', h({ host: 'bongtour.com' }))).toBe('https://bongtour.com/products/pkg-a')
    expect(buildProductSlugRedirectLocation('pkg-a', '', h({}))).toBe('/products/pkg-a')
  })

  it('fails open (null) on error / non-ok', async () => {
    const bad = (async () => new Response('x', { status: 503 })) as unknown as typeof fetch
    expect(await fetchProductPathStatus('a', { origin: 'http://x', fetchImpl: bad })).toBeNull()
    const thrower = (async () => {
      throw new Error('down')
    }) as unknown as typeof fetch
    expect(await fetchProductPathStatus('a', { origin: 'http://x', fetchImpl: thrower })).toBeNull()
    const ok = (async () => Response.json({ kind: 'redirect', slug: 'pkg-a' })) as unknown as typeof fetch
    expect(await fetchProductPathStatus('a', { origin: 'http://x', fetchImpl: ok })).toEqual({ kind: 'redirect', slug: 'pkg-a' })
  })
})
