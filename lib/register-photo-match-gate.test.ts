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
    expect(g('Ba Na Hills cable car above forest Da Nang', danangDay)).toBeNull()
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
  })
})
