import { describe, expect, it } from 'vitest'
import { photoMatchGate, type MatchGateContext } from '@/lib/register-photo-match-gate'

const base = { width: 4000, height: 2667, photographer: 'A', originalLink: 'https://www.pexels.com/photo/x-1/', externalId: '1' }
const danangDay: MatchGateContext = {
  placeTerms: ['Ba Na Hills Golden Bridge', '다낭', 'Da Nang'],
  destinationTerms: ['다낭', 'Da Nang'],
  slotText: '바나힐 골든브릿지 다낭',
  slot: 'day',
}
const barcelonaDay: MatchGateContext = {
  placeTerms: ['Sagrada Familia', '바르셀로나', 'Barcelona'],
  destinationTerms: ['스페인', 'Spain'],
  slotText: '바르셀로나 사그라다 파밀리아 구엘공원',
  slot: 'day',
}
const g = (alt: string, ctx: MatchGateContext, extra: Record<string, unknown> = {}) =>
  photoMatchGate({ ...base, altText: alt, ...extra }, ctx).reason

describe('photoMatchGate — 문과장 batch-01 탈락 유형', () => {
  it('금문교를 다낭에 쓰지 않는다', () => {
    expect(g('Golden Gate Bridge at sunset', danangDay)).toBe('other_place_landmark')
  })
  it('바나힐 골든브릿지는 통과', () => {
    expect(g('Golden Bridge held by giant hands at Ba Na Hills, Da Nang', danangDay)).toBeNull()
    expect(g('Golden Bridge at Ba Na Hills Da Nang in fog', danangDay)).toBeNull()
  })
  it('로마·마드리드 명소를 바르셀로나 일차에 쓰지 않는다', () => {
    expect(g('Colosseum in Rome at dusk', barcelonaDay)).toBe('other_place_landmark')
    expect(g('Cibeles fountain Madrid', barcelonaDay)).toBe('other_place_landmark')
    expect(g('Sagrada Familia basilica Barcelona', barcelonaDay)).toBeNull()
  })
  it('사람·의료·차량·사물·침실·홍보 탈락', () => {
    expect(g('Man in black jacket in Da Nang', danangDay)).toBe('person')
    expect(g('Surgeon in operating room', danangDay)).toBe('medical')
    expect(g('Red sports car at night Da Nang', danangDay)).toBe('vehicle')
    expect(g('Luxury wristwatch close up', danangDay)).toBe('unrelated_object')
    expect(g('Couple lying on bed in hotel room Da Nang', danangDay)).toBe('person')
    expect(g('Bed in hotel bedroom Da Nang', danangDay)).toBe('interior_not_place')
    expect(g('Bongsim eSIM promo Da Nang', danangDay)).toBe('promo')
  })
  it('케이블카는 차량으로 보지 않는다', () => {
    expect(g('Ba Na Hills cable car above forest Da Nang', { ...danangDay, slotText: '바나힐 케이블카 골든브릿지 다낭' })).toBeNull()
  })
  it('케이블카도 그날 일정에 없으면 차량, 승합차·버스는 탈락', () => {
    expect(g('Ba Na Hills cable car above forest Da Nang', danangDay)).toBe('vehicle')
    expect(g('White van parked near Golden Bridge Ba Na Hills Da Nang', danangDay)).toBe('vehicle')
    expect(g('Tour bus on a road in Da Nang', danangDay)).toBe('vehicle')
  })
  it('장소명 없는 설명·설명 없음·출처 없음·저해상도 탈락', () => {
    expect(g('Beautiful mountain landscape', danangDay)).toBe('no_place_match')
    expect(photoMatchGate({ ...base, originalLink: '', pageUrl: '' }, danangDay).reason).toBe('no_description')
    expect(g('Da Nang beach', danangDay, { externalId: '' })).toBe('missing_attribution')
    expect(g('Da Nang beach', danangDay, { width: 800 })).toBe('low_res')
  })
  it('대표 슬롯은 세로 사진 탈락', () => {
    expect(g('Da Nang beach', { ...danangDay, slot: 'main' }, { width: 2000, height: 3000 })).toBe('portrait_orientation')
  })
  it('AI 는 표시가 있을 때만', () => {
    expect(photoMatchGate({ isGenerated: true, aiLabel: null }, danangDay).reason).toBe('ai_unlabeled')
    expect(photoMatchGate({ isGenerated: true, aiLabel: { isGenerated: true, prompt: 'x' } }, danangDay).ok).toBe(true)
  })
  it('다른 도시명(이 일차 글에 없음) 탈락', () => {
    expect(g('Wat Arun temple Bangkok', { placeTerms: ['Pattaya'], destinationTerms: ['파타야', 'Pattaya'], slotText: '파타야 산호섬', slot: 'day' })).toBe(
      'other_place_landmark'
    )
    expect(g('Venice canal and Hanoi', { placeTerms: ['Paris'], destinationTerms: ['프랑스'], slotText: '파리 에펠탑', slot: 'day' })).toBe('city_mismatch')
  })
})

describe('photoMatchGate — 약한 일치', () => {
  const pq: MatchGateContext = { placeTerms: ['Grand World'], destinationTerms: ['푸꾸옥', 'Phu Quoc'], slotText: '푸꾸옥 그랜드월드', slot: 'day' }
  it('여러 단어 장소명의 한 단어만 맞으면 탈락', () => {
    expect(g('World map on a wall', pq)).toBe('no_place_match')
    expect(g('Grand World Phu Quoc canal at night', pq)).toBeNull()
    expect(g('Sunset over Phu Quoc island', pq)).toBeNull()
  })
  it('말라카 성 바울 성당을 마카오 대표에 쓰지 않는다', () => {
    const mo: MatchGateContext = { placeTerms: ["Ruins of St. Paul's"], destinationTerms: ['마카오', 'Macau'], slotText: '마카오 성바울성당 유적', slot: 'main' }
    expect(g("View of ancient St. Paul's Church ruins in Malacca, Malaysia", mo)).toBe('city_mismatch')
    expect(g("Ruins of St. Paul's in Macau at twilight", mo)).toBeNull()
  })
  it('한글 목적지를 영문으로 넓혀 본다', () => {
    const gl: MatchGateContext = { placeTerms: ['Li River Guilin Cruise'], destinationTerms: ['구이린', '구이린'], slotText: '첩채산 상비산', slot: 'day' }
    expect(g('Li River with karst mountains in Guilin, China', gl)).toBeNull()
    // 그날 요약이 있으면 요약에 없는 목적지(구이린)로는 인정하지 않는다
    expect(g('Li River with karst mountains in Guilin, China', { ...gl, daySummary: '첩채산 · 자연과 역사가 조화로운 첩채산과 상비산을 둘러봅니다.' })).toBe('no_place_match')
    expect(g('Li River with karst mountains in Guilin, China', { ...gl, daySummary: '계림 · 이강유람' })).toBeNull()
  })
})

describe('photoMatchGate — 그날 일정 요약에 있는 장소만 (문과장 10/31 mt-0314 D3)', () => {
  const otaru: MatchGateContext = {
    placeTerms: ['Otaru Music Box Museum', '오타루 - 삿포 - 오타루운하(추계) - 오타루 오르골당'],
    destinationTerms: ['삿포로', 'Sapporo'],
    slotText: '오타루 · 시로이 코이비토 파크 오타루 - 삿포 - 오타루운하(추계) - 오타루 오르골당 - 과자거리와 유리공방(추계) 삿포로',
    slot: 'day',
    daySummary: '오타루 · 시로이 코이비토 파크 (외부정원 관광) 오타루와 오타루운하를 둘러봅니다. 오타루 오르골당과 과자거리와 유리공방을 이어서 방문합니다.',
  }
  it('삿포로 양조장(그날 일정에 없음)은 탈락', () => {
    expect(g('A rainy day at the historic entrance of a Sapporo brewery in Hokkaido, Japan, capturing the classic architecture and street scene.', otaru)).not.toBeNull()
    expect(g('Historic Sapporo brewery building in Hokkaido', otaru)).toBe('no_place_match')
  })
  it('오타루 운하·오르골당은 통과', () => {
    expect(g('Otaru canal with old stone warehouses in Hokkaido', otaru)).toBeNull()
    expect(g('Otaru Music Box Museum steam clock exterior', otaru)).toBe('unrelated_object')
    expect(g('Otaru Music Box Museum building exterior at dusk', otaru)).toBeNull()
  })
  it('승용차가 크게 보이면 탈락', () => {
    expect(g('Red car parked by Otaru canal', otaru)).toBe('vehicle')
  })
})

describe('photoMatchGate — 사람이 주인공인 사진만 탈락 (사장님 10/31 16:29)', () => {
  const mo: MatchGateContext = { placeTerms: ["Ruins of St. Paul's"], destinationTerms: ['마카오', 'Macau'], slotText: '마카오 성바울성당 유적', slot: 'main' }
  it('풍경 속 작은 사람·간판은 통과', () => {
    expect(g("People walk past the historic Ruins of St. Paul's in Macau during twilight", mo)).toBeNull()
    expect(g("Ruins of St. Paul's in Macau with tourists on the steps", mo)).toBeNull()
    expect(g('Neon signs on a street in Macau at night', mo)).toBeNull()
    expect(g("Ruins of St. Paul's Macau with a man walking in front", mo)).toBeNull()
  })
  it('사람이 주인공이면 탈락', () => {
    expect(g('A woman checks her fortune sticks in Macau', mo)).toBe('person')
    expect(g('Portrait of a girl in front of Ruins of St. Paul Macau', mo)).toBe('person')
    expect(g('Tourist wearing a red dress posing in Macau', mo)).toBe('person')
    expect(g('Young couple taking a selfie in Macau', mo)).toBe('person')
    expect(g('Close up of a woman face Macau', mo)).toBe('person')
  })
})
