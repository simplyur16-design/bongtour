/**
 * REGRESSION-FREEZE[photo-run-budget-judge-1129]
 *  (1) 등록대기 단계 전용 시간 한도 + 이어서 처리를 빈칸 채움 앞으로
 *  (2) 판정 교정: 교체 계획이 등록 게이트 계획과 같아야 한다(2026-11-28 22:30 회차 발리 D4 Tanah Lot→Padang Padang 등)
 *  (3) 회차 ID·시작/종료·단계별 stopReason 상태 행
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { acquireVerifiedPhoto, type AcquireDeps, type AcquireInput, type AcquireResult } from '@/lib/photo-autofill-acquire'
import { PublicPhotoUsage } from '@/lib/photo-autofill-gate'
import { buildRegistrationPhotoInput, photoUrlsOf, type ProductPhotoFacts } from '@/lib/photo-gate-runner'
import { healBlockedSlots, type HealDeps } from '@/lib/photo-heal'
import {
  PENDING_WRONG_PHOTO_REPLACE_TIME_BUDGET_MS,
  WRONG_PHOTO_REPLACE_TIME_BUDGET_MS,
  pendingWrongPhotoDeadlineAtMs,
  publicWrongPhotoDeadlineAtMs,
  runWrongPhotoRounds,
} from '@/lib/photo-replace-wrong-1128'
import { createPhotoRunRecorder, photoRunStageKey, PHOTO_RUN_STATE_KEY, type RunStateStore } from '@/lib/photo-run-state-1129'
import { evaluateRegistrationPhotos, SOURCE_META_MISMATCH_DETAIL, STORED_SIGHT_MISMATCH_DETAIL } from '@/lib/register-photo-registration-gate'
import type { PhotoException } from '@/lib/photo-exception-list'

const FIX = JSON.parse(readFileSync(new URL('./photo-run-budget-judge-1129.fixture.json', import.meta.url), 'utf8')) as Record<
  string,
  { destination: string; primaryDestination: string | null; schedule: Array<Record<string, unknown>> }
>

function factsOf(slug: string, mutate?: (rows: Array<Record<string, unknown>>) => void): ProductPhotoFacts {
  const f = FIX[slug]!
  const rows = JSON.parse(JSON.stringify(f.schedule)) as Array<Record<string, unknown>>
  mutate?.(rows)
  return {
    id: slug,
    destination: f.destination,
    primaryDestination: f.primaryDestination,
    schedule: JSON.stringify(rows),
    bgImageUrl: null,
    bgImageExternalId: null,
    bgImageSource: null,
    bgImagePhotographer: null,
    bgImageSourceUrl: null,
    bgImageRehostSearchLabel: null,
    bgImagePlaceName: null,
    bgImageIsGenerated: null,
  } as unknown as ProductPhotoFacts
}

function gateBlocks(p: ProductPhotoFacts) {
  const probes: Record<string, { bytes: number; width: number }> = {}
  for (const u of photoUrlsOf(p)) probes[u] = { bytes: 1000, width: 1600 }
  return evaluateRegistrationPhotos(buildRegistrationPhotoInput(p, new PublicPhotoUsage(), probes)).blocks
}

describe('1) 등록대기 단계 전용 시간 한도', () => {
  const MIN = 60 * 1000
  it('공개 단계가 공유 한도를 다 쓰면 등록대기는 첫 상품 전에 time_budget(22:30 회차 재현)', async () => {
    let t = 0
    const shared = t + WRONG_PHOTO_REPLACE_TIME_BUDGET_MS
    // 공개 단계: 상품마다 1분, 한도(45분) 안에서 끝나지만 마지막 상품이 한도를 넘겨 끝난다
    t = 44 * MIN
    t += 2 * MIN
    const processed: string[] = []
    const r = await runWrongPhotoRounds({
      productIds: ['p1', 'p2', 'p3'],
      processOne: async (id) => (processed.push(id), { replaced: 1, quotaLimited: false }),
      quotaResumeAtMs: () => null,
      now: () => t,
      sleep: async () => {},
      deadlineAtMs: shared,
    })
    expect(r.stopReason).toBe('time_budget')
    expect(processed).toEqual([])
    expect(r.remaining).toEqual(['p1', 'p2', 'p3'])
  })

  it('전용 한도는 등록대기 단계 시작 시각부터 센다 — 공개 단계가 얼마를 썼든 등록대기는 처리된다', async () => {
    const publicStart = 0
    const publicDeadline = publicWrongPhotoDeadlineAtMs(publicStart)
    const pendingStart = publicDeadline + 2 * MIN // 공개 단계가 한도를 넘겨 끝난 뒤
    const pendingDeadline = pendingWrongPhotoDeadlineAtMs(pendingStart)
    expect(pendingDeadline - pendingStart).toBe(PENDING_WRONG_PHOTO_REPLACE_TIME_BUDGET_MS)
    expect(pendingDeadline).toBeGreaterThan(publicDeadline)
    let t = pendingStart
    const processed: string[] = []
    const r = await runWrongPhotoRounds({
      productIds: ['p1', 'p2', 'p3'],
      processOne: async (id) => (processed.push(id), (t += MIN), { replaced: 1, quotaLimited: false }),
      quotaResumeAtMs: () => null,
      now: () => t,
      sleep: async () => {},
      deadlineAtMs: pendingDeadline,
    })
    expect(r.stopReason).toBe('done')
    expect(processed).toEqual(['p1', 'p2', 'p3'])
  })

  it('작업 소스: 한도 공유 변수 없음 + 등록대기 이어서 처리가 빈칸 채움 반복문 앞 + 단계 기록', () => {
    const job = readFileSync(new URL('./register-auto-photo-register-job.ts', import.meta.url), 'utf8')
    expect(job).not.toContain('wrongDeadlineAtMs')
    expect(job).toContain('publicWrongPhotoDeadlineAtMs(publicStartedAtMs)')
    expect(job).toContain('pendingWrongPhotoDeadlineAtMs(pendingStartedAtMs)')
    const cont = job.indexOf("kind: 'photo-replace-wrong-pending-continued'")
    const fillLoop = job.indexOf('for (const row of queue) {')
    const pubCont = job.indexOf("kind: 'photo-replace-wrong-continued'")
    expect(cont).toBeGreaterThan(0)
    expect(cont).toBeLessThan(fillLoop)
    expect(pubCont).toBeGreaterThan(fillLoop) // 공개 이어서 처리는 기존 위치 유지
    // 겹침 보호는 그대로
    const cron = readFileSync(new URL('./instrumentation-register-pre-photo-self-heal-cron.ts', import.meta.url), 'utf8')
    expect(cron).toContain('if (healOnlyTickRunning || autoPhotoTickRunning) return')
    for (const k of ["'public-wrong'", "'pending-wrong'", "'pending-wrong-continued'", "'fill'", "'public-wrong-continued'"]) expect(job).toContain(`runRec.stage(${k}`)
    expect(job).toContain('await runRec.start()')
    expect(job).toContain('await runRec.finish()')
  })
})

describe('2) 판정 교정 — 3건 재현', () => {
  it('pkg-nl-0029 D4: 교체 검색이 게이트와 같은 계획(일정 전체·마지막 일차)을 쓴다', async () => {
    const p = factsOf('pkg-nl-0029')
    const rows = JSON.parse(p.schedule!) as Array<Record<string, unknown>>
    const row = rows.find((r) => Number(r.day) === 4)!
    const asked: string[][] = []
    const deps: AcquireDeps = {
      search: async () => [],
      stockStopped: () => true,
      commit: async () => ({ ok: false, reason: 'x' }),
      pause: async () => {},
      lookupPool: async (sight) => (asked.push([sight]), []),
    }
    const base: AcquireInput = {
      productId: 'pkg-nl-0029',
      kind: 'day',
      day: 4,
      dayFacts: { title: row.title as string, routeText: row.routeText as string, description: row.description as string, imageKeyword: row.imageKeyword as string, imageKeyword2: row.imageKeyword2 as string },
      cityTerms: ['Bali'],
      destinationText: '발리',
      usage: new PublicPhotoUsage(),
      origin: 'heal',
    }
    // 이전 동작(마지막 일차=이 일차, 일정 전체 없음): 게이트가 기대하지 않는 'Padang Padang Beach Bali'를 먼저 찾았다
    await acquireVerifiedPhoto({ ...base, dayFacts: { ...base.dayFacts!, supplierText: [row.breakfastText, row.lunchText, row.dinnerText].filter(Boolean).join(' ') } }, deps)
    expect(asked.some((a) => /Padang Padang/i.test(a[0]!))).toBe(true)
    asked.length = 0
    await acquireVerifiedPhoto({ ...base, dayFacts: { ...base.dayFacts!, supplierText: [row.breakfastText, row.lunchText, row.dinnerText].filter(Boolean).join(' ') }, maxDay: rows.length, allRows: rows }, deps)
    expect(asked.some((a) => /Padang Padang/i.test(a[0]!))).toBe(false)
  })

  it('pkg-nl-0029 D4: heal 이 게이트 계획에 없는 명소 사진(Padang Padang)을 돌려받으면 쓰지 않고 예외로 둔다', async () => {
    const p = factsOf('pkg-nl-0029')
    const blocks = gateBlocks(p).filter((b) => b.day === 4)
    expect(blocks.length).toBeGreaterThan(0)
    expect(blocks[0]!.detail.startsWith(STORED_SIGHT_MISMATCH_DETAIL)).toBe(true) // 현재 저장 사진도 같은 기준에서 불일치
    const exceptions: PhotoException[] = []
    let wrote = false
    let seen: AcquireInput | null = null
    const deps: HealDeps = {
      acquire: async (input): Promise<AcquireResult> => {
        seen = input
        return {
          ok: true,
          tried: [],
          photo: {
            url: 'https://cdn.example.com/photo-pool/padang.webp',
            source: 'Pexels',
            photographer: 'x',
            originalLink: 'https://www.pexels.com/photo/sunny-day-at-padang-padang-beach-bali-indonesia-1/',
            externalId: '1',
            bytes: 1000,
            width: 1600,
            sight: 'Padang Padang Beach Bali',
            matched: 'padang padang beach bali',
            query: 'Padang Padang Beach Bali',
            via: 'pool',
          } as never,
        }
      },
      writeSchedule: async () => ((wrote = true), true),
      writeCover: async () => true,
      recordException: async (e) => void exceptions.push(e),
      recordReplace: async () => {},
      usage: new PublicPhotoUsage(),
    }
    const res = await healBlockedSlots(
      { productId: 'pkg-nl-0029', destinationTerms: ['발리', 'Bali'], cityTerms: ['Bali'], schedule: p.schedule, cover: null, blocks },
      deps,
    )
    expect(seen).not.toBeNull()
    expect((seen as unknown as AcquireInput).maxDay).toBe(5)
    expect((seen as unknown as AcquireInput).allRows?.length).toBe(5)
    expect(wrote).toBe(false)
    expect(res.replaced).toEqual([])
    expect(exceptions.map((e) => e.reason)).toContain('sight_not_in_day_plan')
  })

  it('pkg-nl-0012 D4: 브뤼셀-브뤼헤 경유일의 Grand Place Brussels 는 그날 경로 도시의 대표 명소라 일치(키워드 Bruges Canals 는 잔여 값) — 다른 나라 명소는 불일치', () => {
    const ok = gateBlocks(factsOf('pkg-nl-0012')).filter((b) => b.day === 4)
    expect(ok).toEqual([])
    const bad = gateBlocks(
      factsOf('pkg-nl-0012', (rows) => {
        const r = rows.find((x) => Number(x.day) === 4)!
        r.imageSource = { ...(r.imageSource as object), sight: 'Eiffel Tower Paris' }
      }),
    ).filter((b) => b.day === 4)
    expect(bad.length).toBe(1)
    expect(bad[0]!.reason).toBe('photo_sight_mismatch')
    expect(bad[0]!.detail.startsWith(STORED_SIGHT_MISMATCH_DETAIL)).toBe(true)
  })

  it('pkg-nl-0036 D1: 5.4광장 이름표 사진이 출처 페이지는 광저우 문이면 게이트가 이름-내용 불일치로 막고, 대체 후보가 없으면 기존 사진을 유지하며 예외로 남긴다', async () => {
    const p = factsOf('pkg-nl-0036')
    const blocks = gateBlocks(p).filter((b) => b.day === 1)
    expect(blocks.length).toBe(1)
    expect(blocks[0]!.reason).toBe('photo_sight_mismatch')
    expect(blocks[0]!.detail.startsWith(SOURCE_META_MISMATCH_DETAIL)).toBe(true)
    expect(blocks[0]!.detail).toContain('guangzhou')
    const exceptions: PhotoException[] = []
    let wrote = false
    const deps: HealDeps = {
      acquire: async (input): Promise<AcquireResult> => ({
        ok: false,
        skipped: false,
        tried: [],
        exception: { productId: input.productId, day: input.day, kind: 'day', sight: 'May Fourth Square', query: 'May Fourth Square', reason: 'no_sight_match', detail: 'rejects=no_sight_match:9', origin: 'heal', at: new Date().toISOString() },
      }),
      writeSchedule: async () => ((wrote = true), true),
      writeCover: async () => true,
      recordException: async (e) => void exceptions.push(e),
      recordReplace: async () => {},
      usage: new PublicPhotoUsage(),
      allowClear: false,
    }
    const res = await healBlockedSlots({ productId: 'pkg-nl-0036', destinationTerms: [p.destination!], cityTerms: [], schedule: p.schedule, cover: null, blocks }, deps)
    expect(wrote).toBe(false)
    expect(res.schedule).toBe(p.schedule)
    expect(exceptions.map((e) => e.reason)).toEqual(['no_sight_match'])
  })

  it('퍼센트 인코딩 출처 주소(Špilberk)는 풀어서 비교한다 — 맞는 사진을 불일치로 오판하지 않고, 다른 곳 사진은 여전히 불일치', () => {
    const mk = (sight: string, link: string) =>
      gateBlocks(
        factsOf('pkg-nl-0012', (rows) => {
          const r = rows.find((x) => Number(x.day) === 7)!
          r.routeText = '브르노'
          r.title = 'Spilberk Castle Brno'
          r.description = 'Spilberk Castle Brno 를 방문합니다.'
          r.imageSource = { sight, source: 'Pixabay', originalLink: link }
        }),
      ).filter((b) => b.day === 7 && b.detail.startsWith(SOURCE_META_MISMATCH_DETAIL))
    expect(mk('Spilberk Castle Brno', 'https://pixabay.com/photos/%C5%A1pilberk-brno-roost-city-monument-4902615/').map((b) => b.detail)).toEqual([])
    expect(mk('Spilberk Castle Brno', 'https://pixabay.com/photos/beach-sunny-sky-bali-2632765/').length).toBe(1)
  })

  it('pkg-xx-0001 D1(파리)·D10(로마): 게이트 계획에 없는 에펠탑 이름표는 불일치로 본다', () => {
    const blocks = gateBlocks(factsOf('pkg-xx-0001'))
    const d10 = blocks.find((b) => b.day === 10)
    expect(d10?.reason).toBe('photo_sight_mismatch')
    expect(d10?.detail.startsWith(STORED_SIGHT_MISMATCH_DETAIL)).toBe(true)
  })
})

describe('3) 회차 상태 행(회차 ID·시작/종료·단계별 stopReason)', () => {
  function memStore() {
    const rows = new Map<string, { s: Date; f: Date | null }>()
    const store: RunStateStore = { save: async (k, s, f) => void rows.set(k, { s, f }) }
    return { rows, store }
  }

  it('회차 행은 시작 때 종료 NULL, 끝나면 종료 시각. 단계 행은 키에 단계·stopReason, 시각은 그 단계 시작·끝', async () => {
    const { rows, store } = memStore()
    let t = Date.parse('2026-11-28T13:30:00Z')
    const rec = createPhotoRunRecorder(store, () => t)
    expect(rec.runId).toBe(String(Date.parse('2026-11-28T13:30:00Z')))
    await rec.start()
    expect(rows.get(PHOTO_RUN_STATE_KEY)).toEqual({ s: new Date(t), f: null })
    const st = t
    t += 41 * 60 * 1000
    await rec.stage('public-wrong', 'time_budget', st)
    const k = photoRunStageKey('public-wrong', 'time_budget')
    expect(k).toBe('photo-autofill:stage:public-wrong:time_budget')
    expect(rows.get(k)).toEqual({ s: new Date(st), f: new Date(t) })
    t += 60 * 1000
    await rec.finish()
    expect(rows.get(PHOTO_RUN_STATE_KEY)).toEqual({ s: new Date(Date.parse('2026-11-28T13:30:00Z')), f: new Date(t) })
  })

  it('저장 실패는 삼키고 작업을 막지 않는다', async () => {
    const rec = createPhotoRunRecorder({ save: async () => { throw new Error('db down') } })
    await expect(rec.start()).resolves.toBeUndefined()
    await expect(rec.stage('fill', 'done', Date.now())).resolves.toBeUndefined()
    await expect(rec.finish()).resolves.toBeUndefined()
  })

  it('스키마 변경 없이 기존 표·키만 쓴다(키는 photo-autofill: 접두, 시크릿·개인정보 없음)', () => {
    const lib = readFileSync(new URL('./photo-run-state-1129.ts', import.meta.url), 'utf8')
    expect(lib).toContain("'photo-autofill:run'")
    expect(lib).toContain('scraperSupplierState')
    expect(lib).not.toMatch(/process\.env|\$executeRaw|\$queryRaw/)
    const schemaDiff = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8')
    expect(schemaDiff).toContain('model ScraperSupplierState')
  })
})
