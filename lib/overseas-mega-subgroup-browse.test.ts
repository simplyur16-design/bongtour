import { describe, expect, it } from 'vitest'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'
import {
  megaMenuSubgroupLabelsInOrder,
  resolveOverseasMegaMenuSubgroupLabelForBrowse,
} from '@/lib/overseas-mega-region-city-group'

function resolveSubgroup(
  regionId: string,
  title: string,
  primaryDestination: string,
  opts?: { cityKey?: string; countryKey?: string },
) {
  const input = {
    title,
    originSource: 'hanatour',
    primaryDestination,
    destination: primaryDestination,
    cityKey: opts?.cityKey ?? null,
    countryKey: opts?.countryKey ?? null,
  }
  const match = matchProductToOverseasNode(input)
  return resolveOverseasMegaMenuSubgroupLabelForBrowse(input, match, regionId, primaryDestination)
}

describe('overseas mega subgroup browse', () => {
  it('southeast-asia — 도시·국가 그룹 라벨', () => {
    expect(resolveSubgroup('southeast-asia', '다낭 4일', '다낭', { cityKey: 'danang' })).toBe('베트남')
    expect(resolveSubgroup('southeast-asia', '방콕 5일', '방콕', { cityKey: 'bangkok' })).toBe('태국')
    expect(resolveSubgroup('southeast-asia', '인도 골든트라이앵글', '인도', { countryKey: 'india' })).toBe('인도')
    expect(megaMenuSubgroupLabelsInOrder('southeast-asia').slice(0, 3)).toEqual([
      '베트남',
      '태국',
      '싱가포르',
    ])
  })

  it('americas — 하와이·미서부·미동부·캐나다 그룹', () => {
    expect(resolveSubgroup('americas', '호놀룰루 5일', '호놀룰루', { cityKey: 'honolulu' })).toBe('하와이')
    expect(resolveSubgroup('americas', 'LA·라스베가스', '로스앤젤레스', { cityKey: 'la' })).toBe('미서부')
    expect(resolveSubgroup('americas', '뉴욕 워싱턴 8일', '뉴욕', { cityKey: 'new-york' })).toBe('미동부')
    expect(resolveSubgroup('americas', '미서부/미동부/캐나다 완전일주 19일', '캐나다')).toBe('캐나다')
    expect(resolveSubgroup('americas', '밴쿠버 7일', '밴쿠버', { cityKey: 'vancouver' })).toBe('캐나다')
    expect(
      resolveSubgroup('americas', '5대캐년 9일', '세도나캐년숙박', { cityKey: 'grandcanyon', countryKey: 'usa-west' }),
    ).toBe('미서부')
    expect(
      resolveSubgroup('americas', '세도나·그랜드캐년', '세도나캐년숙박', { cityKey: 'lasvegas', countryKey: 'usa-west' }),
    ).toBe('미서부')
    expect(megaMenuSubgroupLabelsInOrder('americas')).toEqual([
      '하와이',
      '미서부',
      '미동부',
      '캐나다',
      '알래스카',
    ])
  })

  it('japan — 도쿠시마는 주고쿠-시코쿠', () => {
    expect(resolveSubgroup('japan', '도쿠시마 4일', '도쿠시마', { cityKey: 'tokushima' })).toBe('주고쿠-시코쿠')
  })

  it('china-hk-mo — 샤먼·푸저우는 중국(복건)', () => {
    expect(resolveSubgroup('china-hk-mo', '샤먼 5일', '샤먼', { cityKey: 'xiamen' })).toBe('중국')
    expect(resolveSubgroup('china-hk-mo', '푸저우 3일', '푸저우', { cityKey: 'fuzhou' })).toBe('중국')
    expect(resolveSubgroup('china-hk-mo', '샤먼 푸저우 연계', '샤먼 푸저우', { cityKey: 'fuzhou' })).toBe('중국')
  })

  it('japan — 시즈오카는 간토(홋카이도 아님)', () => {
    expect(resolveSubgroup('japan', '시즈오카·이즈 4일', '시즈오카', { cityKey: 'shizuoka' })).toBe('간토')
    expect(resolveSubgroup('japan', '일본 시즈오카', '시즈오카 · 이즈(아타미)')).toBe('간토')
    expect(resolveSubgroup('japan', '일본만 있는 상품', '일본')).toBe('기타')
  })

  it('china-hk-mo — 내몽골→몽골, 서안→중국', () => {
    expect(resolveSubgroup('china-hk-mo', '내몽골 후룬베이얼 5일', '내몽골', { cityKey: 'inner-mongolia' })).toBe(
      '몽골',
    )
    expect(resolveSubgroup('china-hk-mo', '서안·화불 6일', '서안', { cityKey: 'xian' })).toBe('중국')
    expect(resolveSubgroup('china-hk-mo', '서안 관광', '서안 · 우루무치')).toBe('중국')
  })

  it('europe-me — 코카서스 3국(두바이 연계 포함)', () => {
    expect(
      resolveSubgroup(
        'europe-me',
        '코카서스 3국 10일 KE #두바이관광',
        '아제르바이잔, 조지아, 아르메니아, 두바이',
        { cityKey: 'azerbaijan' },
      ),
    ).toBe('코카서스 3국')
    expect(
      resolveSubgroup('europe-me', '코카서스 3국 12일', '아제르바이잔, 조지아, 아르메니아', {
        cityKey: 'azerbaijan',
      }),
    ).toBe('코카서스 3국')
    expect(resolveSubgroup('europe-me', '코카서스 3국 두바이 10일', '두바이', { cityKey: 'dubai' })).toBe(
      '코카서스 3국',
    )
    expect(
      resolveSubgroup('europe-me', '조지아·아제르바이잔·아르메니아 9일', '두바이 경유', { cityKey: 'dubai' }),
    ).toBe('코카서스 3국')
  })

  it('china-hk-mo — 황산(黄山)·장야(七彩丹霞)', () => {
    expect(resolveSubgroup('china-hk-mo', '황산 5일', '황산', { cityKey: 'huangshan' })).toBe('중국')
    expect(resolveSubgroup('china-hk-mo', '장야 七彩丹霞 5일', '장야', { cityKey: 'zhangye' })).toBe('중국')
  })

  it('south-america — 국가별 섹션(중남미 그룹 아님)', () => {
    expect(resolveSubgroup('south-america', '멕시코 칸쿤', '멕시코', { countryKey: 'mexico' })).toBe('멕시코')
    expect(resolveSubgroup('south-america', '쿠바 아바나', '쿠바', { countryKey: 'cuba' })).toBe('쿠바')
    expect(resolveSubgroup('south-america', '페루 마추픽추', '페루', { countryKey: 'peru' })).toBe('페루')
    expect(megaMenuSubgroupLabelsInOrder('south-america').includes('멕시코')).toBe(true)
    expect(megaMenuSubgroupLabelsInOrder('south-america').includes('중남미')).toBe(false)
  })
})
