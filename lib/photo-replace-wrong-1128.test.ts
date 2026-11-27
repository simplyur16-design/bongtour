/**
 * REGRESSION-FREEZE[photo-replace-wrong-1128]: 이미 든 잘못된 사진 판정·실사진 교체·못 찾으면 유지·실행 상한
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { AcquireInput, AcquireResult } from '@/lib/photo-autofill-acquire'
import { evaluateAutofillCandidate, photoSubjectIsTextOrMap, PublicPhotoUsage, type AutofillCandidate } from '@/lib/photo-autofill-gate'
import { sightProfile } from '@/lib/photo-autofill-sight'
import { healBlockedSlots, type HealDeps, type HealInput } from '@/lib/photo-heal'
import type { PhotoException } from '@/lib/photo-exception-list'
import { coverReplacementData, parseReplaceNote } from '@/lib/photo-slot-apply'
import {
  createRunBudget,
  publicWrongPhotoBlocks,
  rotateForHour,
  WRONG_PHOTO_REPLACE_MAX_PER_RUN,
  WRONG_PHOTO_REPLACE_PUBLIC_MAX_PER_RUN,
  WRONG_PHOTO_REPLACE_PUBLIC_SCAN_PER_RUN,
} from '@/lib/photo-replace-wrong-1128'
import {
  evaluateRegistrationPhotos,
  photoSourceIsAiGenerated,
  registrationBlockCodes,
  STORED_SIGHT_MISMATCH_DETAIL,
  type RegistrationPhotoBlock,
  type RegistrationPhotoInput,
} from '@/lib/register-photo-registration-gate'
import { AUTO_REGISTER_BLOCK_REASON_KO } from '@/lib/register-auto-register-gate'

const OK_PROBE = { bytes: 150_000, width: 1800 }

/** fit-mt-0008 4일차 실제 저장값(국제거리 간판 사진, 저장 명소 'Okinawa') */
const FIT_MT_0008_DAY4 = {
  day: 4,
  title: '아쉬움을 뒤로하고 다시 만날 약속',
  routeText: 'Pacific Hotel Okinawa - Naminoue Shrine - Naha Airport',
  description: '호텔 조식 후 시내의 사찰을 방문하고 렌터카를 반납하며 여정을 마무리합니다.',
  imageKeyword: 'Okinawa',
  imageUrl: 'https://cdn.example.com/photo-pool/fit-mt-0008-d4.webp',
  imageSource: {
    source: 'CC0',
    photographer: 'Naha Mama Pavilionz',
    originalLink:
      'https://commons.wikimedia.org/wiki/File:JP_%E6%97%A5%E6%9C%AC_Japan_%E6%B2%96%E7%B9%A9_OKINAWA_%E9%82%A3%E9%9C%B8_Naha_%E5%9C%8B%E9%9A%9B%E9%80%9A_Kokusai-dori_sign_January_2025_R12S_07.jpg',
    externalId: '158551898',
    cityMatch: 'pool',
    sight: 'Okinawa',
    sightMatch: 'okinawa',
  },
}

function istDay(over: Record<string, unknown> = {}) {
  return {
    day: 1,
    title: '이스탄불 · 블루모스크',
    routeText: '이스탄불 - 블루모스크 - 그랜드바자르',
    description: null,
    imageUrl: 'https://cdn.example.com/photo-pool/d1.webp',
    imageSource: { source: 'Pexels', photographer: 'A', originalLink: 'https://www.pexels.com/photo/blue-mosque-in-istanbul-111/', externalId: '111' },
    ...over,
  }
}

function gateInput(days: Array<Record<string, unknown>>, over: Partial<RegistrationPhotoInput> = {}): RegistrationPhotoInput {
  const urls = days.map((d) => String(d.imageUrl ?? '')).filter(Boolean)
  if (over.cover?.url) urls.push(over.cover.url)
  return {
    productId: 'p-1',
    destinationTerms: ['이스탄불', '터키', 'istanbul'],
    cover: null,
    schedule: JSON.stringify(days),
    usage: new PublicPhotoUsage(),
    probes: Object.fromEntries(urls.map((u) => [u, OK_PROBE])),
    ...over,
  }
}

const reasons = (r: { blocks: RegistrationPhotoBlock[] }) => r.blocks.map((b) => b.reason)

describe('photo-replace-wrong-1128: 이미 든 사진 판정', () => {
  it('fit-mt-0008 4일차 국제거리 간판 사진 → photo_text_map (교체 대상)', () => {
    const r = evaluateRegistrationPhotos(gateInput([FIT_MT_0008_DAY4], { destinationTerms: ['오키나와', 'okinawa', 'naha'] }))
    const b = r.blocks.find((x) => x.reason === 'photo_text_map')
    expect(b).toBeDefined()
    expect(b!.day).toBe(4)
    expect(publicWrongPhotoBlocks(r.blocks).map((x) => x.reason)).toContain('photo_text_map')
    expect(registrationBlockCodes(r.blocks)).toContain('photo_wrong_kind')
    expect(AUTO_REGISTER_BLOCK_REASON_KO.photo_wrong_kind).toBeTruthy()
  })

  it('지도·노선도·간판 사진은 새 후보에서도 text_or_map 으로 탈락', () => {
    const naminoue = sightProfile('Naminoue Shrine')
    const base: AutofillCandidate = {
      id: '9001',
      source: 'Wikimedia',
      url: 'https://upload.wikimedia.org/x/9001.jpg',
      width: 4000,
      height: 2600,
      photographer: 'X',
      originalLink: 'https://commons.wikimedia.org/wiki/File:Naminoue_Shrine_sign_Naha.jpg',
      altText: 'Naminoue Shrine sign in Naha',
      title: null,
      description: null,
      tags: [],
    }
    const judge = (c: AutofillCandidate) =>
      evaluateAutofillCandidate({ candidate: c, sight: naminoue, cityTerms: ['naha', 'okinawa'], slotText: 'Naminoue Shrine', slotKind: 'day', productId: 'p-1', usage: new PublicPhotoUsage() })
    expect(judge(base).reasons).toContain('text_or_map')
    expect(judge({ ...base, altText: 'Naminoue Shrine route map', originalLink: 'https://commons.wikimedia.org/wiki/File:Naminoue_route_map.jpg' }).reasons).toContain('text_or_map')
    expect(judge({ ...base, altText: 'Naminoue Shrine bus route timetable', originalLink: 'https://commons.wikimedia.org/wiki/File:Naminoue_bus.jpg' }).reasons).toContain('text_or_map')
    expect(judge({ ...base, altText: 'Naminoue Shrine on the cliff above the beach', originalLink: 'https://commons.wikimedia.org/wiki/File:Naminoue_Shrine_cliff.jpg' }).reasons).not.toContain('text_or_map')
  })

  it('간판이 명소 이름 자체면(Hollywood Sign) 거르지 않고, 거리 풍경 속 복수 간판(shop signs)도 거르지 않는다', () => {
    expect(photoSubjectIsTextOrMap('hollywood sign los angeles hills', ['Hollywood Sign'])).toBe(false)
    expect(photoSubjectIsTextOrMap('charming alleyway with vintage shop and cafe signs', ['Insadong'])).toBe(false)
    expect(photoSubjectIsTextOrMap('brown wooden signage on rocky river', ['Blue Mosque'])).toBe(true)
    expect(photoSubjectIsTextOrMap('quebec on map', ['Old Quebec'])).toBe(true)
  })

  it('Gemini(AI) 생성 일차·대표 사진 → photo_ai_generated, 관리자 선택 칸은 그대로', () => {
    const ai = istDay({ imageSource: { source: 'Gemini', originalLink: '', externalId: '' }, imageIsGenerated: true, imageUrl: 'https://cdn.example.com/gemini-day/d1.webp' })
    expect(reasons(evaluateRegistrationPhotos(gateInput([ai])))).toContain('photo_ai_generated')
    expect(reasons(evaluateRegistrationPhotos(gateInput([{ ...ai, imageManualSelected: true }])))).not.toContain('photo_ai_generated')
    const cover = { url: 'https://cdn.example.com/c.webp', source: 'gemini', isGenerated: true, originalLink: '', placeLabel: 'Blue Mosque' }
    const rc = evaluateRegistrationPhotos(gateInput([istDay()], { cover }))
    expect(rc.blocks.filter((b) => b.kind === 'cover').map((b) => b.reason)).toContain('photo_ai_generated')
    expect(publicWrongPhotoBlocks(rc.blocks).some((b) => b.kind === 'cover' && b.reason === 'photo_ai_generated')).toBe(true)
    expect(reasons(evaluateRegistrationPhotos(gateInput([istDay()], { cover: { ...cover, source: 'gemini_manual' } })))).not.toContain('photo_ai_generated')
    expect(photoSourceIsAiGenerated({ source: 'Pexels', url: 'https://cdn.example.com/p.webp', isGenerated: false })).toBe(false)
  })

  it('상품 안 같은 사진(앞 일차와 같음) → 뒤 일차만 photo_in_product_duplicate', () => {
    const d1 = istDay()
    const d2 = istDay({ day: 2 })
    const r = evaluateRegistrationPhotos(gateInput([d1, d2]))
    const dups = r.blocks.filter((b) => b.reason === 'photo_in_product_duplicate')
    expect(dups.map((b) => b.day)).toEqual([2])
  })

  it('다른 일차 명소로 저장된 사진 → 저장 명소 불일치(공개 상품도 교체 대상)', () => {
    const d1 = istDay()
    const d2 = istDay({
      day: 2,
      title: '카파도키아 · 괴레메',
      routeText: '카파도키아 - 괴레메 야외박물관',
      imageUrl: 'https://cdn.example.com/photo-pool/d2.webp',
      imageSource: { source: 'Pexels', photographer: 'A', originalLink: 'https://www.pexels.com/photo/x-222/', externalId: '222', sight: 'Blue Mosque', sightMatch: 'blue mosque' },
    })
    const r = evaluateRegistrationPhotos(gateInput([d1, d2], { destinationTerms: ['이스탄불', '카파도키아', 'istanbul', 'cappadocia'] }))
    const m = r.blocks.find((b) => b.day === 2 && b.reason === 'photo_sight_mismatch')
    expect(m).toBeDefined()
    expect(m!.detail.startsWith(STORED_SIGHT_MISMATCH_DETAIL)).toBe(true)
    expect(publicWrongPhotoBlocks(r.blocks).some((b) => b.day === 2)).toBe(true)
  })

  it('공개 상품: 근거 없는 불일치·인물·대표의 명소 불일치·용량은 교체하지 않는다', () => {
    const blocks: RegistrationPhotoBlock[] = [
      { kind: 'day', day: 1, reason: 'photo_sight_mismatch', detail: 'unverified (no title/tags)' },
      { kind: 'day', day: 2, reason: 'photo_sight_mismatch', detail: 'no sight in "istanbul skyline"' },
      { kind: 'day', day: 3, reason: 'photo_irrelevant_subject', detail: 'man in jacket' },
      { kind: 'cover', day: null, reason: 'photo_sight_mismatch', detail: 'no place' },
      { kind: 'day', day: 4, reason: 'photo_over_bytes', detail: '500000>=400000' },
      { kind: 'day', day: 5, reason: 'photo_public_duplicate', detail: '' },
      { kind: 'day', day: 6, reason: 'photo_sight_mismatch', detail: `${STORED_SIGHT_MISMATCH_DETAIL} "Eiffel Tower Paris" vs Weihai` },
      { kind: 'day', day: 7, reason: 'photo_text_map', detail: 'quebec on map' },
      { kind: 'day', day: 8, reason: 'photo_monochrome_text', detail: 'bw' },
      { kind: 'day', day: 9, reason: 'photo_in_product_duplicate', detail: '' },
      { kind: 'day', day: 10, reason: 'photo_ai_generated', detail: 'Gemini' },
    ]
    expect(publicWrongPhotoBlocks(blocks).map((b) => b.day)).toEqual([6, 7, 8, 9, 10])
  })
})

function scheduleOf(n: number) {
  return JSON.stringify(
    Array.from({ length: n }, (_, i) => ({
      day: i + 1,
      title: `${i + 1}일차`,
      routeText: '이스탄불 - 블루모스크',
      imageUrl: `https://cdn.example.com/old${i + 1}.webp`,
      imageSource: { source: 'Gemini', originalLink: '', externalId: '' },
      imageIsGenerated: true,
    })),
  )
}

function okResult(id: string): AcquireResult {
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

function harness(acquire: (i: AcquireInput) => AcquireResult, takeRunBudget?: () => boolean) {
  const exceptions: PhotoException[] = []
  const replaced: Array<{ day: number; sourceType: string; notes: string }> = []
  const calls: AcquireInput[] = []
  const deps: HealDeps = {
    acquire: async (i) => {
      calls.push(i)
      return acquire(i)
    },
    writeSchedule: async () => true,
    writeCover: async () => true,
    recordException: async (e) => void exceptions.push(e),
    recordReplace: async (r) => void replaced.push(r),
    usage: new PublicPhotoUsage(),
    now: () => new Date('2026-11-28T00:30:00+09:00'),
    takeRunBudget,
  }
  return { deps, exceptions, replaced, calls }
}

const aiBlock = (day: number): RegistrationPhotoBlock => ({ kind: 'day', day, reason: 'photo_ai_generated', detail: 'Gemini' })
const healInput = (blocks: RegistrationPhotoBlock[]): HealInput => ({
  productId: 'p-pub',
  destinationTerms: ['이스탄불', 'istanbul'],
  cityTerms: ['istanbul'],
  schedule: scheduleOf(3),
  cover: null,
  blocks,
})

describe('photo-replace-wrong-1128: 교체·유지·상한', () => {
  it('AI 일차 사진은 실사진으로 바뀌고 이전 값(주소·출처)이 기록된다', async () => {
    let n = 0
    const h = harness(() => okResult(`n${++n}`))
    const r = await healBlockedSlots(healInput([aiBlock(2)]), h.deps)
    expect(r.replaced).toHaveLength(1)
    const rows = JSON.parse(r.schedule!)
    expect(rows[1].imageUrl).toContain('new-n1')
    const note = parseReplaceNote(h.replaced[0]!.notes)
    expect(note?.prev).toMatchObject({ imageUrl: 'https://cdn.example.com/old2.webp' })
    expect(JSON.stringify(note?.prev)).toContain('Gemini')
  })

  it('교체 후에는 다시 AI 로 판정되지 않는다(재교체 반복 없음)', async () => {
    let n = 0
    const h = harness(() => okResult(`n${++n}`))
    const r = await healBlockedSlots(healInput([aiBlock(1), aiBlock(2), aiBlock(3)]), h.deps)
    const again = evaluateRegistrationPhotos({
      productId: 'p-pub',
      destinationTerms: ['이스탄불', 'istanbul'],
      cover: null,
      schedule: r.schedule,
      usage: new PublicPhotoUsage(),
      probes: {},
    })
    expect(again.blocks.filter((b) => b.reason === 'photo_ai_generated')).toHaveLength(0)
    const c = okResult('c1')
    if (!c.ok) throw new Error('fixture')
    expect(coverReplacementData(c.photo)).toMatchObject({ bgImageIsGenerated: false })
  })

  it('실사진을 못 찾으면 기존 사진을 지우지 않고 사유를 남긴다', async () => {
    const h = harness((i) => ({
      ok: false,
      skipped: false,
      tried: [],
      exception: { productId: i.productId, day: i.day, kind: i.kind, sight: 'Blue Mosque', query: 'Blue Mosque', reason: 'no_candidate', detail: '-', origin: i.origin, at: 'now' },
    }))
    const r = await healBlockedSlots(healInput([aiBlock(1)]), h.deps)
    expect(r.replaced).toHaveLength(0)
    expect(r.schedule).toBe(scheduleOf(3))
    expect(r.exceptions[0]!.detail).toContain('photo_ai_generated')
  })

  it('실행 상한을 넘으면 검색하지 않고 미룬다(사진 유지)', async () => {
    const budget = createRunBudget(1)
    let n = 0
    const h = harness(() => okResult(`n${++n}`), budget.take)
    const r = await healBlockedSlots(healInput([aiBlock(1), aiBlock(2), aiBlock(3)]), h.deps)
    expect(h.calls).toHaveLength(1)
    expect(r.replaced).toHaveLength(1)
    expect(r.deferred).toBe(2)
    const rows = JSON.parse(r.schedule!)
    expect(rows[2].imageUrl).toBe('https://cdn.example.com/old3.webp')
    expect(budget.used()).toBe(1)
  })

  it('상한 상수와 카운터', () => {
    expect(WRONG_PHOTO_REPLACE_MAX_PER_RUN).toBe(12)
    expect(WRONG_PHOTO_REPLACE_PUBLIC_MAX_PER_RUN).toBe(6)
    expect(WRONG_PHOTO_REPLACE_PUBLIC_SCAN_PER_RUN).toBe(60)
    const b = createRunBudget(2)
    expect([b.take(), b.take(), b.take()]).toEqual([true, true, false])
    expect(b.used()).toBe(2)
  })

  it('시각마다 판정 시작 위치가 돌아간다', () => {
    const rows = Array.from({ length: 10 }, (_, i) => i)
    const a = rotateForHour(rows, new Date('2026-11-28T00:30:00Z'), 3)
    const b = rotateForHour(rows, new Date('2026-11-28T01:30:00Z'), 3)
    expect(a).toHaveLength(3)
    expect(a).not.toEqual(b)
  })
})

describe('photo-replace-wrong-1128: 정적 가드', () => {
  const src = (p: string) => readFileSync(p, 'utf8')
  it('교체 경로는 이미지 생성(Gemini)을 쓰지 않는다', () => {
    for (const f of ['lib/photo-replace-wrong-1128.ts', 'lib/photo-heal.ts']) {
      expect(src(f)).not.toMatch(/from '@\/lib\/[^']*gemini[^']*'/i)
      expect(src(f)).not.toMatch(/generateImage|imagen/i)
    }
  })
  it('매시 작업이 공개 상품 교체를 상한과 함께 부른다', () => {
    const job = src('lib/register-auto-photo-register-job.ts')
    expect(job).toContain('runPublicWrongPhotoReplaceLive')
    expect(job).toContain('createRunBudget(WRONG_PHOTO_REPLACE_MAX_PER_RUN)')
    expect(job).toContain('WRONG_PHOTO_REPLACE_PUBLIC_MAX_PER_RUN')
    const runner = src('lib/photo-gate-runner.ts')
    expect(runner).toContain("registrationStatus: 'registered'")
    expect(runner).toContain('publicWrongPhotoBlocks')
  })
})
