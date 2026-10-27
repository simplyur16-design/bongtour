import { describe, expect, it } from 'vitest'
import {
  applyLocalDepartureDisplayPrefix,
  applyLocalDeparturePrefixToHeroTitles,
  countLocalDepartureMentions,
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
  it('mid-name city: one prefix at the front, the other occurrence removed (pkg-hn-0136/0137 style)', () => {
    expect(
      applyLocalDepartureDisplayPrefix('[NO유류인상][청주출발]장가계직항 4일#다드림 #관광지 중심 월드체인 5성호텔', ['cheongju']),
    ).toBe('[청주출발] [NO유류인상] 장가계직항 4일#다드림 #관광지 중심 월드체인 5성호텔')
    expect(
      applyLocalDepartureDisplayPrefix('[NO유류인상][Semi-프리미엄+청주출발]장가계/원가계 5일#천문호선쇼 #대협곡', ['cheongju']),
    ).toBe('[청주출발] [NO유류인상][Semi-프리미엄]장가계/원가계 5일#천문호선쇼 #대협곡')
  })
  it('combined bracket: removes only that part plus its joiner, drops an emptied bracket', () => {
    expect(applyLocalDepartureDisplayPrefix('장가계 [특가/청주출발/노팁]', ['cheongju'])).toBe('[청주출발] 장가계 [특가/노팁]')
    expect(applyLocalDepartureDisplayPrefix('장가계 [청주출발, 노쇼핑]', ['cheongju'])).toBe('[청주출발] 장가계 [노쇼핑]')
    expect(applyLocalDepartureDisplayPrefix('다낭 [청주공항 출발 특가]', ['cheongju'])).toBe('[청주출발] 다낭 [특가]')
    expect(applyLocalDepartureDisplayPrefix('다낭 [ #청주출발 ] 5일', ['cheongju'])).toBe('[청주출발] 다낭 5일')
  })
  it('hashtag, plain text and time-of-day forms are removed (city+출발 token only)', () => {
    expect(applyLocalDepartureDisplayPrefix('싱가포르 5일 #부산오전출발 #싱가포르항공', ['busan'])).toBe(
      '[부산출발] 싱가포르 5일 #싱가포르항공',
    )
    expect(applyLocalDepartureDisplayPrefix('장가계 4일 #청주출발 #노팁', ['cheongju'])).toBe('[청주출발] 장가계 4일 #노팁')
    expect(applyLocalDepartureDisplayPrefix('청주출발 장가계 4일', ['cheongju'])).toBe('[청주출발] 장가계 4일')
    expect(applyLocalDepartureDisplayPrefix('나트랑 대구출발/부산출발', ['busan', 'daegu'])).toBe('[부산출발] [대구출발] 나트랑')
  })
  it('leading bracket that already contains it is kept; later duplicates are removed', () => {
    expect(applyLocalDepartureDisplayPrefix('[청주출발+동선최소화]몽골 울란바토르 3박5일 #청주출발', ['cheongju'])).toBe(
      '[청주출발+동선최소화]몽골 울란바토르 3박5일',
    )
    expect(applyLocalDepartureDisplayPrefix('[부산출발] 다낭 [부산출발]', ['busan'])).toBe('[부산출발] 다낭')
    expect(applyLocalDepartureDisplayPrefix('[부산출발][부산출발] 다낭', ['busan'])).toBe('[부산출발] 다낭')
  })
  it('never removes other cities, airline names or foreign departures', () => {
    expect(applyLocalDepartureDisplayPrefix('[제주항공] 다낭 #오사카출발 [부산출발]', ['jeju'])).toBe(
      '[제주출발] [제주항공] 다낭 #오사카출발 [부산출발]',
    )
    expect(applyLocalDepartureDisplayPrefix('[청주출발] 장가계 #대구출발', ['cheongju'])).toBe('[청주출발] 장가계 #대구출발')
  })
  it('invariant: each tag city appears exactly once, at the front', () => {
    const names = [
      '[NO유류인상][청주출발]장가계직항 4일',
      '[NO유류인상][Semi-프리미엄+청주출발]장가계',
      '[청주출발+동선최소화]몽골 #청주출발 청주출발',
      '장가계 [특가/청주출발/노팁] #청주공항출발',
      '청주 오전출발 장가계',
      '장가계 청주오전출발',
      '장가계 3박 4일',
    ]
    for (const n of names) {
      const out = applyLocalDepartureDisplayPrefix(n, ['cheongju'])
      expect(countLocalDepartureMentions(out, 'cheongju'), out).toBe(1)
      expect(out.match(/^\[([^\]]*)\]/)?.[1] ?? '', out).toMatch(/청주출발/)
      expect(out, out).not.toMatch(/\[\s*\]|\s{2,}|^\s|\s$/)
    }
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
    expect(r.listingTitle).toBe('[청주출발] [NO유류인상] 장가계')
    expect(r.heroSubtitle).toBeNull()
  })
})
