import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildProductPublicSeoDocumentTitle } from '@/lib/product-public-seo-title'
import { SITE_NAME } from '@/lib/site-metadata'

/**
 * REGRESSION-FREEZE[site-title-no-double-suffix]: 루트 layout title.template(`%s | Bong투어`)이 붙는 페이지에서
 * 이미 사이트명이 든 제목은 { absolute } 로 — 탭 제목 'Bong투어 | Bong투어' 겹침 금지 (상품 상세·eSIM·국외연수 등) — manifest
 * app/simplyur/** 는 다른 담당(박대리) 영역이라 검사에서 뺀다.
 */
const ROOT = path.resolve(__dirname, '..')
const BRAND_RE = /Bong투어|SITE_NAME|documentTitle/

function listRouteFiles(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) listRouteFiles(p, acc)
    else if (/^(page|layout)\.tsx?$/.test(e.name)) acc.push(p)
  }
  return acc
}

export function findDoubledSiteTitleLines(src: string): string[] {
  const out: string[] = []
  const stack: string[] = []
  const brandedConstTitle = /const\s+title\s*=.*(Bong투어|SITE_NAME)/.test(src)
  src.split('\n').forEach((ln, i) => {
    const t = ln.trim()
    const m = t.match(/^([A-Za-z_]+)\s*:\s*(.*)$/)
    const enclosing = stack.length ? stack[stack.length - 1] : ''
    const free = !/^(openGraph|twitter|title)$/.test(enclosing)
    if (free && m && m[1] === 'title' && !/^\{\s*absolute/.test(m[2]) && BRAND_RE.test(m[2])) out.push(`${i + 1}: ${t}`)
    if (free && t === 'title,' && brandedConstTitle) out.push(`${i + 1}: ${t}`)
    for (const ch of ln.replace(/(['"`]).*?\1/g, '')) {
      if (ch === '{') stack.push(m && ln.indexOf('{') > ln.indexOf(':') ? m[1] : '_')
      else if (ch === '}') stack.pop()
    }
  })
  return out
}

describe('site title — no doubled Bong투어 suffix', () => {
  it('no page/layout under app/ (except root layout, simplyur) sets a branded title without absolute', () => {
    const bad: string[] = []
    for (const f of listRouteFiles(path.join(ROOT, 'app'))) {
      const rel = path.relative(ROOT, f).replace(/\\/g, '/')
      if (rel === 'app/layout.tsx' || rel.startsWith('app/simplyur')) continue
      for (const l of findDoubledSiteTitleLines(fs.readFileSync(f, 'utf8'))) bad.push(`${rel}:${l}`)
    }
    expect(bad).toEqual([])
  })
  it('covers product detail and eSIM pages explicitly', () => {
    const files = [
      'app/products/[idOrSlug]/page.tsx',
      'app/travel/esim/page.tsx',
      'app/travel/esim/catalog/page.tsx',
      'app/travel/esim/product/[optionApiId]/page.tsx',
      'app/business/programs/page.tsx',
    ]
    for (const rel of files) {
      const src = fs.readFileSync(path.join(ROOT, rel), 'utf8')
      expect(findDoubledSiteTitleLines(src), rel).toEqual([])
      expect(src, rel).toContain('absolute:')
    }
  })
  it('detector flags the old patterns', () => {
    expect(findDoubledSiteTitleLines("export const metadata = {\n  title: 'eSIM 요금제 목록 | Bong투어 eSIM',\n}")).toHaveLength(1)
    expect(findDoubledSiteTitleLines('return {\n  title: isDraft ? `${documentTitle} (미리보기)` : documentTitle,\n}')).toHaveLength(1)
    expect(findDoubledSiteTitleLines("const title = `${p} | Bong투어 eSIM`\nreturn {\n  title,\n}")).toHaveLength(1)
    expect(findDoubledSiteTitleLines("export const metadata = {\n  title: '여행 상품 목록',\n  openGraph: {\n    title: `x | ${SITE_NAME}`,\n  },\n}")).toEqual([])
  })
  it('product document title carries the site name exactly once', () => {
    const t = buildProductPublicSeoDocumentTitle({ displayTitle: '오사카 3일', duration: '3일' } as never)
    expect(t.split(SITE_NAME).length - 1).toBe(1)
  })
})
