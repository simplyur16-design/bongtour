import { describe, expect, it } from 'vitest'
import { PublicPhotoUsage, buildPublicPhotoUsage } from '@/lib/photo-autofill-gate'
import { evaluateRegistrationPhotos, registrationBlockCodes, type RegistrationPhotoInput } from '@/lib/register-photo-registration-gate'
import { AUTO_REGISTER_BLOCK_REASON_KO } from '@/lib/register-auto-register-gate'

const OK_PROBE = { bytes: 150_000, width: 1800 }

function day(over: Record<string, unknown> = {}) {
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

function input(over: Partial<RegistrationPhotoInput> & { days?: Array<Record<string, unknown>> } = {}): RegistrationPhotoInput {
  const days = over.days ?? [day()]
  const urls = days.map((d) => String(d.imageUrl ?? '')).filter(Boolean)
  return {
    productId: 'p-new',
    destinationTerms: ['이스탄불', '터키', 'istanbul'],
    cover: null,
    schedule: JSON.stringify(days),
    usage: new PublicPhotoUsage(),
    probes: Object.fromEntries(urls.map((u) => [u, OK_PROBE])),
    ...over,
  }
}

const reasons = (r: ReturnType<typeof evaluateRegistrationPhotos>) => r.blocks.map((b) => b.reason)

describe('register-photo-registration-gate: 등록 전 자동 차단 사유', () => {
  it('방문지에 맞고 크기도 기준 안이면 통과', () => {
    expect(evaluateRegistrationPhotos(input()).ok).toBe(true)
  })

  it('방문지 불일치 → photo_sight_mismatch', () => {
    const r = evaluateRegistrationPhotos(
      input({ days: [day({ imageSource: { source: 'Pexels', photographer: 'A', originalLink: 'https://www.pexels.com/photo/plate-of-food-222/', externalId: '222' } })] }),
    )
    expect(reasons(r)).toContain('photo_sight_mismatch')
    expect(r.ok).toBe(false)
  })

  it('도시 이름만 맞는 사진도 방문지 불일치', () => {
    const r = evaluateRegistrationPhotos(
      input({ days: [day({ imageSource: { source: 'Pexels', photographer: 'A', originalLink: 'https://www.pexels.com/photo/istanbul-skyline-333/', externalId: '333' } })] }),
    )
    expect(reasons(r)).toContain('photo_sight_mismatch')
  })

  it('자동 채움이 남긴 방문지 근거(sight+sightMatch)가 있으면 통과', () => {
    const r = evaluateRegistrationPhotos(
      input({ days: [day({ imageSource: { source: 'Pexels', photographer: 'A', originalLink: 'https://www.pexels.com/photo/x-444/', externalId: '444', sight: 'Blue Mosque', sightMatch: 'blue mosque' } })] }),
    )
    expect(reasons(r)).not.toContain('photo_sight_mismatch')
  })

  it('대표가 다른 공개 상품 대표와 같으면 photo_public_duplicate, 일차가 같아도 막지 않는다', () => {
    const usage = buildPublicPhotoUsage([
      { productId: 'p-public', bgImageUrl: 'https://cdn.example.com/photo-pool/cover.webp', bgImageExternalId: '555', schedule: JSON.stringify([{ day: 1, imageUrl: 'x', imageSource: { externalId: '111' } }]) },
    ])
    const r = evaluateRegistrationPhotos(
      input({
        usage,
        cover: { url: 'https://cdn.example.com/photo-pool/c2.webp', externalId: '555', originalLink: 'https://www.pexels.com/photo/blue-mosque-in-istanbul-555/', placeLabel: 'Blue Mosque' },
        probes: { 'https://cdn.example.com/photo-pool/d1.webp': OK_PROBE, 'https://cdn.example.com/photo-pool/c2.webp': OK_PROBE },
      }),
    )
    const dups = r.blocks.filter((b) => b.reason === 'photo_public_duplicate')
    expect(dups.map((b) => b.kind)).toEqual(['cover'])
  })

  it('대표가 다른 상품의 일차 사진과만 같으면 중복으로 막지 않는다', () => {
    const usage = buildPublicPhotoUsage([
      { productId: 'p-public', bgImageUrl: null, schedule: JSON.stringify([{ day: 1, imageUrl: 'https://images.pexels.com/photos/777/a.jpeg', imageSource: { externalId: '777' } }]) },
    ])
    const cover = { url: 'https://cdn.example.com/photo-pool/c777.webp', externalId: '777', originalLink: 'https://www.pexels.com/photo/blue-mosque-777/', placeLabel: 'Blue Mosque' }
    const r = evaluateRegistrationPhotos(input({ usage, cover, probes: { 'https://cdn.example.com/photo-pool/d1.webp': OK_PROBE, [cover.url]: OK_PROBE } }))
    expect(r.blocks.some((b) => b.reason === 'photo_public_duplicate')).toBe(false)
  })

  it('인물이 주인공이거나 회의실·로고면 → photo_irrelevant_subject', () => {
    for (const link of ['https://www.pexels.com/photo/portrait-of-a-woman-blue-mosque-666/', 'https://www.pexels.com/photo/blue-mosque-office-meeting-667/']) {
      const r = evaluateRegistrationPhotos(input({ days: [day({ imageSource: { source: 'Pexels', photographer: 'A', originalLink: link, externalId: '666' } })] }))
      expect(reasons(r), link).toContain('photo_irrelevant_subject')
    }
  })

  it('저화질 → photo_low_res, 용량 초과 → photo_over_bytes(대표 200,000 / 일차 400,000), 측정 실패 → photo_not_measured', () => {
    const u = 'https://cdn.example.com/photo-pool/d1.webp'
    expect(reasons(evaluateRegistrationPhotos(input({ probes: { [u]: { bytes: 100_000, width: 800 } } })))).toContain('photo_low_res')
    expect(reasons(evaluateRegistrationPhotos(input({ probes: { [u]: { bytes: 400_000, width: 1800 } } })))).toContain('photo_over_bytes')
    expect(reasons(evaluateRegistrationPhotos(input({ probes: { [u]: { bytes: 399_999, width: 1800 } } })))).not.toContain('photo_over_bytes')
    expect(reasons(evaluateRegistrationPhotos(input({ probes: { [u]: { bytes: null, width: null } } })))).toContain('photo_not_measured')
    const cover = { url: 'https://cdn.example.com/photo-pool/c.webp', originalLink: 'https://www.pexels.com/photo/blue-mosque-777/', placeLabel: 'Blue Mosque' }
    const r = evaluateRegistrationPhotos(input({ cover, probes: { [u]: OK_PROBE, [cover.url]: { bytes: 200_000, width: 1800 } } }))
    expect(r.blocks.some((b) => b.kind === 'cover' && b.reason === 'photo_over_bytes')).toBe(true)
  })

  it('관리자가 고른 일차 사진은 내용 검사를 건너뛴다(크기 측정만)', () => {
    const r = evaluateRegistrationPhotos(
      input({ days: [day({ imageManualSelected: true, imageSource: { source: 'manual', originalLink: '', externalId: '' } })] }),
    )
    expect(r.ok).toBe(true)
  })

  it('상품 단위 사유 코드는 자동 등록 사유 목록에 한글 표기가 있다', () => {
    const codes = registrationBlockCodes([
      { kind: 'day', day: 1, reason: 'photo_sight_mismatch', detail: '' },
      { kind: 'day', day: 2, reason: 'photo_sight_mismatch', detail: '' },
      { kind: 'cover', day: null, reason: 'photo_public_duplicate', detail: '' },
      { kind: 'day', day: 3, reason: 'photo_low_res', detail: '' },
    ])
    expect(codes.sort()).toEqual(['photo_public_duplicate', 'photo_sight_mismatch'])
    for (const c of ['photo_sight_mismatch', 'photo_public_duplicate', 'photo_irrelevant_subject'] as const) {
      expect(AUTO_REGISTER_BLOCK_REASON_KO[c]).toBeTruthy()
    }
  })
})
