import { describe, expect, it } from 'vitest'
import { matchMegaMenuCityKeysInHaystack } from '@/lib/mega-menu-master-city-keys'
import { megaMenuPlacementForCityKey, resetMegaMenuCityPlacementCache } from '@/lib/mega-menu-city-group-coherence'
import { matchProductToOverseasNode } from '@/lib/match-overseas-product'
import { resolveOverseasDisplayBucketForBrowse } from '@/lib/overseas-display-buckets'
import { resolveOverseasMegaMenuSubgroupLabelForBrowse } from '@/lib/overseas-mega-region-city-group'
import { healRegisterDestinationLabel, isRegisterDestinationPollutionLabel } from '@/lib/register-destination-finalize'
import { isBannedOptionalTourName } from '@/lib/optional-tour-row-gate-ybtour'

// REGRESSION-FREEZE[mega-menu-misc6-geo]: 잔여 6건·잔여석 dest·옵션 소요시간 — manifest
describe('mega-menu misc6 geo + seat dest + ybtour duration ban', () => {
  it('옌타이 → yantai · china_hk_mo · 산동', () => {
    resetMegaMenuCityPlacementCache()
    expect(matchMegaMenuCityKeysInHaystack('[2인출발보장]옌타이 골프 3일')).toContain('yantai')
    expect(megaMenuPlacementForCityKey('yantai')?.menuGroupSlug).toBe('shandong')
    const m = matchProductToOverseasNode({
      title: '[2인출발보장]옌타이 골프 3일',
      originSource: 'hanatour',
      primaryDestination: '옌타이',
      destination: '옌타이',
      cityKey: 'yantai',
    })
    expect(
      resolveOverseasDisplayBucketForBrowse(
        { title: '옌타이 골프', primaryDestination: '옌타이', destination: '옌타이', cityKey: 'yantai' },
        m,
      ),
    ).toBe('china_hk_mo')
  })

  it('태항산 cityKey taihang → china_hk_mo (not other)', () => {
    resetMegaMenuCityPlacementCache()
    expect(matchMegaMenuCityKeysInHaystack('보천+태항대협곡/천계산/팔리구_5일')).toContain('taihang')
    expect(megaMenuPlacementForCityKey('taihang')?.regionId).toBe('china-hk-mo')
    expect(
      resolveOverseasDisplayBucketForBrowse(
        {
          title: '보천+태항대협곡/천계산/팔리구_5일',
          primaryDestination: '태항산',
          destination: '태항산',
          cityKey: 'taihang',
        },
        matchProductToOverseasNode({
          title: '보천+태항대협곡/천계산/팔리구_5일',
          originSource: 'verygoodtour',
          primaryDestination: '태항산',
          destination: '태항산',
          cityKey: 'taihang',
        }),
      ),
    ).toBe('china_hk_mo')
  })

  it('브루나이 → sea_taiwan · subgroup 브루나이 (not 기타)', () => {
    resetMegaMenuCityPlacementCache()
    expect(megaMenuPlacementForCityKey('brunei')?.regionId).toBe('southeast-asia')
    const product = {
      title: '[ 청정국가 브루나이 5일',
      primaryDestination: '브루나이',
      destination: '브루나이',
      cityKey: 'brunei',
      originSource: 'verygoodtour',
    }
    const m = matchProductToOverseasNode(product)
    expect(resolveOverseasDisplayBucketForBrowse(product, m)).toBe('sea_taiwan')
    expect(resolveOverseasMegaMenuSubgroupLabelForBrowse(product, m, 'southeast-asia', '브루나이')).toBe(
      '브루나이',
    )
  })

  it('쏙쏙도쿄 접두 붙여쓰기 → tokyo · japan', () => {
    resetMegaMenuCityPlacementCache()
    expect(matchMegaMenuCityKeysInHaystack('[부산출발] 핵심쏙쏙도쿄 2박3일 우리만')).toContain('tokyo')
    expect(
      resolveOverseasDisplayBucketForBrowse(
        {
          title: '[부산출발] 핵심쏙쏙도쿄 2박3일 우리만',
          primaryDestination: '도쿄',
          destination: '도쿄',
          cityKey: 'tokyo',
        },
        matchProductToOverseasNode({
          title: '[부산출발] 핵심쏙쏙도쿄 2박3일 우리만',
          originSource: 'naeiltour',
          primaryDestination: '도쿄',
          destination: '도쿄',
          cityKey: 'tokyo',
        }),
      ),
    ).toBe('japan')
  })

  it('dest 잔여석 scrub — 지명만 남김', () => {
    expect(isRegisterDestinationPollutionLabel('잔여④석 · 비즈니스 · 클래스')).toBe(true)
    expect(healRegisterDestinationLabel({ current: '스위스 (잔여②석)', title: '스위스 일주 10일' })).toBe('스위스')
    expect(healRegisterDestinationLabel({ current: '도쿄 (잔여5석 · 치바)', title: '도쿄 3일' })).toMatch(/도쿄/)
    expect(healRegisterDestinationLabel({ current: '프랑스 (잔여②석 · 대한항공)', title: '프랑스 8일' })).toBe(
      '프랑스',
    )
  })

  it('ybtour bans 약 1시간~1시간 반 duration fragment', () => {
    expect(isBannedOptionalTourName('약 1시간~1시간 반')).toBe(true)
    expect(isBannedOptionalTourName('약 15~30분')).toBe(true)
    expect(isBannedOptionalTourName('비용CAD')).toBe(true)
    expect(isBannedOptionalTourName('캐필라노 서스펜션 브릿지')).toBe(false)
  })
})
