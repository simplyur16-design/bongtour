import { describe, expect, it } from 'vitest'
import {
  expandBrowseCityFilterKeys,
  menuCityKeysOnly,
} from '@/lib/cluster-city-expansions'
import { resolveBrowseCityKeysForFilter } from '@/lib/browse-country-url-resolve'

describe('menu city does not expand to sibling cities', () => {
  // REGRESSION-FREEZE[menu-city-no-sibling-expand]: 메뉴 도시는 형제 키로 안 펼침 — manifest
  it('하얼빈·끄라비·중경·심양·요코하마 leaf는 형제 도시·클러스터 노드 없이 자기 키만 남긴다', () => {
    const harbin = resolveBrowseCityKeysForFilter('harbin')
    expect(harbin).toContain('harbin')
    expect(harbin).not.toContain('dalian-harbin')
    expect(harbin).not.toContain('dalian')
    const krabi = resolveBrowseCityKeysForFilter('krabi')
    expect(krabi).toContain('krabi')
    expect(krabi).not.toContain('phuket-krabi-khaolak')
    expect(krabi).not.toContain('phuket')
    const chongqing = resolveBrowseCityKeysForFilter('chongqing')
    expect(chongqing).toContain('chongqing')
    expect(chongqing).not.toContain('sichuan')
    expect(chongqing).not.toContain('chengdu')
    expect(chongqing).not.toContain('jiuzhaigou')
    const shenyang = resolveBrowseCityKeysForFilter('shenyang')
    expect(shenyang).toContain('shenyang')
    expect(shenyang).not.toContain('changbai')
    expect(shenyang).not.toContain('yanji')
    expect(shenyang).not.toContain('changchun')
    const yokohama = resolveBrowseCityKeysForFilter('yokohama')
    expect(yokohama).toContain('yokohama')
    expect(yokohama).not.toContain('yokohama-kamakura')
    expect(yokohama).not.toContain('yamanashi')
    expect(yokohama).not.toContain('kamakura')
    const toya = resolveBrowseCityKeysForFilter('toya')
    expect(toya).toContain('toya')
    expect(toya).toContain('toya-jozankei')
    expect(toya).toContain('jozankei')
  })

  it('클러스터 노드 슬러그는 구성 도시를 유지한다', () => {
    const keys = expandBrowseCityFilterKeys(['yokohama-kamakura'])
    expect(keys).toEqual(expect.arrayContaining(['yokohama', 'kamakura', 'yamanashi']))
    expect(menuCityKeysOnly('yokohama-kamakura', keys)).toEqual(expect.arrayContaining(['yokohama', 'kamakura']))
  })
})
