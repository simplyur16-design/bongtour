import { describe, expect, it } from 'vitest'
import type { AcquireInput, AcquireResult } from '@/lib/photo-autofill-acquire'
import { PublicPhotoUsage } from '@/lib/photo-autofill-gate'
import { HEAL_MAX_SLOTS_PER_PRODUCT, healBlockedSlots, type HealDeps, type HealInput } from '@/lib/photo-heal'
import type { PhotoException } from '@/lib/photo-exception-list'
import { parseReplaceNote } from '@/lib/photo-slot-apply'
import type { RegistrationPhotoBlock } from '@/lib/register-photo-registration-gate'

function scheduleOf(n: number, manualDay?: number) {
  return JSON.stringify(
    Array.from({ length: n }, (_, i) => ({
      day: i + 1,
      title: `${i + 1}일차`,
      description: '설명',
      routeText: '이스탄불 - 블루모스크',
      imageUrl: `https://cdn.example.com/old${i + 1}.webp`,
      imageSource: { source: 'Pexels', photographer: 'A', originalLink: `https://www.pexels.com/photo/x-${i + 1}/`, externalId: String(i + 1) },
      ...(manualDay === i + 1 ? { imageManualSelected: true } : {}),
    })),
  )
}

const block = (day: number | null, reason: RegistrationPhotoBlock['reason'] = 'photo_sight_mismatch'): RegistrationPhotoBlock => ({
  kind: day == null ? 'cover' : 'day',
  day,
  reason,
  detail: '',
})

function okResult(id: string, _input: AcquireInput): AcquireResult {
  return {
    ok: true,
    tried: [],
    photo: {
      ok: true,
      url: `https://cdn.example.com/new-${id}.webp`,
      bytes: 100_000,
      width: 1800,
      source: 'Pexels',
      photographer: 'B',
      originalLink: `https://www.pexels.com/photo/blue-mosque-${id}/`,
      externalId: id,
      sight: 'Blue Mosque',
      matched: 'blue mosque',
      query: 'Blue Mosque',
    },
  }
}

function failResult(input: AcquireInput, reason = 'candidate_cap'): AcquireResult {
  return {
    ok: false,
    skipped: false,
    tried: [],
    exception: { productId: input.productId, day: input.day, kind: input.kind, sight: 'Blue Mosque', query: 'Blue Mosque', reason, detail: 'rejects=-', origin: input.origin, at: 'now' },
  }
}

function harness(opts: { acquire: (i: AcquireInput, n: number) => AcquireResult; writeOk?: boolean }) {
  const exceptions: PhotoException[] = []
  const replaced: Array<{ day: number; sourceType: string; notes: string }> = []
  const written: string[] = []
  let n = 0
  const deps: HealDeps = {
    acquire: async (i) => opts.acquire(i, ++n),
    writeSchedule: async (_id, _expected, next) => {
      if (opts.writeOk === false) return false
      written.push(next)
      return true
    },
    writeCover: async () => true,
    recordException: async (e) => void exceptions.push(e),
    recordReplace: async (r) => void replaced.push(r),
    usage: new PublicPhotoUsage(),
    now: () => new Date('2026-11-14T07:00:00Z'),
  }
  return { deps, exceptions, replaced, written }
}

const baseInput = (over: Partial<HealInput> = {}): HealInput => ({
  productId: 'p-new',
  destinationTerms: ['이스탄불', 'istanbul'],
  cityTerms: ['istanbul'],
  schedule: scheduleOf(3),
  cover: null,
  blocks: [],
  ...over,
})

describe('photo-heal: 막힌 칸만 다음 후보로 교체', () => {
  it('막힌 칸만 새 사진으로 바뀌고 나머지 일차는 그대로', async () => {
    const h = harness({ acquire: (i, n) => okResult(`n${n}`, i) })
    const r = await healBlockedSlots(baseInput({ blocks: [block(2)] }), h.deps)
    expect(r.replaced).toHaveLength(1)
    const rows = JSON.parse(r.schedule!)
    expect(rows[1].imageUrl).toContain('new-n1')
    expect(rows[0].imageUrl).toBe('https://cdn.example.com/old1.webp')
    expect(rows[2].imageUrl).toBe('https://cdn.example.com/old3.webp')
    expect(rows[1].title).toBe('2일차')
  })

  it('교체 전 값을 되돌릴 수 있게 기록한다', async () => {
    const h = harness({ acquire: (i, n) => okResult(`n${n}`, i) })
    await healBlockedSlots(baseInput({ blocks: [block(1)] }), h.deps)
    const note = parseReplaceNote(h.replaced[0]!.notes)
    expect(note?.prev).toMatchObject({ imageUrl: 'https://cdn.example.com/old1.webp' })
    expect(h.replaced[0]!.sourceType).toBe('heal-day')
  })

  it('한 칸의 여러 사유는 한 번만 교체', async () => {
    const h = harness({ acquire: (i, n) => okResult(`n${n}`, i) })
    const r = await healBlockedSlots(baseInput({ blocks: [block(1), block(1, 'photo_public_duplicate')] }), h.deps)
    expect(r.replaced).toHaveLength(1)
  })

  it('후보를 못 찾으면 그 칸은 예외 목록(사유 포함)에 오르고 사진은 그대로', async () => {
    const h = harness({ acquire: (i) => failResult(i) })
    const r = await healBlockedSlots(baseInput({ blocks: [block(2, 'photo_public_duplicate')] }), h.deps)
    expect(r.replaced).toHaveLength(0)
    expect(r.exceptions).toHaveLength(1)
    expect(r.exceptions[0]!.reason).toBe('candidate_cap')
    expect(r.exceptions[0]!.detail).toContain('photo_public_duplicate')
    expect(h.exceptions).toHaveLength(1)
    expect(r.schedule).toBe(scheduleOf(3))
  })

  it('동시에 수정되어 쓰기 충돌이면 덮어쓰지 않고 예외', async () => {
    const h = harness({ acquire: (i, n) => okResult(`n${n}`, i), writeOk: false })
    const r = await healBlockedSlots(baseInput({ blocks: [block(1)] }), h.deps)
    expect(r.replaced).toHaveLength(0)
    expect(r.exceptions[0]!.reason).toBe('write_conflict')
  })

  it('관리자가 고른 일차는 건드리지 않는다', async () => {
    const h = harness({ acquire: (i, n) => okResult(`n${n}`, i) })
    const r = await healBlockedSlots(baseInput({ schedule: scheduleOf(3, 2), blocks: [block(2)] }), h.deps)
    expect(r.replaced).toHaveLength(0)
    expect(h.written).toHaveLength(0)
  })

  it('측정 실패만 있는 칸은 힐 대상이 아니다(재측정은 호출부)', async () => {
    const h = harness({ acquire: (i, n) => okResult(`n${n}`, i) })
    const r = await healBlockedSlots(baseInput({ blocks: [block(1, 'photo_not_measured')] }), h.deps)
    expect(r.replaced).toHaveLength(0)
    expect(r.exceptions).toHaveLength(0)
  })

  it(`한 상품에서 ${HEAL_MAX_SLOTS_PER_PRODUCT}칸을 넘으면 나머지는 heal_cap 예외로 남기고 멈춘다`, async () => {
    const days = HEAL_MAX_SLOTS_PER_PRODUCT + 3
    const h = harness({ acquire: (i, n) => okResult(`n${n}`, i) })
    const r = await healBlockedSlots(baseInput({ schedule: scheduleOf(days), blocks: Array.from({ length: days }, (_, i) => block(i + 1)) }), h.deps)
    expect(r.replaced).toHaveLength(HEAL_MAX_SLOTS_PER_PRODUCT)
    expect(r.exceptions.filter((e) => e.reason === 'heal_cap')).toHaveLength(3)
  })

  it('대표 사진 칸도 같은 방식으로 교체·기록', async () => {
    const covers: Array<Record<string, unknown>> = []
    const h = harness({ acquire: (i, n) => okResult(`c${n}`, i) })
    h.deps.writeCover = async (_id, data) => {
      covers.push(data)
      return true
    }
    const r = await healBlockedSlots(
      baseInput({ cover: { url: 'https://cdn.example.com/oldcover.webp', externalId: '9', originalLink: 'https://www.pexels.com/photo/x-9/', source: 'Pexels', placeLabel: 'Blue Mosque' }, blocks: [block(null, 'photo_public_duplicate')] }),
      h.deps,
    )
    expect(r.replaced).toEqual([{ kind: 'cover', day: null, reason: 'photo_public_duplicate' }])
    expect(covers[0]!.bgImageUrl).toContain('new-c1')
    expect(parseReplaceNote(h.replaced[0]!.notes)?.prev).toMatchObject({ bgImageUrl: 'https://cdn.example.com/oldcover.webp' })
  })
})
