import { describe, expect, it, vi } from 'vitest'
import { healthTotals, rotateByHour, runHealthChecks, type HealthCheck } from '@/lib/site-health-registry'
import {
  PHOTO_HEALTH_CHECKS,
  duplicateDaysInProduct,
  photoLooksAirportOrInflight,
  type PhotoHealthCtx,
  type PhotoHealthProduct,
} from '@/lib/site-health-photo-checks'
import { SEO_HEALTH_CHECKS, type SeoHealthCtx } from '@/lib/site-health-seo-checks'
import { parsePageSeoFacts, parseSitemapLocs } from '@/lib/site-health-seo-parse'

const sched = (days: Array<Record<string, unknown>>) => JSON.stringify(days)

function photoCtx(products: PhotoHealthProduct[], over: Partial<PhotoHealthCtx> = {}): PhotoHealthCtx & { cleared: string[] } {
  const cleared: string[] = []
  return {
    products,
    probe: async () => ({ status: 200, bytes: 100_000 }),
    isMonochrome: async () => false,
    clearDayPhoto: async (id, day, _u, reason) => {
      cleared.push(`${id}:${day}:${reason}`)
      return true
    },
    refillIds: new Set<string>(),
    cleared,
    ...over,
  }
}

const sum = async (ctx: PhotoHealthCtx) => Object.fromEntries((await runHealthChecks(PHOTO_HEALTH_CHECKS, ctx)).map((s) => [s.id, s]))

describe('site-health registry (공용 틀)', () => {
  it('항목 하나가 실패해도 나머지는 돌고, code 항목은 고치지 않고 남김으로 센다', async () => {
    const checks: HealthCheck<null>[] = [
      { id: 'boom', area: 'seo', kind: 'code', summary: '', find: () => { throw new Error('x') } },
      { id: 'code1', area: 'seo', kind: 'code', summary: '', find: () => [{ checkId: 'code1', target: '/a', detail: 'd' }] },
      {
        id: 'data1', area: 'photo', kind: 'data', summary: '',
        find: () => [1, 2, 3].map((i) => ({ checkId: 'data1', target: `p${i}`, detail: 'd' })),
        fix: async () => ({ fixed: true }),
      },
    ]
    const out = await runHealthChecks(checks, null, { maxFixesPerCheck: 2 })
    expect(out[0]!.error).toContain('x')
    expect(out[1]).toMatchObject({ found: 1, fixed: 0, remaining: 1 })
    expect(out[2]).toMatchObject({ found: 3, fixed: 2, remaining: 1 })
    expect(healthTotals(out)).toEqual({ found: 4, fixed: 2, codeIssues: 1 })
  })
  it('시각마다 다른 표본', () => {
    const l = [1, 2, 3, 4, 5]
    const a = rotateByHour(l, 2, new Date(3_600_000 * 0))
    const b = rotateByHour(l, 2, new Date(3_600_000 * 1))
    expect(a).toEqual([1, 2])
    expect(b).toEqual([3, 4])
  })
})

describe('site-health photo checks', () => {
  const place = (day: number, url: string, extra: Record<string, unknown> = {}) => ({
    day, title: 'Day', routeText: '에펠탑 - 루브르 박물관', imageKeyword: 'Eiffel Tower', imageUrl: url, ...extra,
  })
  it('상품 안 중복 사진은 뒤 일차만 비우고 같은 실행 재채움 대상에 넣는다', async () => {
    const p = { id: 'p1', bgImageUrl: 'c', schedule: sched([place(1, 'https://x/a.jpg'), place(2, 'https://x/b.jpg'), place(3, 'https://x/a.jpg?w=2')]) }
    expect(duplicateDaysInProduct(p).map((r) => r.day)).toEqual([3])
    const ctx = photoCtx([p])
    const s = await sum(ctx)
    expect(s['photo-dup-in-product']).toMatchObject({ found: 1, fixed: 1 })
    expect(ctx.cleared).toContain('p1:3:photo-dup-in-product')
    expect(ctx.refillIds.has('p1')).toBe(true)
  })
  it('수동 선택 사진과 다시 채울 수 없는 일차(키워드 없음)는 비우지 않는다', async () => {
    const p = {
      id: 'p2', bgImageUrl: 'c',
      schedule: sched([
        place(1, 'https://x/a.jpg'),
        place(2, 'https://x/a.jpg', { imageManualSelected: true }),
        { day: 3, title: '', routeText: '', imageKeyword: '', imageUrl: 'https://x/a.jpg' },
      ]),
    }
    const ctx = photoCtx([p])
    const s = await sum(ctx)
    expect(s['photo-dup-in-product']).toMatchObject({ found: 2, fixed: 0, remaining: 2 })
    expect(ctx.cleared).toEqual([])
  })
  it('공항·기내 사진은 잡고, 이동일 창밖(airplane view)은 잡지 않는다', () => {
    expect(photoLooksAirportOrInflight({ imageKeyword: 'Incheon Airport terminal' })).toBe(true)
    expect(photoLooksAirportOrInflight({ imageUrl: 'https://x/in-flight-meal.jpg' })).toBe(true)
    expect(photoLooksAirportOrInflight({ imageKeyword: 'Paris airplane view' })).toBe(false)
  })
  it('깨짐·용량 초과·흑백 일차는 비우고, 대표사진 문제는 기록만', async () => {
    const p = {
      id: 'p3', bgImageUrl: 'https://x/cover.jpg',
      schedule: sched([place(1, 'https://x/broken.jpg'), place(2, 'https://x/big.jpg'), place(3, 'https://x/mono.jpg')]),
    }
    const ctx = photoCtx([p], {
      probe: async (u) =>
        u.includes('broken') ? { status: 404, bytes: null } : u.includes('big') ? { status: 200, bytes: 900_000 } : u.includes('cover') ? { status: 200, bytes: 500_000 } : { status: 200, bytes: 10 },
      isMonochrome: async (u) => u.includes('mono'),
    })
    const s = await sum(ctx)
    expect(s['photo-broken-day']).toMatchObject({ found: 1, fixed: 1 })
    expect(s['photo-oversize-day']).toMatchObject({ found: 1, fixed: 1 })
    expect(s['photo-monochrome-day']).toMatchObject({ found: 1, fixed: 1 })
    expect(s['photo-cover-problem']).toMatchObject({ found: 1, fixed: 0, remaining: 1 })
  })
  it('예산이 끝난 probe(null)는 문제로 세지 않는다', async () => {
    const p = { id: 'p4', bgImageUrl: 'c', schedule: sched([place(1, 'https://x/a.jpg')]) }
    const s = await sum(photoCtx([p], { probe: async () => null, isMonochrome: async () => null }))
    expect(s['photo-broken-day']!.found).toBe(0)
    expect(s['photo-monochrome-day']!.found).toBe(0)
  })
  it('빈 일차·대표사진 없음은 재채움 대상에 넣는다(일정 글은 그대로)', async () => {
    const p = { id: 'p5', bgImageUrl: '', schedule: sched([place(1, ''), place(2, 'https://x/b.jpg')]) }
    const ctx = photoCtx([p])
    const s = await sum(ctx)
    expect(s['photo-empty-day']!.found).toBe(1)
    expect(s['photo-no-cover']!.found).toBe(1)
    expect(ctx.refillIds.has('p5')).toBe(true)
    expect(ctx.cleared).toEqual([])
  })
})

const goodProduct = `<html><head><title>파리 6일 패키지 | 봉투어</title><meta name="description" content="파리와 인터라켄을 6일 동안 돌아보는 패키지 여행입니다. 출발일별 가격을 확인하세요.">
<link rel="canonical" href="https://bongtour.com/products/pkg-1"></head><body>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Product"},{"@type":"BreadcrumbList"}]}</script>
<img src="a.jpg" alt="에펠탑"><img src="d.svg" alt="" aria-hidden="true"><p>eSIM(여행용) 고객센터</p></body></html>`

describe('site-health SEO·AEO', () => {
  it('파서: title·description·canonical·JSON-LD·alt·보이는 글', () => {
    const f = parsePageSeoFacts(goodProduct)
    expect(f.title).toContain('파리')
    expect(f.canonical).toBe('https://bongtour.com/products/pkg-1')
    expect(f.jsonLdTypes).toEqual(['Product', 'BreadcrumbList'])
    expect(f.imgWithoutAlt).toBe(0)
    expect(parseSitemapLocs('<urlset><url><loc>https://bongtour.com/products/pkg-1</loc></url></urlset>')).toEqual(['https://bongtour.com/products/pkg-1'])
  })
  it('정상 상품 페이지는 0건, 문제 페이지는 항목별로 기록(고치지 않음)', async () => {
    const bad = `<html><head><title></title></head><body><script type="application/ld+json">{bad</script><img src="x.jpg"><p>유심사 고객센터</p></body></html>`
    const ctx: SeoHealthCtx = {
      pages: [
        { path: '/products/pkg-1', kind: 'product', status: 200, html: goodProduct },
        { path: '/travel/esim', kind: 'esim', status: 200, html: bad },
        { path: '/gone', kind: 'menu', status: 500, html: null },
      ],
      sitemapPaths: new Set(['/products/pkg-1']),
      publicProductPaths: ['/products/pkg-1', '/products/pkg-2'],
    }
    const s = Object.fromEntries((await runHealthChecks(SEO_HEALTH_CHECKS, ctx)).map((x) => [x.id, x]))
    expect(s['seo-page-fetch']!.found).toBe(1)
    expect(s['seo-title']!.found).toBe(1)
    expect(s['seo-description']!.found).toBe(1)
    expect(s['seo-canonical']!.found).toBe(1)
    expect(s['seo-jsonld']!.found).toBe(1)
    expect(s['seo-img-alt']!.found).toBe(1)
    expect(s['seo-sitemap']!.samples[0]).toContain('/products/pkg-2')
    expect(s['aeo-faq']!.found).toBe(1)
    expect(s['aeo-esim-wording']!.found).toBe(1)
    expect(Object.values(s).every((x) => x.kind === 'code' && x.fixed === 0)).toBe(true)
  })
  it('상품 페이지에 Product/Trip·BreadcrumbList 가 없으면 기록', async () => {
    const html = goodProduct.replace('{"@type":"Product"},', '')
    const ctx: SeoHealthCtx = { pages: [{ path: '/products/pkg-1', kind: 'product', status: 200, html }], sitemapPaths: new Set(), publicProductPaths: [] }
    const s = Object.fromEntries((await runHealthChecks(SEO_HEALTH_CHECKS, ctx)).map((x) => [x.id, x]))
    expect(s['seo-jsonld']!.samples[0]).toContain('Product/Trip')
  })
})

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
