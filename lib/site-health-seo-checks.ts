/**
 * 매시 SEO·AEO 점검 항목(공용 틀에 얹는다). 공개 상품·메뉴 페이지를 표본으로 읽어 기록만 한다(kind 'code').
 * eSIM 고객 문구 규칙: 유심사 표기 금지, 'eSIM(여행용)'·'고객센터' 사용.
 * 이후 작업(수집 분류·메가메뉴·톡톡·로고)은 이 배열에 자기 항목을 추가한다.
 * REGRESSION-FREEZE[site-health-hourly-1122]: SEO·AEO 점검 — 기록만, 자기 사이트만 — manifest
 */
import type { HealthCheck, HealthFinding } from '@/lib/site-health-registry'
import { parsePageSeoFacts, pathOf, type PageSeoFacts } from '@/lib/site-health-seo-parse'

export type SeoPageKind = 'product' | 'menu' | 'esim' | 'faq'

export type SeoPage = { path: string; kind: SeoPageKind; status: number; html: string | null }

export type SeoHealthCtx = {
  pages: SeoPage[]
  /** sitemap.xml 의 경로들(못 읽으면 null) */
  sitemapPaths: Set<string> | null
  /** 공개 상품 경로 전체(사이트맵 누락 점검용) */
  publicProductPaths: string[]
}

export const AEO_SUMMARY_MIN_CHARS = 40
export const PRODUCT_JSONLD_TYPES = ['Product', 'TouristTrip', 'Trip']
export const ESIM_FORBIDDEN_WORD_RE = /유심사|usimsa/i

const factsCache = new WeakMap<SeoPage, PageSeoFacts>()
function facts(p: SeoPage): PageSeoFacts | null {
  if (!p.html || p.status >= 400) return null
  let f = factsCache.get(p)
  if (!f) {
    f = parsePageSeoFacts(p.html)
    factsCache.set(p, f)
  }
  return f
}

function pageCheck(
  id: string,
  area: 'seo' | 'aeo',
  summary: string,
  test: (f: PageSeoFacts, p: SeoPage) => string | null,
): HealthCheck<SeoHealthCtx> {
  return {
    id,
    area,
    kind: 'code',
    summary,
    find(ctx) {
      const out: HealthFinding[] = []
      for (const p of ctx.pages) {
        const f = facts(p)
        if (!f) continue
        const why = test(f, p)
        if (why) out.push({ checkId: id, target: p.path, detail: why })
      }
      return out
    },
  }
}

export function canonicalProblem(f: PageSeoFacts, p: SeoPage): string | null {
  if (!f.canonical) return 'canonical missing'
  return pathOf(f.canonical) === pathOf(p.path) ? null : `canonical → ${pathOf(f.canonical)}`
}

export function jsonLdProblem(f: PageSeoFacts, p: SeoPage): string | null {
  if (f.jsonLdErrors > 0) return `json-ld parse errors ${f.jsonLdErrors}`
  if (p.kind !== 'product') return null
  const miss: string[] = []
  if (!f.jsonLdTypes.some((t) => PRODUCT_JSONLD_TYPES.includes(t))) miss.push('Product/Trip')
  if (!f.jsonLdTypes.includes('BreadcrumbList')) miss.push('BreadcrumbList')
  return miss.length ? `json-ld missing ${miss.join(',')}` : null
}

export const SEO_HEALTH_CHECKS: HealthCheck<SeoHealthCtx>[] = [
  {
    id: 'seo-page-fetch',
    area: 'seo',
    kind: 'code',
    summary: '공개 페이지 응답 오류',
    find: (ctx) =>
      ctx.pages.filter((p) => !p.html || p.status >= 400).map((p) => ({ checkId: 'seo-page-fetch', target: p.path, detail: `status ${p.status}` })),
  },
  pageCheck('seo-title', 'seo', 'title 없음', (f) => (f.title.length < 5 ? 'title missing' : null)),
  pageCheck('seo-description', 'seo', 'meta description 없음', (f) => (!f.description ? 'description missing' : null)),
  pageCheck('seo-canonical', 'seo', 'canonical 없음·불일치', canonicalProblem),
  pageCheck('seo-jsonld', 'seo', 'JSON-LD 오류(Product/Trip·BreadcrumbList)', jsonLdProblem),
  pageCheck('seo-img-alt', 'seo', '사진 alt 없음', (f) => (f.imgWithoutAlt > 0 ? `img without alt ${f.imgWithoutAlt}` : null)),
  {
    id: 'seo-sitemap',
    area: 'seo',
    kind: 'code',
    summary: '공개 상품의 sitemap 누락',
    find(ctx) {
      if (!ctx.sitemapPaths) return [{ checkId: 'seo-sitemap', target: '/sitemap.xml', detail: 'sitemap unreadable' }]
      const sm = ctx.sitemapPaths
      return ctx.publicProductPaths
        .filter((path) => !sm.has(pathOf(path)))
        .map((path) => ({ checkId: 'seo-sitemap', target: path, detail: 'not in sitemap' }))
    },
  },
  pageCheck('aeo-faq', 'aeo', '질문형 FAQ(FAQPage) 없음 — FAQ·eSIM 페이지', (f, p) =>
    (p.kind === 'esim' || p.kind === 'faq') && !f.jsonLdTypes.includes('FAQPage') ? 'FAQPage missing' : null,
  ),
  pageCheck('aeo-summary', 'aeo', `상품 요약(description) ${AEO_SUMMARY_MIN_CHARS}자 미만`, (f, p) =>
    p.kind === 'product' && f.description && f.description.length < AEO_SUMMARY_MIN_CHARS ? `summary ${f.description.length} chars` : null,
  ),
  pageCheck('aeo-esim-wording', 'aeo', 'eSIM 고객 문구 유심사 노출', (f) => {
    const m = f.visibleText.match(ESIM_FORBIDDEN_WORD_RE) ?? (ESIM_FORBIDDEN_WORD_RE.test(f.title + f.description) ? ['meta'] : null)
    return m ? `forbidden word: ${m[0]}` : null
  }),
]
