import { describe, expect, it } from 'vitest'
import { deriveDaySights, isCityOnlySight, sightMatchInText, sightProfile, sightSearchQueries } from '@/lib/photo-autofill-sight'

const day = (routeText: string, title = '', description: string | null = null, imageKeyword: string | null = null) => ({
  title,
  routeText,
  description,
  imageKeyword,
  imageKeyword2: null,
})

describe('photo-autofill-sight: 그날 방문지 추출', () => {
  it('일정 동선의 방문지를 영문 명소명으로 뽑는다(도시명이 아니라 명소)', () => {
    const r = deriveDaySights(day('이스탄불 - 블루모스크 - 아야소피아 - 그랜드바자르'), '이스탄불 터키')
    expect(r.reason).toBe('ok')
    expect(r.sights.join(' ').toLowerCase()).toContain('blue mosque')
    expect(r.sights.every((s) => !isCityOnlySight(s))).toBe(true)
  })

  it('공항 이동·도시만 있는 날은 명소 없음 → 비워 둔다', () => {
    expect(deriveDaySights(day('인천 출발 - 방콕 도착'), '방콕 태국').sights).toEqual([])
    expect(deriveDaySights(day('방콕 시내', '방콕'), '방콕 태국').sights).toEqual([])
  })

  it('다른 도시를 가리키는 낡은 키워드(예: 부다페스트 일정의 New York)는 쓰지 않는다', () => {
    const r = deriveDaySights(day('부다페스트 - 어부의 요새 - 세체니 다리', '부다페스트', null, 'New York'), '부다페스트 헝가리')
    expect(r.sights.join(' ').toLowerCase()).not.toContain('new york')
    expect(r.rejectedKeywords.some((k) => k.keyword.toLowerCase().includes('new york'))).toBe(true)
  })

  it('검색어는 명소 → 명소+도시 순으로 최대 2개', () => {
    expect(sightSearchQueries('Blue Mosque', ['istanbul'])).toEqual(['Blue Mosque', 'Blue Mosque istanbul'])
  })
})

describe('photo-autofill-sight: 이름 일치(별칭 포함)', () => {
  it('별칭으로도 일치한다', () => {
    const p = sightProfile('Blue Mosque')
    expect(sightMatchInText(p, 'Sultan Ahmed Mosque Istanbul at dusk', ['istanbul'])).toBeTruthy()
  })

  it('도시 이름만 있는 글은 일치가 아니다', () => {
    const p = sightProfile('Blue Mosque')
    expect(sightMatchInText(p, 'Istanbul skyline at dusk', ['istanbul'])).toBeNull()
  })

  it('도시만 있는 이름은 명소로 쓰지 않는다', () => {
    expect(isCityOnlySight('Istanbul')).toBe(true)
    expect(sightMatchInText(sightProfile('Istanbul'), 'Istanbul at night', ['istanbul'])).toBeNull()
  })

  it('일반 명사뿐인 명소는 도시 낱말이 같이 있어야 일치', () => {
    const p = sightProfile('Central Market')
    expect(p.kind).toBe('generic')
    expect(sightMatchInText(p, 'Central market hall in Budapest', ['budapest'])).toBeTruthy()
    expect(sightMatchInText(p, 'Central market hall in the old quarter', ['budapest'])).toBeNull()
  })
})
