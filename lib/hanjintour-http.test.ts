import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createHanjintourClient,
  HANJINTOUR_CALL_GAP_MS,
  HANJINTOUR_FETCH_RETRY,
  HanjintourBlockedError,
} from './hanjintour-http'

function fakeFetch(statuses: number[]) {
  const calls: Array<{ url: string; at: number }> = []
  let active = 0
  let maxActive = 0
  const impl = (async (url: string) => {
    active++
    maxActive = Math.max(maxActive, active)
    calls.push({ url: String(url), at: calls.length })
    await new Promise((r) => setTimeout(r, 1))
    active--
    const status = statuses.shift() ?? 200
    return new Response(JSON.stringify({ result: true, n: calls.length }), { status })
  }) as unknown as typeof fetch
  return { impl, calls, maxActive: () => maxActive }
}

describe('createHanjintourClient', () => {
  it('serializes calls and waits gap+jitter before every call after the first', async () => {
    const f = fakeFetch([])
    const sleeps: number[] = []
    const c = createHanjintourClient({ fetchImpl: f.impl, sleep: async (ms) => void sleeps.push(ms), random: () => 0.5 })
    await Promise.all([c.call('a', 'GET', '/x'), c.call('b', 'POST', '/y', { q: 1 }), c.call('c', 'GET', '/z', { k: 'v' })])
    expect(f.maxActive()).toBe(1)
    expect(sleeps.filter((ms) => ms >= HANJINTOUR_CALL_GAP_MS)).toHaveLength(2)
    expect(f.calls[2]!.url).toContain('/z?k=v')
  })

  it('stops all further calls after a 403 block signal', async () => {
    const f = fakeFetch([200, 403])
    const c = createHanjintourClient({ fetchImpl: f.impl, sleep: async () => {}, random: () => 0 })
    await c.call('a', 'GET', '/x')
    await expect(c.call('b', 'GET', '/y')).rejects.toBeInstanceOf(HanjintourBlockedError)
    await expect(c.call('c', 'GET', '/z')).rejects.toBeInstanceOf(HanjintourBlockedError)
    expect(f.calls).toHaveLength(2)
    expect(c.isBlocked()).toBe(true)
  })

  it('read retry is at most once', () => {
    expect(HANJINTOUR_FETCH_RETRY.maxRetries).toBe(1)
  })

  it('collector modules use only the hanjintour client (no raw fetch, no shared scraper config)', () => {
    for (const f of ['lib/hanjintour-api.ts', 'lib/hanjintour-parse.ts', 'lib/hanjintour-region-filter.ts', 'scripts/hanjintour-dry-run.ts']) {
      const src = fs.readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/\bfetch\(/)
      expect(src, f).not.toMatch(/prisma\.|@prisma\/client/)
    }
  })
})
