import { describe, expect, it } from 'vitest'
import { coverSearchSights, deriveDaySights, isCityOnlySight, sightMatchInText, sightProfile, sightSearchQueries } from '@/lib/photo-autofill-sight'

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

  it('일정 정규식에 없는 일차 명소 키워드도 그 날 사진 검색에 쓴다', () => {
    const r = deriveDaySights(
      day('장가계 국립공원', '장가계', '금편계를 걷습니다', 'Golden Whip Stream'),
      '장가계',
    )
    expect(r.sights.join(' ').toLowerCase()).toContain('golden whip')
    expect(r.rejectedKeywords.some((k) => k.why === 'not_in_route')).toBe(false)
  })

  it('다른 도시를 가리키는 낡은 키워드(예: 부다페스트 일정의 New York)는 쓰지 않는다', () => {
    const r = deriveDaySights(day('부다페스트 - 어부의 요새 - 세체니 다리', '부다페스트', null, 'New York'), '부다페스트 헝가리')
    expect(r.sights.join(' ').toLowerCase()).not.toContain('new york')
    expect(r.rejectedKeywords.some((k) => k.keyword.toLowerCase().includes('new york'))).toBe(true)
  })

  it('검색어는 명소 → 명소+도시 순으로 최대 2개', () => {
    // 사장님 08:55: 검색어는 관광지명만(도시 자동 덧붙임 금지), 도시만은 검색어 아님
    expect(sightSearchQueries('Blue Mosque')).toEqual(['Blue Mosque'])
    expect(sightSearchQueries('Istanbul')).toEqual([])
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

  it('명소 이름 안의 도시는 상품 대표 도시와 달라도 앵커가 된다', () => {
    const otaru = sightProfile('Otaru Music Box Museum')
    expect(sightMatchInText(otaru, 'Otaru music box museum wooden dolls', ['hakodate'])).toBeTruthy()
    expect(sightMatchInText(otaru, 'Hakodate night view bay', ['hakodate'])).toBeNull()
    const whip = sightProfile('Golden Whip Stream')
    expect(sightMatchInText(whip, 'Golden Whip stream in the canyon', ['zhangjiajie'])).toBeTruthy()
    const park = sightProfile('Arakurayama Sengen Park Kawaguchiko')
    expect(sightMatchInText(park, 'Chureito Pagoda and cherry blossoms', ['shizuoka'])).toBeTruthy()
  })

  it('대표 검색어가 도시뿐이면 일차 명소를 쓴다', () => {
    expect(coverSearchSights(['홍콩', 'Hong Kong'], ['Ruins of St Paul', 'Hong Kong'])).toEqual(['Ruins of St Paul'])
    expect(coverSearchSights(['Ruins of St Paul'], ['National Palace Museum'])[0]).toBe('National Palace Museum')
    expect(coverSearchSights([''], ['National Palace Museum'])).toEqual(['National Palace Museum'])
  })
})
