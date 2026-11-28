/**
 * REGRESSION-FREEZE[photo-run-budget-judge-1129]
 * 기존 Wikimedia·Wikipedia·Commons 사진과 확정 명소 불일치 사진을 정기 자동 채움이 교체하고, 맞는 사진이 없으면 빈칸으로 둔다(사장님 2026-11-29 00:14).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import type { AcquireInput, AcquireResult } from '@/lib/photo-autofill-acquire'
import { PublicPhotoUsage } from '@/lib/photo-autofill-gate'
import { photoIsBannedSource, photoIsConfirmedWrong, CONFIRMED_WRONG_PHOTOS_1129 } from '@/lib/photo-banned-source-1129'
import { buildRegistrationPhotoInput, photoUrlsOf, type ProductPhotoFacts } from '@/lib/photo-gate-runner'
import { healBlockedSlots, type HealDeps } from '@/lib/photo-heal'
import { pendingWrongPhotoBlocks, publicWrongPhotoBlocks, runWrongPhotoRounds, shouldClearWhenUnreplaceable, publicWrongPhotoDeadlineAtMs, pendingWrongPhotoDeadlineAtMs } from '@/lib/photo-replace-wrong-1128'
import type { PhotoException } from '@/lib/photo-exception-list'
import { evaluateRegistrationPhotos, registrationBlockCodes } from '@/lib/register-photo-registration-gate'

const FIX = JSON.parse(readFileSync(new URL('./photo-run-budget-judge-1129.fixture.json', import.meta.url), 'utf8')) as Record<
  string,
  { destination: string; primaryDestination: string | null; schedule: Array<Record<string, unknown>> }
>

const WIKI = {
  url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Tanah_Lot_Temple.jpg',
  imageSource: { source: 'Wikimedia Commons', photographer: 'someone', originalLink: 'https://commons.wikimedia.org/wiki/File:Tanah_Lot_Temple.jpg', externalId: 'File:Tanah_Lot_Temple.jpg', sight: 'Tanah Lot' },
}

function factsOf(slug: string, mutate?: (rows: Array<Record<string, unknown>>) => void, cover?: Partial<ProductPhotoFacts>, id?: string): ProductPhotoFacts {
  const f = FIX[slug]!
  const rows = JSON.parse(JSON.stringify(f.schedule)) as Array<Record<string, unknown>>
  mutate?.(rows)
  return {
    id: id ?? slug,
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
    ...cover,
  } as unknown as ProductPhotoFacts
}

function gateBlocks(p: ProductPhotoFacts) {
  const probes: Record<string, { bytes: number; width: number }> = {}
  for (const u of photoUrlsOf(p)) probes[u] = { bytes: 1000, width: 1600 }
  return evaluateRegistrationPhotos(buildRegistrationPhotoInput(p, new PublicPhotoUsage(), probes)).blocks
}

const wikiDay = (manual: boolean) => (rows: Array<Record<string, unknown>>) => {
  rows[3]!.imageUrl = WIKI.url
  rows[3]!.imageSource = { ...WIKI.imageSource }
  rows[3]!.imageManualSelected = manual
}

const okPhoto = {
  url: 'https://cdn.example.com/photo-pool/new.webp',
  source: 'Pixabay',
  photographer: 'p',
  originalLink: 'https://pixabay.com/photos/tanah-lot-temple-bali-1234/',
  externalId: '1234',
  bytes: 1000,
  width: 1600,
  sight: 'Tanah Lot',
  matched: 'tanah lot',
  query: 'Tanah Lot',
  via: 'pixabay',
}

function makeDeps(over: Partial<HealDeps> & { acquire: HealDeps['acquire'] }) {
  const exceptions: PhotoException[] = []
  const writes: string[] = []
  const covers: Array<Record<string, unknown>> = []
  const replaces: Array<{ sourceType: string; notes: string }> = []
  const deps: HealDeps = {
    writeSchedule: async (_id, _exp, next) => (writes.push(next), true),
    writeCover: async (_id, data) => (covers.push(data), true),
    recordException: async (e) => void exceptions.push(e),
    recordReplace: async (r) => void replaces.push(r),
    usage: new PublicPhotoUsage(),
    ...over,
  }
  return { deps, exceptions, writes, covers, replaces }
}

const failAcquire = async (input: AcquireInput): Promise<AcquireResult> => ({
  ok: false,
  skipped: false,
  tried: [],
  exception: { productId: input.productId, day: input.day, kind: input.kind, sight: null, query: null, reason: 'no_sight_match', detail: 'rejects=no_sight_match:9', origin: 'heal', at: new Date().toISOString() },
})

describe('출처 판정(URL·원본 링크 호스트·source)', () => {
  it('Wikimedia·Wikipedia·Commons 는 막고, 우리 풀 파일·Pixabay·Openverse CC0 는 막지 않는다', () => {
    expect(photoIsBannedSource({ url: WIKI.url })).toBe(true)
    expect(photoIsBannedSource({ url: 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/x.webp', originalLink: 'https://commons.wikimedia.org/wiki/File:X.jpg' })).toBe(true)
    expect(photoIsBannedSource({ url: 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/x.webp', originalLink: 'https://en.wikipedia.org/wiki/X' })).toBe(true)
    expect(photoIsBannedSource({ url: 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/x.webp', source: 'Wikimedia Commons' })).toBe(true)
    expect(photoIsBannedSource({ url: 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/x.webp', source: 'wikimedia' })).toBe(true)
    expect(photoIsBannedSource({ url: 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/wikimedia-like-name.webp', source: 'PhotoPool', originalLink: 'https://www.pexels.com/photo/x-1/' })).toBe(false)
    expect(photoIsBannedSource({ url: 'https://cdn.pixabay.com/photo/a.jpg', source: 'Pixabay', originalLink: 'https://pixabay.com/photos/a-1/' })).toBe(false)
    expect(photoIsBannedSource({ url: 'https://live.staticflickr.com/a.jpg', source: 'cc0', originalLink: 'https://www.flickr.com/photos/a/1' })).toBe(false)
    expect(photoIsBannedSource({ url: 'https://notwikimedia.org.example.com/a.jpg' })).toBe(false)
  })
})

describe('게이트: photo_banned_source', () => {
  it('일차 칸: 관리자가 고른 칸이어도 막고 photo_wrong_kind 코드로 매핑, 공개·등록대기 교체 대상', () => {
    for (const manual of [false, true]) {
      const blocks = gateBlocks(factsOf('pkg-nl-0029', wikiDay(manual)))
      const b = blocks.filter((x) => x.reason === 'photo_banned_source')
      expect(b.map((x) => `${x.kind}:${x.day}`)).toEqual(['day:4'])
      expect(registrationBlockCodes(blocks)).toContain('photo_wrong_kind')
      expect(publicWrongPhotoBlocks(blocks).some((x) => x.reason === 'photo_banned_source')).toBe(true)
      expect(pendingWrongPhotoBlocks(blocks).some((x) => x.reason === 'photo_banned_source')).toBe(true)
    }
  })
  it('대표 칸: Wikimedia 대표는 공개 상품에서도 교체 대상(AI 외 대표 면제를 이 사유는 받지 않는다)', () => {
    const p = factsOf('pkg-nl-0029', undefined, { bgImageUrl: 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/c.webp', bgImageSource: 'wikimedia', bgImageSourceUrl: 'https://commons.wikimedia.org/wiki/File:C.jpg' })
    const blocks = gateBlocks(p)
    expect(blocks.some((x) => x.kind === 'cover' && x.reason === 'photo_banned_source')).toBe(true)
    expect(publicWrongPhotoBlocks(blocks).some((x) => x.kind === 'cover' && x.reason === 'photo_banned_source')).toBe(true)
  })
  it('Wikimedia 가 아닌 사진은 이 사유로 막지 않는다', () => {
    expect(gateBlocks(factsOf('pkg-nl-0029')).some((x) => x.reason === 'photo_banned_source')).toBe(false)
  })
})

describe('heal: 교체 → 못 찾으면 공개 단계만 빈칸', () => {
  const wikiBlocks = (manual: boolean) => {
    const p = factsOf('pkg-nl-0029', wikiDay(manual))
    return { p, blocks: publicWrongPhotoBlocks(gateBlocks(p)).filter((b) => b.day === 4) }
  }
  const input = (p: ProductPhotoFacts, blocks: ReturnType<typeof gateBlocks>) => ({ productId: p.id, destinationTerms: ['발리', 'Bali'], cityTerms: ['Bali'], schedule: p.schedule, cover: null, blocks })

  it('맞는 사진을 찾으면 교체한다(관리자 선택 칸이어도) — 새 사진은 Wikimedia 가 아니고 수동 선택 표시는 내려간다', async () => {
    const { p, blocks } = wikiBlocks(true)
    const h = makeDeps({ acquire: async () => ({ ok: true, tried: [], photo: okPhoto as never }), clearUnreplaceable: shouldClearWhenUnreplaceable })
    const res = await healBlockedSlots(input(p, blocks), h.deps)
    expect(res.replaced.map((r) => r.day)).toEqual([4])
    const row = (JSON.parse(res.schedule!) as Array<Record<string, unknown>>)[3]!
    expect(row.imageUrl).toBe(okPhoto.url)
    expect(row.imageManualSelected).toBe(false)
    expect(photoIsBannedSource({ url: row.imageUrl, ...(row.imageSource as object) })).toBe(false)
    expect(h.replaces[0]!.sourceType).toBe('heal-day')
    expect(h.replaces[0]!.notes).toContain('Wikimedia') // 되돌릴 수 있게 교체 전 값을 남긴다
  })

  it('관리자 선택이 아닌 기존 칸도 같은 방식으로 교체한다', async () => {
    const { p, blocks } = wikiBlocks(false)
    const h = makeDeps({ acquire: async () => ({ ok: true, tried: [], photo: okPhoto as never }) })
    const res = await healBlockedSlots(input(p, blocks), h.deps)
    expect(res.replaced.length).toBe(1)
  })

  it('못 찾으면 공개 단계는 칸을 비우고(틀린 사진 유지 금지) 되돌림 기록·예외 사유를 남긴다', async () => {
    const { p, blocks } = wikiBlocks(true)
    const h = makeDeps({ acquire: failAcquire, clearUnreplaceable: shouldClearWhenUnreplaceable })
    const res = await healBlockedSlots(input(p, blocks), h.deps)
    const row = (JSON.parse(res.schedule!) as Array<Record<string, unknown>>)[3]!
    expect(row.imageUrl).toBe('')
    expect(row.imageSource).toBeNull()
    expect(res.cleared).toBe(1)
    expect(h.exceptions.map((e) => e.reason)).toEqual(['no_sight_match', 'cleared_no_replacement'])
    expect(h.replaces[0]!.sourceType).toBe('heal-clear')
    expect(h.replaces[0]!.notes).toContain('Wikimedia')
    // 다른 일차 칸은 그대로
    const before = JSON.parse(p.schedule!) as Array<Record<string, unknown>>
    const after = JSON.parse(res.schedule!) as Array<Record<string, unknown>>
    expect(after.filter((_, i) => i !== 3)).toEqual(before.filter((_, i) => i !== 3))
  })

  it('등록대기 단계(비우기 옵션 없음)는 못 찾아도 비우지 않는다', async () => {
    const { p, blocks } = wikiBlocks(false)
    const h = makeDeps({ acquire: failAcquire })
    const res = await healBlockedSlots(input(p, blocks), h.deps)
    expect(h.writes).toEqual([])
    expect(res.schedule).toBe(p.schedule)
    expect(res.cleared).toBeUndefined()
  })

  it('후보가 Wikimedia 출처면 쓰지 않는다(새 Wikimedia 0) — 공개 단계는 비운다', async () => {
    const { p, blocks } = wikiBlocks(false)
    const wikiCand = { ...okPhoto, url: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/X.jpg', source: 'Wikimedia Commons', originalLink: 'https://commons.wikimedia.org/wiki/File:X.jpg' }
    const h = makeDeps({ acquire: async () => ({ ok: true, tried: [], photo: wikiCand as never }), clearUnreplaceable: shouldClearWhenUnreplaceable })
    const res = await healBlockedSlots(input(p, blocks), h.deps)
    expect(h.exceptions.map((e) => e.reason)).toContain('banned_source_candidate')
    for (const w of h.writes) expect(w).not.toContain('commons.wikimedia.org/wiki/File:X.jpg')
    expect((JSON.parse(res.schedule!) as Array<Record<string, unknown>>)[3]!.imageUrl).toBe('')
  })

  it('대표 칸: 교체 성공은 대표 필드만, 못 찾으면 대표 필드를 비운다', async () => {
    const cover = { bgImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c1/C.jpg', bgImageSource: 'wikimedia', bgImageSourceUrl: 'https://commons.wikimedia.org/wiki/File:C.jpg', bgImageExternalId: 'File:C.jpg' }
    const p = factsOf('pkg-nl-0029', undefined, cover)
    const blocks = publicWrongPhotoBlocks(gateBlocks(p)).filter((b) => b.kind === 'cover')
    expect(blocks.length).toBe(1)
    const heal = { productId: p.id, destinationTerms: ['발리'], cityTerms: ['Bali'], schedule: p.schedule, cover: { url: cover.bgImageUrl, externalId: cover.bgImageExternalId, source: cover.bgImageSource, originalLink: cover.bgImageSourceUrl, placeLabel: 'Tanah Lot' }, blocks }
    const ok = makeDeps({ acquire: async () => ({ ok: true, tried: [], photo: okPhoto as never }), clearUnreplaceable: shouldClearWhenUnreplaceable })
    await healBlockedSlots(heal, ok.deps)
    expect(ok.covers[0]!.bgImageUrl).toBe(okPhoto.url)
    expect(ok.writes).toEqual([])
    const none = makeDeps({ acquire: failAcquire, clearUnreplaceable: shouldClearWhenUnreplaceable })
    const res = await healBlockedSlots(heal, none.deps)
    expect(none.covers[0]!.bgImageUrl).toBeNull()
    expect(none.covers[0]!.bgImageSource).toBeNull()
    expect(res.cleared).toBe(1)
    expect(none.replaces[0]!.sourceType).toBe('heal-cover-clear')
    expect(none.replaces[0]!.notes).toContain('wikimedia')
    const keep = makeDeps({ acquire: failAcquire })
    await healBlockedSlots(heal, keep.deps)
    expect(keep.covers).toEqual([])
  })
})

describe('확정 불일치 비우기 범위', () => {
  it('저장 명소 불일치(STORED_SIGHT_MISMATCH)는 못 찾으면 비우고, 출처 메타 불일치(SOURCE_META)는 확정 목록에 있을 때만 비운다', async () => {
    // pkg-nl-0029 D4: 저장 명소가 그날 정답 명소에 없음(확정)
    const p29 = factsOf('pkg-nl-0029')
    const b29 = publicWrongPhotoBlocks(gateBlocks(p29)).filter((b) => b.day === 4)
    expect(b29.length).toBeGreaterThan(0)
    const h29 = makeDeps({ acquire: failAcquire, clearUnreplaceable: shouldClearWhenUnreplaceable })
    const r29 = await healBlockedSlots({ productId: p29.id, destinationTerms: ['발리', 'Bali'], cityTerms: ['Bali'], schedule: p29.schedule, cover: null, blocks: b29 }, h29.deps)
    expect(r29.cleared).toBe(1)
    expect((JSON.parse(r29.schedule!) as Array<Record<string, unknown>>)[3]!.imageUrl).toBe('')

    // pkg-nl-0036 D1: 확정 오답 목록(상품 ID·일차·사진 ID 일치) → 비운다
    const conf = CONFIRMED_WRONG_PHOTOS_1129[0]!
    const realId = conf.productId
    const p36 = factsOf('pkg-nl-0036', undefined, undefined, realId)
    const b36 = publicWrongPhotoBlocks(gateBlocks(p36)).filter((b) => b.day === 1)
    expect(b36.length).toBe(1)
    const h36 = makeDeps({ acquire: failAcquire, clearUnreplaceable: shouldClearWhenUnreplaceable })
    const r36 = await healBlockedSlots({ productId: realId, destinationTerms: [p36.destination!], cityTerms: [], schedule: p36.schedule, cover: null, blocks: b36 }, h36.deps)
    expect(r36.cleared).toBe(1)
    expect((JSON.parse(r36.schedule!) as Array<Record<string, unknown>>)[0]!.imageUrl).toBe('')

    // 같은 일반 출처 메타 불일치라도 확정 목록에 없는 상품은 비우지 않는다(유지 + 예외)
    const pOther = factsOf('pkg-nl-0036', undefined, undefined, 'some-other-product')
    const bOther = publicWrongPhotoBlocks(gateBlocks(pOther)).filter((b) => b.day === 1)
    const hOther = makeDeps({ acquire: failAcquire, clearUnreplaceable: shouldClearWhenUnreplaceable })
    const rOther = await healBlockedSlots({ productId: 'some-other-product', destinationTerms: [pOther.destination!], cityTerms: [], schedule: pOther.schedule, cover: null, blocks: bOther }, hOther.deps)
    expect(rOther.cleared).toBeUndefined()
    expect(hOther.writes).toEqual([])
  })

  it('확정 목록은 사진이 바뀌면 자동 해제된다', () => {
    const c = CONFIRMED_WRONG_PHOTOS_1129[0]!
    expect(photoIsConfirmedWrong(c.productId, c.day, c.externalId)).toBe(true)
    expect(photoIsConfirmedWrong(c.productId, c.day, 'other')).toBe(false)
    expect(photoIsConfirmedWrong(c.productId, c.day + 1, c.externalId)).toBe(false)
    expect(photoIsConfirmedWrong(c.productId, null, c.externalId)).toBe(false)
  })
})

describe('대량 교체가 등록대기 단계를 굶기지 않는다(가짜 시계)', () => {
  const MIN = 60 * 1000
  it('공개 단계 200상품(상품당 1분)은 45분에서 멈추고 남은 상품은 뒤로 넘기며, 등록대기는 자기 한도로 전부 처리된다', async () => {
    let t = 0
    const ids = Array.from({ length: 200 }, (_, i) => `pub${i}`)
    const done: string[] = []
    const pub = await runWrongPhotoRounds({
      productIds: ids,
      processOne: async (id) => (done.push(id), (t += MIN), { replaced: 1, quotaLimited: false }),
      quotaResumeAtMs: () => null,
      now: () => t,
      sleep: async () => {},
      deadlineAtMs: publicWrongPhotoDeadlineAtMs(0),
    })
    expect(pub.stopReason).toBe('time_budget')
    expect(done.length).toBe(45)
    expect(pub.remaining.length).toBe(155)
    const pendingDone: string[] = []
    const pend = await runWrongPhotoRounds({
      productIds: ['pe1', 'pe2', 'pe3'],
      processOne: async (id) => (pendingDone.push(id), (t += MIN), { replaced: 1, quotaLimited: false }),
      quotaResumeAtMs: () => null,
      now: () => t,
      sleep: async () => {},
      deadlineAtMs: pendingWrongPhotoDeadlineAtMs(t),
    })
    expect(pend.stopReason).toBe('done')
    expect(pendingDone).toEqual(['pe1', 'pe2', 'pe3'])
  })
})

describe('소스 확인', () => {
  const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')
  it('공개 교체 단계만 비우기 옵션을 넘기고 등록대기 단계는 넘기지 않는다', () => {
    const runner = read('./photo-gate-runner.ts')
    expect(runner.match(/clearUnreplaceable: shouldClearWhenUnreplaceable/g)?.length).toBe(1)
    const pendingFn = runner.slice(runner.indexOf('export async function runPendingWrongPhotoReplaceLive'))
    expect(pendingFn).not.toContain('clearUnreplaceable')
  })
})
