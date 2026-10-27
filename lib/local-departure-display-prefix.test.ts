import { describe, expect, it } from 'vitest'
import {
  applyLocalDepartureDisplayPrefix,
  applyLocalDeparturePrefixToHeroTitles,
  localDepartureTagsFromAirportDisplay,
  resolveDetailLocalDepartureTags,
  resolveDisplayLocalDepartureTags,
} from '@/lib/local-departure-display-prefix'

describe('resolveDisplayLocalDepartureTags', () => {
  it('uses localDepartureTag in canonical order, ignoring unknown values', () => {
    expect(resolveDisplayLocalDepartureTags({ localDepartureTag: ['daegu', 'x', 'busan'] })).toEqual(['busan', 'daegu'])
  })
  it('falls back to departureAirportLabel only when tags are empty', () => {
    expect(resolveDisplayLocalDepartureTags({ localDepartureTag: [], departureAirportLabel: 'jeju' })).toEqual(['jeju'])
    expect(resolveDisplayLocalDepartureTags({ localDepartureTag: ['busan'], departureAirportLabel: 'daegu' })).toEqual(['busan'])
  })
  it('gimpo / incheon / null give no prefix', () => {
    expect(resolveDisplayLocalDepartureTags({ localDepartureTag: [], departureAirportLabel: 'gimpo' })).toEqual([])
    expect(resolveDisplayLocalDepartureTags({ localDepartureTag: null, departureAirportLabel: null })).toEqual([])
    expect(resolveDisplayLocalDepartureTags(null)).toEqual([])
  })
  it('never infers from the title', () => {
    const src = { title: '[부산출발] 다낭 3박 5일', localDepartureTag: [] } as Parameters<typeof resolveDisplayLocalDepartureTags>[0]
    expect(resolveDisplayLocalDepartureTags(src)).toEqual([])
  })
})

describe('applyLocalDepartureDisplayPrefix', () => {
  it('adds prefix to short card titles', () => {
    expect(applyLocalDepartureDisplayPrefix('울란바타르 3박 5일', ['busan'])).toBe('[부산출발] 울란바타르 3박 5일')
    expect(applyLocalDepartureDisplayPrefix('태항산 4박 6일', ['daegu'])).toBe('[대구출발] 태항산 4박 6일')
    expect(applyLocalDepartureDisplayPrefix('다낭 4박 6일', ['jeju'])).toBe('[제주출발] 다낭 4박 6일')
  })
  it('does not duplicate when the name already starts with that city bracket', () => {
    expect(applyLocalDepartureDisplayPrefix('[부산출발] 몽골 울란바타르', ['busan'])).toBe('[부산출발] 몽골 울란바타르')
    expect(applyLocalDepartureDisplayPrefix('[청주출발+동선최소화] 울란바토르', ['cheongju'])).toBe(
      '[청주출발+동선최소화] 울란바토르',
    )
    expect(applyLocalDepartureDisplayPrefix('[부산항출발] 후쿠오카', ['busan'])).toBe('[부산항출발] 후쿠오카')
    expect(applyLocalDepartureDisplayPrefix('[김해출발] 세부', ['busan'])).toBe('[김해출발] 세부')
  })
  it('still prefixes when the city appears only mid-name', () => {
    expect(applyLocalDepartureDisplayPrefix('[NO유류인상][청주출발] 장가계 3박4일', ['cheongju'])).toBe(
      '[청주출발] [NO유류인상][청주출발] 장가계 3박4일',
    )
    expect(applyLocalDepartureDisplayPrefix('[NO유류인상][Semi-프리미엄+청주출발] 장가계', ['cheongju'])).toBe(
      '[청주출발] [NO유류인상][Semi-프리미엄+청주출발] 장가계',
    )
  })
  it('a different city bracket at the start does not satisfy the tag', () => {
    expect(applyLocalDepartureDisplayPrefix('[부산출발] 다낭', ['cheongju'])).toBe('[청주출발] [부산출발] 다낭')
  })
  it('multiple cities: only the missing ones are added, in canonical order', () => {
    expect(applyLocalDepartureDisplayPrefix('[대구출발] 나트랑', ['busan', 'daegu'])).toBe('[부산출발] [대구출발] 나트랑')
    expect(applyLocalDepartureDisplayPrefix('[부산출발][대구출발] 나트랑', ['busan', 'daegu'])).toBe('[부산출발][대구출발] 나트랑')
    expect(applyLocalDepartureDisplayPrefix('나트랑', ['daegu', 'busan'])).toBe('[부산출발] [대구출발] 나트랑')
  })
  it('no tags or empty title → unchanged', () => {
    expect(applyLocalDepartureDisplayPrefix('다낭 3박 5일', [])).toBe('다낭 3박 5일')
    expect(applyLocalDepartureDisplayPrefix('', ['busan'])).toBe('')
    expect(applyLocalDepartureDisplayPrefix('다낭', null)).toBe('다낭')
  })
  it('the word 출발 inside an airline/other bracket is not treated as a departure bracket', () => {
    expect(applyLocalDepartureDisplayPrefix('[제주항공] 다낭', ['jeju'])).toBe('[제주출발] [제주항공] 다낭')
  })
})

describe('detail helpers', () => {
  it('maps airport display text to tags', () => {
    expect(localDepartureTagsFromAirportDisplay('부산공항')).toEqual(['busan'])
    expect(localDepartureTagsFromAirportDisplay('김포공항')).toEqual([])
    expect(localDepartureTagsFromAirportDisplay(null)).toEqual([])
  })
  it('prefers localDepartureDisplayTags, falls back to departureAirportLabelDisplay (old cached payload)', () => {
    expect(resolveDetailLocalDepartureTags({ localDepartureDisplayTags: ['cheongju'], departureAirportLabelDisplay: '부산공항' })).toEqual([
      'cheongju',
    ])
    expect(resolveDetailLocalDepartureTags({ departureAirportLabelDisplay: '대구공항' })).toEqual(['daegu'])
    expect(resolveDetailLocalDepartureTags({ title: 'x' })).toEqual([])
  })
  it('prefixes hero and listing titles', () => {
    const r = applyLocalDeparturePrefixToHeroTitles(
      { heroTitle: '장가계 3박 4일', listingTitle: '[NO유류인상][청주출발] 장가계', heroSubtitle: null },
      ['cheongju'],
    )
    expect(r.heroTitle).toBe('[청주출발] 장가계 3박 4일')
    expect(r.listingTitle).toBe('[청주출발] [NO유류인상][청주출발] 장가계')
    expect(r.heroSubtitle).toBeNull()
  })
})
