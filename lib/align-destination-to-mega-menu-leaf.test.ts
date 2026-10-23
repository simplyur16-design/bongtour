// REGRESSION-FREEZE[mega-menu-dest-city-country-leaf]: 도시는 도시·나라는 나라 — manifest
import { describe, expect, it } from 'vitest'
import {
  alignDestinationToMegaMenuLeaf,
  classifyMegaMenuDestinationLabel,
  firstMegaMenuLeafInText,
} from '@/lib/align-destination-to-mega-menu-leaf'
import { megaMenuClickLabelForCityKey } from '@/lib/mega-menu-click-label'
import { finalizeRegisterDestinationFields } from '@/lib/register-destination-finalize'

describe('alignDestinationToMegaMenuLeaf', () => {
  it('classifies 홋카이도/규슈 as group not city leaf', () => {
    expect(classifyMegaMenuDestinationLabel('홋카이도')).toBe('group')
    expect(classifyMegaMenuDestinationLabel('규슈')).toBe('group')
    expect(classifyMegaMenuDestinationLabel('오타루')).toBe('city')
    expect(classifyMegaMenuDestinationLabel('후쿠오카')).toBe('city')
    expect(classifyMegaMenuDestinationLabel('프랑스')).toBe('country')
  })

  it('group 홋카이도 + cityKey otaru → 오타루', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '홋카이도',
      title: '스타가이드와 함께하는 홋카이도 4일',
      cityKey: 'otaru',
      countryKey: 'japan',
    })
    expect(r.destination).toBe('오타루')
  })

  it('group 규슈 + cityKey fukuoka → 후쿠오카', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '규슈',
      title: '규슈 4일 후쿠오카 온천',
      cityKey: 'fukuoka',
      countryKey: 'japan',
    })
    expect(r.destination).toBe('후쿠오카')
  })

  it('does not map nordic title to georgia via bad cityKey', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '북유럽 · 발트 발틱3국',
      title: '북유럽 발트 발틱3국 10일',
      cityKey: 'georgia',
      countryKey: 'nordic-baltic',
    })
    expect(r.destination).not.toBe('조지아')
  })

  it('cityKey prefers city leaf over country leaf (otaru)', () => {
    expect(megaMenuClickLabelForCityKey('otaru')).toBe('오타루')
  })

  it('alias 동경→도쿄 · 상하이→상해 · 베이징→북경', () => {
    expect(alignDestinationToMegaMenuLeaf({ current: '동경', title: '동경 3일' }).destination).toBe(
      '도쿄',
    )
    expect(alignDestinationToMegaMenuLeaf({ current: '상하이', title: '상하이 3일' }).destination).toBe(
      '상해',
    )
    expect(alignDestinationToMegaMenuLeaf({ current: '베이징', title: '베이징 3일' }).destination).toBe(
      '북경',
    )
  })

  it('cluster 펼침으로 kamakura가 요코하마 leaf가 되지 않음', () => {
    expect(megaMenuClickLabelForCityKey('kamakura')).toBe('가마쿠라')
    expect(megaMenuClickLabelForCityKey('yokohama')).toBe('요코하마')
  })

  it('cityKey hyphen 정규화 — bigisland→빅아일랜드 · grandcanyon→그랜드캐년', () => {
    expect(megaMenuClickLabelForCityKey('bigisland')).toBe('빅아일랜드')
    expect(megaMenuClickLabelForCityKey('grandcanyon')).toBe('그랜드캐년')
  })

  it('sydney는 호주 도시 leaf 없음 → dest는 LC 국가 leaf (click label 오매칭 금지)', () => {
    expect(megaMenuClickLabelForCityKey('sydney')).toBe('')
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '시드니',
        title: '시드니 5일',
        cityKey: 'sydney',
        countryKey: 'australia',
      }).destination,
    ).toBe('호주/뉴질랜드')
  })

  it('does not map 니스 dest to 스페인 via cityKey es without evidence', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '니스 · 마세나 광장 외 13도시',
      title: '남프랑스 니스 일주',
      cityKey: 'es',
      countryKey: 'spain',
    })
    expect(r.destination).not.toBe('스페인')
    expect(r.destination).toBe('프랑스')
  })

  it('finalize coerces group dest when cityKey present', () => {
    const fin = finalizeRegisterDestinationFields({
      title: '홋카이도 4일 비에이',
      primaryDestination: '홋카이도',
      destination: '홋카이도',
      countryKey: 'japan',
      cityKey: 'sapporo',
    })
    expect(fin.primaryDestination).toBe('삿포로')
  })

  // REGRESSION-FREEZE[mega-menu-dest-city-country-leaf]: 미동부≠캐나다 leaf — manifest
  it('미동부 그룹 + cityKey niagara → 나이아가라 금지 (캐나다 leaf)', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '미동부',
      title: '미동부 핵심관광 8일',
      cityKey: 'niagara',
      countryKey: 'usa',
    })
    expect(r.destination).not.toBe('나이아가라')
    expect(r.destination).toBe('뉴욕')
  })

  it('이미 나이아가라 dest여도 제목 미동부면 미동부 그룹 leaf로 교정', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '나이아가라',
      title: '미동부 뉴욕 워싱턴 일주',
      cityKey: 'niagara',
      countryKey: 'usa',
    })
    expect(r.destination).not.toBe('나이아가라')
    expect(['뉴욕', '워싱턴']).toContain(r.destination)
  })

  it('미동부, 캐나다 제목 + dest 나이아가라(제목 미언급) → 미동부 leaf', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '나이아가라',
      title: '미동부, 캐나다 PICK 7박 10일',
      cityKey: 'nyc',
      countryKey: 'usa',
    })
    expect(r.destination).not.toBe('나이아가라')
    expect(r.destination).toBe('뉴욕')
  })

  it('제목에 나이아가라가 명시되면 유지', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '나이아가라',
      title: '미동부 나이아가라 방문 10일',
      cityKey: 'niagara',
      countryKey: 'usa',
    })
    expect(r.destination).toBe('나이아가라')
  })

  it('인도 권역 + cityKey jaipur → 국가 leaf 인도 (자이푸르 강등 금지)', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '자이푸르',
      title: '인도 골든트라이앵글 7일',
      cityKey: 'jaipur',
      countryKey: 'india',
    })
    expect(r.destination).toBe('인도')
  })

  it('스리랑카 권역 + cityKey colombo → 국가 leaf 스리랑카', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '콜롬보',
      title: '스리랑카 일주 6일',
      cityKey: 'colombo',
      countryKey: 'sri-lanka',
    })
    expect(r.destination).toBe('스리랑카')
  })

  it('북유럽 그룹을 덴마크로 임의 강등하지 않음', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '북유럽 · 발트 발틱3국',
      title: '북유럽 발트 발틱3국 10일',
      cityKey: 'georgia',
      countryKey: 'nordic-baltic',
    })
    expect(r.destination).not.toBe('덴마크')
    expect(r.destination).not.toBe('조지아')
  })

  it('시즈오카 dest를 테마 트레킹으로 훔치지 않음', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '시즈오카',
      title: '시즈오카 트레킹 3일',
      cityKey: 'shizuoka',
      countryKey: 'japan',
    })
    expect(r.destination).toBe('시즈오카')
  })

  it('미서부+하와이 하이브리드 — 호놀룰루를 로스앤젤레스로 뺏지 않음', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '호놀룰루',
      title: '미서부, 하와이 11일',
      cityKey: 'honolulu',
      countryKey: 'united-states',
    })
    expect(r.destination).toBe('호놀룰루')
  })

  // REGRESSION-FREEZE[mega-menu-dest-city-country-leaf]: 인도=국가 leaf only (도시 메가 폐기) — manifest
  it('인도 도시 관용 dest·북인도 일주는 모두 인도 leaf', () => {
    // alias 정규화 후 country — 메가 city leaf 없음
    expect(classifyMegaMenuDestinationLabel('바라나시')).toBe('country')
    expect(classifyMegaMenuDestinationLabel('자이푸르')).toBe('country')
    expect(classifyMegaMenuDestinationLabel('인도')).toBe('country')
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '바라나시',
        title: '준특급 북인도 완전일주 타지마할 7박9일',
        cityKey: 'india',
        countryKey: 'india',
      }).destination,
    ).toBe('인도')
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '자이푸르',
        title: '북인도일주 9일 #타지마할,바라나시',
        cityKey: 'india',
        countryKey: 'india',
      }).destination,
    ).toBe('인도')
    // 레거시 DB 도시 dest만 있어도 alias→인도
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '아그라',
        title: '타지마할 관광',
        cityKey: 'india',
        countryKey: 'india',
      }).destination,
    ).toBe('인도')
  })

  it('북유럽·발틱 dest → 발트3국 leaf (북유럽 그룹 LC 중복 없이)', () => {
    expect(classifyMegaMenuDestinationLabel('발트3국')).toBe('country')
    expect(classifyMegaMenuDestinationLabel('에스토니아')).toBe('country')
    const r = alignDestinationToMegaMenuLeaf({
      current: '북유럽 · 발트 발틱3국',
      title: '북유럽 4국 발틱 3국 12일',
      cityKey: null,
      countryKey: 'nordic-baltic',
    })
    expect(r.destination).toBe('발트3국')
  })

  it('유럽 dest + 제목 코펜하겐 → 덴마크 (코펜하겐 city leaf 미추가)', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '유럽',
      title: '발틱+북유럽 코펜하겐자유시간',
      cityKey: 'denmark-mix',
      countryKey: 'nordic-baltic',
    })
    expect(r.destination).toBe('덴마크')
  })

  it('시모노세키는 주고쿠 city leaf', () => {
    expect(classifyMegaMenuDestinationLabel('시모노세키')).toBe('city')
    const r = alignDestinationToMegaMenuLeaf({
      current: '슈페리어룸 2박',
      title: '리조나레 시모노세키',
      cityKey: null,
      countryKey: 'japan',
    })
    expect(r.destination).toBe('시모노세키')
  })

  it('오염 dest에 트레킹·골프 테마 leaf를 쓰지 않음', () => {
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '호도협 · 호도협 미니트레킹 외',
        title: '백두산 호도협 미니트레킹 4일',
      }).destination,
    ).not.toBe('트레킹')
    expect(
      alignDestinationToMegaMenuLeaf({
        current: 'KOOLINA GOLF CLUB · 코올리나 골프 클럽',
        title: '하와이 코올리나 골프 5일',
        cityKey: 'honolulu',
      }).destination,
    ).not.toBe('골프')
  })

  it('계림·싱가폴·프라하 관용 → 메가 leaf', () => {
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '계림 · 세외도원 외',
        title: '계림 양삭 4박5일',
      }).destination,
    ).toBe('구이린')
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '싱가폴 4박',
        title: '싱가폴 자유여행',
      }).destination,
    ).toBe('싱가포르')
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '유럽 (프라하 성 · 성 비투스 성당)',
        title: '동유럽 프라하 7일',
      }).destination,
    ).toBe('체코')
  })

  it('비즈니스 제목이 니스→프랑스로 오매칭되지 않음', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '골프',
      title: '[비즈니스] 미션힐스 골프클럽 세계최대 규모 골프 리조트 5일',
      cityKey: 'shenzhen',
      countryKey: 'china',
    })
    expect(r.destination).not.toBe('프랑스')
  })

  it('하와이 제목 + cityKey honolulu → 호놀룰루 (골프장 dest)', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: 'KOOLINA GOLF CLUB · 코올리나 골프 클럽 외',
      title: '하와이 골프와 진주만, 오아후 와이키키 1주일',
      cityKey: 'honolulu',
      countryKey: 'united-states',
    })
    expect(r.destination).toBe('호놀룰루')
  })

  it('오아후만 있는 제목도 호놀룰루 leaf', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: 'KOOLINA GOLF CLUB · 코올리나 골프 클럽 외',
      title: '오아후 골프와 진주만의 여운 #코올리나',
      cityKey: 'honolulu',
      countryKey: 'united-states',
    })
    expect(r.destination).toBe('호놀룰루')
  })

  it('2030/골프 테마 dest는 제목 leaf·cityKey geo로 교정', () => {
    // 제목에 고치 leaf가 있으면 cityKey(다카마쓰)보다 제목 우선
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '2030',
        title: '[2030전용] 고치 4일 #소규모여행',
        cityKey: 'takamatsu',
        countryKey: 'japan',
      }).destination,
    ).toBe('고치')
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '2030',
        title: '[2030전용] 규슈/사가 3일 #소도시투어',
        cityKey: 'saga',
        countryKey: 'japan',
      }).destination,
    ).toBe('사가')
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '골프',
        title: '[비즈니스] 심천 미션힐스 골프클럽 5일',
        cityKey: 'shenzhen',
        countryKey: 'china',
      }).destination,
    ).toBe('심천')
  })

  it('유럽 우산 + countryKey → 국가 leaf', () => {
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '유럽',
        title: '동유럽 3국 9일 #할슈타트',
        cityKey: 'at',
        countryKey: 'austria',
      }).destination,
    ).toBe('오스트리아')
  })

  it('중남미·아프리카 일주는 그룹명 LC, 고유 term이면 국가 leaf', () => {
    expect(classifyMegaMenuDestinationLabel('중남미')).toBe('country')
    expect(classifyMegaMenuDestinationLabel('아프리카')).toBe('country')
    // N개국 다도시 — 마추픽추 언급만으로 페루로 쪼개지 않음
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '중남미',
        title: '중남미 20일 #6개국 #마추픽추 #이과수',
        cityKey: 'cancun',
        countryKey: 'latin-caribbean',
      }).destination,
    ).toBe('중남미')
    // 마사이마라 term → 케냐 (국가 leaf, N개국이어도 구체 국가 허용)
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '아프리카',
        title: '아프리카 6개국 13일 #마사이마라',
        countryKey: 'africa',
      }).destination,
    ).toBe('케냐')
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '『행운의 주문',
        title: '[비즈니스] 아프리카 일주 6개국 13일',
        countryKey: 'africa',
      }).destination,
    ).toBe('아프리카')
    // 북인도 완전일주 — 타지마할≠아그라 dest
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '인도',
        title: '준특급 북인도 완전일주 타지마할 7박9일',
        cityKey: 'india',
        countryKey: 'india',
      }).destination,
    ).toBe('인도')
  })

  it('「두 개의 나라」관용 ≠ 나라시 · 그리스 그룹→아테네', () => {
    expect(
      firstMegaMenuLeafInText('『에게 해를 품은 두 개의 나라』그리스 + 튀르키예 11일'),
    ).toBeNull()
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '나라',
        title: '『에게 해를 품은 두 개의 나라』그리스 + 튀르키예 11일',
        cityKey: 'nara',
        countryKey: 'japan',
      }).destination,
    ).toBe('아테네')
  })

  it('오염 dest — cityKey·관용 term으로 leaf', () => {
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '미지정',
        title: '#아시아나항공 #비치리조트연박',
        cityKey: 'okinawa-main',
        countryKey: 'japan',
      }).destination,
    ).toBe('오키나와')
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '옐로팡딜',
        title: '[옐로팡딜] 부산출발 타이페이 4일',
        cityKey: 'taipei',
        countryKey: 'taiwan',
      }).destination,
    ).toBe('타이베이')
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '대구출발',
        title: '[대구출발] 프리미엄 북해도 4일_온천호텔',
        countryKey: 'japan',
      }).destination,
    ).toBe('삿포로')
    expect(
      alignDestinationToMegaMenuLeaf({
        current: '백두산 FAQ · 고속열차 이동 외',
        title: '백두산(북파+서파)/장춘 4일',
        countryKey: 'china',
      }).destination,
    ).toBe('장백산')
  })
})
