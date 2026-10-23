// REGRESSION-FREEZE[mega-menu-dest-city-country-leaf]: 도시는 도시·나라는 나라 — manifest
import { describe, expect, it } from 'vitest'
import {
  alignDestinationToMegaMenuLeaf,
  classifyMegaMenuDestinationLabel,
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

  it('제목에 바라나시가 있으면 자이푸르 dest를 바라나시로', () => {
    const r = alignDestinationToMegaMenuLeaf({
      current: '자이푸르',
      title: '북인도일주 9일 #타지마할,바라나시',
      cityKey: 'india',
      countryKey: 'india',
    })
    expect(r.destination).toBe('바라나시')
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
})
