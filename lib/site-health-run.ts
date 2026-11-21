/**
 * 매시 자동 점검 실행(사진 + SEO·AEO). 매시 30분 자동 사진 채움 실행 앞에서 돈다. AI 토큰 없음.
 * 사진 문제 칸은 비우고 같은 실행의 공개 상품 채움이 먼저 다시 채운다(refillIds).
 * 기록: 칸 비우기마다 AssetUsageLog(site-health-clear, 이전 URL — 되돌림 가능), 실행 요약은 stdout site-health-done.
 * REGRESSION-FREEZE[site-health-hourly-1122]: 매시 점검 실행 — 비우기 상한·간격·지터 — manifest
 */
import { prisma } from '@/lib/prisma'
import { recordAssetUsage } from '@/lib/asset-usage-log'
import { isMonochromePhotoUrl } from '@/lib/register-photo-monochrome'
import { publicProductPath } from '@/lib/product-public-path'
import { healthTotals, rotateByHour, runHealthChecks, type HealthCheckSummary } from '@/lib/site-health-registry'
import { PHOTO_HEALTH_CHECKS, type PhotoHealthProduct, type PhotoProbe } from '@/lib/site-health-photo-checks'
import { SEO_HEALTH_CHECKS, type SeoPage } from '@/lib/site-health-seo-checks'
import { parseSitemapLocs, pathOf } from '@/lib/site-health-seo-parse'

export const SITE_HEALTH_PROBE_BUDGET = 40
export const SITE_HEALTH_MONO_BUDGET = 6
export const SITE_HEALTH_PRODUCT_PAGES_PER_RUN = 6
export const SITE_HEALTH_MENU_PAGES_PER_RUN = 4
export const SITE_HEALTH_FIXED_PAGES: ReadonlyArray<{ path: string; kind: SeoPage['kind'] }> = [
  { path: '/', kind: 'menu' },
  { path: '/travel/esim', kind: 'esim' },
  { path: '/support', kind: 'faq' },
]

export type SiteHealthRunResult = {
  photo: HealthCheckSummary[]
  seo: HealthCheckSummary[]
  totals: { found: number; fixed: number; codeIssues: number }
  refillIds: string[]
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const gap = (base: number, jitter: number) => sleep(base + Math.floor(Math.random() * jitter))

function rotateAll<T>(list: readonly T[], now: Date, step: number): T[] {
  if (!list.length) return []
  const start = (Math.floor(now.getTime() / 3_600_000) * step) % list.length
  return [...list.slice(start), ...list.slice(0, start)]
}

async function fetchText(url: string, f: typeof fetch): Promise<{ status: number; text: string | null }> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 15_000)
    const res = await f(url, { signal: ctrl.signal, headers: { 'user-agent': 'bongtour-site-health' } })
    clearTimeout(t)
    return { status: res.status, text: res.ok ? await res.text() : null }
  } catch {
    return { status: 0, text: null }
  }
}

export async function clearPublicDayPhoto(productId: string, day: number, prevUrl: string, reason: string): Promise<boolean> {
  const p = await prisma.product.findUnique({ where: { id: productId }, select: { schedule: true } })
  if (!p?.schedule) return false
  let rows: unknown
  try {
    rows = JSON.parse(p.schedule)
  } catch {
    return false
  }
  if (!Array.isArray(rows)) return false
  let hit = false
  const next = rows.map((r) => {
    if (!r || typeof r !== 'object') return r
    const o = r as Record<string, unknown>
    if (Math.floor(Number(o.day)) !== day || String(o.imageUrl ?? '').trim() !== prevUrl) return r
    hit = true
    return { ...o, imageUrl: '' }
  })
  if (!hit) return false
  const wrote = await prisma.product.updateMany({ where: { id: productId, schedule: p.schedule }, data: { schedule: JSON.stringify(next) } })
  if (wrote.count !== 1) return false
  await recordAssetUsage({
    productId,
    day,
    assetPath: prevUrl,
    selectionMode: 'site-health',
    sourceType: 'site-health-clear',
    actorType: 'system',
    notes: `site-health:clear:${reason} prev=${prevUrl}`.slice(0, 1000),
  })
  return true
}

export async function runSiteHealthHourly(opts: {
  origin: string
  now?: Date
  fetchImpl?: typeof fetch
  /** 한 실행에서 비울 최대 칸 수(= 같은 실행에서 다시 채울 수 있는 공개 상품 수) */
  clearBudget?: number
}): Promise<SiteHealthRunResult> {
  const now = opts.now ?? new Date()
  const f = opts.fetchImpl ?? fetch
  const origin = opts.origin.replace(/\/$/, '')
  const all = await prisma.product.findMany({
    where: { registrationStatus: { equals: 'registered' } },
    select: { id: true, slug: true, bgImageUrl: true, schedule: true },
    orderBy: { id: 'asc' },
  })
  const products: PhotoHealthProduct[] = rotateAll(all, now, 7)

  const probeCache = new Map<string, PhotoProbe>()
  let probes = 0
  let monos = 0
  let clears = 0
  const clearBudget = Math.max(0, opts.clearBudget ?? 10)
  const refillIds = new Set<string>()
  const photo = await runHealthChecks(PHOTO_HEALTH_CHECKS, {
    products,
    async probe(url) {
      const hit = probeCache.get(url)
      if (hit) return hit
      if (probes >= SITE_HEALTH_PROBE_BUDGET) return null
      probes++
      await gap(300, 200)
      let r: PhotoProbe
      try {
        const res = await f(url, { method: 'HEAD' })
        const len = Number(res.headers.get('content-length'))
        r = { status: res.status, bytes: Number.isFinite(len) && len > 0 ? len : null }
      } catch {
        r = { status: 0, bytes: null }
      }
      // 연결 실패(0)는 깨짐으로 보지 않는다(일시 장애 SKIP)
      if (r.status === 0) return null
      probeCache.set(url, r)
      return r
    },
    async isMonochrome(url) {
      if (monos >= SITE_HEALTH_MONO_BUDGET) return null
      monos++
      await gap(300, 200)
      return isMonochromePhotoUrl(url, { fetchImpl: f })
    },
    async clearDayPhoto(productId, day, prevUrl, reason) {
      if (clears >= clearBudget) return false
      const ok = await clearPublicDayPhoto(productId, day, prevUrl, reason)
      if (ok) clears++
      return ok
    },
    refillIds,
  })

  const sm = await fetchText(`${origin}/sitemap.xml`, f)
  const locs = sm.text ? parseSitemapLocs(sm.text) : []
  const sitemapPaths = sm.text ? new Set(locs.map(pathOf)) : null
  const productPaths = all.map((p) => publicProductPath(p))
  const productPathSet = new Set(productPaths.map(pathOf))
  const fixedSet = new Set(SITE_HEALTH_FIXED_PAGES.map((p) => p.path))
  const menuPaths = [...new Set(locs.map(pathOf))].filter((p) => !productPathSet.has(p) && !fixedSet.has(p))
  const targets: Array<{ path: string; kind: SeoPage['kind'] }> = [
    ...SITE_HEALTH_FIXED_PAGES,
    ...rotateByHour(menuPaths, SITE_HEALTH_MENU_PAGES_PER_RUN, now).map((path) => ({ path, kind: 'menu' as const })),
    ...rotateByHour(productPaths, SITE_HEALTH_PRODUCT_PAGES_PER_RUN, now).map((path) => ({ path, kind: 'product' as const })),
  ]
  const pages: SeoPage[] = []
  for (const t of targets) {
    await gap(800, 400)
    const r = await fetchText(`${origin}${t.path}`, f)
    pages.push({ path: t.path, kind: t.kind, status: r.status, html: r.text })
  }
  const seo = await runHealthChecks(SEO_HEALTH_CHECKS, { pages, sitemapPaths, publicProductPaths: productPaths })

  const totals = healthTotals([...photo, ...seo])
  const brief = (l: HealthCheckSummary[]) =>
    l.map((s) => ({ id: s.id, found: s.found, fixed: s.fixed, remaining: s.remaining, samples: s.samples, ...(s.error ? { error: s.error } : {}) }))
  console.log(
    JSON.stringify({
      kind: 'site-health-done',
      at: now.toISOString(),
      products: all.length,
      pages: pages.length,
      probes,
      ...totals,
      photo: brief(photo),
      seo: brief(seo),
    }),
  )
  return { photo, seo, totals, refillIds: [...refillIds] }
}
