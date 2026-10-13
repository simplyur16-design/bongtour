/**
 * REGRESSION-FREEZE[register-schedule-mongolia-turtle-rock-terelj]: Pexels 실측 검색어 — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  isAnimalTurtlePexelsHit,
  isOffTripInnerMongoliaPexelsHit,
  isWrongGeoForMongoliaTurtleRockPexelsHit,
  MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD,
  mongoliaTurtleRockPexelsRelevanceDelta,
  qualifyMongoliaTurtleRockPexelsKeyword,
} from '@/lib/register-schedule-mongolia-turtle-rock-pexels'
import { englishFromScheduleKoreanSegment } from '@/lib/register-schedule-llm-image-keyword-fallback'
import { buildHeroPexelsQuerySet } from '@/lib/pexels-hero-query'
import { finalizeScheduleImageKeyword } from '@/lib/pexels-place-name-keyword'

describe('mongolia turtle rock pexels keyword', () => {
  it('maps 거북이바위 / bare Turtle Rock to live-proven Terelj Rocky Hills', () => {
    expect(qualifyMongoliaTurtleRockPexelsKeyword('Turtle Rock')).toBe(
      MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD,
    )
    expect(qualifyMongoliaTurtleRockPexelsKeyword('Turtle Rock Terelj Mongolia')).toBe(
      MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD,
    )
    expect(qualifyMongoliaTurtleRockPexelsKeyword('Melkhii Khad')).toBe(
      MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD,
    )
    expect(qualifyMongoliaTurtleRockPexelsKeyword('Terelj Mongolia rocky landscape')).toBe(
      MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD,
    )
    expect(qualifyMongoliaTurtleRockPexelsKeyword('Terelj Mongolia Rocky')).toBe(
      MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD,
    )
    expect(englishFromScheduleKoreanSegment('거북이바위')).toBe(MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD)
    expect(englishFromScheduleKoreanSegment('거북 바위')).toBe(MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD)
    expect(MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD).toBe('Terelj Mongolia Rocky Hills')
    expect(finalizeScheduleImageKeyword(MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD)).toBe(
      MONGOLIA_TURTLE_ROCK_PEXELS_KEYWORD,
    )
  })

  it('hero query set uses Rocky Hills primary and Melkhii/Formation secondaries', () => {
    const q = buildHeroPexelsQuerySet({
      stem: 'Turtle Rock',
      city: null,
      destination: '몽골',
    })
    expect(q.primaryQuery).toBe('Terelj Mongolia Rocky Hills')
    expect(q.primaryQuery).not.toMatch(/^Turtle Rock$/i)
    expect(q.secondaryQueries.some((s) => /Melkhii Khad Terelj/i.test(s))).toBe(true)
    expect(q.secondaryQueries.some((s) => /Rock Formation|rock formation/i.test(s))).toBe(true)
  })

  it('rejects animal turtle, Inner Mongolia, arkhangai, Chechnya', () => {
    expect(
      isAnimalTurtlePexelsHit('Group of turtles basking in the sun on a rock in a tranquil pond.'),
    ).toBe(true)
    expect(
      isAnimalTurtlePexelsHit(
        'A scenic autumn view with horses and rider amidst rocky hills in Ulaanbaatar, Mongolia.',
      ),
    ).toBe(false)
    expect(isOffTripInnerMongoliaPexelsHit('Xilingol grassland Inner Mongolia')).toBe(true)
    expect(
      isWrongGeoForMongoliaTurtleRockPexelsHit(
        'arkhangai-province-ikh-tamir-sum-north-tamir-valley-mongolia-28103660',
      ),
    ).toBe(true)
    expect(
      isWrongGeoForMongoliaTurtleRockPexelsHit(
        'Stunning view of unique rock formations in Chechnya, Russia, on a sunny day.',
      ),
    ).toBe(true)
    expect(
      isWrongGeoForMongoliaTurtleRockPexelsHit(
        'A scenic autumn view with horses and rider amidst rocky hills in Ulaanbaatar, Mongolia.',
      ),
    ).toBe(false)
  })

  it('relevance ranks rocky-hills 31694814 above arkhangai yurt and camel tourism', () => {
    const rock31694814 = mongoliaTurtleRockPexelsRelevanceDelta(
      'Breathtaking rocky landscape with light cloud cover and dry terrain. https://www.pexels.com/photo/scenic-view-of-rocky-hills-under-cloudy-sky-31694814/',
    )
    const camel30240842 = mongoliaTurtleRockPexelsRelevanceDelta(
      'A scenic autumn view with horses and rider amidst rocky hills and trees in Ulaanbaatar, Mongolia. https://www.pexels.com/photo/a-scenic-autumn-view-with-horses-and-rider-amidst-rocky-hills-and-trees-in-ulaanbaatar-mongolia-30240842/',
    )
    const yurt28103660 = mongoliaTurtleRockPexelsRelevanceDelta(
      'A wide shot of the Mongolian steppe featuring a yurt and grazing sheep below rugged mountains. https://www.pexels.com/photo/arkhangai-province-ikh-tamir-sum-north-tamir-valley-2024-08-01-mongolia-28103660/',
    )
    const chechnya = mongoliaTurtleRockPexelsRelevanceDelta(
      'Stunning view of unique rock formations in Chechnya, Russia, on a sunny day.',
    )
    expect(yurt28103660.hardReject).toBe(true)
    expect(chechnya.hardReject).toBe(true)
    expect(rock31694814.hardReject).toBe(false)
    expect(camel30240842.hardReject).toBe(false)
    expect(rock31694814.delta).toBeGreaterThan(camel30240842.delta)
    expect(rock31694814.delta).toBeGreaterThan(40)

    const grasslandOutcrop = mongoliaTurtleRockPexelsRelevanceDelta(
      'A breathtaking view of expansive grasslands under a bright blue sky, featuring a rugged rocky outcrop. https://www.pexels.com/photo/scenic-view-of-vast-grasslands-and-rocky-outcrop-30109532/',
    )
    expect(rock31694814.delta).toBeGreaterThan(grasslandOutcrop.delta)
    expect(
      isWrongGeoForMongoliaTurtleRockPexelsHit(
        'Beautiful landscape of rolling hills under a cloudy blue sky in Ulanqab, China.',
      ),
    ).toBe(true)
  })
})
