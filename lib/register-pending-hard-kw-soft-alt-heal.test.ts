import { describe, expect, it } from 'vitest'
import {
  pickUnusedRegisterScheduleCitySoftAltKeyword,
  collectRegisterScheduleCitySoftAltKeywords,
} from '@/lib/register-schedule-city-soft-alts'
import { isBrokenRegisterLandmarkKeyword } from '@/lib/register-pre-photo-guards'
import { EUROPE_PRODUCT_DEST_RE } from '@/lib/register-schedule-cross-continent-keyword-guard'
import { inferRegisterPendingDestinationFromTitle } from '@/lib/register-pre-photo-verify'
import { enforceRegisterScheduleTripUniqueImageKeywords } from '@/lib/register-schedule-trip-image-keyword-dedupe'
import { normScheduleImageKeywordKey } from '@/lib/register-schedule-llm-image-keyword-fallback'

// REGRESSION-FREEZE[register-pending-hard-kw-soft-alt-heal]: pending hard KW → unused soft-alt — manifest

describe('register-pending-hard-kw-soft-alt-heal', () => {
  it('Reykjavik pack yields unused alt after harbor houses used', () => {
    const used = new Set([normScheduleImageKeywordKey('Reykjavik Colorful Harbor Houses')])
    const next = pickUnusedRegisterScheduleCitySoftAltKeyword(used, {
      routeText: '레이캬비크 - 블루라군',
      usedKeyword: 'Reykjavik Colorful Harbor Houses',
    })
    expect(next).toBeTruthy()
    expect(normScheduleImageKeywordKey(next)).not.toBe(
      normScheduleImageKeywordKey('Reykjavik Colorful Harbor Houses'),
    )
  })

  it('Bondi Beach middle repeat is replaced by Sydney soft-alt', () => {
    const rows = [
      { day: 1, routeText: '인천 - 시드니', imageKeyword: 'Sydney', imageKeyword2: null },
      { day: 2, routeText: '시드니 - 본디비치', imageKeyword: 'Bondi Beach', imageKeyword2: null },
      { day: 3, routeText: '본디 - 시드니', imageKeyword: 'Bondi Beach', imageKeyword2: null },
      { day: 4, routeText: '시드니 - 인천', imageKeyword: 'Sydney', imageKeyword2: null },
    ]
    const out = enforceRegisterScheduleTripUniqueImageKeywords(rows as any)
    const middles = out.filter((r) => Number(r.day) === 2 || Number(r.day) === 3)
    const keys = middles.map((r) => normScheduleImageKeywordKey(String(r.imageKeyword ?? '')))
    expect(keys[0]).toBeTruthy()
    expect(keys[1]).toBeTruthy()
    expect(keys[0]).not.toBe(keys[1])
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: usedKeyword≠day-route pack unlock — manifest
  it('Istanbul usedKeyword on Mykonos day does not unlock Anitkabir', () => {
    const used = new Set([
      normScheduleImageKeywordKey('Mykonos windmills'),
      normScheduleImageKeywordKey('Mykonos Chora white houses'),
      normScheduleImageKeywordKey('Paradise Beach Mykonos'),
      normScheduleImageKeywordKey('Delos Island Greece'),
      normScheduleImageKeywordKey('Istanbul'),
    ])
    const next = pickUnusedRegisterScheduleCitySoftAltKeyword(used, {
      routeText: '아테네 - 미코노스',
      usedKeyword: 'Istanbul',
    })
    expect(String(next ?? '')).not.toMatch(/Anitkabir|Cappadocia|Pamukkale|Hagia|Blue Mosque/i)
  })

  it('Laura Village usedKeyword on Yellowknife day does not unlock Bondi', () => {
    const used = new Set([normScheduleImageKeywordKey('Laura Village Blue Mountains')])
    const next = pickUnusedRegisterScheduleCitySoftAltKeyword(used, {
      routeText: '올드타운 - 오로라 빌리지',
      usedKeyword: 'Laura Village Blue Mountains',
    })
    expect(String(next ?? '')).not.toMatch(/Bondi|Sydney Opera|Harbour Bridge|Taronga/i)
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: Bangkok≠bare 야시장 (Phu Quoc Duong Dong bleed) — manifest
  it('Phu Quoc Duong Dong night market does not unlock Bangkok soft-alts', () => {
    const used = new Set([
      normScheduleImageKeywordKey('Phu Quoc Grand World'),
      normScheduleImageKeywordKey('Phu Quoc Hon Thom Cable Car'),
      normScheduleImageKeywordKey('Phu Quoc Dinh Cau Temple'),
    ])
    const next = pickUnusedRegisterScheduleCitySoftAltKeyword(used, {
      routeText: '후추농장 - 쯔엉동 야시장',
      usedKeyword: 'Duong Dong Night Market Phu Quoc',
    })
    expect(String(next ?? '')).not.toMatch(/Bangkok|Chatuchak|Asiatique|Icon Siam|Wat Arun/i)
    expect(String(next ?? '')).toMatch(/Duong Dong|Pepper|Sao Beach|Vinpearl|Safari/i)
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: bare 사파리/Safari≠Serengeti (Vinpearl Safari Phu Quoc) — manifest
  it('Phu Quoc Vinpearl Safari does not unlock Serengeti or Paris soft-alts', () => {
    const alts = collectRegisterScheduleCitySoftAltKeywords('빈펄 사파리 - 그랜드월드')
    expect(alts.some((a) => /Serengeti|Ngorongoro|Masai\s*Mara|Amboseli|Manyara/i.test(a))).toBe(
      false,
    )
    expect(alts.some((a) => /Eiffel|Louvre|Champs|Notre\s*Dame/i.test(a))).toBe(false)
    expect(alts.some((a) => /Vinpearl\s*Safari|Grand\s*World|Sao\s*Beach/i.test(a))).toBe(true)
    const next = pickUnusedRegisterScheduleCitySoftAltKeyword(new Set(), {
      routeText: '빈펄 사파리 - 그랜드월드',
      title: '푸꾸옥 4일',
    })
    expect(String(next ?? '')).not.toMatch(/Serengeti|Ngorongoro|Eiffel|Louvre/i)
    expect(String(next ?? '')).toMatch(/Phu\s*Quoc|Vinpearl|Grand\s*World|Sao\s*Beach/i)
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: 세부일정≠Cebu (Okinawa bleed) — manifest
  it('Okinawa 세부일정 does not unlock Cebu soft-alts', () => {
    for (const hay of ['세부일정', '세부 일정', '세부안내', '오키나와 세부일정', '츄라우미 수족관 세부안내']) {
      const alts = collectRegisterScheduleCitySoftAltKeywords(hay)
      expect(alts.some((a) => /Cebu|Moalboal|Kawasan|Oslob|Magellan/i.test(a)), hay).toBe(false)
    }
    const oki = collectRegisterScheduleCitySoftAltKeywords('오키나와 츄라우미')
    expect(oki.some((a) => /Churaumi|American\s*Village|Shuri|Okinawa/i.test(a))).toBe(true)
    expect(oki.some((a) => /Cebu|Moalboal/i.test(a))).toBe(false)
    const cebuOk = collectRegisterScheduleCitySoftAltKeywords('세부 모알보알')
    expect(cebuOk.some((a) => /Cebu|Moalboal/i.test(a))).toBe(true)
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: marketing prose≠wrong soft-alt packs — manifest
  it('marketing prose does not unlock unrelated soft-alt packs', () => {
    const cases: Array<{ hay: string; deny: RegExp }> = [
      { hay: '로마시대 유적', deny: /Colosseum|Trevi|Pantheon/i },
      { hay: '호텔 온천 이용', deny: /Kurokawa|Kumamoto|Takachiho|Beppu/i },
      { hay: '료칸 조식', deny: /Kurokawa|Kumamoto|Beppu/i },
      { hay: '순례길 안내', deny: /Santiago|Camino|Portomarin/i },
      { hay: '니스한 날씨', deny: /Promenade|Nice Old Town|Negresco/i },
      { hay: '와이너리 투어', deny: /Montepulciano|Orvieto|Chianti|Tuscany/i },
      { hay: '워터파크 이용권', deny: /Saipan|Managaha|Garapan/i },
      { hay: 'PIC 리조트', deny: /Saipan|Managaha/i },
      { hay: '꽃시계 포토존', deny: /Central Park|Times Square|Niagara/i },
      { hay: '로키', deny: /Vancouver|Banff|Lake Louise/i },
      { hay: '쥬얼 장식', deny: /Haji Lane|ION Orchard|Jewel Changi/i },
      { hay: '잠잠', deny: /Haji Lane|Jewel Changi|Orchard/i },
      { hay: '캔디 가게', deny: /Kandy|Nuwara|Colombo|Bentota/i },
      { hay: '미케', deny: /Da Nang|Dragon Bridge|Marble Mountains/i },
      { hay: '리우 카페', deny: /Redeemer|Copacabana|Ipanema|Sugarloaf/i },
      { hay: '샹그릴라 호텔', deny: /Lijiang|Jade Dragon|Tiger Leaping/i },
      { hay: 'Rainbow bridge', deny: /Sun Moon|Alishan|Rainbow Village|Taichung/i },
      { hay: 'F1 경기', deny: /Las Vegas|Grand Canyon|Bellagio/i },
      { hay: '모아이 기념품', deny: /Easter Island|Rapa Nui|Tongariki/i },
      { hay: '아디스', deny: /Addis Ababa|Meskel|Entoto/i },
      { hay: '치첸', deny: /Cancun|Chichen|Tulum/i },
      { hay: '나일', deny: /Abu Simbel|Luxor|Cairo|Giza/i },
    ]
    for (const { hay, deny } of cases) {
      const alts = collectRegisterScheduleCitySoftAltKeywords(hay)
      expect(alts.some((a) => deny.test(a)), hay).toBe(false)
    }
    // still unlock on real place evidence
    expect(
      collectRegisterScheduleCitySoftAltKeywords('로마 콜로세움').some((a) => /Colosseum/i.test(a)),
    ).toBe(true)
    expect(collectRegisterScheduleCitySoftAltKeywords('니스 해변').some((a) => /Nice|Promenade/i.test(a))).toBe(
      true,
    )
    expect(collectRegisterScheduleCitySoftAltKeywords('사이판').some((a) => /Saipan/i.test(a))).toBe(true)
    expect(collectRegisterScheduleCitySoftAltKeywords('쿠로가와').some((a) => /Kurokawa/i.test(a))).toBe(true)
    expect(collectRegisterScheduleCitySoftAltKeywords('리장').some((a) => /Lijiang/i.test(a))).toBe(true)
    expect(collectRegisterScheduleCitySoftAltKeywords('아디스 아바바').some((a) => /Addis/i.test(a))).toBe(
      true,
    )
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: 사파리·마이파리≠Paris soft-alt — manifest
  it('Miyako 마이파리 does not unlock Paris soft-alts', () => {
    for (const hay of ['마이파리', '마이파리 열대과수원', '사파리', '빈펄 사파리']) {
      const alts = collectRegisterScheduleCitySoftAltKeywords(hay)
      expect(alts.some((a) => /Eiffel|Louvre|Champs|Notre\s*Dame|Arc\s*de\s*Triomphe/i.test(a)), hay).toBe(
        false,
      )
      expect(EUROPE_PRODUCT_DEST_RE.test(hay), `Europe flip:${hay}`).toBe(false)
    }
    const miyako = collectRegisterScheduleCitySoftAltKeywords('마이파리 열대과수원')
    expect(miyako.some((a) => /Miyakojima|Maehama|Irabu|Fruit/i.test(a))).toBe(true)
    const paris = collectRegisterScheduleCitySoftAltKeywords('파리 루브르')
    expect(paris.some((a) => /Eiffel|Louvre/i.test(a))).toBe(true)
    expect(inferRegisterPendingDestinationFromTitle('미야코지마 마이파리 자유여행')).not.toBe('파리')
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: Lisbon≠Porto soft-alt bleed — manifest
  it('Lisbon day soft-alt pack does not unlock Porto Ribeira', () => {
    const lisbon = collectRegisterScheduleCitySoftAltKeywords('리스본 벨렝')
    expect(lisbon.some((a) => /Porto Ribeira|Clerigos Tower Porto|Dom Luis/i.test(a))).toBe(false)
    expect(lisbon.some((a) => /Belem|Jeronimos|Commerce|Tram|Alfama/i.test(a))).toBe(true)
    const used = new Set(lisbon.map((a) => normScheduleImageKeywordKey(a)))
    const next = pickUnusedRegisterScheduleCitySoftAltKeyword(used, {
      routeText: '벨렝 - 제로니모스 - 코메르시우 광장 - 리스본',
      usedKeyword: 'Belem Tower Lisbon',
    })
    expect(String(next ?? '')).not.toMatch(/Porto Ribeira|Clerigos|Sao Bento|Dom Luis/i)
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-empty-middle]: HK soft-alt must pass landmark guard — manifest
  it('Hong Kong soft-alt pack has no lodging/non-landmark strings', () => {
    const alts = collectRegisterScheduleCitySoftAltKeywords('홍콩 침사추이')
    expect(alts.length).toBeGreaterThanOrEqual(4)
    for (const a of alts) {
      expect(isBrokenRegisterLandmarkKeyword(a), a).toBe(false)
    }
    expect(alts.some((a) => /Ngong Ping|Symphony of Lights|Star Ferry/i.test(a))).toBe(false)
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-empty-middle]: Dubai bare day soft-alt pack — manifest
  it('Dubai bare day soft-alt pack yields unused landmarks', () => {
    const alts = collectRegisterScheduleCitySoftAltKeywords('두바이')
    expect(alts.length).toBeGreaterThanOrEqual(4)
    expect(alts.some((a) => /Marina|Frame|Miracle|Burj|Palm|Fountain|JBR|Fahidi/i.test(a))).toBe(true)
    const used = new Set([normScheduleImageKeywordKey(alts[0]!)])
    const next = pickUnusedRegisterScheduleCitySoftAltKeyword(used, {
      routeText: '두바이',
      usedKeyword: alts[0],
    })
    expect(next).toBeTruthy()
    expect(normScheduleImageKeywordKey(next)).not.toBe(normScheduleImageKeywordKey(alts[0]!))
  })

  it('Helsinki and Madrid packs exist for empty-middle fill', () => {
    expect(collectRegisterScheduleCitySoftAltKeywords('헬싱키').length).toBeGreaterThanOrEqual(3)
    expect(collectRegisterScheduleCitySoftAltKeywords('마드리드').length).toBeGreaterThanOrEqual(3)
    expect(collectRegisterScheduleCitySoftAltKeywords('싱가포르').length).toBeGreaterThanOrEqual(3)
  })

  it('Yellowknife schedule does not get Bondi after Laura Village soft-alt attempt', () => {
    const rows = [
      { day: 1, routeText: '인천 - 옐로나이프', imageKeyword: 'Yellowknife', imageKeyword2: null },
      {
        day: 2,
        routeText: '올드타운 - 오로라 빌리지',
        imageKeyword: 'Laura Village Blue Mountains',
        imageKeyword2: null,
      },
      {
        day: 3,
        routeText: '오로라 헌팅',
        imageKeyword: 'Prince of Wales Northern Heritage Centre',
        imageKeyword2: null,
      },
      { day: 4, routeText: '옐로나이프 - 인천', imageKeyword: 'Yellowknife', imageKeyword2: null },
    ]
    const out = enforceRegisterScheduleTripUniqueImageKeywords(rows as any)
    for (const r of out) {
      for (const slot of [r.imageKeyword, r.imageKeyword2]) {
        expect(String(slot ?? '')).not.toMatch(/Bondi Beach/i)
        expect(String(slot ?? '')).not.toMatch(/Laura Village/i)
      }
    }
  })

  it('오로라 빌리지 route landmarks are Aurora not Laura', async () => {
    const { collectRouteTextOrderedLandmarkKeywords } = await import(
      '@/lib/register-schedule-route-text-image-keyword-ssot'
    )
    const kws = collectRouteTextOrderedLandmarkKeywords('올드타운 - 오로라 빌리지')
    expect(kws.some((k) => /Laura Village/i.test(k))).toBe(false)
    expect(kws.some((k) => /Aurora|Northern Lights|Yellowknife/i.test(k))).toBe(true)
  })

  it('Phu Quoc Grand World pack has multiple alts', () => {
    const alts = collectRegisterScheduleCitySoftAltKeywords('푸꾸옥 그랜드월드 모벤픽')
    expect(alts.length).toBeGreaterThanOrEqual(3)
    expect(alts.some((a) => /Grand\s*World|Sao\s*Beach|Safari/i.test(a))).toBe(true)
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-day-route]: 발리카삭(보홀)≠Bali soft-alt bleed — manifest
  it('Balicasag Bohol title does not unlock Bali soft-alts', () => {
    const alts = collectRegisterScheduleCitySoftAltKeywords('보홀 6일 발리카삭 로복강')
    expect(alts.some((a) => /Padang Padang|Uluwatu|Seminyak|Tanah Lot/i.test(a))).toBe(false)
    expect(alts.some((a) => /Bohol|Loboc|Chocolate Hills|Balicasag Island Bohol/i.test(a))).toBe(true)
  })

  // REGRESSION-FREEZE[register-schedule-city-soft-alt-empty-middle]: Istanbul Topkapi spelling + Bohol/Manado/Shenzhen packs — manifest
  it('Istanbul Topkapi spelling and Bohol Manado Shenzhen packs fill empty-middle', () => {
    const istanbul = collectRegisterScheduleCitySoftAltKeywords('성 소피아 성당 - 톱카프 궁전')
    expect(istanbul.some((a) => /Hagia Sophia|Topkapi|Blue Mosque|Galata/i.test(a))).toBe(true)
    expect(collectRegisterScheduleCitySoftAltKeywords('보홀 - 로복강').length).toBeGreaterThanOrEqual(4)
    expect(collectRegisterScheduleCitySoftAltKeywords('마나도 - 부나켄 국립공원').length).toBeGreaterThanOrEqual(3)
    expect(collectRegisterScheduleCitySoftAltKeywords('화창베이 - 선전베이공원 - 난터우').length).toBeGreaterThanOrEqual(
      3,
    )
  })

  // REGRESSION-FREEZE[register-pre-photo-heal-keep-visit-city-keyword]: middle empty kw1 — used kw2 clear for refill — manifest
  // REGRESSION-FREEZE[register-pre-photo-heal-keep-visit-city-keyword]: 자유 시간|공항 이동 requires primary — manifest
  it('자유 시간 및 공항 이동 middle requires primary and dest soft-alt fills', async () => {
    const { registerScheduleDayRequiresPrimaryImageKeyword } = await import(
      '@/lib/register-pre-photo-verify'
    )
    const { resolveScheduleKeywordSlotKind } = await import('@/lib/schedule-image-keyword-adjacent-poi')
    const { healRegisterPrePhotoSchedule } = await import('@/lib/register-pre-photo-self-heal')
    expect(registerScheduleDayRequiresPrimaryImageKeyword('middle', '자유 시간 및 공항 이동')).toBe(true)
    const rows = [
      { day: 1, routeText: '인천 - 홍콩', imageKeyword: 'Avenue of Stars Hong Kong', imageKeyword2: null },
      { day: 2, routeText: '빅토리아 피크', imageKeyword: 'Victoria Peak', imageKeyword2: null },
      { day: 3, routeText: '자유 시간 및 공항 이동', imageKeyword: '', imageKeyword2: null },
      { day: 4, routeText: '홍콩 - 인천', imageKeyword: 'Hong Kong', imageKeyword2: null },
    ]
    expect(resolveScheduleKeywordSlotKind(3, 4, 4)).toBe('middle')
    const healed = healRegisterPrePhotoSchedule(rows as any, {
      supplierKey: 'modetour',
      productDestination: '홍콩',
      productTitle: '[홍콩에어텔] 알렉산드라 호텔',
      lane: 'air_hotel_free',
    })
    const d3 = healed.rows.find((r) => Number(r.day) === 3)
    expect(String(d3?.imageKeyword ?? '').trim()).toBeTruthy()
    expect(String(d3?.imageKeyword ?? '')).toMatch(/Hong Kong|Harbour|Temple|Peak|Ferry|Market|Promenade/i)
  })

  // REGRESSION-FREEZE[register-pre-photo-heal-keep-visit-city-keyword]: forceTripUnique orphan kw2 → promote — manifest
  it('forceTripUnique promotes orphan kw2 when primary cleared as used', () => {
    const rows = [
      { day: 1, routeText: '인천 - 마드리드', imageKeyword: 'Madrid', imageKeyword2: null },
      {
        day: 2,
        routeText: '프라도 미술관',
        imageKeyword: 'Prado Museum Madrid',
        imageKeyword2: null,
      },
      {
        day: 3,
        routeText: '마드리드 아토차 역 - 세비야 스페인 광장',
        // enforce 회귀 패턴: primary 비움 + 미사용 kw2 orphan
        imageKeyword: '',
        imageKeyword2: 'Retiro Park Madrid',
      },
      { day: 4, routeText: '마드리드 - 인천', imageKeyword: 'Madrid', imageKeyword2: null },
    ]
    const out = enforceRegisterScheduleTripUniqueImageKeywords(rows as any)
    const d3 = out.find((r) => Number(r.day) === 3)
    expect(String(d3?.imageKeyword ?? '').trim()).toBeTruthy()
    expect(normScheduleImageKeywordKey(String(d3?.imageKeyword ?? ''))).toBe(
      normScheduleImageKeywordKey('Retiro Park Madrid'),
    )
  })

  it(
    'empty middle with trip-used kw2 clears and soft-alt refill fills primary',
    { timeout: 30_000 },
    async () => {
    const { applyRegisterScheduleImageKeywordsBySupplier } = await import(
      '@/lib/register-schedule-image-keywords-apply'
    )
    const { healRegisterPrePhotoSchedule } = await import('@/lib/register-pre-photo-self-heal')
    const rows = [
      { day: 1, routeText: '인천 - 마드리드', imageKeyword: '', imageKeyword2: null },
      {
        day: 2,
        routeText: '마드리드 - 프라도 미술관 - 왕궁',
        imageKeyword: 'Prado Museum Madrid',
        imageKeyword2: null,
      },
      {
        day: 3,
        routeText: '마드리드 시내 자유',
        imageKeyword: '',
        imageKeyword2: 'Prado Museum Madrid',
      },
      { day: 4, routeText: '마드리드 - 인천', imageKeyword: '', imageKeyword2: null },
    ]
    const applied = applyRegisterScheduleImageKeywordsBySupplier(rows as any, {
      supplierKey: 'hanatour',
      productDestination: '스페인',
      productTitle: '마드리드 자유일정',
    })
    const enforced = enforceRegisterScheduleTripUniqueImageKeywords(applied as any)
    const healed = healRegisterPrePhotoSchedule(enforced as any, {
      supplierKey: 'hanatour',
      productDestination: '스페인',
      productTitle: '마드리드 자유일정',
      lane: 'package',
    })
    const d3 = healed.rows.find((r) => Number(r.day) === 3)
    const d3kw = String(d3?.imageKeyword ?? '').trim()
    expect(d3kw).toBeTruthy()
    expect(normScheduleImageKeywordKey(d3kw)).not.toBe(
      normScheduleImageKeywordKey('Prado Museum Madrid'),
    )
    // kw2 may soft-alt refill; must not re-park the trip-used Prado as orphan secondary
    expect(normScheduleImageKeywordKey(String(d3?.imageKeyword2 ?? ''))).not.toBe(
      normScheduleImageKeywordKey('Prado Museum Madrid'),
    )
  })
})
