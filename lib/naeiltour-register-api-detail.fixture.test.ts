/**
 * 내일투어 MEZZ32084 녹화 fixture — live gate 확인 항목 전부 + 요청 수·부분실패·SKIP 판정.
 * REGRESSION-FREEZE[naeiltour-register-mezz32084-fixture]: 결정적 PR 차단 기준 — manifest
 */
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertNaeiltourMezz32084RegisterParsed, NAEILTOUR_MEZZ32084_URL } from '@/lib/naeiltour-mezz32084-gate-assertions'
import {
  augmentNaeiltourRegisterParsedFromApiCollect,
  parseNaeiltourRegisterFromApi,
} from '@/lib/naeiltour-register-api-parse'
import {
  fetchNaeiltourRegisterDetailBundleResult,
  resetNaeiltourRegisterDetailBundleMemoForTests,
} from '@/lib/naeiltour-register-api-detail'
import {
  classifyLiveGateFetchErrors,
  classifyNestedNpmExit,
  LIVE_GATE_EXTERNAL_SKIP_EXIT_CODE,
} from '@/lib/regression-freeze/live-gate-external'

const FIXTURE_DIR = path.join(__dirname, '__fixtures__', 'naeiltour', 'mezz32084')
const VIEW = fs.readFileSync(path.join(FIXTURE_DIR, 'view.html'), 'utf8')
const TAB0 = fs.readFileSync(path.join(FIXTURE_DIR, 'tab0.html'), 'utf8')
const TAB1 = fs.readFileSync(path.join(FIXTURE_DIR, 'tab1.html'), 'utf8')
const NO_OPTION_TEXT = '선택관광이 없는 노옵션 상품입니다.'

type Part = 'page' | 'tab0' | 'tab1' | 'program_list'
type Override = (part: Part, n: number) => Response | Error | null

function html(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
}

function installFixtureFetch(fixtures: { view: string; tab0: string; tab1: string }, override?: Override) {
  const counts: Record<Part, number> = { page: 0, tab0: 0, tab1: 0, program_list: 0 }
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input)
    let part: Part
    if (/\/sub\/view\.asp\b/i.test(url)) part = 'page'
    else if (/\/sub\/program_process\.asp\b/i.test(url)) part = 'program_list'
    else if (/\/sub\/view_process\.asp\b/i.test(url)) {
      const mode = new URLSearchParams(String(init?.body ?? '')).get('mode')
      if (mode === 'view_tab_0') part = 'tab0'
      else if (mode === 'view_tab_1') part = 'tab1'
      else throw new Error(`unexpected view_process mode ${mode}`)
    } else {
      throw new Error(`unexpected network call in fixture test: ${url}`)
    }
    counts[part] += 1
    const o = override?.(part, counts[part])
    if (o instanceof Error) throw o
    if (o) return o
    if (part === 'page') return html(fixtures.view)
    if (part === 'tab0') return html(fixtures.tab0)
    if (part === 'tab1') return html(fixtures.tab1)
    return html('<html><body><table></table></body></html>')
  })
  vi.stubGlobal('fetch', fetchMock)
  return { fetchMock, counts }
}

async function settleWithFakeTimers<T>(p: Promise<T>): Promise<T> {
  let done = false
  let value!: T
  let error: unknown
  p.then(
    (v) => {
      done = true
      value = v
    },
    (e) => {
      done = true
      error = e
    },
  )
  for (let i = 0; i < 600 && !done; i++) await vi.advanceTimersByTimeAsync(500)
  if (!done) throw new Error('promise did not settle under fake timers')
  if (error) throw error
  return value
}

describe('naeiltour MEZZ32084 recorded fixture', () => {
  beforeEach(() => {
    resetNaeiltourRegisterDetailBundleMemoForTests()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    resetNaeiltourRegisterDetailBundleMemoForTests()
  })

  it('passes every live-gate assertion from recorded view/tab0/tab1', async () => {
    installFixtureFetch({ view: VIEW, tab0: TAB0, tab1: TAB1 })
    const parsed = await settleWithFakeTimers(
      parseNaeiltourRegisterFromApi('', 'naeiltour', { originUrl: NAEILTOUR_MEZZ32084_URL }),
    )
    expect(() => assertNaeiltourMezz32084RegisterParsed(parsed)).not.toThrow()
    expect(parsed.hasOptionalTour).toBe(false)
    expect(parsed.optionalTourCollectStatus).toBe('known')
    expect(parsed.naeiltourDetailFetchStatus).toEqual({ page: 'ok', tab0: 'ok', tab1: 'ok' })
    expect(parsed.naeiltourDetailFetchErrors).toBeNull()
  })

  it('fetches the detail bundle once per run (parse + augment) — request count does not grow', async () => {
    const { fetchMock, counts } = installFixtureFetch({ view: VIEW, tab0: TAB0, tab1: TAB1 })
    const parsed = await settleWithFakeTimers(
      parseNaeiltourRegisterFromApi('', 'naeiltour', { originUrl: NAEILTOUR_MEZZ32084_URL }),
    )
    await settleWithFakeTimers(
      augmentNaeiltourRegisterParsedFromApiCollect(parsed, { originUrl: NAEILTOUR_MEZZ32084_URL }),
    )
    expect(counts.page).toBe(1)
    expect(counts.tab0).toBe(1)
    expect(counts.tab1).toBe(1)
    // 이전 구조: register-facts·parse·augment가 각자 묶음(3요청)을 받아 9요청 + 출발 목록.
    const previousTotal = 3 * 3 + counts.program_list
    expect(fetchMock.mock.calls.length).toBe(3 + counts.program_list)
    expect(fetchMock.mock.calls.length).toBeLessThan(previousTotal)
  })

  it('concurrent callers share one in-flight bundle', async () => {
    const { counts } = installFixtureFetch({ view: VIEW, tab0: TAB0, tab1: TAB1 })
    const [a, b] = await settleWithFakeTimers(
      Promise.all([
        fetchNaeiltourRegisterDetailBundleResult(NAEILTOUR_MEZZ32084_URL),
        fetchNaeiltourRegisterDetailBundleResult(NAEILTOUR_MEZZ32084_URL),
      ]),
    )
    expect(a).toBe(b)
    expect(counts).toMatchObject({ page: 1, tab0: 1, tab1: 1 })
  })

  it('tab0 outage → fetchStatus/fetchErrors, optional tour unknown_fetch_failed, no immediate re-call', async () => {
    const { counts } = installFixtureFetch({ view: VIEW, tab0: TAB0, tab1: TAB1 }, (part) =>
      part === 'tab0' ? new Response('down', { status: 503 }) : null,
    )
    const parsed = await settleWithFakeTimers(
      parseNaeiltourRegisterFromApi('', 'naeiltour', { originUrl: NAEILTOUR_MEZZ32084_URL }),
    )
    expect(parsed.hasOptionalTour).toBeUndefined()
    expect(parsed.optionalTourCollectStatus).toBe('unknown_fetch_failed')
    expect(parsed.naeiltourDetailFetchStatus).toEqual({ page: 'ok', tab0: 'failed', tab1: 'ok' })
    expect(parsed.naeiltourDetailFetchErrors).toEqual([
      expect.objectContaining({ part: 'tab0', errorKind: 'http_5xx', status: 503, attempts: 2 }),
    ])
    // 재시도 1회 = tab0 2회. 실패 결과는 10분 캐시에 넣지 않지만 같은 흐름에서 즉시 다시 부르지 않는다.
    expect(counts.tab0).toBe(2)
    const augmented = await settleWithFakeTimers(
      augmentNaeiltourRegisterParsedFromApiCollect(parsed, { originUrl: NAEILTOUR_MEZZ32084_URL }),
    )
    expect(counts).toMatchObject({ page: 1, tab0: 2, tab1: 1 })
    expect(augmented.hasOptionalTour).toBeUndefined()
    expect(augmented.optionalTourCollectStatus).toBe('unknown_fetch_failed')

    const detail = await fetchNaeiltourRegisterDetailBundleResult(NAEILTOUR_MEZZ32084_URL)
    expect(detail.outcome).toBe('partial')
    const verdict = classifyLiveGateFetchErrors('naeiltour', 'mezz32084', detail.fetchErrors)
    expect(verdict.verdict).toBe('skip')
    if (verdict.verdict === 'skip') {
      expect(verdict.reasons[0]).toMatchObject({
        supplier: 'naeiltour',
        gate: 'mezz32084',
        part: 'tab0',
        errorKind: 'http_5xx',
        attempts: 2,
      })
      expect(verdict.reasons[0]!.url).toMatch(/view_process\.asp$/)
    }
  })

  it('page timeout twice → page_failed with SKIP verdict', async () => {
    const timeout = Object.assign(new Error('timeout'), { name: 'TimeoutError' })
    installFixtureFetch({ view: VIEW, tab0: TAB0, tab1: TAB1 }, (part) => (part === 'page' ? timeout : null))
    const detail = await settleWithFakeTimers(fetchNaeiltourRegisterDetailBundleResult(NAEILTOUR_MEZZ32084_URL))
    expect(detail.outcome).toBe('page_failed')
    expect(detail.fetchErrors).toEqual([expect.objectContaining({ part: 'page', errorKind: 'timeout', attempts: 2 })])
    expect(classifyLiveGateFetchErrors('naeiltour', 'mezz32084', detail.fetchErrors).verdict).toBe('skip')
  })

  it('4xx on detail page is FAIL, not SKIP (no retry)', async () => {
    const { counts } = installFixtureFetch({ view: VIEW, tab0: TAB0, tab1: TAB1 }, (part) =>
      part === 'page' ? new Response('gone', { status: 404 }) : null,
    )
    const detail = await settleWithFakeTimers(fetchNaeiltourRegisterDetailBundleResult(NAEILTOUR_MEZZ32084_URL))
    expect(counts.page).toBe(1)
    expect(classifyLiveGateFetchErrors('naeiltour', 'mezz32084', detail.fetchErrors).verdict).toBe('fail')
  })

  it('tampered fixture (optional tour present) FAILS the gate assertions', async () => {
    expect(TAB0).toContain(NO_OPTION_TEXT)
    installFixtureFetch({
      view: VIEW,
      tab0: TAB0.replace(NO_OPTION_TEXT, '현지 선택관광 3종 (1인 USD 50)'),
      tab1: TAB1,
    })
    const parsed = await settleWithFakeTimers(
      parseNaeiltourRegisterFromApi('', 'naeiltour', { originUrl: NAEILTOUR_MEZZ32084_URL }),
    )
    expect(parsed.hasOptionalTour).toBe(true)
    expect(() => assertNaeiltourMezz32084RegisterParsed(parsed)).toThrow(/no-option product/)
  })

  it('tampered fixture (included block removed) FAILS the gate assertions', async () => {
    installFixtureFetch({
      view: VIEW,
      tab0: TAB0.replace(/<p class="title">\s*포함사항\s*<\/p>/, '<p class="title">기타</p>'),
      tab1: TAB1,
    })
    const parsed = await settleWithFakeTimers(
      parseNaeiltourRegisterFromApi('', 'naeiltour', { originUrl: NAEILTOUR_MEZZ32084_URL }),
    )
    expect(() => assertNaeiltourMezz32084RegisterParsed(parsed)).toThrow(/included >= 2/)
  })
})

describe('live gate SKIP exit code aggregation', () => {
  it('counts 78 as SKIP only for allowed gates; other non-zero exits FAIL', () => {
    expect(LIVE_GATE_EXTERNAL_SKIP_EXIT_CODE).toBe(78)
    expect(classifyNestedNpmExit(0, true)).toBe('pass')
    expect(classifyNestedNpmExit(78, true)).toBe('skip')
    expect(classifyNestedNpmExit(78, false)).toBe('fail')
    expect(classifyNestedNpmExit(1, true)).toBe('fail')
    expect(classifyNestedNpmExit(null, true)).toBe('fail')
  })
})
