/**
 * Walk client pending panel imports. Fail if next/cache is reachable.
 * REGRESSION-FREEZE[pending-pre-photo-verify-client-safe]: 등록대기 클라 → revalidatePath 금지
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const START = 'app/admin/pending/components/AdminPendingDetailPanel.tsx'
const IMPORT_RE = /from\s+['"](@\/[^'"]+|next\/[^'"]+|\.\.?\/[^'"]+)['"]/g

/** webpack strips `import type` / `export type` — do not treat those as a client graph edge. */
function isTypeOnlyFrom(src: string, fromIndex: number): boolean {
  const prefix = src.slice(0, fromIndex)
  const idx = Math.max(prefix.lastIndexOf('import'), prefix.lastIndexOf('export'))
  if (idx < 0) return false
  const head = prefix.slice(idx).trimStart()
  return /^(?:export\s+)?import\s+type\b/.test(head) || /^export\s+type\b/.test(head)
}

function resolveImport(fromFile: string, spec: string): string | null {
  if (spec === 'next/cache' || spec.startsWith('next/cache/')) return 'next/cache'
  if (spec.startsWith('next/')) return null
  let abs = spec.startsWith('@/')
    ? path.join(ROOT, spec.slice(2))
    : path.resolve(path.dirname(path.join(ROOT, fromFile)), spec)
  const candidates = [
    abs,
    `${abs}.ts`,
    `${abs}.tsx`,
    path.join(abs, 'index.ts'),
    path.join(abs, 'index.tsx'),
  ]
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return path.relative(ROOT, c).replaceAll('\\', '/')
    }
  }
  return null
}

function walk(start: string): string[] {
  const seen = new Set<string>()
  const queue = [start.replaceAll('\\', '/')]
  const hits: string[] = []
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    if (file === 'next/cache') {
      hits.push(file)
      continue
    }
    const full = path.join(ROOT, file)
    if (!fs.existsSync(full)) continue
    const src = fs.readFileSync(full, 'utf8')
    for (const m of src.matchAll(IMPORT_RE)) {
      if (isTypeOnlyFrom(src, m.index ?? 0)) continue
      const resolved = resolveImport(file, m[1]!)
      if (!resolved) continue
      if (resolved === 'next/cache') hits.push(`${file} -> next/cache`)
      else queue.push(resolved)
    }
  }
  return hits
}

describe('pending-pre-photo-verify-client-safe', () => {
  it('등록대기 패널 import 그래프에 next/cache 가 없다', () => {
    const hits = walk(START)
    assert.deepEqual(hits, [])
  })
})
