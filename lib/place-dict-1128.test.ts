/**
 * REGRESSION-FREEZE[place-dict-1128]: 사장님 08:40 '테스트해서 되면 적용' — 10칸 dry-run·08:30 로그에서 본 오매핑 고정.
 * 도시만은 명소 아님, 빠진 명소 사전, 그날 원문 도시로 검색, 그날 원문에 없는 키워드 제외, 문맥 없는 사전 오매핑 차단.
 */
import { describe, expect, it } from 'vitest'
import { CITY_REPRESENTATIVE_SIGHTS, OFFICIAL_NAMES_WITH_CITY_WORD, deriveDaySights, foldPhotoText, isCityToken, landmarkHomeInProduct, sightMatchInText, sightProfile, sightSearchQueries } from '@/lib/photo-autofill-sight'
import { englishFromScheduleKoreanSegmentWithRegex, findAllScheduleSpotMatchesInText } from '@/lib/schedule-poi-regex-ssot'
import { acquireVerifiedPhoto, type AcquireDeps } from '@/lib/photo-autofill-acquire'
import { PublicPhotoUsage } from '@/lib/photo-autofill-gate'

describe('place-dict-1128 city names are not sights', () => {
  it.each(['Xian', 'Lima', 'Delhi', 'Christchurch', 'Kaohsiung', 'Weihai', 'Sao Paulo Brazil', 'Washington Dc', 'Addis Ababa Ethiopia', 'Salzburg', 'Porto'])('%s is not a sight', (n) => {
    expect(['city', 'empty']).toContain(sightProfile(n).kind)
  })
  it('real landmarks with a city word stay sights', () => {
    expect(sightProfile('Hohensalzburg Fortress Salzburg').kind).toBe('sight')
    expect(sightProfile('Giant Wild Goose Pagoda').kind).toBe('sight')
  })
})

describe('place-dict-1128 day sights', () => {
  it('xian day with 대안탑 searches Giant Wild Goose Pagoda, not the city keyword', () => {
    const r = deriveDaySights({ title: '서안 · 대안탑(북광장)', routeText: '서안 - 대안탑(북광장)', imageKeyword: 'Xian' }, '서안')
    expect(r.sights[0]).toBe('Giant Wild Goose Pagoda')
    expect(r.sights).not.toContain('Xian')
  })
  it('keyword not in that day text is dropped (Hohensalzburg on a Mirabell/Getreidegasse day)', () => {
    const r = deriveDaySights(
      { title: '잘츠부르크 이동 · 게트라이데 거리', routeText: '잘츠부르크 이동 - 정원과 미라벨 궁전 - 대성당 - 모짜르트의 생가 - 게트라이데 거리', imageKeyword: 'Hohensalzburg Fortress Salzburg' },
      '헝가리',
    )
    expect(r.sights).not.toContain('Hohensalzburg Fortress Salzburg')
    expect(r.rejectedKeywords.map((k) => k.keyword)).toContain('Hohensalzburg Fortress Salzburg')
    expect(r.sights.length).toBeGreaterThan(0)
  })
  it('항주 문맥 서호는 dictionary name West Lake Hangzhou, first in text order', () => {
    const r = deriveDaySights({ title: '서호산책 / 항주임시정부청사 · 항주', routeText: '서호산책 / 항주임시정부청사 - 항주', imageKeyword: 'West Lake' }, '청도 Qingdao')
    expect(r.route).toBe('own')
    expect(sightSearchQueries(r.sights[0]!)[0]).toBe('West Lake')
  })
})

describe('place-dict-1128 dictionary mis-maps', () => {
  const ens = (t: string) => findAllScheduleSpotMatchesInText(t).map((h) => h.en)
  it("'~을 위해' is not Weihai", () => {
    expect(englishFromScheduleKoreanSegmentWithRegex('관람을 위해 벨베데레 궁')).not.toBe('Weihai')
  })
  it('기라델리 is not Delhi', () => {
    expect(englishFromScheduleKoreanSegmentWithRegex('기라델리 스퀘어')).not.toBe('Delhi')
  })
  it('Osaka aquarium whale shark is not Cebu Oslob; Cebu context still is', () => {
    expect(ens('덴포잔 대관람차 - 카이유칸 고래상어')).not.toContain('Cebu Oslob Whale Shark')
    expect(ens('세부 오슬롭 고래상어 투어')).toContain('Cebu Oslob Whale Shark')
  })
  it('Mud Bath is not Bath England; Port Stephens 크루즈 is not Dubai; Barcelona 올림픽경기장 is not Beijing', () => {
    expect(ens('I-Resort Mud Bath - 나트랑 비치')).not.toContain('Bath Roman Baths England')
    expect(ens('포트스테판 도우 크루즈')).not.toContain('Dubai Creek Dhow Cruise')
    expect(ens('몬주익 올림픽경기장 - 바르셀로나')).not.toContain('Beijing National Stadium')
    expect(ens('북경 올림픽경기장 새둥지')).toContain('Beijing National Stadium')
  })
  it('California 레드우드 is not Rotorua Whakarewarewa', () => {
    expect(ens('샌프란시스코 - 레드우드 국립공원')).not.toContain('Redwoods Whakarewarewa Forest')
    expect(ens('로토루아 레드우드 수목원')).toContain('Redwoods Whakarewarewa Forest')
  })
  it('landmark home city must appear somewhere in the product', () => {
    expect(landmarkHomeInProduct('Eiffel Tower', '마카오 파리지앵 에펠탑')).toBe(false)
    expect(landmarkHomeInProduct('Eiffel Tower', '파리 에펠탑')).toBe(true)
    expect(landmarkHomeInProduct('Oslo Opera House', '오슬로 오페라하우스')).toBe(true)
    expect(landmarkHomeInProduct('Redwoods Whakarewarewa Forest', '샌프란시스코 레드우드')).toBe(false)
  })
})

describe('place-dict-1128 queries are sight names only (사장님 08:55)', () => {
  it('West Lake day in a 청도 product searches the dictionary name only, never a city appended', async () => {
    const queries: string[] = []
    const deps: AcquireDeps = {
      search: async (_t, q) => {
        queries.push(q)
        return []
      },
      stockStopped: (t) => t === 'pexels',
      commit: async () => ({ ok: false, reason: 'x' }),
      pause: async () => {},
      searchCc0: async (q) => {
        queries.push(q)
        return []
      },
    }
    await acquireVerifiedPhoto(
      {
        productId: 'p',
        kind: 'day',
        day: 4,
        dayFacts: { title: '서호산책 / 항주임시정부청사 · 항주', routeText: '서호산책 / 항주임시정부청사 - 항주', imageKeyword: 'West Lake' },
        cityTerms: ['qingdao'],
        destinationText: '청도 qingdao',
        usage: new PublicPhotoUsage(),
        origin: 'autofill',
      },
      deps,
    )
    expect(queries[0]).toBe('West Lake')
    expect(queries.some((q) => /qingdao|hangzhou/i.test(q))).toBe(false)
  })
  it('Giant Wild Goose Pagoda query is the name only', () => {
    expect(sightSearchQueries('Giant Wild Goose Pagoda')[0]).toBe('Giant Wild Goose Pagoda')
  })
  // 사장님 08:56·08:57: 검색어에 도시명은 어떤 형태로도 넣지 않는다
  it.each([
    'West Lake Hangzhou', 'Mirabell Gardens Salzburg', 'Getreidegasse Salzburg', 'Karnak Temple Luxor Columns', 'Dragon Bridge Da Nang',
    'Hohensalzburg Fortress Salzburg', 'Polynesian Spa Rotorua', 'Xian Road Food Street Dalian', 'Charles Bridge Prague', 'Blue Mosque Istanbul',
  ])('query for %s carries no city word', (s) => {
    const qs = sightSearchQueries(s)
    expect(qs.length).toBeGreaterThan(0)
    for (const q of qs) for (const w of q.split(' ')) expect(isCityToken(foldPhotoText(w)), `${q}`).toBe(false)
  })
  it.each(['Xian', 'Hangzhou', 'Salzburg', 'Prague'])('%s → no query (city alone / city + generic noun not an official name)', (s) => {
    expect(sightSearchQueries(s)).toEqual([])
  })
  // 봉실장 09:16: 공식 고유명 안의 도시 낱말은 허용(허용 목록만), 덧붙임은 금지
  it('official names keep their city word: Prague Castle, Victoria Peak, Sydney Opera House', () => {
    expect(sightSearchQueries('Prague Castle')).toEqual(['Prague Castle'])
    expect(sightSearchQueries('Victoria Peak Hong Kong')[0]).toBe('Victoria Peak') // victoria 는 도시 낱말 아님 → 그대로, 덧붙인 Hong Kong 만 뺀다
    expect(sightSearchQueries('Sydney Opera House')).toEqual(['Sydney Opera House'])
  })
  it('appended city is still stripped: West Lake Hangzhou → West Lake, Xian alone → none', () => {
    expect(sightSearchQueries('West Lake Hangzhou')).toEqual(['West Lake'])
    expect(sightSearchQueries('Xian')).toEqual([])
  })
  it('every allow-list entry contains a city word (otherwise it does not belong on the list)', () => {
    for (const n of OFFICIAL_NAMES_WITH_CITY_WORD) expect(n.split(' ').some((w) => isCityToken(foldPhotoText(w))), n).toBe(true)
  })
  it('photo match never passes on a city word alone', () => {
    expect(sightMatchInText(sightProfile('Giant Wild Goose Pagoda'), 'Xian city wall at night', ['xian'])).toBeNull()
    expect(sightMatchInText(sightProfile('Mirabell Gardens Salzburg'), 'Salzburg old town view', ['salzburg'])).toBeNull()
  })
})

describe('place-dict-1128 test10-r2 dictionary additions', () => {
  const ens = (t: string) => findAllScheduleSpotMatchesInText(t).map((h) => h.en)
  it('포르투 동 루이스 다리 is the first listed sight', () => {
    const r = deriveDaySights({ title: '포르투', routeText: '동 루이스 다리 - 포르투 케이블카 - 상 벤투 역 - 볼량시장' }, '포르투')
    expect(r.sights[0]).toBe('Dom Luis I Bridge')
  })
  it('포트스테판 사막 = Stockton Bight Sand Dunes; a Wisconsin Stockton Island photo does not match', () => {
    expect(ens('시드니 - 포트스테판 사막 - 야생 돌핀 크루즈')).toContain('Stockton Bight Sand Dunes')
    expect(sightMatchInText(sightProfile('Stockton Bight Sand Dunes'), 'julian bay apostle islands lake stockton island beach', ['sydney'])).toBeNull()
  })
})

describe('place-dict-1128 route 1 (own text) / route 2 (city representative)', () => {
  it('route 1: listed sights in text order', () => {
    const r = deriveDaySights({ title: '서안', routeText: '서안 도착 - 대안탑(북광장) - 회족거리', imageKeyword: 'Xian' }, '서안')
    expect(r.route).toBe('own')
    expect(r.sights[0]).toBe('Giant Wild Goose Pagoda')
  })
  it('route 2 only when the day lists no sight: 서안 → 대안탑·병마용, never the city itself', () => {
    const r = deriveDaySights({ title: '서안 이동', routeText: '서안으로 이동 후 호텔 투숙', imageKeyword: 'Xian' }, '서안')
    expect(r.route).toBe('city_rep')
    expect(r.sights.slice(0, 2)).toEqual(['Giant Wild Goose Pagoda', 'Terracotta Army'])
  })
  it('city representative dictionary has no city words in sight names', () => {
    for (const e of CITY_REPRESENTATIVE_SIGHTS) for (const s of e.sights) for (const w of s.split(' ')) expect(isCityToken(foldPhotoText(w)), s).toBe(false)
  })
})
