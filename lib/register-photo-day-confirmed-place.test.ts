import { describe, expect, it, vi } from 'vitest'
import { processImagesProductUpdate } from '@/lib/register-auto-photo-missing-day'
import { readFileSync } from 'node:fs'
import {
  blocksAutomaticDayPhotoGeneration,
  dayAllowsPlacePhoto,
  dayPhotoContext,
  dayPhotoContextFromFacts,
  dayPhotoFactsFromScheduleFields,
  dayPoolOrHeroAllowed,
  daySelectionPersistSlice,
  explicitSameSightPlace,
  photoContextSearchQuery,
  pickDayStockCandidate,
  routeDaySlotHero,
  selectScheduleDayPhoto,
  transportCandidateAllowed,
  transportExampleGenerationPolicy,
  transportOnlyPhotoContext,
  travelMovePhotoPlace,
} from '@/lib/register-photo-day-confirmed-place'

const UPP_D1 =
  '인천-아디스 아바바-빅토리아 폴스. 짐바브웨편 빅토리아폭포 도보 관광. 노을이 지는 잠베지강 상류에서 선셋크루즈.'
const UPP_D2 = '짐바브웨-보츠와나. 사륜 구동 사파리 게임 드라이브. 초베 국립 공원 보트 사파리 관광.'
const UPP_D3 = '짐바브웨-잠비아-빅토리아 폴스. 세계 3대 폭포 잠비아편 빅토리아 폭포 관광. 이후 아디스아바바 항공 이동.'
const UPP_D4 = '아디스 아바바-상파울루. 호텔 조식 후 공항 이동. 상파울루 도착 후 연결 항공.'

const EWA_D1 =
  '파리 샤를드골 국제공항 도착. 호텔 체크인 후 파리 자유일정 또는 휴식. *파리 추천 관광지* - 샹젤리제 - 개선문 - 에펠탑 - 몽파르나스타워'
const EWA_D3 =
  '호텔 조식 후 파리 자유여행. *파리 추천 관광지* - 베르사유 궁전 - 마레지구 - 오르세 미술관 - 몽마르트'

const CGP_D1 = '제주항공 21:40 부산 출발 / 00:45 계림 도착. 호텔로 이동하여 투숙 및 휴식. 방문 관광지 없음.'
const CGP_D3 = '양삭. 용호공원. 칠성공원. 상공산. 양삭 이강유람. 서가 재래시장. 우룡하 야경 뗏목은 선택관광.'

const ATA_D3 = '전일 자유일정. 식사 불포함. 구체 방문지 없음.'
const ATA_D6 = '치앙마이 00:10 출발. 인천국제공항 07:10 도착. 관광 없음.'

const nairobi = {
  altText: 'skyline view of nairobi cityscape at daytime',
  pageUrl: 'https://www.pexels.com/photo/skyline-view-of-nairobi-cityscape-at-daytime-29069344/',
  originalLink: 'https://www.pexels.com/photo/skyline-view-of-nairobi-cityscape-at-daytime-29069344/',
  externalId: '29069344',
  photographer: 'Ken Mwaura',
  width: 4000,
  height: 2600,
}

const venice = {
  altText: 'rialto bridge at sunset in venice italy',
  pageUrl: 'https://www.pexels.com/photo/rialto-bridge-at-sunset-in-venice-italy-29487677/',
  originalLink: 'https://www.pexels.com/photo/rialto-bridge-at-sunset-in-venice-italy-29487677/',
  externalId: '29487677',
  photographer: 'Vladimir Srajber',
  width: 4000,
  height: 2600,
}

const falls = {
  url: 'pool://victoria-falls',
  externalId: '23232507',
}

describe('confirmed day place gate', () => {
  it('UPP D2 and D4 are different activities and do not reuse the Nairobi URL', () => {
    expect(explicitSameSightPlace(UPP_D2, UPP_D4)).toBeNull()
    expect(dayPoolOrHeroAllowed(nairobi, UPP_D2).ok).toBe(false)
    expect(dayAllowsPlacePhoto(UPP_D4)).toBe(true)
    expect(travelMovePhotoPlace(UPP_D4)).toEqual({ kind: 'upcoming', place: '상파울루' })
    expect(dayPoolOrHeroAllowed({
      altText: 'city skyline view',
      label: '상파울루',
      pageUrl: 'https://www.pexels.com/photo/sao-paulo-1/',
      originalLink: 'https://www.pexels.com/photo/sao-paulo-1/',
      externalId: '31',
      photographer: 'A',
      width: 4000,
      height: 2600,
    }, UPP_D4).ok).toBe(true)
    expect(dayPoolOrHeroAllowed({
      altText: 'sao paulo city skyline',
      pageUrl: 'https://www.pexels.com/photo/sao-paulo-2/',
      originalLink: 'https://www.pexels.com/photo/sao-paulo-2/',
      externalId: '32',
      photographer: 'A',
      width: 4000,
      height: 2600,
    }, UPP_D4).ok).toBe(true)
    expect(dayPoolOrHeroAllowed({
      altText: 'são paulo city skyline at dusk',
      pageUrl: 'https://www.pexels.com/photo/sao-paulo-3/',
      originalLink: 'https://www.pexels.com/photo/sao-paulo-3/',
      externalId: '34',
      photographer: 'A',
      width: 4000,
      height: 2600,
    }, UPP_D4).ok).toBe(true)
    expect(dayPoolOrHeroAllowed({
      altText: 'addis ababa university campus',
      label: '아디스아바바',
      pageUrl: 'https://www.pexels.com/photo/addis-1/',
      originalLink: 'https://www.pexels.com/photo/addis-1/',
      externalId: '33',
      photographer: 'A',
      width: 4000,
      height: 2600,
    }, UPP_D4).ok).toBe(false)
    const fetchPhoto = vi.fn()
    const picked = pickDayStockCandidate(
      [{ ...nairobi, url: 'pool://nairobi' }],
      () => true,
      () => explicitSameSightPlace(UPP_D2, UPP_D4) != null,
    )
    expect(picked).toBeNull()
    expect(fetchPhoto).not.toHaveBeenCalled()
  })

  it('EWA recommendation days keep an Eiffel or Versailles photo and reject Venice', () => {
    const eiffelDay = `${EWA_D1}\nEiffel Tower`
    const versaillesDay = `${EWA_D3}\nPalace of Versailles`
    expect(dayAllowsPlacePhoto(eiffelDay)).toBe(true)
    expect(dayAllowsPlacePhoto(versaillesDay)).toBe(true)
    expect(dayPoolOrHeroAllowed({
      altText: 'eiffel tower in paris at dusk',
      pageUrl: 'https://www.pexels.com/photo/eiffel-tower-paris-1/',
      originalLink: 'https://www.pexels.com/photo/eiffel-tower-paris-1/',
      externalId: '11',
      photographer: 'A',
      width: 4000,
      height: 2600,
    }, eiffelDay).ok).toBe(true)
    expect(dayPoolOrHeroAllowed({
      altText: 'palace of versailles gardens in france',
      pageUrl: 'https://www.pexels.com/photo/palace-of-versailles-1/',
      originalLink: 'https://www.pexels.com/photo/palace-of-versailles-1/',
      externalId: '12',
      photographer: 'A',
      width: 4000,
      height: 2600,
    }, versaillesDay).ok).toBe(true)
    expect(dayPoolOrHeroAllowed(venice, eiffelDay).ok).toBe(false)
    expect(dayPoolOrHeroAllowed(venice, versaillesDay).ok).toBe(false)
    expect(dayPoolOrHeroAllowed({
      altText: 'palace of versailles gardens in france',
      pageUrl: 'https://www.pexels.com/photo/palace-of-versailles-1/',
      originalLink: 'https://www.pexels.com/photo/palace-of-versailles-1/',
      externalId: '12',
      photographer: 'A',
      width: 4000,
      height: 2600,
    }, eiffelDay).ok).toBe(false)
    expect(dayPoolOrHeroAllowed({
      altText: 'portrait of a surgeon in sao paulo hospital',
      pageUrl: 'https://www.pexels.com/photo/sao-paulo-surgeon-1/',
      originalLink: 'https://www.pexels.com/photo/sao-paulo-surgeon-1/',
      externalId: '35',
      photographer: 'A',
      width: 4000,
      height: 2600,
    }, UPP_D4).reason).toBe('medical')
    expect(dayPoolOrHeroAllowed({
      altText: 'sao paulo city skyline',
      isGenerated: true,
      width: 4000,
      height: 2600,
    }, UPP_D4).reason).toBe('ai_unlabeled')
  })

  it('UPP D1 and D3 keep the same waterfall when both name Victoria Falls', () => {
    expect(explicitSameSightPlace(UPP_D1, UPP_D3)).toBe('빅토리아폭포')
    const picked = pickDayStockCandidate([falls], () => true, () => explicitSameSightPlace(UPP_D1, UPP_D3) != null)
    expect(picked).toEqual(falls)
  })

  it('returns null without calling out when no unused or same-sight candidate exists', () => {
    const fetchPhoto = vi.fn()
    expect(pickDayStockCandidate([], () => false, () => false)).toBeNull()
    expect(
      pickDayStockCandidate([{ url: 'pool://used' }], () => true, () => false),
    ).toBeNull()
    expect(fetchPhoto).not.toHaveBeenCalled()
  })

  it('CGP departure uses Guilin and Yangshuo stays a real tour', () => {
    expect(dayAllowsPlacePhoto(CGP_D1)).toBe(true)
    expect(travelMovePhotoPlace(CGP_D1)).toEqual({ kind: 'upcoming', place: '계림' })
    expect(photoContextSearchQuery(CGP_D1)).toBe('계림')
    expect(dayAllowsPlacePhoto(CGP_D3)).toBe(true)
    expect(dayPoolOrHeroAllowed({
      ...nairobi,
      altText: 'li river landscape in guilin',
      pageUrl: 'https://www.pexels.com/photo/li-river-guilin-1/',
      originalLink: 'https://www.pexels.com/photo/li-river-guilin-1/',
    }, CGP_D1).ok).toBe(true)
    expect(dayPoolOrHeroAllowed({
      ...nairobi,
      altText: 'gamcheon culture village in busan',
      pageUrl: 'https://www.pexels.com/photo/gamcheon-busan-1/',
      originalLink: 'https://www.pexels.com/photo/gamcheon-busan-1/',
    }, CGP_D1).ok).toBe(false)
    expect(dayPoolOrHeroAllowed(nairobi, CGP_D1).ok).toBe(false)
    expect(explicitSameSightPlace(CGP_D1, CGP_D3)).toBeNull()
  })

  it('ATA free day keeps the Doi Suthep recommendation and the return day uses Chiang Mai', () => {
    const freeDay = `${ATA_D3}\nWat Phra That Doi Suthep`
    const returnDay = `${ATA_D6}\nWat Phra That Doi Suthep`
    const doi = {
      altText: 'wat phra that doi suthep golden temple',
      pageUrl: 'https://www.pexels.com/photo/wat-phra-that-doi-suthep-1/',
      originalLink: 'https://www.pexels.com/photo/wat-phra-that-doi-suthep-1/',
      externalId: '21',
      photographer: 'A',
      width: 4000,
      height: 2600,
    }
    expect(dayPhotoContext(freeDay).kind).toBe('recommendation')
    expect(dayAllowsPlacePhoto(freeDay)).toBe(true)
    expect(dayAllowsPlacePhoto(returnDay)).toBe(true)
    expect(travelMovePhotoPlace(returnDay)).toEqual({ kind: 'last_stay', place: '치앙마이' })
    expect(photoContextSearchQuery(returnDay)).toBe('치앙마이')
    expect(blocksAutomaticDayPhotoGeneration(returnDay)).toBe(true)
    expect(blocksAutomaticDayPhotoGeneration(freeDay)).toBe(false)
    expect(dayPoolOrHeroAllowed(doi, freeDay).ok).toBe(true)
    expect(dayPoolOrHeroAllowed(nairobi, freeDay).ok).toBe(false)
    expect(dayPoolOrHeroAllowed({
      ...doi,
      altText: 'temple and mountain in chiang mai',
      pageUrl: 'https://www.pexels.com/photo/chiang-mai-temple-1/',
      originalLink: 'https://www.pexels.com/photo/chiang-mai-temple-1/',
    }, returnDay).ok).toBe(true)
    expect(dayPoolOrHeroAllowed(doi, returnDay).ok).toBe(true)
    expect(dayPoolOrHeroAllowed(nairobi, returnDay).ok).toBe(false)
    expect(explicitSameSightPlace(ATA_D3, ATA_D6)).toBeNull()
  })

  it('does not invent a city when the source has no travel direction', () => {
    const unclear = '호텔 투숙 후 휴식. 관광 없음.'
    expect(dayPhotoContext(unclear)).toEqual({ kind: 'none' })
    expect(dayAllowsPlacePhoto(unclear)).toBe(false)
    expect(travelMovePhotoPlace(unclear)).toBeNull()
    expect(photoContextSearchQuery(unclear)).toBeNull()
    expect(dayPoolOrHeroAllowed(nairobi, unclear).reason).toBe('no_confirmed_sightseeing')
    expect(travelMovePhotoPlace('부산 출발. 인천 도착. 관광 없음.')).toBeNull()
  })

  it('transport-only cruise and train allow a matching real photo and keep example generation manual', () => {
    const cruise = '부산 18:00 출발. 후쿠오카 크루즈 이동. 익일 후쿠오카 도착. 관광 없음.'
    const train = '서울역 09:00 출발. 부산역 기차 이동. 부산 도착. 일정 없음.'
    const fetchPhoto = vi.fn()
    const generateImage = vi.fn()
    expect(transportOnlyPhotoContext(UPP_D1)).toBeNull()
    expect(dayPhotoContext(UPP_D1).kind).toBe('supplier')
    expect(transportOnlyPhotoContext(cruise)).toEqual({ mode: 'cruise', segment: '부산 후쿠오카' })
    expect(photoContextSearchQuery(cruise)).toBe('크루즈 부산 후쿠오카')
    expect(transportExampleGenerationPolicy(cruise)).toEqual({
      realSearchFirst: true,
      whenNoRealPhoto: 'manual_example_only',
      autoInvoke: false,
    })
    expect(blocksAutomaticDayPhotoGeneration(cruise)).toBe(true)
    expect(transportExampleGenerationPolicy(UPP_D4)).toBeNull()
    const realCruise = {
      altText: 'white cruise ship near fukuoka',
      pageUrl: 'https://www.pexels.com/photo/fukuoka-cruise-1/',
      originalLink: 'https://www.pexels.com/photo/fukuoka-cruise-1/',
      externalId: '41',
      photographer: 'A',
      width: 4000,
      height: 2600,
    }
    expect(transportCandidateAllowed(realCruise, cruise)).toMatchObject({ ok: true, sourceKind: 'real' })
    expect(dayPoolOrHeroAllowed({
      ...realCruise,
      altText: 'eiffel tower in paris',
      pageUrl: 'https://www.pexels.com/photo/eiffel-tower-paris-2/',
      originalLink: 'https://www.pexels.com/photo/eiffel-tower-paris-2/',
    }, cruise).ok).toBe(false)
    expect(transportCandidateAllowed({
      ...realCruise,
      altText: 'cruise ship skyline in nairobi',
      pageUrl: 'https://www.pexels.com/photo/nairobi-cruise-1/',
      originalLink: 'https://www.pexels.com/photo/nairobi-cruise-1/',
    }, cruise).ok).toBe(false)
    expect(transportCandidateAllowed({
      altText: 'quantum of the seas balcony suite cruise',
      pageUrl: 'https://www.pexels.com/photo/quantum-cruise-1/',
      originalLink: 'https://www.pexels.com/photo/quantum-cruise-1/',
      externalId: '42',
      photographer: 'A',
      width: 4000,
      height: 2600,
    }, cruise).reason).toBe('unverified_facility')
    expect(transportCandidateAllowed({
      altText: 'cruise ship on open sea',
      isGenerated: true,
    }, cruise).reason).toBe('example_unlabeled')
    expect(transportCandidateAllowed({
      altText: 'cruise ship on open sea',
      label: '예시 이미지',
      width: 4000,
      height: 2600,
    }, cruise)).toMatchObject({ ok: true, sourceKind: 'example' })
    expect(transportCandidateAllowed({
      altText: 'cruise ship on open sea',
      isGenerated: true,
      aiLabel: '생성 이미지',
      width: 4000,
      height: 2600,
    }, cruise)).toMatchObject({ ok: true, sourceKind: 'generated' })
    expect(transportCandidateAllowed({
      altText: '확정 실제 선박 크루즈',
      label: '예시 이미지',
      width: 4000,
      height: 2600,
    }, cruise).reason).toBe('confirmed_real_claim')
    expect(dayPhotoContext(train).kind).toBe('transport')
    expect(photoContextSearchQuery(train)).toBe('기차 서울 부산')
    expect(transportCandidateAllowed({
      altText: 'passenger train at seoul station',
      pageUrl: 'https://www.pexels.com/photo/seoul-train-1/',
      originalLink: 'https://www.pexels.com/photo/seoul-train-1/',
      externalId: '51',
      photographer: 'A',
      width: 4000,
      height: 2600,
    }, train)).toMatchObject({ ok: true, sourceKind: 'real' })
    expect(fetchPhoto).not.toHaveBeenCalled()
    expect(generateImage).not.toHaveBeenCalled()
    const src = readFileSync(new URL('./register-photo-day-confirmed-place.ts', import.meta.url), 'utf8')
    expect(src).not.toContain('generateImageWithGemini')
    expect(src).not.toContain('fetch(')
    expect(src).toContain('manual_example_only')
    expect(src).toContain('autoInvoke: false')
  })

  it('does not treat a shared generic activity word as the same sightseeing place', () => {
    expect(explicitSameSightPlace(
      '초베 국립공원에서 사파리 게임 드라이브',
      '크루거 국립공원에서 사파리 게임 드라이브',
    )).toBeNull()
    expect(explicitSameSightPlace(UPP_D1, UPP_D3)).toBe('빅토리아폭포')
  })

  it('classifies stored ATA, UPP, and CGP rows from the saved JSON and the source segment', () => {
    const ataD3 = dayPhotoFactsFromScheduleFields({
      title: '산 위에서 내려다보는 황금빛 도시',
      description: '산 정상에 위치한 왓 프라탓 도이수텝에 올라 황금빛 사탑과 함께 치앙마이 시내 전경을 한눈에 담아 보세요. 도이수텝까지는 거리가 있으니 썽태우를 대절하거나 볼트 앱을 활용해 이동하는 것이 경제적입니다.',
      routeText: '왓 프라탓 도이수텝 - 떵뗌또 - 님만해민',
      imageKeyword: 'Wat Phra That Doi Suthep',
      imageCandidateOrigin: 'v2-ai-gemini',
      supplierOriginal: null,
    })
    const uppStored = dayPhotoFactsFromScheduleFields({
      title: '아디스 아바바 · 상파울루',
      description: '아디스 아바바와 상파울루를 둘러봅니다. 상파울루에서 주변을 이어서 둘러봅니다.',
      routeText: '아디스 아바바 - 상파울루',
      imageKeyword: 'Addis Ababa University Campus',
      imageCandidateOrigin: 'chain-pexels',
      supplierOriginal: null,
    })
    const uppSource = {
      ...uppStored,
      sourceMovementText: '[ET506/09:40] 아디스아바바 출발 (비행시간 약 12시간 10분) / 상파울루 [16:20] 상파울루(GRU) 도착',
    }
    const cgp = dayPhotoFactsFromScheduleFields({
      title: '계림 · 서가재래시장',
      description: '인천에서 출발해 계림에서 도착합니다. 세외도원과 인상유삼저를 둘러봅니다. 첫날 리듬을 맞추며 일정을 이어갑니다.',
      routeText: '계림 - 세외도원 - 인상유삼저 - 금탑은탑 - 서가재래시장',
      imageKeyword: 'Li River Guilin Cruise',
      supplierOriginal: null,
      sourceMovementText: '제주항공 7C8653 21:40 2026.11.22(일) 부산 PUS 출발 / 00:45 2026.11.23(월) 계림 KWL 도착 +1',
    })
    const ataD6 = dayPhotoFactsFromScheduleFields({
      title: '그리운 집으로 돌아가는 길',
      description: '즐거웠던 치앙마이 여행의 추억을 가슴에 품고 안전하게 한국 공항에 도착하여 일상을 준비해 보세요. 기내에서는 건조할 수 있으니 수분 크림이나 마스크팩을 챙겨 피부 컨디션을 관리하면 귀국 후가 더욱 편안합니다.',
      routeText: '김해 국제공항 - 김해공항 식당가 - 자택',
      imageKeyword: 'Wat Phra That Doi Suthep',
      imageCandidateOrigin: null,
      supplierOriginal: null,
    })
    expect(dayPhotoContextFromFacts(ataD3).kind).toBe('recommendation')
    expect(dayPhotoContextFromFacts(uppStored).kind).toBe('none')
    expect(dayPhotoContextFromFacts(uppSource)).toEqual({ kind: 'upcoming', place: '상파울루' })
    expect(dayPhotoContextFromFacts(cgp)).toEqual({ kind: 'upcoming', place: '계림' })
    expect(dayPhotoContextFromFacts(ataD6)).toEqual({ kind: 'last_stay', place: '치앙마이' })
    expect(dayPoolOrHeroAllowed({
      altText: 'wat phra that doi suthep golden temple',
      pageUrl: 'https://www.pexels.com/photo/wat-phra-that-doi-suthep-1/',
      originalLink: 'https://www.pexels.com/photo/wat-phra-that-doi-suthep-1/',
      externalId: '21',
      photographer: 'A',
      width: 4000,
      height: 2600,
    }, ataD6).ok).toBe(true)
    expect(dayPoolOrHeroAllowed({
      altText: 'foggy stone bridge with no named place',
      pageUrl: 'https://www.pexels.com/photo/foggy-stone-bridge-1/',
      originalLink: 'https://www.pexels.com/photo/foggy-stone-bridge-1/',
      externalId: '91',
      photographer: 'A',
      width: 4000,
      height: 2600,
    }, ataD6).ok).toBe(false)
  })
})

const ATA_D3_STORED = {
  title: '산 위에서 내려다보는 황금빛 도시',
  description: '산 정상에 위치한 왓 프라탓 도이수텝에 올라 황금빛 사탑과 함께 치앙마이 시내 전경을 한눈에 담아 보세요. 도이수텝까지는 거리가 있으니 썽태우를 대절하거나 볼트 앱을 활용해 이동하는 것이 경제적입니다.',
  routeText: '왓 프라탓 도이수텝 - 떵뗌또 - 님만해민',
}
const DUPLICATE_DOI = 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/chiang-mai-doi-suthep.webp'

function stock(url: string, altText: string, externalId: string) {
  return {
    url,
    altText,
    pageUrl: `https://www.pexels.com/photo/${externalId}/`,
    originalLink: `https://www.pexels.com/photo/${externalId}/`,
    externalId,
    photographer: 'A',
    width: 4000,
    height: 2600,
  }
}

describe('schedule day photo selection path', () => {
  it('runs pool, hero, chain, keep, and payload without a network or database call', async () => {
    const ataD3 = dayPhotoFactsFromScheduleFields({
      ...ATA_D3_STORED,
      imageKeyword: 'Wat Phra That Doi Suthep',
      imageCandidateOrigin: 'v2-ai-gemini',
      supplierOriginal: null,
    })
    const uppSource = dayPhotoFactsFromScheduleFields({
      title: '아디스 아바바 · 상파울루',
      description: '아디스 아바바와 상파울루를 둘러봅니다. 상파울루에서 주변을 이어서 둘러봅니다.',
      routeText: '아디스 아바바 - 상파울루',
      imageKeyword: 'Addis Ababa University Campus',
      imageCandidateOrigin: 'chain-pexels',
      sourceMovementText: '[ET506/09:40] 아디스아바바 출발 (비행시간 약 12시간 10분) / 상파울루 [16:20] 상파울루(GRU) 도착',
    })
    const cgp = dayPhotoFactsFromScheduleFields({
      title: '계림 · 서가재래시장',
      description: '인천에서 출발해 계림에서 도착합니다. 세외도원과 인상유삼저를 둘러봅니다. 첫날 리듬을 맞추며 일정을 이어갑니다.',
      routeText: '계림 - 세외도원 - 인상유삼저 - 금탑은탑 - 서가재래시장',
      sourceMovementText: '제주항공 7C8653 21:40 2026.11.22(일) 부산 PUS 출발 / 00:45 2026.11.23(월) 계림 KWL 도착 +1',
    })
    const ataD6 = dayPhotoFactsFromScheduleFields({
      title: '그리운 집으로 돌아가는 길',
      description: '즐거웠던 치앙마이 여행의 추억을 가슴에 품고 안전하게 한국 공항에 도착하여 일상을 준비해 보세요. 기내에서는 건조할 수 있으니 수분 크림이나 마스크팩을 챙겨 피부 컨디션을 관리하면 귀국 후가 더욱 편안합니다.',
      routeText: '김해 국제공항 - 김해공항 식당가 - 자택',
      imageKeyword: 'Wat Phra That Doi Suthep',
      imageCandidateOrigin: null,
    })
    const existing = {
      imageUrl: 'https://images.pexels.com/photos/1/pexels-photo-1.jpeg',
      imageUrl2: 'https://kr.object.ncloudstorage.com/bongtour/photo-pool/example-existing.webp',
      ...ATA_D3_STORED,
    }
    const calls = { pool: 0, hero: 0, chain: 0 }
    const recommended = await selectScheduleDayPhoto({
      facts: ataD3,
      existing,
      isUsed: () => false,
      sameSightReuse: () => false,
      loadPool: async () => {
        calls.pool += 1
        return stock('https://cdn.example/doi-new.webp', 'wat phra that doi suthep golden temple', '21')
      },
      loadHero: async () => {
        calls.hero += 1
        return routeDaySlotHero()
      },
      loadChain: async () => {
        calls.chain += 1
        return null
      },
    })
    expect(recommended.stage).toBe('pool')
    expect(recommended.imageUrl).toBe('https://cdn.example/doi-new.webp')
    expect(recommended.title).toBe(ATA_D3_STORED.title)
    expect(recommended.description).toBe(ATA_D3_STORED.description)
    expect(recommended.routeText).toBe(ATA_D3_STORED.routeText)
    expect(recommended.generateInvoked).toBe(false)
    expect(calls).toEqual({ pool: 1, hero: 0, chain: 0 })

    const outboundCalls = { pool: 0, hero: 0, chain: 0 }
    const outbound = await selectScheduleDayPhoto({
      facts: uppSource,
      existing: {
        imageUrl: existing.imageUrl,
        imageUrl2: existing.imageUrl2,
        title: '아디스 아바바 · 상파울루',
        description: '아디스 아바바와 상파울루를 둘러봅니다. 상파울루에서 주변을 이어서 둘러봅니다.',
        routeText: '아디스 아바바 - 상파울루',
      },
      isUsed: (candidate) => candidate.url === DUPLICATE_DOI,
      sameSightReuse: () => false,
      loadPool: async () => {
        outboundCalls.pool += 1
        return stock('https://cdn.example/nairobi.webp', 'skyline view of nairobi cityscape at daytime', '29069344')
      },
      loadHero: async () => {
        outboundCalls.hero += 1
        return routeDaySlotHero()
      },
      loadChain: async () => {
        outboundCalls.chain += 1
        return stock('https://cdn.example/saopaulo.webp', 'são paulo city skyline', '32')
      },
    })
    expect(outbound.stage).toBe('chain')
    expect(outbound.imageUrl).toBe('https://cdn.example/saopaulo.webp')
    expect(outbound.description).toBe('아디스 아바바와 상파울루를 둘러봅니다. 상파울루에서 주변을 이어서 둘러봅니다.')
    expect(outbound.generateInvoked).toBe(false)
    expect(outboundCalls).toEqual({ pool: 1, hero: 1, chain: 1 })

    const guilin = await selectScheduleDayPhoto({
      facts: cgp,
      existing: {
        imageUrl: existing.imageUrl,
        imageUrl2: null,
        title: '계림 · 서가재래시장',
        description: '인천에서 출발해 계림에서 도착합니다. 세외도원과 인상유삼저를 둘러봅니다. 첫날 리듬을 맞추며 일정을 이어갑니다.',
        routeText: '계림 - 세외도원 - 인상유삼저 - 금탑은탑 - 서가재래시장',
      },
      isUsed: () => false,
      sameSightReuse: () => false,
      loadPool: async () => stock('https://cdn.example/busan.webp', 'gamcheon culture village in busan', '81'),
      loadHero: async () => routeDaySlotHero(),
      loadChain: async () => stock('https://cdn.example/guilin.webp', 'li river landscape in guilin', '82'),
    })
    expect(guilin.stage).toBe('chain')
    expect(guilin.imageUrl).toBe('https://cdn.example/guilin.webp')
    expect(guilin.routeText).toContain('서가재래시장')

    const revisit = await selectScheduleDayPhoto({
      facts: ataD6,
      existing: {
        imageUrl: existing.imageUrl,
        imageUrl2: existing.imageUrl2,
        title: '그리운 집으로 돌아가는 길',
        description: ataD6.description,
        routeText: '김해 국제공항 - 김해공항 식당가 - 자택',
      },
      isUsed: (candidate) => candidate.url === DUPLICATE_DOI,
      sameSightReuse: () => false,
      loadPool: async () => stock(DUPLICATE_DOI, 'wat phra that doi suthep golden temple', '21'),
      loadHero: async () => routeDaySlotHero(),
      loadChain: async () => stock('https://cdn.example/doi-other.webp', 'wat phra that doi suthep golden temple', '22'),
    })
    expect(revisit.stage).toBe('chain')
    expect(revisit.imageUrl).toBe('https://cdn.example/doi-other.webp')
    expect(revisit.title).toBe('그리운 집으로 돌아가는 길')

    const fallsFacts = dayPhotoFactsFromScheduleFields({
      title: '빅토리아 폭포',
      description: UPP_D3,
      routeText: '짐바브웨 - 잠비아 - 빅토리아 폴스',
    })
    expect(dayPoolOrHeroAllowed(stock('pool://victoria-falls', 'victoria falls waterfall', '23232507'), fallsFacts)).toEqual({ ok: true, reason: null })
    expect(explicitSameSightPlace(UPP_D1, UPP_D3)).toBe('빅토리아폭포')
    const falls = await selectScheduleDayPhoto({
      facts: dayPhotoFactsFromScheduleFields({
        title: '빅토리아 폭포',
        description: UPP_D3,
        routeText: '짐바브웨 - 잠비아 - 빅토리아 폴스',
      }),
      existing: { imageUrl: null, imageUrl2: null, title: '빅토리아 폭포', description: UPP_D3, routeText: '짐바브웨 - 잠비아 - 빅토리아 폴스' },
      isUsed: () => true,
      sameSightReuse: () => explicitSameSightPlace(UPP_D1, UPP_D3) != null,
      loadPool: async () => stock('pool://victoria-falls', 'victoria falls waterfall', '23232507'),
      loadHero: async () => routeDaySlotHero(),
      loadChain: async () => null,
    })
    expect(falls.stage).toBe('pool')
    expect(falls.imageUrl).toBe('pool://victoria-falls')

    const kept = await selectScheduleDayPhoto({
      facts: uppSource,
      existing: {
        imageUrl: existing.imageUrl,
        imageUrl2: existing.imageUrl2,
        title: '아디스 아바바 · 상파울루',
        description: '아디스 아바바와 상파울루를 둘러봅니다. 상파울루에서 주변을 이어서 둘러봅니다.',
        routeText: '아디스 아바바 - 상파울루',
      },
      isUsed: () => false,
      sameSightReuse: () => false,
      loadPool: async () => null,
      loadHero: async () => routeDaySlotHero(),
      loadChain: async () => null,
    })
    expect(kept.stage).toBe('kept')
    expect(kept.imageUrl).toBe(existing.imageUrl)
    expect(kept.imageUrl2).toBe(existing.imageUrl2)
    expect(kept.unresolvedReason).toBe('no_verified_real_photo')
    expect(kept.generateInvoked).toBe(false)
    expect(kept.description).toBe('아디스 아바바와 상파울루를 둘러봅니다. 상파울루에서 주변을 이어서 둘러봅니다.')

    const noStock = await selectScheduleDayPhoto({
      facts: ataD3,
      existing,
      isUsed: () => false,
      sameSightReuse: () => false,
      loadPool: async () => null,
      loadHero: async () => routeDaySlotHero(),
      loadChain: async () => null,
    })
    expect(noStock.stage).toBe('kept')
    expect(noStock.unresolvedReason).toBe('no_verified_real_photo')
    expect(noStock.generateInvoked).toBe(false)
    expect(noStock.imageUrl).toBe(existing.imageUrl)
    expect(noStock.description).toBe(ATA_D3_STORED.description)

    const storedOriginal = { items: [{ name: '부산 출발', text: '계림 도착' }] }
    const slice = daySelectionPersistSlice(
      {
        day: 1,
        title: '계림 · 서가재래시장',
        description: '인천에서 출발해 계림에서 도착합니다. 세외도원과 인상유삼저를 둘러봅니다. 첫날 리듬을 맞추며 일정을 이어갑니다.',
        routeText: '계림 - 세외도원 - 인상유삼저 - 금탑은탑 - 서가재래시장',
        supplierOriginal: storedOriginal,
        imageUrl: existing.imageUrl,
        imageUrl2: existing.imageUrl2,
      },
      kept,
      kept.stage === 'kept',
    )
    const update = processImagesProductUpdate(true, JSON.stringify([slice]), { status: 'pending', bgImageUrl: 'https://example/cover.webp' })
    expect(update).toEqual({ schedule: JSON.stringify([slice]) })
    expect(Object.keys(update)).toEqual(['schedule'])
    const written = JSON.parse(String(update.schedule))[0]
    expect(written.title).toBe('계림 · 서가재래시장')
    expect(written.description).toContain('계림에서 도착합니다')
    expect(written.routeText).toContain('서가재래시장')
    expect(written.supplierOriginal).toEqual(storedOriginal)
    expect(written.imageUrl).toBe(existing.imageUrl)
    expect(written.imageUrl2).toBe(existing.imageUrl2)
  })
})
