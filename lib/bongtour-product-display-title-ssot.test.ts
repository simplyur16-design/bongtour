import { describe, expect, it } from 'vitest'
import {
  composeBongtourHeroDisplayTitle,
  composeHeroDayToken,
  durationHintFromTitle,
  resolvePublicBrowseCardTitle,
  resolvePublicDetailHeroTitles,
  sanitizePlaceLabel,
  scrubKrDepartureFromPlaceLabel,
  formatPublicDestinationDisplayLabel,
} from '@/lib/bongtour-product-display-title-ssot'

// REGRESSION-FREEZE[bongtour-ocean-warm-design-l0]: heroShortTitle 계약 — manifest

describe('composeHeroDayToken', () => {
  it('N박 M일 → N박 M일', () => {
    expect(composeHeroDayToken('3박 4일')).toBe('3박 4일')
    expect(composeHeroDayToken('7박8일')).toBe('7박 8일')
  })
  it('totalDays 폴백 → (n-1)박 n일', () => {
    expect(composeHeroDayToken(null, 5)).toBe('4박 5일')
  })
})

describe('composeBongtourHeroDisplayTitle', () => {
  it('브랜드 도시 + 단일국 → 도시 short + 국가 subtitle', () => {
    const r = composeBongtourHeroDisplayTitle({
      duration: '4박 5일',
      countryLabel: '베트남',
      cities: ['다낭', '호이안'],
    })
    expect(r.heroShortTitle).toBe('다낭 4박 5일')
    expect(r.heroSubtitle).toBe('베트남')
    expect(r.placeKind).toBe('city')
  })

  it('단일국·메가 도시 leaf → 도시 short (일본 N박 금지)', () => {
    const r = composeBongtourHeroDisplayTitle({
      duration: '2박 3일',
      countryLabel: '일본',
      cities: ['가나자와', '다카야마'],
    })
    expect(r.heroShortTitle).toBe('가나자와 2박 3일')
    expect(r.heroSubtitle).toBe('일본')
    expect(r.placeKind).toBe('city')
  })

  it('다국가 권역 — 중분류 동유럽 금지 · 도시 short', () => {
    const r = composeBongtourHeroDisplayTitle({
      duration: '8박 10일',
      multiCountry: true,
      regionLabel: '동유럽',
      cities: ['프라하', '부다페스트', '빈'],
      countryLabel: null,
    })
    expect(r.heroShortTitle).toBe('프라하 8박 10일')
    expect(r.heroShortTitle).not.toMatch(/동유럽/)
  })

  it('테마 화이트리스트 — 나라+테마+일수', () => {
    const r = composeBongtourHeroDisplayTitle({
      duration: '6박 7일',
      countryLabel: '아이슬란드',
      haystack: '아이슬란드 오로라 버스투어',
      cities: ['레이캬비크'],
    })
    expect(r.heroShortTitle).toBe('아이슬란드 오로라 6박 7일')
    expect(r.placeKind).toBe('theme')
  })

  it('일수 없으면 short null (UI title 폴백)', () => {
    const r = composeBongtourHeroDisplayTitle({
      countryLabel: '태국',
      cities: ['방콕'],
    })
    expect(r.heroShortTitle).toBeNull()
    expect(r.dayToken).toBeNull()
  })

  it('금칙 토큰 제거', () => {
    const r = composeBongtourHeroDisplayTitle({
      duration: '3박 4일',
      countryLabel: '프리미엄 베트남',
      cities: ['다낭'],
    })
    expect(r.heroShortTitle).toBe('다낭 3박 4일')
    expect(r.heroSubtitle).not.toMatch(/프리미엄/)
  })
})

describe('sanitizePlaceLabel / durationHintFromTitle', () => {
  it('반쪽 괄호·괄호 안 도시 목록 제거', () => {
    expect(sanitizePlaceLabel('규슈 (후쿠오카')).toBe('규슈')
    expect(sanitizePlaceLabel('규슈 (후쿠오카, 벳푸, 유후인, 히타)')).toBe('규슈')
  })
  it('원제목에서 일수 힌트', () => {
    expect(durationHintFromTitle('뉴질랜드 남/북섬 9일 #온천')).toBe('9일')
    expect(durationHintFromTitle('이탈리아 일주 11일')).toBe('11일')
  })
})

// REGRESSION-FREEZE[public-card-hero-short-title]: 카드 제목 배선 — manifest
describe('resolvePublicBrowseCardTitle', () => {
  it('긴 해시태그 원문 대신 목적지+N박M일 카드 제목', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title:
          'NO유류 차액! 출발가능 이탈리아 일주 11일 [낯설어 아름답다] #대한항공 #4성급호텔 #남부3DAYS',
        duration: '9박 11일',
        primaryDestination: '로마 · 피렌체 · 베네치아',
        primaryRegion: '유럽',
      },
      'NO유류 차액! 출발가능 이탈리아 일주 11일 [낯설어 아름답다]',
    )
    expect(r.usedHeroShort).toBe(true)
    expect(r.cardTitle).toMatch(/\d+박\s*\d+일$/)
    expect(r.cardTitle.length).toBeLessThan(40)
    expect(r.cardTitle).not.toMatch(/#대한항공|NO유류/)
  })

  it('브랜드 도시 방콕 — 짧은 카드 제목', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '방콕/파타야 3박 5일 #첫여행추천 #5성호텔',
        duration: '3박 5일',
        primaryDestination: '방콕 · 파타야',
      },
      '방콕/파타야 3박 5일 #첫여행추천 #5성호텔',
    )
    expect(r.cardTitle).toBe('방콕 3박 5일')
    expect(r.usedHeroShort).toBe(true)
  })

  it('일수 없으면 Plan B 폴백', () => {
    const fb = '태국 자유여행 특가 모음'
    const r = resolvePublicBrowseCardTitle(
      {
        title: fb,
        primaryDestination: '방콕',
      },
      fb,
    )
    expect(r.usedHeroShort).toBe(false)
    expect(r.cardTitle).toBe(fb)
  })

  it('목적지 괄호 조각 → 도시 leaf short (규슈 중분류·반쪽 괄호 금지)', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '규슈 4일 #온천의 진수 #완벽한 동선',
        duration: '3박 4일',
        primaryDestination: '규슈 (후쿠오카, 벳푸, 유후인, 히타)',
        cityKey: 'fukuoka',
        countryKey: 'japan',
        countryRowLabel: '일본',
      },
      '규슈 4일 #온천의 진수',
    )
    expect(r.usedHeroShort).toBe(true)
    expect(r.cardTitle).toBe('후쿠오카 3박 4일')
    expect(r.cardTitle).not.toMatch(/[（(）)]/)
    expect(r.cardTitle).not.toMatch(/^규슈\s|^일본\s/)
  })

  it('duration 비어도 제목 일수로 short', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '뉴질랜드 남/북섬 9일 #자연그대로 #온천 #밀포드사운드',
        primaryRegion: '뉴질랜드',
      },
      '뉴질랜드 남/북섬 9일 #자연그대로 #온천 #밀포드사운드',
    )
    expect(r.usedHeroShort).toBe(true)
    // 메가 LC leaf 정규화: 뉴질랜드 → 호주/뉴질랜드
    // days-only 제목은 nights 미발명 (9일 ≠ 8박 9일 가정)
    expect(r.cardTitle).toMatch(/^(?:뉴질랜드|호주\/뉴질랜드) (?:\d+박 )?9일$/)
    expect(r.cardTitle).not.toMatch(/#/)
  })

  // REGRESSION-FREEZE[public-card-hero-short-title]: EN browse slug≠카드 place — manifest
  it('continent oceania/southeast-asia EN slug를 카드 short에 쓰지 않음', () => {
    const au = resolvePublicBrowseCardTitle(
      {
        title: '[2030전용] 시드니 6일 #시드니시티투어',
        duration: '4박 6일',
        primaryDestination: '호주/뉴질랜드',
        destination: '호주/뉴질랜드',
        primaryRegion: 'oceania',
      },
      '[2030전용] 시드니 6일',
    )
    expect(au.cardTitle).not.toMatch(/oceania|southeast-asia|americas|europe-me/i)
    expect(au.cardTitle).toMatch(/^(시드니|호주\/뉴질랜드) \d+박/)

    const nt = resolvePublicBrowseCardTitle(
      {
        title: '[2030전용] 나트랑 5일 #전일정5성호텔',
        duration: '3박 5일',
        primaryDestination: '나트랑',
        destination: '나트랑',
        primaryRegion: 'southeast-asia',
        countryRowLabel: '베트남',
      },
      '[2030전용] 나트랑 5일',
    )
    expect(nt.cardTitle).toBe('나트랑 3박 5일')
  })

  it('후쿠오카 1박 2일 short는 오염으로 보지 않음', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '[가볍게 떠나는 여행+LITE TRIP] 후쿠오카 1박 2일',
        duration: '1박 2일',
        primaryDestination: '후쿠오카',
        destination: '후쿠오카',
        countryRowLabel: '일본',
      },
      '후쿠오카 1박 2일',
    )
    expect(r.cardTitle).toBe('후쿠오카 1박 2일')
    expect(r.usedHeroShort).toBe(true)
  })

  // REGRESSION-FREEZE[public-card-hero-short-title]: 그룹 헤더≠목적지 — manifest
  it('칭다오 — china-circle 그룹 헤더를 short에 쓰지 않음', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '[하나투어] 칭다오 핵심관광 2박3일',
        duration: '2박 3일',
        primaryDestination: '칭다오',
        destination: '청도',
        primaryRegion: '중국권 · 홍콩 · 마카오 · 몽골 · 중앙아',
      },
      '[하나투어] 칭다오 핵심관광 2박3일',
    )
    expect(r.usedHeroShort).toBe(true)
    expect(r.cardTitle).toBe('청도 2박 3일')
    expect(r.cardTitle).not.toMatch(/중국권|홍콩|마카오|몽골|중앙아/)
  })

  // REGRESSION-FREEZE[public-card-hero-short-title]: The Rocks 등 EN 키워드≠상품명 — manifest
  it('The Rocks soft-alt 문구를 카드 제목으로 쓰지 않음', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: 'The Rocks Sydney harbor',
        duration: '3박 4일',
        primaryDestination: '시드니',
      },
      'The Rocks Sydney harbor',
    )
    expect(r.cardTitle).toBe('시드니 3박 4일')
    expect(r.cardTitle).not.toMatch(/Rocks|harbor/i)
  })

  it('dest가 「ㅣ The Rocks ㅣ」여도 시드니 제목으로', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '[2030전용]시드니 6일#시드니시티투어',
        duration: '5박 6일',
        primaryDestination: 'ㅣ The Rocks ㅣ',
        destination: 'ㅣ The Rocks ㅣ',
      },
      '[2030전용]시드니 6일#시드니시티투어',
    )
    expect(r.cardTitle).toMatch(/시드니/)
    expect(r.cardTitle).not.toMatch(/Rocks/i)
  })

  // REGRESSION-FREEZE[public-card-hero-short-title]: 일정 POI·중복·권역혼선 ≠ 카드 제목 — manifest
  it('주조공장·식비 등 일정 POI dest를 카드 제목으로 쓰지 않음', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '후쿠오카 3박4일 #온천',
        duration: '3박 4일',
        primaryDestination: '마사히로주조공장',
        primaryRegion: '일본',
      },
      '후쿠오카 3박4일 #온천',
    )
    expect(r.cardTitle).not.toMatch(/주조공장|식비/)
    expect(r.cardTitle).toMatch(/일본|후쿠오카/)
  })

  it('홍콩실속 중복·&harr 엔티티를 카드에 남기지 않음', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '홍콩실속 홍콩실속 금까2박3일 A &harr; B',
        duration: '2박 3일',
        primaryDestination: '홍콩',
      },
      '홍콩실속 홍콩실속 금까2박3일 A &harr; B',
    )
    expect(r.cardTitle).toBe('홍콩 2박 3일')
    expect(r.cardTitle).not.toMatch(/실속|&harr|금까/)
  })

  it('일본+미국 혼선 제목을 카드에 쓰지 않음', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '일본제품에 미국 2박3일',
        duration: '2박 3일',
        primaryDestination: '일본제품에 미국',
      },
      '일본제품에 미국 2박3일',
    )
    expect(r.cardTitle).not.toMatch(/일본제품|미국/)
  })

  it('나하 국제거리 dest → 오키나와 카드 (거리≠도시)', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '오키나와 4일 #츄라우미수족관',
        duration: '3박 4일',
        primaryDestination: '나하 국제거리',
        primaryRegion: '일본',
        cityKey: 'okinawa',
        countryKey: 'japan',
        countryRowLabel: '일본',
      },
      '오키나와 4일 #츄라우미수족관',
    )
    expect(r.cardTitle).not.toMatch(/국제거리|여행\s*1박/)
    expect(r.cardTitle).toMatch(/오키나와/)
    expect(r.cardTitle).not.toBe('일본 3박 4일')
  })

  it('홋카이도 그룹 dest + cityKey → 도시 short 일본 N박 금지', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '스타가이드와 함께하는 홋카이도 4일',
        duration: '3박 4일',
        primaryDestination: '홋카이도',
        countryRowLabel: '일본',
        cityKey: 'sapporo',
        countryKey: 'japan',
      },
      '스타가이드와 함께하는 홋카이도 4일',
    )
    expect(r.cardTitle).toBe('삿포로 3박 4일')
    expect(r.cardTitle).not.toMatch(/^일본\s/)
  })

  // REGRESSION-FREEZE[mega-menu-dest-city-country-leaf]: 미동부 card ≠ 나이아가라 — manifest
  it('미동부 상품 카드가 나이아가라로 떨어지지 않음', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '미동부 핵심관광 8일',
        duration: '7박 8일',
        primaryDestination: '미동부',
        cityKey: 'niagara',
        countryKey: 'usa',
        countryRowLabel: '미국',
      },
      '미동부 핵심관광 8일',
    )
    expect(r.cardTitle).not.toMatch(/나이아가라/)
    expect(r.cardTitle).toMatch(/뉴욕/)
  })

  it('미동부, 캐나다 + dest 나이아가라(제목 미언급) 카드 ≠ 나이아가라', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '미동부, 캐나다 PICK 7박 10일',
        duration: '7박 10일',
        primaryDestination: '나이아가라',
        cityKey: 'nyc',
        countryKey: 'usa',
        countryRowLabel: '미국',
      },
      '미동부, 캐나다 PICK 7박 10일',
    )
    expect(r.cardTitle).not.toMatch(/나이아가라/)
    expect(r.cardTitle).toMatch(/뉴욕/)
  })

  it('인도 권역·제목에 도시 없으면 인도 short (자이푸르 cityKey 금지)', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '인도 골든트라이앵글 7일',
        duration: '6박 7일',
        primaryDestination: '자이푸르',
        cityKey: 'jaipur',
        countryKey: 'india',
        countryRowLabel: '인도',
      },
      '인도 골든트라이앵글 7일',
    )
    expect(r.cardTitle).toMatch(/^인도\s/)
    expect(r.cardTitle).not.toMatch(/자이푸르/)
  })

  it('북유럽 4국 카드 ≠ 중분류 북유럽 · 국가 leaf short', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '북유럽 4국 9일 (덴마크/노르웨이/스웨덴/핀란드) 크루즈 2박',
        duration: '8박 9일',
        primaryDestination: '노르웨이',
        cityKey: 'norway-mix',
        countryKey: 'norway',
        countryRowLabel: '노르웨이',
        primaryRegion: 'europe',
      },
      '북유럽 4국 9일',
    )
    expect(r.cardTitle).not.toMatch(/북유럽/)
    expect(r.cardTitle).toMatch(/노르웨이|덴마크/)
  })

  it('일본·동남아·유럽 region 카드 금지 — dest 도시/국가 leaf', () => {
    expect(
      resolvePublicBrowseCardTitle(
        {
          title: '[2030전용] 규슈/사가 3일',
          duration: '2박 3일',
          primaryDestination: '사가',
          cityKey: 'saga',
          countryKey: 'japan',
          countryRowLabel: '일본',
        },
        '규슈/사가 3일',
      ).cardTitle,
    ).toBe('사가 2박 3일')
    expect(
      resolvePublicBrowseCardTitle(
        {
          title: '다낭 자유 5일',
          duration: '3박 5일',
          primaryDestination: '다낭',
          cityKey: 'danang',
          countryKey: 'vietnam',
          countryRowLabel: '베트남',
          primaryRegion: '동남아',
        },
        '다낭 자유 5일',
      ).cardTitle,
    ).toBe('다낭 3박 5일')
    expect(
      resolvePublicBrowseCardTitle(
        {
          title: '스위스 알프스 7일',
          duration: '5박 7일',
          primaryDestination: '스위스',
          countryKey: 'switzerland',
          countryRowLabel: '스위스',
          primaryRegion: '유럽, 스위스',
        },
        '스위스 알프스 7일',
      ).cardTitle,
    ).toMatch(/^스위스\s/)
    expect(
      resolvePublicBrowseCardTitle(
        {
          title: '스위스 알프스 7일',
          duration: '5박 7일',
          primaryDestination: '스위스',
          countryKey: 'switzerland',
          countryRowLabel: '스위스',
          primaryRegion: '유럽, 스위스',
        },
        '스위스 알프스 7일',
      ).cardTitle,
    ).not.toMatch(/유럽|동남아|일본/)
  })

  // REGRESSION-FREEZE[public-card-hero-short-title]: 북인도 short ≠ 바라나시 — manifest
  it('북인도 일주·완전일주는 바라나시가 아니라 북인도 short', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '북인도일주 9일 #타지마할,바라나시,갠지스강',
        duration: '7박 9일',
        primaryDestination: '자이푸르',
        cityKey: 'india',
        countryKey: 'india',
        countryRowLabel: '인도',
      },
      '북인도일주 9일',
    )
    expect(r.cardTitle).toMatch(/^북인도\s/)
    expect(r.cardTitle).not.toMatch(/바라나시|자이푸르/)
    expect(
      resolvePublicBrowseCardTitle(
        {
          title: '준특급 북인도 완전일주 <노쇼핑/국내선1회/열차1회/특식3회/타지마할/19금사원> 7박 9일',
          duration: '7박 9일',
          primaryDestination: '바라나시',
          cityKey: 'india',
          countryKey: 'india',
          countryRowLabel: '인도',
        },
        '준특급 북인도 완전일주',
      ).cardTitle,
    ).toBe('북인도 7박 9일')
  })

  it('스리랑카 권역 카드는 콜롬보가 아니라 스리랑카 short', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '스리랑카 일주 6일',
        duration: '5박 6일',
        primaryDestination: '콜롬보',
        cityKey: 'colombo',
        countryKey: 'sri-lanka',
        countryRowLabel: '스리랑카',
      },
      '스리랑카 일주 6일',
    )
    expect(r.cardTitle).toMatch(/^스리랑카\s/)
    expect(r.cardTitle).not.toMatch(/콜롬보/)
  })
})

// REGRESSION-FREEZE[public-detail-hero-short-listing]: 상세 short·원명 — manifest
describe('resolvePublicDetailHeroTitles', () => {
  it('자유여행 — 히어로 short, 옆 카드는 원 상품명', () => {
    const listing =
      '방콕 자유여행 방콕 수쿰윗 편도 픽업 포함 3박 5일 #시내호텔'
    const r = resolvePublicDetailHeroTitles({
      title: listing,
      duration: '3박 5일',
      primaryDestination: '방콕',
    })
    expect(r.usedHeroShort).toBe(true)
    expect(r.heroTitle).toBe('방콕 3박 5일')
    expect(r.listingTitle).toBe(listing)
    expect(r.heroTitle).not.toEqual(r.listingTitle)
  })

  // REGRESSION-FREEZE[public-detail-hero-short-listing]: 오염 listingTitle 차단 — manifest
  it('중국권 헤더·The Rocks 원문은 listingTitle로 안 나감', () => {
    const qingdao = resolvePublicDetailHeroTitles({
      title: '중국권 · 홍콩 · 마카오 · 몽골 · 중앙아 2박 3일',
      duration: '2박 3일',
      primaryDestination: '칭다오',
      primaryRegion: '중국권 · 홍콩 · 마카오 · 몽골 · 중앙아',
    })
    expect(qingdao.heroTitle).toBe('청도 2박 3일')
    expect(qingdao.listingTitle).toBe('청도 2박 3일')
    expect(qingdao.listingTitle).not.toMatch(/중국권|홍콩|마카오/)

    const rocks = resolvePublicDetailHeroTitles({
      title: 'The Rocks Sydney harbor',
      duration: '3박 4일',
      primaryDestination: '시드니',
    })
    expect(rocks.heroTitle).toBe('시드니 3박 4일')
    expect(rocks.listingTitle).toBe('시드니 3박 4일')
    expect(rocks.listingTitle).not.toMatch(/Rocks/i)
  })

  // REGRESSION-FREEZE[public-detail-hero-short-listing]: sticky 원명 ≠ short 폴백 — manifest
  it('일반 긴 상품명은 sticky listing에 원문 유지 (나라 N박N일 치환 금지)', () => {
    const listing =
      '준특급 북인도 완전일주 <노쇼핑/국내선1회/열차1회/특식3회/타지마할/19금사원> 7박 9일'
    const r = resolvePublicDetailHeroTitles({
      title: listing,
      duration: '7박 9일',
      primaryDestination: '인도',
      countryKey: 'india',
    })
    expect(r.heroTitle).toMatch(/^북인도\s/)
    expect(r.listingTitle).toBe(listing)
    expect(r.listingTitle).not.toMatch(/^인도\s+\d+\s*박/)
    expect(r.listingTitle).not.toMatch(/^북인도\s+\d+\s*박/)
  })
})

// REGRESSION-FREEZE[public-card-no-kr-departure-place]: 출발지≠목적지 — manifest
describe('resolvePublicBrowseCardTitle KR departure place', () => {
  it('부산 · 마츠야마 dest → 마츠야마 N박 M일 (부산 금지)', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '마츠야마/오즈/우치코 역사 도고 온천가 2박 3일',
        duration: '2박 3일',
        primaryDestination: '부산 · 마츠야마',
      },
      '마츠야마/오즈/우치코 역사 도고 온천가 2박 3일',
    )
    expect(r.usedHeroShort).toBe(true)
    expect(r.cardTitle).toBe('마츠야마 2박 3일')
    expect(r.cardTitle).not.toMatch(/부산/)
  })

  it('[부산출발] 도쿄 — 도쿄 short', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '[부산출발] 핵심쏙쏙도쿄 2박3일',
        duration: '2박 3일',
        primaryDestination: '도쿄',
      },
      '[부산출발] 핵심쏙쏙도쿄 2박3일',
    )
    expect(r.cardTitle).toBe('도쿄 2박 3일')
  })

  it('dest 라벨 부산 · 마츠야마 → 마츠야마', () => {
    expect(scrubKrDepartureFromPlaceLabel('부산 · 마츠야마')).toBe('마츠야마')
    expect(scrubKrDepartureFromPlaceLabel('마츠야마')).toBe('마츠야마')
  })

  it('인천출발·청주출발만이면 빈 문자열 (원문 폴백 금지)', () => {
    expect(scrubKrDepartureFromPlaceLabel('인천출발')).toBe('')
    expect(scrubKrDepartureFromPlaceLabel('청주출발 · 동선최소화')).toBe('')
    expect(formatPublicDestinationDisplayLabel('인천출발')).toBe('—')
    expect(formatPublicDestinationDisplayLabel('부산 · 마츠야마')).toBe('마츠야마')
    expect(scrubKrDepartureFromPlaceLabel('밤출발 · 나이아가라')).toBe('나이아가라')
  })

  it('[청주출발+동선최소화] 제목 → 울란바토르 short', () => {
    const r = resolvePublicBrowseCardTitle(
      {
        title: '[청주출발+동선최소화]몽골 울란바토르 3박5일 #노쇼핑노옵션',
        duration: '3박 5일',
        primaryDestination: '청주출발 · 동선최소화',
      },
      '[청주출발+동선최소화]몽골 울란바토르 3박5일',
    )
    expect(r.cardTitle).toMatch(/울란바토르|울란바타르|몽골/)
    expect(r.cardTitle).not.toMatch(/청주|동선최소화/)
  })
})
