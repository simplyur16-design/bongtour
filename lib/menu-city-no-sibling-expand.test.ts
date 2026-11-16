import { describe, expect, it } from 'vitest'
import {
  expandBrowseCityFilterKeys,
  menuCityKeysOnly,
} from '@/lib/cluster-city-expansions'
import { resolveBrowseCityKeysForFilter } from '@/lib/browse-country-url-resolve'

describe('menu city does not expand to sibling cities', () => {
  // REGRESSION-FREEZE[menu-city-no-sibling-expand]: 메뉴 도시는 형제 키로 안 펼침 — manifest
  it('하얼빈·끄라비·중경·심양·요코하마는 다른 도시 키를 넣지 않는다', () => {
    expect(menuCityKeysOnly('harbin', expandBrowseCityFilterKeys(['harbin', 'dalian-harbin']))).toEqual(['harbin'])
    expect(menuCityKeysOnly('krabi', expandBrowseCityFilterKeys(['krabi', 'phuket']))).toEqual(['krabi'])
    expect(menuCityKeysOnly('chongqing', expandBrowseCityFilterKeys(['chongqing', 'chengdu', 'sichuan']))).toEqual([
      'chongqing',
    ])
    expect(menuCityKeysOnly('shenyang', expandBrowseCityFilterKeys(['shenyang', 'yanji', 'changchun']))).toEqual([
      'shenyang',
    ])
    expect(resolveBrowseCityKeysForFilter('yokohama')).toEqual(['yokohama'])
    expect(resolveBrowseCityKeysForFilter('yokohama')).not.toContain('yamanashi')
  })

  it('클러스터 노드 슬러그는 구성 도시를 유지한다', () => {
    const keys = expandBrowseCityFilterKeys(['yokohama-kamakura'])
    expect(keys).toEqual(expect.arrayContaining(['yokohama', 'kamakura', 'yamanashi']))
    expect(menuCityKeysOnly('yokohama-kamakura', keys)).toEqual(expect.arrayContaining(['yokohama', 'kamakura']))
  })
})
