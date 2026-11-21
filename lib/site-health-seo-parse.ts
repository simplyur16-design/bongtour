/**
 * SEO·AEO 점검용 HTML 읽기(의존성 없음). 자기 사이트 공개 페이지만 읽는다.
 * REGRESSION-FREEZE[site-health-hourly-1122]: SEO·AEO 점검 파서 — manifest
 */

export type PageSeoFacts = {
  title: string
  description: string
  canonical: string
  jsonLdTypes: string[]
  jsonLdErrors: number
  imgWithoutAlt: number
  visibleText: string
}

function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'))
  return (m?.[2] ?? m?.[3] ?? '').trim()
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function collectTypes(node: unknown, out: string[]) {
  if (Array.isArray(node)) {
    for (const n of node) collectTypes(n, out)
    return
  }
  if (!node || typeof node !== 'object') return
  const o = node as Record<string, unknown>
  const t = o['@type']
  if (typeof t === 'string') out.push(t)
  else if (Array.isArray(t)) for (const x of t) if (typeof x === 'string') out.push(x)
  if (o['@graph']) collectTypes(o['@graph'], out)
}

export function parsePageSeoFacts(html: string): PageSeoFacts {
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? html
  const title = decode(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '')
  let description = ''
  let canonical = ''
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    if (attr(tag, 'name').toLowerCase() === 'description') description = decode(attr(tag, 'content'))
  }
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    if (attr(tag, 'rel').toLowerCase() === 'canonical') canonical = attr(tag, 'href')
  }
  const jsonLdTypes: string[] = []
  let jsonLdErrors = 0
  const ldRe = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  for (const m of html.matchAll(ldRe)) {
    try {
      collectTypes(JSON.parse(m[1]!), jsonLdTypes)
    } catch {
      jsonLdErrors++
    }
  }
  let imgWithoutAlt = 0
  for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) {
    if (/\saria-hidden\s*=\s*["']true["']/i.test(tag) || /\srole\s*=\s*["']presentation["']/i.test(tag)) continue
    if (!/\salt\s*=/i.test(tag) || !attr(tag, 'alt')) imgWithoutAlt++
  }
  const body = html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html
  const visibleText = decode(
    body
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()
  return { title, description, canonical, jsonLdTypes, jsonLdErrors, imgWithoutAlt, visibleText }
}

export function parseSitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decode(m[1]!))
}

export function pathOf(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/+$/, '') || '/'
  } catch {
    return (url.split('?')[0] ?? url).replace(/\/+$/, '') || '/'
  }
}
