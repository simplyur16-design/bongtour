import { describe, expect, it } from 'vitest'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { isRegisterScheduleNoPlacePhotoDay } from '@/lib/register-schedule-day-summary-finalize'
import { deriveDaySights } from '@/lib/photo-autofill-sight'
import { planDayPhotoSave } from '@/lib/photo-day-save-gate-1128'
import { travelDayRepresentativeSights, registerTravelDayPhotoEligible } from '@/lib/register-day-photo-travel-day'
import { applyDayPhotoClear } from '@/lib/photo-slot-apply'
import {
  buildPublicPhotoUsage,
  evaluateAutofillCandidate,
  photoIdentityKeys,
  type AutofillCandidate,
  type PublicPhotoUsage,
} from '@/lib/photo-autofill-gate'
import { sightProfile } from '@/lib/photo-autofill-sight'

// REGRESSION-FREEZE[photo-wrong-path-1128]: 틀린 사진 경로 차단 단위 검사 — manifest

function plan(row: Parameters<typeof planDayPhotoSave>[0], maxDay = 8, dest = '') {
  return planDayPhotoSave(row, { destinationText: dest, maxDay, allRows: [row] })
}

describe('photo-wrong-path-1128: 영문 명소·사하라 사전', () => {
  it('영문 경로 구간을 장소 없는 날로 버리지 않는다(Petřín)', () => {
    expect(
      isRegisterScheduleNoPlacePhotoDay(
        {
          day: 3,
          title: '블타바 강변의 낭만과 자유로운 탐색',
          routeText: 'Petřín Lookout Tower - Café Louvre - Manufaktura',
          hotelText: 'Hotel',
        },
        8,
      ),
    ).toBe(false)
    const d = deriveDaySights({
      title: '블타바 강변의 낭만과 자유로운 탐색',
      routeText: 'Petřín Lookout Tower - Café Louvre - Manufaktura',
      description: null,
    })
    expect(d.route).toBe('own')
    expect(d.sights.join(' ').toLowerCase()).toMatch(/petr/i)
  })

  it('사하라 사막을 1순위 명소로 읽는다', () => {
    expect(firstMatchingScheduleSpotEn('사하라 사막 아라비안 나잇')).toBe('Sahara Desert')
    const d = deriveDaySights({
      title: '토쥬르 · 사하라 사막 아라비안 나잇 프로그램',
      routeText: '토쥬르 - 옹그즈멜 - 두즈 - 사하라 사막 아라비안 나잇 프로그램',
      description: '두즈와 사하라 사막 아라비안 나잇 프로그램을 이어서 방문합니다.',
      imageKeyword: 'day_5',
    })
    expect(d.sights).toContain('Sahara Desert')
    expect(plan({ day: 5, title: '토쥬르 · 사하라 사막 아라비안 나잇 프로그램', routeText: '토쥬르 - 옹그즈멜 - 두즈 - 사하라 사막 아라비안 나잇 프로그램', imageKeyword: 'day_5' }, 5).action).toBe('search')
  })
})

describe('photo-wrong-path-1128: 2순위·출국·귀국은 도시 대표명소', () => {
  it('자유일정(명소 없음)은 city_rep 검색을 막지 않는다', () => {
    const p = plan({
      day: 2,
      title: '하노이 자유일정',
      routeText: '하노이',
      description: '전일 자유일정. 추천 관광지.',
      imageKeyword: '',
    }, 4, '하노이')
    expect(p.action).toBe('search')
    if (p.action === 'search') expect(p.route).toBe('city_rep')
    expect(p.action === 'search' && p.sights.length > 0).toBe(true)
  })

  it('귀국·숙박 없음 칸은 마지막 체류지 대표명소로 검색(도시명 단독 검색 아님)', () => {
    const p = plan({
      day: 5,
      title: '숙박 없음(귀국)',
      routeText: '숙박 없음(귀국)',
      hotelText: '숙박 없음(귀국)',
      imageKeyword: 'Phu Quoc',
    }, 5, '푸꾸옥')
    expect(p.action).toBe('search')
    if (p.action === 'search') {
      expect(p.route).toBe('city_rep')
      expect(p.sights.length).toBeGreaterThan(0)
      expect(p.sights.join(' ')).not.toMatch(/^(Phu Quoc|Guam)$/i)
      expect(p.sights.join(' ')).not.toMatch(/airport|plane|공항|기내/i)
    }
    const guam = travelDayRepresentativeSights({ day: 5, title: '숙박 없음(귀국)', routeText: '숙박 없음(귀국)', hotelText: '숙박 없음(귀국)', imageKeyword: 'Guam' }, [], '괌', 5)
    expect(guam?.kind).toBe('return')
    expect(guam!.sights.length).toBeGreaterThan(0)
    expect(registerTravelDayPhotoEligible({ day: 5, title: '숙박 없음(귀국)', imageKeyword: 'Guam' }, 5)).toBe(true)
  })

  it('도착일 인천-다낭-호텔은 도착 도시 대표명소(다른 일차 키워드 무시)', () => {
    const p = plan({
      day: 1,
      title: '인천에서 다낭으로',
      routeText: '인천 - 다낭 - 호텔',
      description: '인천에서 출발하여 다낭 공항에 도착해 호텔 체크인.',
      imageKeyword: 'Son Tra Night Market',
    }, 5, '다낭')
    expect(p.action).toBe('search')
    if (p.action === 'search') {
      expect(p.route).toBe('city_rep')
      expect(p.sights.join(' ')).toMatch(/Dragon Bridge|Marble Mountains|Ba Na|My Khe|Han River/i)
      expect(p.sights.join(' ')).not.toMatch(/Son Tra/i)
    }
  })
})

describe('photo-wrong-path-1128: 틀림 6칸 계획', () => {
  it('fit-mt-0029 d4는 히낙다난 동굴 1순위', () => {
    const p = plan({
      day: 4,
      title: '히낙다난 동굴과 보홀 비 팜',
      routeText: '히낙다난 동굴 - 보홀 비 팜',
      imageKeyword: 'Bohol Loboc River Cruise',
    }, 5, '보홀')
    expect(p.action).toBe('search')
    if (p.action === 'search') {
      expect(p.route).toBe('own')
      expect(p.sights[0]).toBe('Hinagdanan Cave')
    }
  })

  it('fit-vg-0006·귀국 3상품 d5는 푸꾸옥 대표명소 검색', () => {
    for (const title of ['푸꾸옥 공항 - 인천', '숙박 없음(귀국)']) {
      const p = plan({ day: 5, title, routeText: title, hotelText: '숙박 없음(귀국)', imageKeyword: 'Phu Quoc' }, 5, '푸꾸옥')
      expect(p.action, title).toBe('search')
      if (p.action === 'search') {
        expect(p.route).toBe('city_rep')
        expect(p.sights.join(' ')).toMatch(/Grand World|Sao Beach|Duong Dong|Hon Thom|Dinh Cau|Vinpearl|Pepper/i)
      }
    }
  })

  it('fit-nl-0018 d1은 라우 파 삿 1순위(도시 키워드 무시)', () => {
    const p = plan({
      day: 1,
      title: '창이 도착과 시내',
      routeText: '창이 공항 - 시내 호텔 - 라우 파 삿',
      description: '창이 공항에 도착한 뒤 호텔 체크인, 라우 파 삿에서 저녁.',
      imageKeyword: 'Singapore',
    }, 4, '싱가포르')
    expect(p.action).toBe('search')
    if (p.action === 'search') {
      expect(p.route).toBe('own')
      expect(p.sights[0]).toBe('Lau Pa Sat')
    }
  })

  it('fit-hn-0052 d7 피렌체→베네치아 이동은 베네치아 대표명소(피렌체 두오모 키워드 무시)', () => {
    const p = plan({
      day: 7,
      title: '피렌체에서 베네치아로 이동해 물의 도시를 관광해요',
      routeText: '피렌체 - 베네치아',
      imageKeyword: 'Florence Duomo Historic Center',
    }, 8, '이탈리아')
    expect(p.action).toBe('search')
    if (p.action === 'search') {
      expect(p.route).toBe('city_rep')
      expect(p.sights.join(' ')).toMatch(/Venice|Rialto|Grand Canal|St Mark|Doge/i)
      expect(p.sights.join(' ')).not.toMatch(/Florence|Duomo|Uffizi/i)
    }
  })

  it('fit-hn-0056 d1은 다낭 대표명소, pkg-hn-0155 d5는 괌 대표명소', () => {
    const a = plan({ day: 1, title: '인천 - 다낭', routeText: '인천 - 다낭 - 호텔', imageKeyword: 'Son Tra Night Market' }, 5, '다낭')
    expect(a.action).toBe('search')
    if (a.action === 'search') expect(a.sights.join(' ')).toMatch(/Dragon Bridge|Marble Mountains|Ba Na|My Khe/i)
    const b = plan({ day: 5, title: '숙박 없음(귀국)', routeText: '숙박 없음(귀국)', hotelText: '숙박 없음(귀국)', imageKeyword: 'Guam' }, 5, '괌')
    expect(b.action).toBe('search')
    if (b.action === 'search') expect(b.sights.join(' ')).toMatch(/Tumon|Lovers Point|Micronesia Mall|Plaza de Espana|Fort Soledad|Fish Eye/i)
  })
})

describe('photo-wrong-path-1128: 목록 카드만 중복 금지·라벨 불일치 거부', () => {
  const cand = (id = '1001'): AutofillCandidate => ({
    id,
    url: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg`,
    width: 2000,
    height: 1200,
    source: 'Pexels',
    photographer: 'A',
    originalLink: `https://www.pexels.com/photo/blue-mosque-${id}/`,
    altText: 'Blue Mosque Istanbul',
    title: 'Blue Mosque Istanbul',
    description: 'Blue Mosque in Istanbul at dusk',
    tags: ['istanbul', 'mosque'],
  })

  it('일차·대표 모두 다른 상품이 쓰는 같은 파일이어도 public_duplicate 가 아니다', () => {
    const usage = buildPublicPhotoUsage([
      {
        productId: 'p-public',
        bgImageUrl: 'https://images.pexels.com/photos/2002/pexels-photo-2002.jpeg',
        bgImageExternalId: '2002',
        bgImageSourceUrl: 'https://www.pexels.com/photo/blue-mosque-2002/',
        schedule: JSON.stringify([
          { day: 1, imageUrl: 'https://images.pexels.com/photos/1001/pexels-photo-1001.jpeg', imageSource: { source: 'Pexels', externalId: '1001', originalLink: 'https://www.pexels.com/photo/blue-mosque-1001/' } },
        ]),
      },
    ])
    const day = evaluateAutofillCandidate({
      candidate: cand('1001'),
      sight: sightProfile('Blue Mosque'),
      cityTerms: ['Istanbul'],
      slotText: '이스탄불 블루 모스크',
      slotKind: 'day',
      productId: 'p-new',
      usage,
    })
    expect(day.reasons).not.toContain('public_duplicate')
    const cover = evaluateAutofillCandidate({
      candidate: { ...cand('2002'), id: '2002', url: 'https://images.pexels.com/photos/2002/pexels-photo-2002.jpeg', originalLink: 'https://www.pexels.com/photo/blue-mosque-2002/' },
      sight: sightProfile('Blue Mosque'),
      cityTerms: ['Istanbul'],
      slotText: '이스탄불 블루 모스크',
      slotKind: 'cover',
      productId: 'p-new',
      usage,
    })
    expect(cover.reasons).not.toContain('public_duplicate')
    expect(cover.ok).toBe(true)
    expect(day.ok).toBe(true)
  })

  it('출처 메타에 명소 표지어가 없고 우리 파일명에만 있으면 거부(산능선≠야시장)', () => {
    const usage = buildPublicPhotoUsage([])
    const r = evaluateAutofillCandidate({
      candidate: {
        id: 'pb-bad',
        source: 'Pixabay',
        url: 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/Phu_Quoc_Duong_Dong_Night_Market_Pixabay__x.webp',
        width: 2000,
        height: 1200,
        photographer: 'A',
        originalLink: 'https://pixabay.com/photos/sea-of-clouds-mountain-ridge-999/',
        altText: 'sea of clouds mountain ridge',
        title: 'sea of clouds mountain ridge',
        description: 'Pixabay Content License',
        tags: ['mountain', 'clouds', 'landscape', 'sunset'],
      },
      sight: sightProfile('Duong Dong Night Market'),
      cityTerms: ['Phu Quoc'],
      slotText: '푸꾸옥 귀국',
      slotKind: 'day',
      productId: 'p-new',
      usage,
    })
    expect(r.ok).toBe(false)
    expect(r.reasons.some((x) => x === 'no_sight_match' || x === 'city_only_match')).toBe(true)
  })

  it('출처 태그·제목에 명소 표지어가 있으면 통과 후보가 된다', () => {
    const r = evaluateAutofillCandidate({
      candidate: cand('1001'),
      sight: sightProfile('Blue Mosque'),
      cityTerms: ['Istanbul'],
      slotText: '이스탄불 블루 모스크',
      slotKind: 'day',
      productId: 'p-new',
      usage: buildPublicPhotoUsage([]),
    })
    expect(r.reasons).not.toContain('no_sight_match')
  })

  it('applyDayPhotoClear는 행을 지우지 않고 imageUrl만 비운다', () => {
    const json = JSON.stringify([
      { day: 5, title: '숙박 없음(귀국)', routeText: '숙박 없음(귀국)', imageUrl: 'https://cdn.example.com/x.webp', imageKeyword: 'Guam' },
    ])
    const applied = applyDayPhotoClear(json, 5)
    expect('error' in applied).toBe(false)
    if ('error' in applied) return
    expect(applied.previous.imageUrl).toContain('cdn.example.com')
    const rows = JSON.parse(applied.schedule) as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    expect(rows[0]!.imageUrl).toBe('')
    expect(rows[0]!.title).toBe('숙박 없음(귀국)')
  })
})
