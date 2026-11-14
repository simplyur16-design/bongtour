/**
 * REGRESSION-FREEZE[seo-search-console-1115]
 * 서치 콘솔 11/9 집계 대응(중복 canonical·404·이미지 사이트맵) — canonical 유틸·마지막 정상본 캐시·410·죽은 주소 가드.
 * REGRESSION-FREEZE[seo-search-console-1115]: manifest vitestSuites
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {}, prismaRead: {} }))

import { XMLValidator } from 'fast-xml-parser'
import { toCanonicalPath, toCanonicalUrl } from '@/lib/seo/canonical-url'
import { createLastGoodCache } from '@/lib/seo/last-good-cache'
import {
  buildImageSitemapXml,
  IMAGE_SITEMAP_CONTENT_TYPE,
  SITEMAP_URL_MAX_LENGTH,
} from '@/lib/seo/image-sitemap'
import { buildEsimSearchMetadata } from '@/lib/seo/esim-search-metadata'
import {
  buildGoneProductHtml,
  GONE_PRODUCT_HEADERS,
  parseProductPathStatus,
} from '@/lib/product-path-status'
import { productPathStatusFromLookup } from '@/lib/product-path-status-from-lookup'
import { sitemapPublicProductWhere } from '@/lib/sitemap-product-where'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import { buildPublicSitemapEntries, sitemapStaticPaths } from '@/lib/sitemap-public-entries'

const ROOT = process.cwd()
const ORIGIN = 'https://bongtour.com'
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

function listRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) listRouteFiles(full, acc)
    else if (/^(page\.tsx|route\.ts)$/.test(ent.name)) acc.push(full)
  }
  return acc
}

function appRoutePatterns(): RegExp[] {
  const appDir = path.join(ROOT, 'app')
  return listRouteFiles(appDir).map((file) => {
    const rel = path.relative(appDir, path.dirname(file)).split(path.sep)
    const parts = rel.filter((s) => s && !/^\(.*\)$/.test(s))
    const body = parts
      .map((s) => (/^\[\[?\.\.\./.test(s) ? '.*' : /^\[.*\]$/.test(s) ? '[^/]+' : s.replace(/[.*+?^${}()|\\]/g, '\\$&')))
      .join('/')
    return new RegExp(`^/${body}/?$`)
  })
}

const METADATA_ROUTE_FILES: Record<string, string> = {
  '/sitemap.xml': 'app/sitemap.ts',
  '/robots.txt': 'app/robots.ts',
}

function pagePathExists(p: string, patterns: RegExp[]): boolean {
  if (p === '/' || p === '') return true
  const meta = METADATA_ROUTE_FILES[p]
  if (meta && fs.existsSync(path.join(ROOT, meta))) return true
  return patterns.some((r) => r.test(p))
}

describe('canonical 유틸 — 파라미터 없는 정식 주소', () => {
  it('쿼리·해시·끝 슬래시·중복 슬래시를 제거한다', () => {
    expect(toCanonicalPath('/products/abc?utm_source=naver&sort=price&page=2')).toBe('/products/abc')
    expect(toCanonicalPath('/products/abc/#top')).toBe('/products/abc')
    expect(toCanonicalPath('/products//abc//')).toBe('/products/abc')
    expect(toCanonicalPath('/')).toBe('/')
    expect(toCanonicalPath('/?utm_medium=cpc')).toBe('/')
    expect(toCanonicalPath('https://bongtour.com/travel/overseas?country=JP&city=osaka')).toBe('/travel/overseas')
  })

  it('해석 불가 입력은 null', () => {
    expect(toCanonicalPath('')).toBeNull()
    expect(toCanonicalPath(null)).toBeNull()
    expect(toCanonicalPath('relative/path')).toBeNull()
  })

  it('절대 주소는 origin 기준, 홈은 끝 슬래시 포함', () => {
    expect(toCanonicalUrl('/products/a?x=1', `${ORIGIN}/`)).toBe(`${ORIGIN}/products/a`)
    expect(toCanonicalUrl('/', ORIGIN)).toBe(`${ORIGIN}/`)
  })

  it('eSIM 메타는 쿼리가 섞인 경로가 들어와도 canonical·og:url 이 파라미터 없는 경로', () => {
    const m = buildEsimSearchMetadata({ title: '제목', description: '설명', path: '/travel/esim/catalog?country=JP&sort=a' })
    expect(m.alternates?.canonical).toBe('/travel/esim/catalog')
    expect((m.openGraph as { url?: string }).url).toBe('/travel/esim/catalog')
  })

  it('상품 상세·redirect 메타는 정식 경로 유틸을 거친다', () => {
    const src = read('app/products/[idOrSlug]/page.tsx')
    expect(src).toContain('REGRESSION-FREEZE[seo-canonical-param-free]')
    expect(src).toContain('toCanonicalPath(publicProductPath(p))')
    expect(src).toContain("alternates: { canonical: publicProductPath({ id: idOrSlug, slug: resolved.slug }) }")
  })

  it('상품 목록·허브·소개 페이지는 쿼리와 무관한 고정 canonical, 홈 기본값 상속 없음', () => {
    expect(read('lib/products-browse-metadata.ts')).toContain("canonical: '/products'")
    expect(read('app/travel/overseas/page.tsx')).toContain("canonical: '/travel/overseas'")
    expect(read('app/travel/air-hotel/page.tsx')).toContain("canonical: '/travel/air-hotel'")
    expect(read('app/business/page.tsx')).toContain("canonical: '/business'")
    const layout = read('app/layout.tsx')
    expect(layout).not.toMatch(/canonical:\s*['"]\/['"]/)
    expect(layout).not.toMatch(/url:\s*['"]\/['"]/)
  })

  it('색인 대상 공개 페이지(관리·인증·마이페이지·결제·simplyur 제외)는 모두 자기 canonical 을 낸다', () => {
    const appDir = path.join(ROOT, 'app')
    const skip = /^(admin|auth|mypage|dev|preview|api|simplyur)([\\/]|$)|checkout|order[\\/]\[orderId\]/
    const missing: string[] = []
    for (const file of listRouteFiles(appDir)) {
      if (!file.endsWith('page.tsx')) continue
      const rel = path.relative(appDir, file).replace(/\\/g, '/')
      if (skip.test(rel)) continue
      const src = fs.readFileSync(file, 'utf8')
      if (/permanentRedirect\(|redirect\(/.test(src) && !/export (const metadata|async function generateMetadata)/.test(src)) continue
      const hasCanonical = /canonical/.test(src) || /\bbuild\w*Metadata\(/.test(src)
      const noindex = /index:\s*false/.test(src)
      if (!hasCanonical && !noindex) missing.push(rel)
    }
    expect(missing, `canonical 없는 공개 페이지: ${missing.join(', ')}`).toEqual([])
  })
})

describe('마지막 정상본 캐시 — 생성 실패·지연이 5xx 가 되지 않는다', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('신선 기간에는 loader 를 다시 부르지 않는다', async () => {
    let t = 0
    const cache = createLastGoodCache<string>({ freshMs: 1000, timeoutMs: 50, now: () => t })
    const loader = vi.fn(async () => 'A')
    expect((await cache.get(loader, () => 'EMPTY')).source).toBe('rebuilt')
    t = 500
    const second = await cache.get(loader, () => 'EMPTY')
    expect(second).toEqual({ value: 'A', source: 'fresh' })
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('만료 후 재생성이 실패하면 마지막 정상본(stale)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let t = 0
    const cache = createLastGoodCache<string>({ freshMs: 10, timeoutMs: 50, now: () => t })
    await cache.get(async () => 'GOOD', () => 'EMPTY')
    t = 100
    const r = await cache.get(async () => {
      throw new Error('db down')
    }, () => 'EMPTY')
    expect(r).toEqual({ value: 'GOOD', source: 'stale' })
  })

  it('처음부터 실패하면 빈 fallback(urlset)을 반환하고 예외를 던지지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const cache = createLastGoodCache<string>({ freshMs: 10, timeoutMs: 50 })
    const r = await cache.get(async () => {
      throw new Error('db down')
    }, () => '<urlset/>')
    expect(r).toEqual({ value: '<urlset/>', source: 'fallback' })
  })

  it('재생성이 시간 제한을 넘으면 마지막 정상본으로 응답한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let t = 0
    const cache = createLastGoodCache<string>({ freshMs: 0, timeoutMs: 20, now: () => t })
    await cache.get(async () => 'GOOD', () => 'EMPTY')
    t = 100
    const r = await cache.get(() => new Promise<string>((resolve) => setTimeout(() => resolve('LATE'), 200)), () => 'EMPTY')
    expect(r).toEqual({ value: 'GOOD', source: 'stale' })
  })

  it('동시 요청은 한 번만 재생성한다', async () => {
    const cache = createLastGoodCache<string>({ freshMs: 0, timeoutMs: 200 })
    const loader = vi.fn(() => new Promise<string>((resolve) => setTimeout(() => resolve('X'), 20)))
    const [a, b] = await Promise.all([cache.get(loader, () => 'E'), cache.get(loader, () => 'E')])
    expect(a.value).toBe('X')
    expect(b.value).toBe('X')
    expect(loader).toHaveBeenCalledTimes(1)
  })
})

describe('이미지 사이트맵 — 이스케이프·네임스페이스·절대 URL·길이', () => {
  it('& < > 따옴표를 이스케이프하고 네임스페이스·절대 loc 을 유지한다', () => {
    const xml = buildImageSitemapXml(
      [
        {
          loc: `${ORIGIN}/products/a?x=1&y=2`,
          imageUrl: 'https://cdn.test/a.webp?w=1&h=2',
          caption: `He said "hi" & it's <ok>`,
          title: "A&B's",
        },
      ],
      ORIGIN,
    )
    expect(XMLValidator.validate(xml)).toBe(true)
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
    expect(xml).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"')
    expect(xml).toContain('<loc>https://bongtour.com/products/a?x=1&amp;y=2</loc>')
    expect(xml).toContain('<image:loc>https://cdn.test/a.webp?w=1&amp;h=2</image:loc>')
    expect(xml).toContain('He said &quot;hi&quot; &amp; it&apos;s &lt;ok&gt;')
    expect(xml).toMatch(/<image:loc>https?:\/\//)
  })

  it(`${SITEMAP_URL_MAX_LENGTH}자 넘는 주소 항목은 건너뛴다`, () => {
    const long = `https://cdn.test/${'a'.repeat(SITEMAP_URL_MAX_LENGTH)}.webp`
    const xml = buildImageSitemapXml(
      [
        { loc: `${ORIGIN}/products/long`, imageUrl: long },
        { loc: `${ORIGIN}/products/ok`, imageUrl: 'https://cdn.test/ok.webp' },
      ],
      ORIGIN,
    )
    expect(XMLValidator.validate(xml)).toBe(true)
    expect(xml).not.toContain('/products/long')
    expect(xml).toContain('/products/ok')
  })

  it('route: 마지막 정상본 캐시·XML Content-Type·캐시 헤더·HEAD·공개 상품만·국외연수 정식 주소', () => {
    const src = read('app/sitemap-images.xml/route.ts')
    expect(src).toContain('REGRESSION-FREEZE[seo-image-sitemap-last-good]')
    expect(src).toContain('createLastGoodCache<string>')
    expect(src).toContain('imageSitemapCache.get(')
    expect(src).toContain('s-maxage=300')
    expect(src).toContain('IMAGE_SITEMAP_CONTENT_TYPE')
    expect(src).toContain('export async function HEAD')
    expect(src).toContain("registrationStatus: 'registered'")
    expect(src).toContain('publicProductWhereClause()')
    expect(src).toContain('trainingProgramPublicPath(p)')
    expect(src).not.toContain('empty urlset')
    expect(IMAGE_SITEMAP_CONTENT_TYPE).toBe('application/xml; charset=utf-8')
  })

  it('sitemap.xml 도 같은 마지막 정상본 캐시를 쓰고 DB 오류를 삼켜 상품 0건으로 굳히지 않는다', () => {
    const src = read('app/sitemap.ts')
    expect(src).toContain('createLastGoodCache<MetadataRoute.Sitemap>')
    expect(src).toContain('sitemapPublicProductWhere()')
    expect(src).not.toContain('static URLs only')
  })
})

describe('사이트맵 = 현재 공개 상품 + 존재하는 정적 주소', () => {
  it('sitemapPublicProductWhere = 상세 조회와 같은 registered + publicProductWhereClause', () => {
    const now = new Date('2026-11-15T00:00:00Z')
    const w = sitemapPublicProductWhere(now)
    expect(w.registrationStatus).toBe('registered')
    expect(JSON.stringify(w)).toContain(JSON.stringify(publicProductWhereClause(now)))
    const resolver = read('lib/resolve-product-by-path-segment.ts')
    expect(resolver).toContain("registrationStatus: 'registered'")
    expect(resolver).toContain('publicProductWhereClause()')
  })

  it('홈 큐레이션 카드의 연결 상품은 상세가 열리는 공개 상품만(출발 종료 상품 404 링크 방지)', () => {
    const src = read('lib/home-season-pick.ts')
    const fn = src.slice(src.indexOf('export async function resolveValidMonthlyCurationLinkedProductIds'))
    expect(fn.slice(0, 900)).toContain('AND: [publicProductWhereClause()]')
    expect(src).toContain('REGRESSION-FREEZE[seo-no-dead-product-links]')
  })

  it('정적 sitemap 주소는 모두 실제 app 라우트이고 삭제된 /travel/domestic 은 없다', () => {
    const patterns = appRoutePatterns()
    const dead = sitemapStaticPaths()
      .map((e) => e.path || '/')
      .filter((p) => !pagePathExists(p, patterns))
    expect(dead, `없는 라우트: ${dead.join(', ')}`).toEqual([])
    expect(sitemapStaticPaths().some((e) => e.path.includes('/travel/domestic'))).toBe(false)
  })

  it('llms.txt 의 내부 링크는 모두 실제 라우트(또는 정적 파일)', () => {
    const patterns = appRoutePatterns()
    const urls = [...read('public/llms.txt').matchAll(/https:\/\/bongtour\.com(\/[^\s)\]>"']*)/g)].map((m) => m[1]!)
    expect(urls.length).toBeGreaterThan(5)
    const dead = urls
      .map((u) => toCanonicalPath(u) ?? u)
      .filter((p) => !pagePathExists(p, patterns) && !fs.existsSync(path.join(ROOT, 'public', p)))
    expect(dead, `llms.txt 죽은 주소: ${dead.join(', ')}`).toEqual([])
    expect(read('public/llms.txt')).not.toContain('/travel/domestic')
  })

  it('상품·연수 항목은 정식 주소(slug 우선, 연수는 /business/programs)', () => {
    const d = new Date('2026-11-01T00:00:00Z')
    const entries = buildPublicSitemapEntries({
      origin: ORIGIN,
      products: [{ id: 'cid1', slug: 'tokyo-3d', updatedAt: d }],
      trainingPrograms: [{ id: 'cid2', slug: 'otr-bt-0001', updatedAt: d }],
    })
    const urls = entries.map((e) => e.url)
    expect(urls).toContain(`${ORIGIN}/products/tokyo-3d`)
    expect(urls).toContain(`${ORIGIN}/business/programs/otr-bt-0001`)
    expect(urls.some((u) => u.includes('/products/otr-bt-'))).toBe(false)
    expect(urls.every((u) => !u.includes('?'))).toBe(true)
  })
})

describe('삭제 상품 410 — 홈 리다이렉트 금지, 국외연수는 정식 주소로 301', () => {
  it('gone 상태를 파싱하고, 공개 조회 not_found 는 그대로 404 계열로 둔다', () => {
    expect(parseProductPathStatus({ kind: 'gone' })).toEqual({ kind: 'gone' })
    expect(productPathStatusFromLookup({ kind: 'not_found' })).toEqual({ kind: 'not_found' })
    expect(parseProductPathStatus({ kind: 'redirect_path', path: '//evil.test' })).toBeNull()
  })

  it('410 본문은 noindex·목록 안내이고 홈으로 보내지 않는다', () => {
    const html = buildGoneProductHtml()
    expect(html).toContain('noindex')
    expect(html).toContain('href="/products"')
    expect(html).not.toMatch(/http-equiv=["']refresh/i)
    expect(GONE_PRODUCT_HEADERS['x-robots-tag']).toContain('noindex')
  })

  it('middleware 는 gone → 410, 국외연수 → 301(redirect_path), 삭제 상품을 홈으로 리다이렉트하지 않는다', () => {
    const mw = read('middleware.ts')
    expect(mw).toContain('REGRESSION-FREEZE[seo-deleted-product-410]')
    expect(mw).toContain("status?.kind === 'gone'")
    expect(mw).toContain('status: 410')
    expect(mw).toContain('status: 301')
    const block = mw.slice(mw.indexOf('const productSegment'), mw.indexOf('esimUnavailableNotFoundResponse(req)'))
    expect(block).not.toMatch(/Location:\s*['"`]\/['"`]/)
  })

  it('경로 상태 API 는 행이 아예 없을 때만 gone, 비공개·출발 종료 행은 404 유지', () => {
    const route = read('app/api/public/product-path-status/route.ts')
    expect(route).toContain("value.kind === 'not_found' && !(await productRowExistsForPathSegment(seg))")
    expect(route).toContain("value = { kind: 'gone' }")
    const resolver = read('lib/resolve-product-by-path-segment.ts')
    const fn = resolver.slice(resolver.indexOf('export async function productRowExistsForPathSegment'))
    expect(fn.slice(0, 400)).not.toContain('registrationStatus')
    expect(fn.slice(0, 400)).not.toContain('publicProductWhereClause')
  })
})
