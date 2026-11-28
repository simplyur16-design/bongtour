/**
 * REGRESSION-FREEZE[photo-wrong-slot-reinspect-1128]: 기존 틀린 칸 재검사·도시명/일반명사 검색 차단·공식 고유명 검색(R03-23) — manifest
 */
import { describe, expect, it } from 'vitest'
import { evaluateAutofillCandidate, PublicPhotoUsage } from '@/lib/photo-autofill-gate'
import { officialSearchName, sightProfile, sightSearchQueries } from '@/lib/photo-autofill-sight'
import { planDayPhotoSave as planSave } from '@/lib/photo-day-save-gate-1128'
import { publicWrongPhotoBlocks } from '@/lib/photo-replace-wrong-1128'
import {
  evaluateRegistrationPhotos,
  SOURCE_META_MISMATCH_DETAIL,
  STORED_SIGHT_MISMATCH_DETAIL,
  type RegistrationPhotoInput,
} from '@/lib/register-photo-registration-gate'
import { firstMatchingScheduleSpotEn as spotEn } from '@/lib/schedule-poi-regex-ssot'
import { itineraryMentionsAnimal, photoSubjectBlockReason } from '@/lib/register-photo-subject-filter'

const OK = { bytes: 150_000, width: 1800 }

function gateInput(
  days: Array<Record<string, unknown>>,
  dest: string[],
): ReturnType<typeof evaluateRegistrationPhotos> {
  const urls = days.map((d) => String(d.imageUrl ?? '')).filter(Boolean)
  const input: RegistrationPhotoInput = {
    productId: 'p-reinspect',
    destinationTerms: dest,
    cover: null,
    schedule: JSON.stringify(days),
    usage: new PublicPhotoUsage(),
    probes: Object.fromEntries(urls.map((u) => [u, OK])),
  }
  return evaluateRegistrationPhotos(input)
}

function publicDays(r: ReturnType<typeof evaluateRegistrationPhotos>) {
  return publicWrongPhotoBlocks(r.blocks)
}

describe('photo-wrong-slot-reinspect-1128: 기존 틀린 7칸은 공개 교체 대상', () => {
  it('fit-mt-0029 4일차: 히낙다난이어야 하는데 보홀 일반 자연 사진', () => {
    const r = gateInput(
      [
        {
          day: 4,
          title: '마지막 힐링과 쇼핑의 즐거움',
          routeText: '히낙다난 동굴 - 보홀 비 팜 - 아일랜드 시티 몰 - 보홀 라운지 - 보홀 팡라오 국제공항',
          description: '신비로운 동굴 체험 후 쇼핑몰에서 기념품을 구매하고 편안한 라운지에서 귀국을 준비합니다.',
          imageKeyword: 'Bohol Loboc River Cruise',
          imageUrl: 'https://cdn.example.com/photo-pool/mt0029-d4.webp',
          imageSource: {
            source: 'Pixabay',
            originalLink: 'https://pixabay.com/photos/bohol-philippines-asia-blue-nature-111/',
            sight: 'Bohol',
            sightMatch: 'bohol',
          },
        },
      ],
      ['보홀', 'bohol'],
    )
    const pub = publicDays(r).filter((b) => b.day === 4)
    expect(pub.some((b) => b.reason === 'photo_sight_mismatch')).toBe(true)
    expect(pub.some((b) => b.detail.startsWith(STORED_SIGHT_MISMATCH_DETAIL) || b.detail.startsWith(SOURCE_META_MISMATCH_DETAIL))).toBe(true)
  })

  it('fit-vg-0006 5일차: 라벨 없는 산/새벽 사진(귀국일 푸꾸옥 대표명소)', () => {
    const r = gateInput(
      [
        {
          day: 5,
          title: '그리운 마음을 안고 집으로',
          routeText: '푸꾸옥 국제공항 - 인천 국제공항',
          description: '인천 국제공항에 안전하게 도착하여 푸꾸옥에서의 즐거웠던 가족 여행 일정을 마무리하는 날입니다.',
          hotelText: '숙박 없음(귀국)',
          imageKeyword: 'Phu Quoc',
          imageUrl: 'https://cdn.example.com/photo-pool/vg0006-d5.webp',
          imageSource: {
            source: 'Pixabay',
            originalLink: 'https://pixabay.com/photos/dawn-clouds-mountain-tree-sunny-222/',
          },
        },
      ],
      ['푸꾸옥', 'phu quoc'],
    )
    const pub = publicDays(r).filter((b) => b.day === 5)
    expect(pub.some((b) => b.detail.startsWith(SOURCE_META_MISMATCH_DETAIL))).toBe(true)
  })

  it('fit-hn-0051 5일차: 즈엉동 야시장 라벨인데 산 사진', () => {
    const r = gateInput(
      [
        {
          day: 5,
          title: '푸꾸옥에서 인천으로 이동하는 일정',
          routeText: '푸꾸옥 - 인천',
          hotelText: '숙박 없음(귀국)',
          description: '푸꾸옥에서 출발하여 인천으로 향해요.',
          imageKeyword: 'Phu Quoc',
          imageUrl: 'https://cdn.example.com/photo-pool/hn0051-d5.webp',
          imageSource: {
            source: 'Pixabay',
            originalLink: 'https://pixabay.com/photos/dawn-clouds-mountain-tree-sunny-222/',
            sight: 'Duong Dong Night Market Phu Quoc',
            sightMatch: 'core:duong+dong',
          },
        },
      ],
      ['푸꾸옥', 'phu quoc'],
    )
    expect(publicDays(r).some((b) => b.day === 5 && b.detail.startsWith(SOURCE_META_MISMATCH_DETAIL))).toBe(true)
  })

  it('pkg-hn-0126 5일차: 같은 산 사진·즈엉동 라벨', () => {
    const r = gateInput(
      [
        {
          day: 5,
          title: '숙박 없음(귀국)',
          routeText: '숙박 없음(귀국)',
          hotelText: '숙박 없음(귀국)',
          imageKeyword: 'Phu Quoc',
          imageUrl: 'https://cdn.example.com/photo-pool/hn0126-d5.webp',
          imageSource: {
            source: 'Pixabay',
            originalLink: 'https://pixabay.com/photos/dawn-clouds-mountain-tree-sunny-222/',
            sight: 'Duong Dong Night Market Phu Quoc',
            sightMatch: 'core:duong+dong',
          },
        },
      ],
      ['푸꾸옥', 'phu quoc'],
    )
    expect(publicDays(r).some((b) => b.day === 5 && b.detail.startsWith(SOURCE_META_MISMATCH_DETAIL))).toBe(true)
  })

  it('fit-nl-0018 1일차: 라우 파 삿 날에 마리나베이샌즈', () => {
    const r = gateInput(
      [
        {
          day: 1,
          title: '설레는 싱가포르와의 첫 만남',
          routeText: '창이 국제공항 - 시내 중심 호텔 - 라우 파 삿',
          description: '창이 국제공항에 도착해 도심으로 이동한 뒤 라우 파 삿에서 꼬치 요리를 즐겨 보세요.',
          imageKeyword: 'Singapore',
          imageUrl: 'https://cdn.example.com/photo-pool/nl0018-d1.webp',
          imageSource: {
            source: 'Pexels',
            originalLink: 'https://www.pexels.com/photo/marina-bay-sands-singapore-333/',
            sight: 'Marina Bay Sands Singapore',
            sightMatch: 'marina bay',
          },
        },
      ],
      ['싱가포르', 'singapore'],
    )
    expect(publicDays(r).some((b) => b.day === 1 && b.detail.startsWith(STORED_SIGHT_MISMATCH_DETAIL))).toBe(true)
  })

  it('fit-hn-0052 7일차: 피렌체→베네치아 이동일에 피렌체 두오모(잔여 키워드 무시)', () => {
    const r = gateInput(
      [
        {
          day: 6,
          title: '피렌체',
          routeText: '피렌체 두오모',
          imageUrl: '',
        },
        {
          day: 7,
          title: '피렌체에서 베네치아로 이동해 물의 도시를 관광해요',
          routeText: '피렌체 - 베네치아',
          description: '호텔에서 조식을 드신 뒤 피렌체에서 베네치아로 이동해 물의 도시를 관광해요.',
          imageKeyword: 'Florence Duomo Historic Center',
          imageUrl: 'https://cdn.example.com/photo-pool/hn0052-d7.webp',
          imageSource: {
            source: 'Pixabay',
            originalLink: 'https://pixabay.com/photos/cathedral-building-florence-duomo-444/',
            sight: 'Florence Duomo Historic Center',
            sightMatch: 'florence duomo',
          },
        },
      ],
      ['이탈리아', 'italy', '베네치아', 'venice', '피렌체', 'florence'],
    )
    expect(publicDays(r).some((b) => b.day === 7 && (b.detail.startsWith(STORED_SIGHT_MISMATCH_DETAIL) || b.detail.startsWith(SOURCE_META_MISMATCH_DETAIL)))).toBe(true)
  })

  it('pkg-hn-0155 5일차: 괌 귀국일에 상어 클로즈업', () => {
    const r = gateInput(
      [
        {
          day: 5,
          title: '숙박 없음(귀국)',
          routeText: '숙박 없음(귀국)',
          hotelText: '숙박 없음(귀국)',
          imageKeyword: 'Guam',
          imageUrl: 'https://cdn.example.com/photo-pool/hn0155-d5.webp',
          imageSource: {
            source: 'Pixabay',
            originalLink: 'https://pixabay.com/photos/shark-fish-eye-animal-water-swim-555/',
            sight: 'Fish Eye Marine Park Guam',
            sightMatch: 'fish eye',
          },
        },
      ],
      ['괌', 'guam'],
    )
    const pub = publicDays(r).filter((b) => b.day === 5)
    expect(pub.some((b) => b.reason === 'photo_sight_mismatch' || b.reason === 'photo_irrelevant_subject')).toBe(true)
  })
})

describe('photo-wrong-slot-reinspect-1128: 새 틀린 6칸 검색어·교체 대상 (R03-23 공식명)', () => {
  it('코끼리코 언덕 검색어는 Xiangbi Shan(상비산)이지, Elephant Trunk 재영작이 아니다', () => {
    expect(spotEn('코끼리코 언덕')).toBe('Xiangbi Shan')
    expect(officialSearchName('코끼리코 언덕')).toBe('Xiangbi Shan')
    expect(officialSearchName('Elephant Trunk Hill')).toBe('Xiangbi Shan')
    const qs = sightSearchQueries('코끼리코 언덕')
    expect(qs).toEqual(['Xiangbi Shan'])
    expect(qs.join(' ').toLowerCase()).not.toMatch(/elephant/)
    const qs2 = sightSearchQueries('Elephant Trunk Hill')
    expect(qs2).toEqual(['Xiangbi Shan'])
  })

  it('수크 와키프는 Souq Waqif, 나고야성은 Nagoya Castle', () => {
    expect(spotEn('수크 와키프')).toBe('Souq Waqif')
    expect(sightSearchQueries('Souq Waqif')[0]).toMatch(/Souq Waqif/i)
    expect(spotEn('나고야성')).toBe('Nagoya Castle')
    expect(sightSearchQueries('Nagoya Castle')).toEqual(['Nagoya Castle'])
  })

  it('도시명 단독 검색어는 없다', () => {
    expect(sightSearchQueries('Nagoya')).toEqual([])
    expect(sightSearchQueries('Doha')).toEqual([])
    expect(sightSearchQueries('나고야')).toEqual([])
    expect(sightSearchQueries('도하')).toEqual([])
  })

  it('지명 속 elephant는 동물 체험이 아니고, elephant-animal 사진은 탈락', () => {
    expect(itineraryMentionsAnimal('계림 코끼리코 언덕 Elephant Trunk Hill', 'elephant')).toBe(false)
    expect(
      photoSubjectBlockReason('elephant animal mammal wildlife closeup', {
        query: 'Xiangbi Shan',
        destination: '계림',
        productText: '계림 코끼리코 언덕',
      }),
    ).toBe('animal_not_in_itinerary')
  })

  it('신사이바시 점포(yoshinoya·store) 사진은 탈락', () => {
    expect(
      photoSubjectBlockReason('Hanamaruudon Yoshinoya Osaka Shinsaibashi store', {
        query: 'Shinsaibashi',
        destination: '오사카',
        productText: '신사이바시',
      }),
    ).toBe('interior_not_place')
  })

  it('츠노시마 대교 날에 기자 피라미드 후보는 탈락', () => {
    const v = evaluateAutofillCandidate({
      candidate: {
        id: 'giza-1',
        source: 'Pexels',
        url: 'https://cdn.example.com/giza.webp',
        width: 2000,
        height: 1300,
        photographer: 'A',
        originalLink: 'https://www.pexels.com/photo/pyramids-of-giza-cairo-egypt-999/',
        altText: 'Pyramids of Giza Cairo',
        title: 'Pyramids of Giza Cairo',
      },
      sight: sightProfile('Tsunoshima Bridge'),
      cityTerms: ['shimonoseki', 'japan'],
      slotText: '츠노시마 대교 - 카와라 소바 - 후쿠오카 공항 시모노세키',
      slotKind: 'day',
      productId: 'fit-nl-0024',
      usage: new PublicPhotoUsage(),
    })
    expect(v.ok).toBe(false)
  })

  it('도착일 나고야·도하는 도시명이 아니라 공식 대표명소로 계획한다', () => {
    const nagoya = planSave(
      { day: 1, title: '도착', routeText: '중부국제공항 - 호텔', hotelText: '나고야 호텔', description: '공항에 도착해 호텔로 이동합니다.', imageKeyword: 'Nagoya' },
      { destinationText: '나고야', maxDay: 3, allRows: [{ day: 1, title: '도착', routeText: '중부국제공항 - 호텔', hotelText: '나고야 호텔' }] },
    )
    expect(nagoya.action).toBe('search')
    if (nagoya.action === 'search') {
      expect(nagoya.sights.some((s) => /Nagoya Castle|Atsuta Shrine/i.test(s))).toBe(true)
      expect(nagoya.sights.every((s) => sightSearchQueries(s).length > 0)).toBe(true)
    }
    const doha = planSave(
      { day: 1, title: '도하 도착', routeText: '하마드 국제공항 - 수크 와키프 - 호텔', description: '수크 와키프를 둘러봅니다.', imageKeyword: 'Doha' },
      { destinationText: '도하', maxDay: 4 },
    )
    expect(doha.action).toBe('search')
    if (doha.action === 'search') {
      expect(doha.sights.some((s) => /Souq Waqif/i.test(s))).toBe(true)
      expect(doha.route).toBe('own')
    }
  })

  it('계림 코끼리코 언덕 날은 Xiangbi Shan으로 검색하고 비우지 않는다', () => {
    const plan = planSave(
      { day: 1, title: '계림 도착', routeText: '코끼리코 언덕 - 이강', description: '계림에 도착해 코끼리코 언덕을 봅니다.', imageKeyword: 'Li River Guilin Cruise' },
      { destinationText: '계림', maxDay: 5 },
    )
    expect(plan.action).toBe('search')
    if (plan.action === 'search') {
      const qs = plan.sights.flatMap(sightSearchQueries)
      expect(qs).toContain('Xiangbi Shan')
      expect(qs.some((q) => /elephant/i.test(q))).toBe(false)
    }
  })
})

describe('photo-wrong-slot-reinspect-1128: 근거 약한 칸은 공개 교체하지 않음·통과 유지', () => {
  it('자동 채움 근거(sight+sightMatch)와 짧은 슬러그만 있으면 통과(기존)', () => {
    const r = gateInput(
      [
        {
          day: 1,
          title: '이스탄불 · 블루모스크',
          routeText: '이스탄불 - 블루모스크 - 그랜드바자르',
          imageUrl: 'https://cdn.example.com/photo-pool/ok.webp',
          imageSource: {
            source: 'Pexels',
            photographer: 'A',
            originalLink: 'https://www.pexels.com/photo/x-444/',
            externalId: '444',
            sight: 'Blue Mosque',
            sightMatch: 'blue mosque',
          },
        },
      ],
      ['이스탄불', 'istanbul'],
    )
    expect(r.blocks.some((b) => b.reason === 'photo_sight_mismatch')).toBe(false)
  })
})
