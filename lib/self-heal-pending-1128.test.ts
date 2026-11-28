/**
 * REGRESSION-FREEZE[self-heal-no-cap-1128]: 등록대기(pending)도 상한 없이 틀린 칸 상품 우선 처리 ·
 * 가드 막힘은 같은 실행에서 기다렸다 재개 · 비우기 0 · 철자(띄어쓰기·하이픈) 차이 오탐 정규화
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/register-pre-photo-pending-queue-query', () => ({ REGISTER_PRE_PHOTO_PENDING_QUEUE_WHERE: { registrationStatus: null } }))
vi.mock('@/lib/photo-autofill-public-usage', async (orig) => {
  const m = await orig<typeof import('@/lib/photo-autofill-public-usage')>()
  const { PublicPhotoUsage } = await import('@/lib/photo-autofill-gate')
  return { ...m, loadPublicPhotoUsageCached: async () => new PublicPhotoUsage() }
})

import type { PrismaClient } from '@prisma/client'
import type { AcquireInput, AcquireResult } from '@/lib/photo-autofill-acquire'
import { PublicPhotoUsage } from '@/lib/photo-autofill-gate'
import { sightMatchInText, sightProfile } from '@/lib/photo-autofill-sight'
import { healBlockedSlots, type HealDeps } from '@/lib/photo-heal'
import { buildRegistrationPhotoInput, runPendingWrongPhotoReplaceLive, type ProductPhotoFacts } from '@/lib/photo-gate-runner'
import { pendingWrongPhotoBlocks } from '@/lib/photo-replace-wrong-1128'
import { evaluateRegistrationPhotos, type RegistrationPhotoBlock } from '@/lib/register-photo-registration-gate'
import type { PhotoException } from '@/lib/photo-exception-list'

describe('self-heal-no-cap-1128: 철자 차이(띄어쓰기·하이픈) 오탐 정규화', () => {
  const nong = sightProfile('Nong Nooch Tropical Garden Pattaya')
  const evid = 'golden temples in nongnooch tropical garden in pattaya in thailand'

  it('Nong Nooch 명소를 nongnooch 로 쓴 출처 메타는 맞는 사진으로 본다(앵커 유무와 무관)', () => {
    expect(sightMatchInText(nong, evid, ['pattaya'])).not.toBeNull()
    expect(sightMatchInText(nong, evid)).not.toBeNull()
  })

  it('반대로 이름이 붙여 쓴 형태이고 본문이 띄어 쓴 형태여도 같다', () => {
    expect(sightMatchInText(sightProfile('Nongnooch Garden'), 'tropical garden nong nooch pattaya')).not.toBeNull()
  })

  it('하이픈·공백 차이가 있는 일본·유럽 이름도 같은 낱말로 본다', () => {
    expect(sightMatchInText(sightProfile('Fushimi Inari Taisha Kyoto'), 'fushimiinari shrine in kyoto', ['kyoto'])).not.toBeNull()
  })

  it('다른 기준은 그대로: 다른 장소·낱말 일부만 있는 본문은 여전히 불일치', () => {
    expect(sightMatchInText(nong, 'tropical garden in bali', ['pattaya'])).toBeNull()
    expect(sightMatchInText(nong, 'nong river in vientiane', ['pattaya'])).toBeNull()
    expect(sightMatchInText(sightProfile('Fushimi Inari Taisha Kyoto'), 'inari sushi restaurant in osaka', ['kyoto'])).toBeNull()
    expect(sightMatchInText(nong, 'festive display of christmas ornaments in shop 35107478', ['pattaya'])).toBeNull()
  })

  const gate = (sightLine: string, originalLink: string) => {
    const days = [
      {
        day: 1,
        title: sightLine,
        routeText: sightLine,
        description: null,
        imageUrl: 'https://cdn.example.com/photo-pool/d1.webp',
        imageSource: { source: 'Pexels', photographer: 'A', originalLink, externalId: '34683483', sight: 'Nong Nooch Tropical Garden Pattaya', sightMatch: 'nong nooch' },
      },
    ]
    return evaluateRegistrationPhotos({
      productId: 'p-th',
      destinationTerms: ['파타야', 'pattaya', 'thailand'],
      cover: null,
      schedule: JSON.stringify(days),
      usage: new PublicPhotoUsage(),
      probes: { [days[0]!.imageUrl]: { bytes: 150_000, width: 1800 } },
    })
  }

  it('게이트: nongnooch 출처 메타가 source_meta_not_sight 로 막히지 않고, 다른 사진은 그대로 막힌다', () => {
    const ok = gate('Nong Nooch Tropical Garden Pattaya', 'https://www.pexels.com/photo/golden-temples-in-nongnooch-tropical-garden-in-pattaya-in-thailand-34683483/')
    expect(ok.blocks.filter((b) => b.reason === 'photo_sight_mismatch')).toEqual([])
    const bad = gate('Nong Nooch Tropical Garden Pattaya', 'https://www.pexels.com/photo/festive-display-of-christmas-ornaments-in-shop-35107478/')
    expect(bad.blocks.map((b) => b.reason)).toContain('photo_sight_mismatch')
  })
})

describe('self-heal-no-cap-1128: 등록대기 교체 대상 선별', () => {
  it('비우기(이동일 빈칸)·일차 공개 중복은 이 단계 대상이 아니고 틀린 칸은 모두 남는다', () => {
    const blocks: RegistrationPhotoBlock[] = [
      { kind: 'day', day: 1, reason: 'photo_ai_generated', detail: 'Gemini' },
      { kind: 'day', day: 2, reason: 'photo_travel_day_empty', detail: 'airport only' },
      { kind: 'day', day: 3, reason: 'photo_public_duplicate', detail: '' },
      { kind: 'day', day: 4, reason: 'photo_sight_mismatch', detail: 'source_meta_not_sight: "x" vs y' },
      { kind: 'cover', day: null, reason: 'photo_sight_mismatch', detail: 'no place in "z"' },
      { kind: 'day', day: 5, reason: 'photo_text_map', detail: 'map' },
    ]
    expect(pendingWrongPhotoBlocks(blocks).map((b) => `${b.kind}:${b.day}`)).toEqual(['day:1', 'day:4', 'cover:null', 'day:5'])
  })
})

/** dr-103 구조 모사: 35개 상품 · 103개 틀린 칸(상품당 1~6칸, 대부분 3칸), 칸마다 서로 다른 명소 */
function fakePendingStore() {
  const products: Array<ProductPhotoFacts & { title: string | null; countryKey: string | null; registrationStatus: string }> = []
  let slot = 0
  for (let i = 0; i < 35; i++) {
    const n = i < 34 ? 3 : 1 // 34*3+1 = 103
    const rows = Array.from({ length: n }, (_, k) => ({
      day: k + 1,
      title: `${k + 1}일차`,
      routeText: `Chiang Mai - Sight${i}x${k}`,
      imageUrl: `https://cdn.example.com/old-${i}-${k}.webp`,
      imageSource: { source: 'Gemini', originalLink: '', externalId: '' },
      imageIsGenerated: true,
    }))
    slot += n
    products.push({
      id: `pkg-${i}`,
      destination: '치앙마이',
      primaryDestination: '치앙마이',
      schedule: JSON.stringify(rows),
      bgImageUrl: null,
      bgImageExternalId: null,
      bgImageSource: null,
      bgImagePhotographer: null,
      bgImageSourceUrl: null,
      bgImageRehostSearchLabel: null,
      bgImagePlaceName: null,
      title: `태국 ${i}`,
      countryKey: 'thailand',
      registrationStatus: 'pending',
    })
  }
  // 등록대기가 아닌 상품(auto_unpublished)은 조회 조건에 없으므로 fake 가 돌려주지 않는다 — 범위 밖 확인용으로 따로 둔다
  expect(slot).toBe(103)
  return products
}

const failQuota = (i: AcquireInput): AcquireResult => ({
  ok: false,
  skipped: false,
  tried: [],
  exception: { productId: i.productId, day: i.day, kind: i.kind, sight: null, query: null, reason: 'no_photo', detail: 'rejects=- evaluated=0/5 notes=unsplash_limit,no_real_photo', origin: i.origin, at: new Date().toISOString() },
})
const okPhoto = (id: string): AcquireResult => ({
  ok: true,
  tried: [],
  photo: { ok: true, url: `https://cdn.example.com/new-${id}.webp`, bytes: 100_000, width: 1800, source: 'Unsplash', photographer: 'B', originalLink: `https://unsplash.com/photos/${id}`, externalId: id, sight: 'x', matched: 'x', query: 'x' },
})

/** CI 샤드(coverage 계측) 안에서도 35상품 판정·교체를 끝낼 여유(기본 5초는 느린 러너에서 부족) */
const HEAVY_TEST_TIMEOUT_MS = 120_000

describe('self-heal-no-cap-1128: 등록대기 103칸 규모 한 실행 처리·가드 재개·비우기 0', () => {
  const fakePrisma = (products: unknown[]) => ({ product: { findMany: async () => products } }) as unknown as PrismaClient

  /** 실제 healBlockedSlots + 메모리 저장소 + 가짜 획득(가드 상태 주입). 비우기는 allowClear:false 로 막는다. */
  function makeHealOne(store: ReturnType<typeof fakePendingStore>, acquire: (i: AcquireInput) => AcquireResult) {
    const writes: Array<{ productId: string; clearedDays: number[] }> = []
    const exceptions: PhotoException[] = []
    let calls = 0
    const healOne = async (id: string) => {
      const p = store.find((x) => x.id === id)!
      const evald = evaluateRegistrationPhotos(buildRegistrationPhotoInput(p, new PublicPhotoUsage(), {}))
      const deps: HealDeps = {
        acquire: async (i) => (calls++, acquire(i)),
        writeSchedule: async (pid, _expected, next) => {
          const rows = JSON.parse(next) as Array<{ day: number; imageUrl?: string }>
          writes.push({ productId: pid, clearedDays: rows.filter((r) => !String(r.imageUrl ?? '').trim()).map((r) => r.day) })
          p.schedule = next
          return true
        },
        writeCover: async () => true,
        recordException: async (e) => void exceptions.push(e),
        recordReplace: async () => {},
        usage: new PublicPhotoUsage(),
        maxSlotsPerProduct: Number.POSITIVE_INFINITY,
        allowClear: false,
      }
      const h = await healBlockedSlots(
        {
          productId: id,
          destinationTerms: ['치앙마이', 'chiang mai'],
          cityTerms: ['chiang mai'],
          schedule: p.schedule,
          cover: null,
          blocks: pendingWrongPhotoBlocks(evald.blocks),
        },
        deps,
      )
      return { replaced: h.replaced.length, exceptions: h.exceptions }
    }
    return { healOne, writes, exceptions, calls: () => calls }
  }

  it('틀린 칸 103개(35상품)를 한 실행에서 모두 교체하고 비운 칸이 0이다(50상품 창·교체 예산 12 없음)', async () => {
    const store = fakePendingStore()
    let n = 0
    const h = makeHealOne(store, (i) => okPhoto(`${i.productId}-${i.day}-${++n}`))
    const r = await runPendingWrongPhotoReplaceLive(fakePrisma(store), async () => null as never, { healOne: h.healOne, quotaResumeAtMs: () => null })
    expect(r.targetProducts).toBe(35)
    expect(r.targets).toBe(103)
    expect(r.replaced).toBe(103)
    expect(r.deferred).toBe(0)
    expect(r.remainingProductIds).toEqual([])
    expect(r.stopReason).toBe('done')
    expect(h.writes.every((w) => w.clearedDays.length === 0)).toBe(true)
    for (const p of store) {
      const rows = JSON.parse(p.schedule!) as Array<{ imageUrl: string; imageSource: { source: string } }>
      expect(rows.every((x) => x.imageUrl.includes('/new-') && x.imageSource.source !== 'Gemini')).toBe(true)
    }
  }, HEAVY_TEST_TIMEOUT_MS)

  it('가드(Unsplash 한도)에 막히면 기존 사진을 유지한 채 같은 실행에서 기다린 뒤 이어서 모두 교체한다', async () => {
    const store = fakePendingStore()
    let blocked = true
    let n = 0
    const h = makeHealOne(store, (i) => (blocked && i.productId >= 'pkg-2' ? failQuota(i) : okPhoto(`${i.productId}-${i.day}-${++n}`)))
    const slept: number[] = []
    const r = await runPendingWrongPhotoReplaceLive(fakePrisma(store), async () => null as never, {
      healOne: h.healOne,
      quotaResumeAtMs: () => (blocked ? Date.now() + 20 * 60 * 1000 : null),
      sleep: async (ms) => {
        slept.push(ms)
        blocked = false
      },
    })
    expect(slept).toHaveLength(1)
    expect(slept[0]).toBeGreaterThanOrEqual(20 * 60 * 1000)
    expect(r.rounds).toBe(2)
    expect(r.waitedMs).toBeGreaterThanOrEqual(20 * 60 * 1000)
    expect(r.remainingProductIds).toEqual([])
    expect(r.stopReason).toBe('done')
    // 막힌 동안 비우지 않았고, 재개 뒤 103칸이 모두 실사진으로 바뀌었다
    expect(h.writes.every((w) => w.clearedDays.length === 0)).toBe(true)
    let replacedSlots = 0
    for (const p of store) {
      const rows = JSON.parse(p.schedule!) as Array<{ imageUrl: string }>
      expect(rows.every((x) => x.imageUrl.trim() !== '')).toBe(true)
      replacedSlots += rows.filter((x) => x.imageUrl.includes('/new-')).length
    }
    expect(replacedSlots).toBe(103)
  }, HEAVY_TEST_TIMEOUT_MS)

  it('기다림이 시간 한도를 넘으면 못 한 상품 번호를 돌려주고 기존 사진은 그대로다(비우기 0)', async () => {
    const store = fakePendingStore()
    const h = makeHealOne(store, (i) => failQuota(i))
    const r = await runPendingWrongPhotoReplaceLive(fakePrisma(store), async () => null as never, {
      healOne: h.healOne,
      quotaResumeAtMs: () => Date.now() + 3 * 60 * 60 * 1000,
      sleep: async () => {},
    })
    expect(r.stopReason).toBe('quota_wait_exceeds_budget')
    expect(r.remainingProductIds).toHaveLength(35)
    expect(r.replaced).toBe(0)
    expect(h.writes).toEqual([])
    for (const p of store) expect((JSON.parse(p.schedule!) as Array<{ imageUrl: string }>).every((x) => x.imageUrl.includes('/old-'))).toBe(true)
  }, HEAVY_TEST_TIMEOUT_MS)

  it('국내여행 등록대기는 건드리지 않고, 틀린 칸이 없는 상품은 대상이 아니다', async () => {
    const store = fakePendingStore()
    store[0]!.countryKey = 'korea'
    store[1]!.schedule = JSON.stringify([{ day: 1, title: '1일차', routeText: 'Chiang Mai - Doi Suthep', imageUrl: '' }])
    const seen: string[] = []
    const r = await runPendingWrongPhotoReplaceLive(fakePrisma(store), async () => null as never, {
      healOne: async (id) => (seen.push(id), { replaced: 1, exceptions: [] }),
      quotaResumeAtMs: () => null,
    })
    expect(seen).not.toContain('pkg-0')
    expect(seen).not.toContain('pkg-1')
    expect(r.targetProducts).toBe(33)
  }, HEAVY_TEST_TIMEOUT_MS)
})

describe('self-heal-no-cap-1128: 등록대기 단계 정적 가드', () => {
  const job = readFileSync('lib/register-auto-photo-register-job.ts', 'utf8')
  const runner = readFileSync('lib/photo-gate-runner.ts', 'utf8')
  it('작업은 등록대기 틀린 칸 단계를 채움 반복문보다 먼저 돌리고, 끝에서 남은 상품을 이어서 처리한다', () => {
    expect(job).toContain('runPendingWrongPhotoReplaceLive')
    expect(job.indexOf('runPendingWrongPhotoReplaceLive(prisma')).toBeLessThan(job.indexOf('for (const row of queue)'))
    expect(job).toContain('photo-replace-wrong-pending-continued')
    expect(job).not.toMatch(/createRunBudget|replaceBudget|takeRunBudget/)
  })
  it('등록대기 단계는 칸 수 무제한·비우기 금지로 고치고 auto_unpublished 는 조회하지 않는다', () => {
    const body = runner.slice(runner.indexOf('export async function runPendingWrongPhotoReplaceLive'), runner.indexOf('export async function headStatus'))
    expect(body).toContain('maxSlotsPerProduct: Number.POSITIVE_INFINITY')
    expect(body).toContain('allowClear: false')
    expect(body).not.toContain("registrationStatus: 'auto_unpublished'")
    expect(body).not.toMatch(/\btake:/)
  })
})
