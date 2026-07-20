/**
 * REGRESSION-FREEZE[register-schedule-description-vibe-ssot]
 */
import { describe, expect, it } from 'vitest'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'
import { hanatourFactDaysToRegisterSchedule } from '@/lib/hanatour-register-api-detail'
import { composeYbtourScheduleDescription } from '@/lib/ybtour-register-api-schedule'
import {
  buildRegisterScheduleTripRouteKeywordContext,
  registerScheduleKeywordPassesTripRouteTextSsot,
  sanitizeRegisterScheduleImageKeywordsFromRouteEvidence,
} from '@/lib/register-schedule-route-evidence-keyword'
import { isRegisterScheduleCrossContinentHallucinationKeyword, inferRegisterEffectiveProductDestination } from '@/lib/register-schedule-cross-continent-keyword-guard'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'

describe('register schedule description vibe SSOT', () => {
  it('modetour — description은 routeText 복사 금지, vibe 2~3문장', () => {
    const days = modetourFactDaysToRegisterSchedule([
      {
        day: 2,
        places: ['피렌체', '베네치아'],
        hotels: ['4성 호텔'],
        meals: [],
        transportNote: null,
      },
    ])
    expect(days[0]?.routeText).toBe('피렌체 - 베네치아')
    expect(days[0]?.description).not.toBe(days[0]?.routeText)
    expect(days[0]?.description).toMatch(/여행|일정|분위기|동선|토스카나|베네토|걷는/)
    // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: region vibe before generic — manifest
    expect(days[0]?.description).not.toMatch(/하루 동안 여러 장면이 자연스럽게/)
  })

  it('modetour — 대련·장가계는 중국 지역 vibe (전일 generic 금지)', () => {
    const days = modetourFactDaysToRegisterSchedule([
      {
        day: 2,
        places: ['대련', '동관거리', '연화산'],
        hotels: [],
        meals: [],
        transportNote: null,
      },
      {
        day: 3,
        places: ['장가계', '천문산', '원가계'],
        hotels: [],
        meals: [],
        transportNote: null,
      },
    ])
    expect(days[0]?.description).toMatch(/항구|해안|도심|바다/)
    expect(days[0]?.description).not.toMatch(/하루 동안 여러 장면이 자연스럽게/)
    expect(days[1]?.description).toMatch(/기암|협곡|풍경|시야/)
    expect(days[1]?.description).not.toBe(days[0]?.description)
  })

  it('hanatour — description은 routeText 복사 금지', () => {
    const sched = hanatourFactDaysToRegisterSchedule([
      {
        day: 1,
        places: ['방콕', '왕궁'],
        hotels: [],
        meals: [],
        transportNote: '인천 - 방콕',
      },
    ])
    expect(sched[0]?.routeText).toBe('방콕 - 왕궁')
    expect(sched[0]?.description).not.toBe(sched[0]?.routeText)
  })

  it('hanatour — 프라하·밴프는 지역 vibe (전일 generic 금지)', () => {
    const sched = hanatourFactDaysToRegisterSchedule([
      {
        day: 2,
        places: ['프라하 성', '카를교', '프라하'],
        hotels: [],
        meals: [],
        transportNote: null,
      },
      {
        day: 3,
        places: ['밴프 국립공원', '보우폭포'],
        hotels: [],
        meals: [],
        transportNote: null,
      },
    ])
    expect(sched[0]?.description).not.toMatch(/하루 동안 여러 장면이 자연스럽게/)
    expect(sched[0]?.description).toMatch(/프라하|중세|광장|걷는|도시/)
    expect(sched[1]?.description).not.toMatch(/하루 동안 여러 장면이 자연스럽게/)
    expect(sched[1]?.description).toMatch(/국립공원|록키|대자연|호수|폭포/)
    expect(sched[0]?.description).not.toBe(sched[1]?.description)
  })

  it('ybtour — 프라하는 region vibe (generic 금지)', () => {
    // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: region vibe before generic — manifest
    const desc = composeYbtourScheduleDescription({
      day: 2,
      maxDay: 8,
      routePlaces: ['프라하 성', '카를교'],
      joinedBlob: '프라하 성 - 카를교 - 프라하',
    })
    expect(desc).not.toMatch(/하루 동안 여러 장면이 자연스럽게/)
    expect(desc).toMatch(/프라하|중세|광장|도시|걷는/)
  })

  it('체스키크롬로프 spelling — POI SSOT matches Cesky', () => {
    expect(firstMatchingScheduleSpotEn('프라하 공항 - 체스키크롬로프')).toMatch(/Cesky Krumlov/i)
  })

  it('ybtour — description은 vibe만 (routeText 1줄 금지)', () => {
    const desc = composeYbtourScheduleDescription({
      day: 2,
      maxDay: 5,
      routePlaces: ['바르샤바', '리가'],
      joinedBlob: '바르샤바 - 리가',
    })
    expect(desc).not.toMatch(/^바르샤바\s*-\s*리가/)
    expect(desc).toMatch(/여행|일정|분위기|동선|여정|구성|시야|피오르드|하루/)
    expect(desc).not.toMatch(/하루 동안 여러 장면이 자연스럽게/)
  })
})

describe('register schedule imageKeyword trip routeText SSOT', () => {
  it('routeText에서 유도 불가한 Colosseum 차단', () => {
    const rows = [{ day: 3, routeText: '파타야 - 알카자 쇼', imageKeyword: 'Colosseum Rome', imageKeyword2: null }]
    const tripCtx = buildRegisterScheduleTripRouteKeywordContext(rows)
    expect(registerScheduleKeywordPassesTripRouteTextSsot('Colosseum Rome', tripCtx)).toBe(false)
    const out = sanitizeRegisterScheduleImageKeywordsFromRouteEvidence(rows)
    expect(out[0]?.imageKeyword).toBe('')
  })

  it('아시아 일정 — 유럽 랜드마크 cross-continent 차단', () => {
    const rows = [{ day: 1, routeText: '방콕 - 왕궁', title: '방콕' }]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword('Colosseum Rome', null, rows),
    ).toBe(true)
  })

  it('뉴질랜드 — Mount Fuji cross-continent 차단 (Japan city 일정 없을 때)', () => {
    // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: Oceania dest Japan/Europe hallucination — manifest
    const rows = [{ day: 8, routeText: '오클랜드 - 해밀턴 가든', title: '오클랜드' }]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Mount Fuji Shizuoka view',
        '뉴질랜드',
        rows,
      ),
    ).toBe(true)
  })

  it('돗토리 일정 — Mount Fuji Shizuoka 환각 차단', () => {
    const rows = [
      { day: 3, routeText: '요나고 - 돗토리 - 쿠라요시', title: '돗토리' },
    ]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Mount Fuji Shizuoka view',
        '일본',
        rows,
      ),
    ).toBe(true)
  })

  it('규슈 벳푸 일정 — Mount Fuji 환각 차단', () => {
    const rows = [{ day: 2, routeText: '유후인 - 벳푸', title: '유후인' }]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Mount Fuji Shizuoka view',
        '일본',
        rows,
      ),
    ).toBe(true)
  })

  // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 교토·오사카 Kansai Fuji 환각 — manifest
  it('교토·오사카 일정 — Mount Fuji 환각 차단', () => {
    const rows = [
      {
        day: 1,
        routeText: '아라시야마 이동 - 도게츠교 - 치쿠린 - 니시키 재래시장',
        title: '교토',
      },
      { day: 2, routeText: '기요미즈데라 - 비와호대교', title: '기요미즈데라' },
      { day: 3, routeText: '오미하치만 - 도톤보리', title: '오사카' },
    ]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Mount Fuji Shizuoka view',
        '일본',
        rows,
      ),
    ).toBe(true)
  })

  // REGRESSION-FREEZE[schedule-poi-regex-ssot]: 도게츠교≠Doge's Palace — manifest
  it('도게츠교 — Togetsukyo Arashiyama, not Doge Palace', () => {
    expect(firstMatchingScheduleSpotEn('도게츠교')).toMatch(/Togetsu|Arashiyama/i)
    expect(firstMatchingScheduleSpotEn('도게츠교')).not.toMatch(/Doge/i)
    expect(firstMatchingScheduleSpotEn('아라시야마 - 도게츠교 - 치쿠린')).not.toMatch(/Doge/i)
  })

  it('유럽 일정 — Louvre Abu Dhabi 환각 차단', () => {
    const rows = [{ day: 3, routeText: '파리 - 루브르', title: '파리' }]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Louvre Abu Dhabi Saadiyat Island',
        '프랑스',
        rows,
      ),
    ).toBe(true)
  })

  it('두바이 일정 — Louvre Abu Dhabi는 환각 아님', () => {
    const rows = [{ day: 3, routeText: '두바이 - 아부다비', title: '아부다비' }]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Louvre Abu Dhabi Saadiyat Island',
        '두바이',
        rows,
      ),
    ).toBe(false)
  })

  // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: Provence — 일본(홋카이도) 환각 차단 — manifest
  it('일본 홋카이도 일정 — Provence/Aix 키워드 환각', () => {
    const rows = [
      { day: 3, routeText: '후라노 이동 - 팜 토미타 - 라벤더 소프트', title: '후라노' },
      { day: 4, routeText: '치토세 국제공항 이동', title: '귀국' },
    ]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Provence lavender fields Valensole plateau',
        '일본',
        rows,
      ),
    ).toBe(true)
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Aix-en-Provence old town fountain',
        '일본',
        rows,
      ),
    ).toBe(true)
  })

  it('imageKeyword Europe 오염으로 dest 추론하지 않음', () => {
    const rows = [
      { day: 1, routeText: '싱가포르', title: '싱가포르', imageKeyword: 'Europe' },
      { day: 3, routeText: '유니버설 스튜디오 싱가포르', title: 'USS' },
    ]
    expect(inferRegisterEffectiveProductDestination(null, rows)).toMatch(/Asia|Singapore|싱가포르/i)
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword(
        'Merlion Park Singapore',
        null,
        rows,
      ),
    ).toBe(false)
  })

  // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 알래스카·미주 dest — Space Needle 오탐 금지 — manifest
  it('알래스카 크루즈 — 잘못된 아시아 dest여도 Space Needle 환각 오탐 금지', () => {
    const rows = [
      { routeText: '시애틀 타코마 - 시애틀 - 퍼블릭 마켓', title: '시애틀' },
      { routeText: '주노 - 글래시어 베이', title: '주노' },
      { routeText: '케치칸', title: '케치칸' },
    ]
    expect(inferRegisterEffectiveProductDestination('아시아', rows)).toMatch(/Americas/i)
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword('Space Needle Seattle', '아시아', rows),
    ).toBe(false)
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword('Glacier Bay Alaska cruise', '알래스카 크루즈', rows),
    ).toBe(false)
  })

  // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 미주리나≠미주 Americas — manifest
  it('미주리나 호수 — Americas 오탐으로 Venice/Eiffel strip 금지', () => {
    const rows = [
      { routeText: '바티칸시국 - 콜로세움 - 로마', title: '로마' },
      { routeText: '미주리나 호수 - 돌로미테 케이블카', title: '미주리나' },
      { routeText: '산 마르코 광장 - 베니스 곤돌라', title: '베니스' },
      { routeText: '에펠탑 - 개선문', title: '파리' },
    ]
    const dest = inferRegisterEffectiveProductDestination(null, rows)
    expect(dest).not.toMatch(/Americas/i)
    expect(dest).toMatch(/Europe|Italy|France|Venice|Rome|Paris|Asia|미주리나|돌로미테/i)
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword('Venice Grand Canal gondolas', null, rows),
    ).toBe(false)
    expect(isRegisterScheduleCrossContinentHallucinationKeyword('Eiffel Tower', null, rows)).toBe(false)
    expect(isRegisterScheduleCrossContinentHallucinationKeyword('Colosseum', null, rows)).toBe(false)
  })

  // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: MILANO≠LA Americas — manifest
  it('HOTEL TIFFANY MILANO — LA Americas 오탐 금지', () => {
    const rows = [
      { routeText: '', title: 'HOTEL TIFFANY MILANO' },
      { routeText: '베키오 다리 - 두오모 - 시뇨리아 광장', title: '피렌체' },
      { routeText: '베니스 - 돌로미테 케이블카', title: '베니스' },
    ]
    expect(inferRegisterEffectiveProductDestination(null, rows)).toMatch(/Europe|Italy|Venice|Florence/i)
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword('Venice Grand Canal gondolas', null, rows),
    ).toBe(false)
  })

  // REGRESSION-FREEZE[register-schedule-cross-continent-europe-asia-guard]: 조이아일랜드·아일랜드호핑 ≠ EU Ireland — manifest
  it('조이아일랜드·아일랜드호핑 — EU Ireland 오탐으로 Maldives/KK strip 금지', async () => {
    const maldivesRows = [
      { routeText: '몰디브 조이아일랜드 라군빌라', title: '몰디브 조이아일랜드 라군빌라' },
      { routeText: '몰디브 - 몰디브 오버워터 빌라', title: '오버워터' },
    ]
    const title = '몰디브 조이아일랜드 라군빌라 4박7일 <AI/스피드보트>'
    expect(inferRegisterEffectiveProductDestination(title, maldivesRows)).toMatch(/몰디브|Maldives|Asia/i)
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword('Maldives Joy Island Lagoon Villa', title, maldivesRows),
    ).toBe(false)
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword('Maldives', title, maldivesRows),
    ).toBe(false)

    const kkRows = [
      {
        routeText: '',
        title: '판보르네오 호텔',
        description: '항구 도시와 구시가지가 이어지는, 아일랜드의 여유로운 이동형 하루입니다.',
      },
      { routeText: '아일랜드 호핑', title: '아일랜드 호핑' },
      { routeText: 'KK 스타 라운지', title: 'KK 스타 라운지' },
    ]
    expect(
      isRegisterScheduleCrossContinentHallucinationKeyword('Kota Kinabalu Island Hopping', null, kkRows),
    ).toBe(false)
    // 「거리가」≠ 리가 — EE cluster·POI 오탐 금지 (apply 경로)
    const { applyRegisterScheduleImageKeywordsBySupplier } = await import(
      '@/lib/register-schedule-image-keywords-apply'
    )
    const ampOut = applyRegisterScheduleImageKeywordsBySupplier(
      [
        { day: 1, title: '판보르네오 호텔', routeText: '', description: kkRows[0].description, imageKeyword: '', imageKeyword2: null },
        { day: 2, title: '아일랜드 호핑', routeText: '아일랜드 호핑', description: kkRows[0].description, imageKeyword: '', imageKeyword2: null },
        { day: 3, title: '판보르네오 호텔', routeText: '', description: '항구·수변 거리가 이어지는 하루입니다.', imageKeyword: '', imageKeyword2: null },
        { day: 4, title: 'KK 스타 라운지', routeText: 'KK 스타 라운지', imageKeyword: '', imageKeyword2: null },
        { day: 5, title: '귀국', routeText: '', imageKeyword: '', imageKeyword2: null },
      ],
      {
        supplierKey: 'kyowontour',
        productDestination: '코타키나발루',
        productTitle: '코타키나발루 아일랜드호핑',
        travelScope: 'package',
      },
    )
    const ampBlob = ampOut.map((r) => `${r.imageKeyword ?? ''} ${r.imageKeyword2 ?? ''}`).join(' | ')
    expect(ampBlob).not.toMatch(/Riga|Latvia|Art Nouveau/i)
    expect(ampBlob).toMatch(/Kota Kinabalu/i)
  })

  // REGRESSION-FREEZE[register-schedule-description-vibe-ssot]: italy/philippines/africa/caucasus/LA spelling — manifest
  it('extended vibe — 로스엔젤·이탈리아·필리핀·코카서스·사파리는 generic 금지', async () => {
    const { composeRegisterScheduleExtendedRegionVibeDescription, isRegisterScheduleGenericTourismDescription } =
      await import('@/lib/register-schedule-region-vibe-extended')
    const blobs = [
      '로스엔젤레스 공항 - 로스엔젤레스 출발',
      '베키오 다리 - 두오모 - 시뇨리아 광장',
      '알로나 비치 - 보홀',
      '므츠헤타 - 아나누리 교회',
      '세렝게티 국립공원 - 응고롱고로',
    ]
    for (const blob of blobs) {
      const d = composeRegisterScheduleExtendedRegionVibeDescription(blob.split(/\s*-\s*/), blob)
      expect(d, blob).toBeTruthy()
      expect(isRegisterScheduleGenericTourismDescription(d!), blob).toBe(false)
    }
  })
})
