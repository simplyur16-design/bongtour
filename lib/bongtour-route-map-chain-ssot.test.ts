import { describe, expect, it } from 'vitest'
import {
  BONGTOUR_ROUTE_MAP_MAX_CITIES,
  buildBongtourRouteMapChain,
  normalizeBongtourRouteMapCityLabel,
} from '@/lib/bongtour-route-map-chain-ssot'

// REGRESSION-FREEZE[bongtour-ocean-warm-design-l0]: buildBongtourRouteMapChain — manifest

describe('buildBongtourRouteMapChain', () => {
  it('일정 route 순서·허브 제외·중복 제거', () => {
    const chain = buildBongtourRouteMapChain({
      schedule: [
        { day: 1, title: '출국', routeText: '인천 - 다낭' },
        { day: 2, title: '다낭', routeText: '다낭 - 호이안 - 다낭' },
        { day: 3, title: '호이안', routeText: '호이안' },
        { day: 4, title: '귀국', routeText: '다낭 - 인천' },
      ],
    })
    expect(chain.cities).toEqual(['다낭', '호이안'])
    expect(chain.showMapTab).toBe(true)
  })

  it('도시 0–1개면 showMapTab false', () => {
    const one = buildBongtourRouteMapChain({
      schedule: [{ day: 1, routeText: '인천 - 괌' }, { day: 2, routeText: '괌' }],
    })
    expect(one.cities).toEqual(['괌'])
    expect(one.showMapTab).toBe(false)

    const empty = buildBongtourRouteMapChain({ schedule: [] })
    expect(empty.showMapTab).toBe(false)
  })

  it('schedule 없으면 destination 폴백', () => {
    const chain = buildBongtourRouteMapChain({
      schedule: null,
      destination: '프라하, 부다페스트',
    })
    expect(chain.cities[0]).toBe('프라하')
    expect(chain.showMapTab).toBe(false)
  })

  it('다국가 체인', () => {
    const chain = buildBongtourRouteMapChain({
      schedule: [
        { day: 1, routeText: '인천 - 프라하' },
        { day: 2, routeText: '프라하' },
        { day: 3, routeText: '프라하 - 빈' },
        { day: 4, routeText: '빈 - 부다페스트' },
        { day: 5, routeText: '부다페스트 - 인천' },
      ],
    })
    expect(chain.cities).toEqual(['프라하', '빈', '부다페스트'])
    expect(chain.showMapTab).toBe(true)
  })

  it('title · 분리·야경/광장 정리·귀국 제외', () => {
    const chain = buildBongtourRouteMapChain({
      schedule: [
        { day: 1, title: '부다페스트 · 브르노' },
        { day: 2, title: '프라하 야경 · 영웅 광장' },
        { day: 3, title: '숙박 없음(귀국)' },
      ],
    })
    expect(normalizeBongtourRouteMapCityLabel('프라하 야경')).toBe('프라하')
    expect(chain.cities).toEqual(['부다페스트', '브르노', '프라하'])
    expect(chain.showMapTab).toBe(true)
  })

  it(`도시 상한 ${BONGTOUR_ROUTE_MAP_MAX_CITIES}`, () => {
    const schedule = Array.from({ length: 20 }, (_, i) => ({
      day: i + 1,
      routeText: `도시${i + 1}`,
    }))
    const chain = buildBongtourRouteMapChain({ schedule })
    expect(chain.citiesRaw.length).toBe(20)
    expect(chain.cities).toHaveLength(BONGTOUR_ROUTE_MAP_MAX_CITIES)
  })
})
