import { describe, expect, it } from 'vitest'
import {
  AUTOFILL_COVER_MAX_BYTES,
  AUTOFILL_DAY_MAX_BYTES,
  AUTOFILL_MAX_CANDIDATES_PER_SLOT,
  AUTOFILL_MIN_WIDTH,
  buildPublicPhotoUsage,
  evaluateAutofillCandidate,
  evaluateStoredPhotoSize,
  photoIdentityKeys,
  photoSubjectIsPerson,
  PublicPhotoUsage,
  type AutofillCandidate,
} from '@/lib/photo-autofill-gate'
import { sightProfile } from '@/lib/photo-autofill-sight'
import { AUTO_REGISTER_CARD_MAX_BYTES } from '@/lib/register-auto-register-gate'
import { DAY_PHOTO_DETAIL_MAX_BYTES } from '@/lib/register-day-photo-policy'
import { IMAGE_MIN_WIDTH } from '@/lib/product-image-source-policy'

const blue = sightProfile('Blue Mosque')

function cand(over: Partial<AutofillCandidate> = {}): AutofillCandidate {
  return {
    id: '1001',
    source: 'Pexels',
    url: 'https://images.pexels.com/photos/1001/pexels-photo-1001.jpeg',
    width: 4000,
    height: 2600,
    photographer: 'Jane Doe',
    originalLink: 'https://www.pexels.com/photo/blue-mosque-in-istanbul-1001/',
    altText: 'Blue Mosque in Istanbul at sunset',
    title: null,
    description: null,
    tags: [],
    ...over,
  }
}

function judge(c: AutofillCandidate, usage = new PublicPhotoUsage(), productId = 'p-new') {
  return evaluateAutofillCandidate({
    candidate: c,
    sight: blue,
    cityTerms: ['istanbul'],
    slotText: '이스탄불 블루모스크 Istanbul',
    slotKind: 'day',
    productId,
    usage,
  })
}

describe('photo-autofill-gate: 기준 상수는 기존 상수를 재사용', () => {
  it('카드 200,000B · 상세 400,000B · 가로 1200px', () => {
    expect(AUTOFILL_COVER_MAX_BYTES).toBe(200_000)
    expect(AUTOFILL_COVER_MAX_BYTES).toBe(AUTO_REGISTER_CARD_MAX_BYTES)
    expect(AUTOFILL_DAY_MAX_BYTES).toBe(400_000)
    expect(AUTOFILL_DAY_MAX_BYTES).toBe(DAY_PHOTO_DETAIL_MAX_BYTES)
    expect(AUTOFILL_MIN_WIDTH).toBe(IMAGE_MIN_WIDTH)
    expect(AUTOFILL_MIN_WIDTH).toBe(1200)
    expect(AUTOFILL_MAX_CANDIDATES_PER_SLOT).toBe(5)
  })
})

describe('photo-autofill-gate: 태그 일치 / 불일치', () => {
  it('명소 이름이 설명에 있으면 통과', () => {
    const r = judge(cand())
    expect(r.ok).toBe(true)
    expect(r.matched).toBeTruthy()
  })

  it('태그에 별칭이 있어도 통과', () => {
    const r = judge(cand({ altText: 'Mosque at dusk', tags: ['sultan ahmed mosque', 'istanbul'] }))
    expect(r.ok).toBe(true)
  })

  it('도시 이름만 맞으면 탈락(city_only_match)', () => {
    const r = judge(cand({ altText: 'Istanbul skyline over the Bosphorus', originalLink: 'https://www.pexels.com/photo/istanbul-skyline-1002/' }))
    expect(r.ok).toBe(false)
    expect(r.reasons).toContain('city_only_match')
  })

  it('이름이 전혀 안 맞으면 탈락(no_sight_match)', () => {
    const r = judge(cand({ altText: 'Plate of food on a wooden table', originalLink: 'https://www.pexels.com/photo/plate-of-food-1003/' }))
    expect(r.ok).toBe(false)
    expect(r.reasons).toContain('no_sight_match')
  })

  it('동음 장소·다른 나라 표지판(Blue Mosque in Yerevan 등)은 탈락', () => {
    const r = judge(cand({ altText: 'Blue Mosque in Yerevan Armenia', originalLink: 'https://www.pexels.com/photo/blue-mosque-in-yerevan-1004/' }))
    expect(r.ok).toBe(false)
  })
})

describe('photo-autofill-gate: 같은 이름 다른 곳', () => {
  it('프라하 구시가지 광장 일정에 바르샤바 사진은 탈락', () => {
    const r = evaluateAutofillCandidate({
      candidate: cand({ altText: 'Old Town Square in Warsaw Poland', originalLink: 'https://www.pexels.com/photo/old-town-square-warsaw-1010/' }),
      sight: sightProfile('Old Town Square'),
      cityTerms: ['prague'],
      slotText: '프라하 구시가지 광장 Prague',
      slotKind: 'day',
      productId: 'p-new',
      usage: new PublicPhotoUsage(),
    })
    expect(r.ok).toBe(false)
    expect(r.reasons).toContain('other_place')
  })
})

describe('photo-autofill-gate: 흔한 이름은 도시 낱말이 같이 있어야 한다', () => {
  const judgeWith = (sight: string, cityTerms: string[], alt: string) =>
    evaluateAutofillCandidate({
      candidate: cand({ altText: alt, originalLink: 'https://www.pexels.com/photo/x-1020/' }),
      sight: sightProfile(sight),
      cityTerms,
      slotText: cityTerms.join(' '),
      slotKind: 'day',
      productId: 'p-new',
      usage: new PublicPhotoUsage(),
    })

  it('Aurora Village(옐로나이프) 일정에 노르웨이 오로라 사진은 탈락', () => {
    expect(judgeWith('Aurora Village', ['yellowknife'], 'Northern Lights above the village in Norway').ok).toBe(false)
    expect(judgeWith('Aurora Village', ['yellowknife'], 'Aurora Village near Yellowknife Canada at night').ok).toBe(true)
  })

  it('프라하 Old Town Square 일정에 포즈난 사진은 탈락, 프라하 사진은 통과', () => {
    expect(judgeWith('Old Town Square', ['prague'], 'Old town square buildings in Poznan Poland').ok).toBe(false)
    expect(judgeWith('Old Town Square', ['prague'], 'Old Town Square in Prague at night').ok).toBe(true)
  })
})

describe('photo-autofill-gate: 인물 주인공 탈락', () => {
  it('태그·제목에 인물이 있으면 탈락', () => {
    for (const alt of ['Portrait of a woman in front of the Blue Mosque', 'Selfie at Blue Mosque istanbul', 'Fashion model posing near Blue Mosque']) {
      const r = judge(cand({ altText: alt, originalLink: 'https://www.pexels.com/photo/x-1005/' }))
      expect(r.ok, alt).toBe(false)
      expect(r.reasons, alt).toContain('person_subject')
    }
    expect(judge(cand({ tags: ['woman', 'blue mosque'] })).reasons).toContain('person_subject')
  })

  it('한 사람이 주어인 문장은 배경이 명소여도 탈락(Solitary person standing on …)', () => {
    expect(photoSubjectIsPerson({ title: 'Solitary person standing on Reynisfjara Beach with iconic rock formations', tags: '' })).toBe(true)
    expect(photoSubjectIsPerson({ title: 'A woman walking toward the Blue Mosque in Istanbul', tags: '' })).toBe(true)
  })

  it('풍경 속 작은 사람은 허용', () => {
    expect(photoSubjectIsPerson({ title: 'Tourists walking by the Blue Mosque courtyard in Istanbul', tags: '' })).toBe(false)
    expect(judge(cand({ altText: 'People walking near the Blue Mosque Istanbul' })).ok).toBe(true)
  })

  it('회의실·사무실·로고 같은 무관 사진은 탈락', () => {
    const r = judge(cand({ altText: 'Blue Mosque logo on office meeting presentation', originalLink: 'https://www.pexels.com/photo/x-1006/' }))
    expect(r.reasons).toContain('irrelevant_subject')
  })
})

describe('photo-autofill-gate: 공개 상품 중복 탈락', () => {
  const rows = [
    {
      productId: 'p-public',
      bgImageUrl: 'https://cdn.example.com/photo-pool/cover.webp',
      bgImageExternalId: '2002',
      bgImageSourceUrl: 'https://www.pexels.com/photo/something-2002/',
      schedule: JSON.stringify([
        { day: 1, imageUrl: 'https://images.pexels.com/photos/1001/pexels-photo-1001.jpeg', imageSource: { source: 'Pexels', externalId: '1001', originalLink: '' } },
      ]),
    },
  ]

  it('일차 사진과 같은 출처 id 는 탈락', () => {
    const usage = buildPublicPhotoUsage(rows)
    const r = judge(cand(), usage)
    expect(r.ok).toBe(false)
    expect(r.reasons).toContain('public_duplicate')
  })

  it('대표(목록 카드) 사진과 같은 id 도 탈락 — 카드 대표는 공개 상품 전체에서 한 번만', () => {
    const usage = buildPublicPhotoUsage(rows)
    const r = judge(cand({ id: '2002', url: 'https://images.pexels.com/photos/2002/pexels-photo-2002.jpeg', originalLink: 'https://www.pexels.com/photo/blue-mosque-2002/' }), usage)
    expect(r.reasons).toContain('public_duplicate')
  })

  it('재호스팅 주소는 풀의 원 출처 id 로 찾는다', () => {
    const usage = buildPublicPhotoUsage(
      [{ productId: 'p-public', bgImageUrl: 'https://cdn.example.com/photo-pool/x.webp', bgImageExternalId: null }],
      new Map([['https://cdn.example.com/photo-pool/x.webp', '3003']]),
    )
    expect(usage.conflict(photoIdentityKeys({ externalId: '3003' }), 'p-other')).not.toBeNull()
  })

  it('같은 상품 안 재사용은 충돌이 아니다', () => {
    const usage = buildPublicPhotoUsage(rows)
    expect(judge(cand(), usage, 'p-public').ok).toBe(true)
  })

  it('쓰이지 않은 사진은 통과', () => {
    expect(judge(cand({ id: '9999', url: 'https://images.pexels.com/photos/9999/a.jpeg', originalLink: 'https://www.pexels.com/photo/blue-mosque-9999/' }), buildPublicPhotoUsage(rows)).ok).toBe(true)
  })
})

describe('photo-autofill-gate: 해상도·용량 기준', () => {
  it('1200px 미만과 세로 사진은 탈락', () => {
    expect(judge(cand({ width: 1199, height: 800 })).reasons).toContain('low_res')
    expect(judge(cand({ width: 1200, height: 800 })).ok).toBe(true)
    expect(judge(cand({ width: 1300, height: 2000 })).reasons).toContain('portrait_orientation')
  })

  it('저장본: 대표 200,000B 미만 · 일차 400,000B 미만 · 1200px 이상 · 측정 실패는 불가', () => {
    expect(evaluateStoredPhotoSize({ kind: 'cover', bytes: 199_999, width: 1600 })).toEqual([])
    expect(evaluateStoredPhotoSize({ kind: 'cover', bytes: 200_000, width: 1600 })).toEqual(['over_bytes'])
    expect(evaluateStoredPhotoSize({ kind: 'day', bytes: 399_999, width: 1600 })).toEqual([])
    expect(evaluateStoredPhotoSize({ kind: 'day', bytes: 400_000, width: 1600 })).toEqual(['over_bytes'])
    expect(evaluateStoredPhotoSize({ kind: 'day', bytes: 100_000, width: 1100 })).toEqual(['low_res'])
    expect(evaluateStoredPhotoSize({ kind: 'day', bytes: null, width: 1600 })).toEqual(['not_measured'])
  })
})
