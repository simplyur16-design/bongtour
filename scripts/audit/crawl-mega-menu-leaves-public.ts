/**
 * Public GET crawl of mega-menu leaf hrefs on https://bongtour.com
 * - concurrency ≤ 2, delay ≥ 300ms
 * - GET only; no POST/login/admin
 * Writes docs/audit/2026-10-24/mega-menu-crawl.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const BASE = 'https://bongtour.com'
const DELAY_MS = 350
const CONCURRENCY = 2

type Leaf = { href: string; leafLabel: string; tabId: string; kind: string }

async function fetchOne(href: string) {
  const url = href.startsWith('http') ? href : `${BASE}${href}`
  const t0 = Date.now()
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'user-agent': 'bongtour-audit-phase-a/1.0 (read-only)' },
    })
    const text = await res.text()
    const cardHints =
      (text.match(/product-card|ProductCard|data-product|href="\/products\//g) || []).length
    return {
      href,
      status: res.status,
      finalUrl: res.url,
      ms: Date.now() - t0,
      cardHintCount: cardHints,
      ok: res.status >= 200 && res.status < 400,
    }
  } catch (e) {
    return {
      href,
      status: 0,
      finalUrl: null as string | null,
      ms: Date.now() - t0,
      cardHintCount: 0,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}

async function poolMap<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx]!)
      await new Promise((r) => setTimeout(r, DELAY_MS))
    }
  }
  await Promise.all(Array.from({ length: n }, () => worker()))
  return out
}

async function main() {
  const leavesPath = join(process.cwd(), 'docs/audit/2026-10-24/mega-menu-leaves.json')
  if (!existsSync(leavesPath)) {
    console.error('missing mega-menu-leaves.json')
    process.exit(1)
  }
  const doc = JSON.parse(readFileSync(leavesPath, 'utf8')) as { leaves: Leaf[] }
  // Cap crawl to avoid hammering prod; full leaf list is in JSON for later.
  const sample = doc.leaves.filter((l) => l.href.includes('/travel/overseas'))
  const everyNth = Math.max(1, Math.floor(sample.length / 60))
  const targets = sample.filter((_, idx) => idx % everyNth === 0).slice(0, 60)

  console.log(`[audit] crawling ${targets.length}/${sample.length} leaves on ${BASE}`)
  const rows = await poolMap(targets, CONCURRENCY, (l) =>
    fetchOne(l.href).then((r) => ({ ...r, leafLabel: l.leafLabel, tabId: l.tabId, kind: l.kind })),
  )

  const fail = rows.filter((r) => !r.ok || r.status >= 400)
  const zeroCards = rows.filter((r) => r.ok && r.cardHintCount === 0)

  const outDir = join(process.cwd(), 'docs/audit/2026-10-24')
  mkdirSync(outDir, { recursive: true })
  const path = join(outDir, 'mega-menu-crawl.json')
  writeFileSync(
    path,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        base: BASE,
        sampled: targets.length,
        totalLeaves: sample.length,
        failCount: fail.length,
        zeroCardHintCount: zeroCards.length,
        rows,
      },
      null,
      2,
    ),
    'utf8',
  )
  console.log(`[audit] wrote ${path} fail=${fail.length} zeroCardHints=${zeroCards.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
