/**
 * 검색 노출 수정·빠른 색인 (2026-11-14) — sitemap 필터·canonical·검색 문구·IndexNow SKIP.
 * REGRESSION-FREEZE[seo-fix-1114]: manifest vitestSuites
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {}, prismaRead: {} }))

import { XMLValidator } from 'fast-xml-parser'
import { sitemapPublicProductWhere, sitemapTrainingProgramWhere } from '@/lib/sitemap-product-where'
import { buildPublicSitemapEntries } from '@/lib/sitemap-public-entries'
import { publicProductWhereClause } from '@/lib/product-sales-policy'
import {
  buildImageSitemapXml,
  normalizeSitemapImageUrl,
  stripInvalidXmlChars,
} from '@/lib/seo/image-sitemap'
import { parseProductPathStatus, isSafeInternalRedirectPath } from '@/lib/product-path-status'
import { productPathStatusFromLookup } from '@/lib/product-path-status-from-lookup'
import {
  buildEsimSearchMetadata,
  ESIM_SEARCH_FORBIDDEN_BRAND_RE,
  ESIM_SEARCH_LABEL,
  sanitizeEsimSearchCopy,
} from '@/lib/seo/esim-search-metadata'
import {
  HOME_PAGE_DESCRIPTION,
  HOME_PAGE_KEYWORDS,
  HOME_PAGE_TITLE,
  buildHomePageMetadata,
} from '@/lib/home-page-metadata'
import { buildSiteJsonLdGraph } from '@/lib/seo/site-json-ld'
import {
  buildBusinessHubJsonLd,
  buildTrainingProgramJsonLd,
  buildTrainingProgramMetadata,
  buildTrainingProgramsListMetadata,
  jsonLdScriptHtml,
} from '@/lib/seo/training-json-ld'
import {
  __peekIndexNowQueueForTests,
  __resetIndexNowQueueForTests,
  computeIndexNowDelayMs,
  filterIndexNowUrls,
  INDEXNOW_TIMING,
  queueIndexNowUrls,
  resolveIndexNowKey,
  submitIndexNow,
} from '@/lib/seo/indexnow'
import { productPublicUrlsForIndex } from '@/lib/seo/product-index-events'
import { publicProductSsrIndexWhere, toPublicProductSsrIndexItem } from '@/lib/public-product-ssr-index'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SEO_HTML_LIMITED_BOTS } = require('./html-limited-bots.js') as { SEO_HTML_LIMITED_BOTS: RegExp }

const ROOT = path.resolve(__dirname, '../..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const ORIGIN = 'https://bongtour.com'

const PROGRAM = {
  id: 'cm_training_1',
  slug: 'otr-bt-0001',
  title: '[복지연수] 독일, 스위스 연수 8일',
  bgImageUrl: 'https://kr.object.ncloudstorage.com/bongtour/x.webp',
  summary: null,
  trainingDescription: '<p>복지 시설 견학</p>',
  primaryDestination: '독일',
  destination: null,
  durationDays: 8,
  duration: '6박 8일',
}

describe('sitemap — DB 공개 상품만, lastmod=updatedAt', () => {
  it('일반 상품 where = registered + 공개 판정 + 국외연수 제외', () => {
    const now = new Date('2026-11-14T03:00:00Z')
    const w = sitemapPublicProductWhere(now)
    expect(w.registrationStatus).toBe('registered')
    const and = w.AND as unknown[]
    expect(and[0]).toEqual(publicProductWhereClause(now))
    expect(JSON.stringify(and[1])).toContain('overseas_training')
    expect(JSON.stringify(w)).not.toMatch(/pending|rejected|pre_photo_blocked|auto_unpublished/)
  })

  it('국외연수 where = registered + overseas_training', () => {
    expect(sitemapTrainingProgramWhere()).toEqual({ registrationStatus: 'registered', listingKind: 'overseas_training' })
  })

  it('상품 lastmod = updatedAt, 정적 URL lastmod 없음, 국외연수는 /business/programs, 넘겨받지 않은(삭제) 상품은 없음', () => {
    const updatedAt = new Date('2026-11-14T02:00:00Z')
    const entries = buildPublicSitemapEntries({
      origin: ORIGIN,
      products: [{ id: 'c1', slug: 'pkg-hn-0001', updatedAt }],
      trainingPrograms: [{ id: 't1', slug: 'otr-bt-0001', updatedAt }],
    })
    const prod = entries.find((e) => e.url === `${ORIGIN}/products/pkg-hn-0001`)
    expect(prod?.lastModified).toEqual(updatedAt)
    expect(entries.find((e) => e.url === `${ORIGIN}/business/programs/otr-bt-0001`)?.lastModified).toEqual(updatedAt)
    expect(entries.some((e) => e.url.includes('/products/otr-bt-'))).toBe(false)
    expect(entries.some((e) => e.url.includes('pkg-mt-0170'))).toBe(false)
    expect(entries.filter((e) => !e.url.includes('/products/') && !e.url.includes('/programs/')).every((e) => e.lastModified == null)).toBe(true)
  })

  it('app/sitemap.ts 는 공용 where·force-dynamic 사용', () => {
    const src = read('app/sitemap.ts')
    expect(src).toContain('sitemapPublicProductWhere()')
    expect(src).toContain('sitemapTrainingProgramWhere()')
    expect(src).toContain("dynamic = 'force-dynamic'")
  })
})

describe('이미지 sitemap — 유효 XML', () => {
  it('제어문자·특수문자·상대 이미지 주소가 있어도 XML 이 유효하고 잘못된 이미지는 빠진다', () => {
    const xml = buildImageSitemapXml(
      [
        { loc: `${ORIGIN}/products/a`, imageUrl: 'https://x.test/a b.webp', caption: 'Tom & Jerry <b>\u0008', title: '제목\u000b"q"' },
        { loc: `${ORIGIN}/products/b`, imageUrl: '/images/b.webp', caption: '', title: null },
        { loc: `${ORIGIN}/products/c`, imageUrl: 'data:image/png;base64,xx' },
        { loc: `${ORIGIN}/products/d`, imageUrl: '' },
        { loc: `${ORIGIN}/products/a`, imageUrl: 'https://x.test/dup.webp' },
      ],
      ORIGIN,
    )
    expect(XMLValidator.validate(xml)).toBe(true)
    expect(xml).toContain('<loc>https://bongtour.com/products/a</loc>')
    expect(xml).toContain('<image:loc>https://x.test/a%20b.webp</image:loc>')
    expect(xml).toContain('<image:loc>https://bongtour.com/images/b.webp</image:loc>')
    expect(xml).not.toContain('/products/c')
    expect(xml).not.toContain('/products/d')
    expect(xml.match(/\/products\/a</g)?.length).toBe(1)
    expect(xml).toContain('Tom &amp; Jerry &lt;b&gt;')
    expect(xml).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/)
  })

  it('빈 목록도 유효한 urlset', () => {
    expect(XMLValidator.validate(buildImageSitemapXml([], ORIGIN))).toBe(true)
  })

  it('normalize·strip 헬퍼', () => {
    expect(normalizeSitemapImageUrl('//cdn.test/x.webp', ORIGIN)).toBe('https://cdn.test/x.webp')
    expect(normalizeSitemapImageUrl('relative.webp', ORIGIN)).toBeNull()
    expect(stripInvalidXmlChars('a\u0000b\uFFFEc')).toBe('abc')
  })

  it('route 는 국외연수를 /business/programs 로, XML 빌더·HEAD·Content-Type 사용', () => {
    const src = read('app/sitemap-images.xml/route.ts')
    expect(src).toContain('trainingProgramPublicPath(p)')
    expect(src).toContain('buildImageSitemapXml(entries, origin)')
    expect(src).toContain('export async function HEAD')
    expect(src).toContain('IMAGE_SITEMAP_CONTENT_TYPE')
  })
})

describe('canonical·중복 주소', () => {
  it('국외연수 /products/<slug> → /business/programs/<slug> (redirect_path), 일반 상품은 그대로', () => {
    expect(
      productPathStatusFromLookup({ kind: 'render', productId: 'x', slug: 'otr-bt-0003', productType: null, listingKind: 'overseas_training' }),
    ).toEqual({ kind: 'redirect_path', path: '/business/programs/otr-bt-0003' })
    expect(productPathStatusFromLookup({ kind: 'redirect', slug: 'otr-bt-0003', listingKind: 'overseas_training' })).toEqual({
      kind: 'redirect_path',
      path: '/business/programs/otr-bt-0003',
    })
    expect(
      productPathStatusFromLookup({ kind: 'render', productId: 'x', slug: 'pkg-hn-0001', productType: null, listingKind: 'travel' }),
    ).toEqual({ kind: 'render' })
    expect(productPathStatusFromLookup({ kind: 'redirect', slug: 'pkg-hn-0001' })).toEqual({ kind: 'redirect', slug: 'pkg-hn-0001' })
    expect(productPathStatusFromLookup({ kind: 'not_found' })).toEqual({ kind: 'not_found' })
  })

  it('redirect_path 파싱은 내부 경로만 (open redirect 금지)', () => {
    expect(parseProductPathStatus({ kind: 'redirect_path', path: '/business/programs/otr-bt-0001' })).toEqual({
      kind: 'redirect_path',
      path: '/business/programs/otr-bt-0001',
    })
    expect(parseProductPathStatus({ kind: 'redirect_path', path: '//evil.test/x' })).toBeNull()
    expect(parseProductPathStatus({ kind: 'redirect_path', path: 'https://evil.test' })).toBeNull()
    expect(isSafeInternalRedirectPath('/a\\b')).toBe(false)
  })

  it('middleware 는 redirect_path 를 301 로', () => {
    const src = read('middleware.ts')
    expect(src).toMatch(/status\?\.kind === 'redirect_path'[\s\S]{0,200}status: 301/)
  })

  it('국외연수 목록·상세 메타: canonical = og:url = 자기 주소, og 이미지 있음', () => {
    const list = buildTrainingProgramsListMetadata()
    expect(list.alternates?.canonical).toBe('/business/programs')
    expect((list.openGraph as { url?: string }).url).toBe('/business/programs')
    expect(String((list.openGraph as { title?: unknown }).title)).toContain('국외연수')
    const d = buildTrainingProgramMetadata(PROGRAM)
    expect(d.alternates?.canonical).toBe('/business/programs/otr-bt-0001')
    expect((d.openGraph as { url?: string }).url).toBe('/business/programs/otr-bt-0001')
    expect(String(d.description)).toContain('국외연수')
  })

  it('국외연수 JSON-LD: BreadcrumbList + TouristTrip / Service, </script> 탈출 방지', () => {
    const detail = JSON.stringify(buildTrainingProgramJsonLd(PROGRAM))
    expect(detail).toContain('"BreadcrumbList"')
    expect(detail).toContain('"TouristTrip"')
    expect(detail).toContain('https://')
    const hub = JSON.stringify(buildBusinessHubJsonLd())
    expect(hub).toContain('"Service"')
    expect(hub).toContain('연수기관 섭외')
    expect(jsonLdScriptHtml({ a: '</script><x>' })).not.toContain('</script>')
  })

  it('루트 layout 은 og:url·robots 기본값을 두지 않는다 (404 robots 충돌·og:url=홈 방지)', () => {
    const src = read('app/layout.tsx')
    const og = src.slice(src.indexOf('openGraph:'), src.indexOf('twitter:'))
    expect(og).not.toMatch(/url:\s*'\/'/)
    expect(src).not.toMatch(/robots:\s*\{/)
  })

  it('검색 크롤러(Googlebot 포함)는 metadata 를 head 로 받는다 (htmlLimitedBots)', () => {
    expect(SEO_HTML_LIMITED_BOTS.test('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true)
    expect(
      SEO_HTML_LIMITED_BOTS.test(
        'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      ),
    ).toBe(true)
    expect(SEO_HTML_LIMITED_BOTS.test('Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)')).toBe(true)
    expect(SEO_HTML_LIMITED_BOTS.test('Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)')).toBe(true)
    expect(SEO_HTML_LIMITED_BOTS.test('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36')).toBe(false)
    expect(read('next.config.js')).toContain('htmlLimitedBots: SEO_HTML_LIMITED_BOTS')
  })

  it('/inquiry og:image 지정', () => {
    const src = read('app/inquiry/page.tsx')
    expect(src).toContain('images: INQUIRY_OG_IMAGES')
  })
})

describe('검색용 문구 — 유심사 표기 없음, eSIM(여행용)·고객센터', () => {
  const ESIM_PAGES = [
    'app/travel/esim/page.tsx',
    'app/travel/esim/catalog/page.tsx',
    'app/travel/esim/recommend/page.tsx',
    'app/travel/esim/guide/page.tsx',
    'app/travel/esim/devices/page.tsx',
    'app/travel/esim/policy/page.tsx',
    'app/travel/esim/help/customer-support/page.tsx',
    'app/travel/esim/help/device-compatibility/page.tsx',
    'app/travel/esim/help/service-help/page.tsx',
    'app/travel/esim/help/setup-guide/page.tsx',
    'app/travel/esim/benefits/chatgpt/page.tsx',
    'app/travel/esim/benefits/google-maps/page.tsx',
    'app/travel/esim/benefits/quality-guarantee/page.tsx',
    'app/travel/esim/benefits/traveler-verification/page.tsx',
    'app/travel/esim/product/[optionApiId]/page.tsx',
  ]

  function metadataBlock(src: string): string {
    const i = src.search(/export (const metadata|async function generateMetadata)/)
    expect(i).toBeGreaterThanOrEqual(0)
    // 메타 객체/함수 끝(첫 줄머리 `}`)까지만 — 본문 JSX 는 검색 메타가 아님
    const rest = src.slice(i)
    const end = rest.search(/\n\};?\s*\n/)
    const j = end > 0 ? i + end + 3 : -1
    // 주석은 검색 문구가 아니다 — 제거 후 검사
    return src
      .slice(i, j > i ? j : undefined)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
  }

  it.each(ESIM_PAGES)('%s 메타에 공급사 이름 없음 + eSIM(여행용) + canonical=og url', (rel) => {
    const block = metadataBlock(read(rel))
    expect(block).not.toMatch(ESIM_SEARCH_FORBIDDEN_BRAND_RE)
    expect(block).toMatch(/buildEsimSearchMetadata\(/)
    if (!rel.includes('[optionApiId]')) {
      expect(block).toContain('eSIM(여행용)')
      const p = block.match(/path:\s*["']([^"']+)["']/)?.[1]
      expect(p).toBe('/' + rel.replace(/^app\//, '').replace(/\/page\.tsx$/, ''))
    }
  })

  it('buildEsimSearchMetadata: og·twitter 채움, 공급사 표기 제거', () => {
    const m = buildEsimSearchMetadata({
      title: '유심사 eSIM(여행용) 일본 | Bong투어 eSIM(여행용)',
      description: '유심사 고객센터로 문의하세요. USIMSA eSIM',
      path: '/travel/esim/x',
    })
    const s = JSON.stringify(m)
    expect(s).not.toMatch(ESIM_SEARCH_FORBIDDEN_BRAND_RE)
    expect(s).toContain(ESIM_SEARCH_LABEL)
    expect(s).toContain('고객센터')
    expect((m.openGraph as { url?: string }).url).toBe('/travel/esim/x')
    expect(m.alternates?.canonical).toBe('/travel/esim/x')
    expect((m.twitter as { card?: string }).card).toBe('summary_large_image')
  })

  it('sanitizeEsimSearchCopy', () => {
    expect(sanitizeEsimSearchCopy('유심사 Esim(여행용) 일본 3일')).toBe('eSIM(여행용) 일본 3일')
    expect(sanitizeEsimSearchCopy('유심사고객센터')).toBe('고객센터')
    expect(sanitizeEsimSearchCopy('일본 3일 / 무제한')).toBe('일본 3일 / 무제한')
  })

  it('홈 title·description·keywords·JSON-LD: 국외연수·eSIM(여행용), 공급사 이름 없음', () => {
    expect(HOME_PAGE_TITLE).toContain('국외연수')
    expect(HOME_PAGE_TITLE).toContain('eSIM(여행용)')
    expect(HOME_PAGE_DESCRIPTION).toContain('국외연수')
    expect(HOME_PAGE_KEYWORDS).toContain('국외연수')
    const meta = JSON.stringify(buildHomePageMetadata([{ url: '/og/default.webp' }]))
    const ld = JSON.stringify(buildSiteJsonLdGraph())
    for (const s of [meta, ld]) expect(s).not.toMatch(ESIM_SEARCH_FORBIDDEN_BRAND_RE)
    const graph = buildSiteJsonLdGraph()['@graph'] as Array<Record<string, unknown>>
    const agency = graph.find((n) => n['@type'] === 'TravelAgency') as { knowsAbout: string[] }
    expect(agency.knowsAbout).toContain('국외연수')
    const list = graph.find((n) => n['@type'] === 'ItemList') as { itemListElement: Array<{ url: string }> }
    expect(list.itemListElement.some((x) => x.url.endsWith('/business/programs'))).toBe(true)
  })

  it('llms.txt: 국외연수 포함, 404 주소(/travel/domestic) 없음, 공급사 이름 없음', () => {
    const t = read('public/llms.txt')
    expect(t).toContain('https://bongtour.com/business/programs')
    expect(t).toContain('국외연수')
    expect(t).toContain('eSIM(여행용)')
    expect(t).not.toContain('/travel/domestic')
    expect(t).not.toMatch(ESIM_SEARCH_FORBIDDEN_BRAND_RE)
  })
})

describe('IndexNow — 실패·키 없음은 SKIP, throw 없음', () => {
  const okEnv = { INDEXNOW_KEY: 'abcdef0123456789' }
  const noSleep = async () => {}
  const silent = () => {}

  beforeEach(() => __resetIndexNowQueueForTests())
  afterEach(() => {
    __resetIndexNowQueueForTests()
    vi.useRealTimers()
  })

  it('키 없으면 fetch 하지 않고 SKIP', async () => {
    const f = vi.fn()
    const r = await submitIndexNow([`${ORIGIN}/products/a`], { env: {}, origin: ORIGIN, fetchImpl: f as never, log: silent })
    expect(r).toMatchObject({ status: 'skip', reason: 'no_key' })
    expect(f).not.toHaveBeenCalled()
    expect(resolveIndexNowKey({ INDEXNOW_KEY: 'short' })).toBeNull()
  })

  it('운영 origin 이 아니면 SKIP', async () => {
    const f = vi.fn()
    const r = await submitIndexNow(['http://localhost:3000/products/a'], {
      env: okEnv,
      origin: 'http://localhost:3000',
      fetchImpl: f as never,
      log: silent,
    })
    expect(r).toMatchObject({ status: 'skip', reason: 'non_production_origin' })
    expect(f).not.toHaveBeenCalled()
  })

  it('네트워크 실패 → 재시도 1회 후 SKIP (throw 없음)', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    const sleep = vi.fn(noSleep)
    const r = await submitIndexNow([`${ORIGIN}/products/a`], { env: okEnv, origin: ORIGIN, fetchImpl: f as never, sleep, log: silent })
    expect(r.status).toBe('skip')
    expect(f).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(INDEXNOW_TIMING.retryDelayMs)
  })

  it('5xx → 1회 재시도 후 성공하면 sent', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response('', { status: 202 }))
    const r = await submitIndexNow([`${ORIGIN}/products/a`, `${ORIGIN}/products/a`, 'https://other.test/x'], {
      env: okEnv,
      origin: ORIGIN,
      fetchImpl: f as never,
      sleep: noSleep,
      log: silent,
    })
    expect(r).toMatchObject({ status: 'sent', count: 1, attempts: 2, httpStatus: 202 })
    const body = JSON.parse((f.mock.calls[0][1] as { body: string }).body)
    expect(body).toMatchObject({ host: 'bongtour.com', key: okEnv.INDEXNOW_KEY, keyLocation: `${ORIGIN}/indexnow-key.txt` })
    expect(body.urlList).toEqual([`${ORIGIN}/products/a`])
  })

  it('403(키 불일치)은 재시도하지 않고 SKIP', async () => {
    const f = vi.fn().mockResolvedValue(new Response('', { status: 403 }))
    const r = await submitIndexNow([`${ORIGIN}/products/a`], { env: okEnv, origin: ORIGIN, fetchImpl: f as never, sleep: noSleep, log: silent })
    expect(r).toMatchObject({ status: 'skip', reason: 'http_403' })
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('큐: 키 없으면 예약 안 함, 키 있으면 묶어서 간격+지터 후 1회 전송', async () => {
    queueIndexNowUrls([`${ORIGIN}/products/a`], { env: {}, log: silent })
    expect(__peekIndexNowQueueForTests().scheduled).toBe(false)

    vi.useFakeTimers()
    const f = vi.fn().mockResolvedValue(new Response('', { status: 200 }))
    const deps = { env: okEnv, origin: ORIGIN, fetchImpl: f as never, sleep: noSleep, log: silent, random: () => 0.5 }
    queueIndexNowUrls([`${ORIGIN}/products/a`], deps)
    queueIndexNowUrls([`${ORIGIN}/products/b`], deps)
    expect(__peekIndexNowQueueForTests()).toEqual({ pending: [`${ORIGIN}/products/a`, `${ORIGIN}/products/b`], scheduled: true })
    await vi.advanceTimersByTimeAsync(INDEXNOW_TIMING.debounceMs - 1)
    expect(f).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(INDEXNOW_TIMING.jitterMs + 10)
    expect(f).toHaveBeenCalledTimes(1)
    expect(JSON.parse((f.mock.calls[0][1] as { body: string }).body).urlList).toHaveLength(2)
  })

  it('간격 계산: 직전 전송 직후면 최소 간격 이상 + 지터', () => {
    expect(computeIndexNowDelayMs(1_000_000, 0, () => 0)).toBe(INDEXNOW_TIMING.debounceMs)
    expect(computeIndexNowDelayMs(1_000_000, 1_000_000 - 1_000, () => 0)).toBe(INDEXNOW_TIMING.minIntervalMs - 1_000)
    expect(computeIndexNowDelayMs(1_000_000, 0, () => 0.999)).toBeLessThan(INDEXNOW_TIMING.debounceMs + INDEXNOW_TIMING.jitterMs)
  })

  it('URL 필터·이벤트 URL', () => {
    expect(filterIndexNowUrls(['/products/a', `${ORIGIN}/products/a#x`, 'https://evil.test/a'], ORIGIN)).toEqual([`${ORIGIN}/products/a`])
    expect(productPublicUrlsForIndex(ORIGIN, { id: 'c1', slug: 'pkg-hn-0001', listingKind: 'travel' })).toEqual([`${ORIGIN}/products/pkg-hn-0001`])
    expect(productPublicUrlsForIndex(ORIGIN, { id: 't1', slug: 'otr-bt-0001', listingKind: 'overseas_training' })).toEqual([
      `${ORIGIN}/business/programs/otr-bt-0001`,
    ])
  })

  it('Google Indexing API 미사용', () => {
    for (const rel of ['lib/seo/indexnow.ts', 'lib/seo/product-index-events.ts']) {
      expect(read(rel)).not.toMatch(/indexing\.googleapis\.com|urlNotifications/)
    }
  })
})

describe('목록 SSR — 공개 상품 링크·h1', () => {
  it('where: registered + 공개 + 국외연수 제외, 해외 허브는 자유여행 제외', () => {
    const all = JSON.stringify(publicProductSsrIndexWhere('all'))
    expect(all).toContain('"registrationStatus":"registered"')
    expect(all).toContain('overseas_training')
    expect(all).not.toContain('air_hotel_free')
    expect(JSON.stringify(publicProductSsrIndexWhere('overseas_package'))).toContain('air_hotel_free')
  })

  it('항목: slug 링크·표시 제목·짧은 설명', () => {
    const it0 = toPublicProductSsrIndexItem({
      id: 'c1',
      slug: 'pkg-hn-0001',
      title: '상해/소주 4일',
      primaryDestination: '상해',
      destination: null,
      duration: '3박4일',
      localDepartureTag: [],
      departureAirportLabel: null,
    })
    expect(it0.href).toBe('/products/pkg-hn-0001')
    expect(it0.title).toContain('상해')
    expect(it0.summary).toContain('상해 · 3박4일')
  })

  it('/products 는 Suspense fallback 에 h1+서버 목록, /travel/overseas 는 sr-only h1 + 로딩 자리 서버 목록', () => {
    const p = read('app/products/page.tsx')
    expect(p).toMatch(/fallback=\{\s*<PublicProductSsrIndex[\s\S]*heading="여행 상품 목록"/)
    expect(read('app/travel/overseas/page.tsx')).toContain('<h1 className="sr-only">해외여행 패키지 상품</h1>')
    expect(read('app/components/travel/overseas/OverseasBrowseSlot.tsx')).toContain('ssrFallback=')
  })

  it('상품 상세 h1 은 1개 — 히어로 짧은 제목·sticky 제목은 <p>', () => {
    const src = read('app/components/detail/product-detail-visual.tsx')
    const h1Count = (src.match(/<h1[\s>]/g) ?? []).length
    expect(h1Count).toBe(1)
  })
})
