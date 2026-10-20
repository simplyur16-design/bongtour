/**
 * REGRESSION-FREEZE[register-pre-photo-pexels-keyword-must-hit]
 */
import { describe, expect, it } from 'vitest'
import {
  distinctivePlaceTokensFromImageKeyword,
  evaluatePexelsKeywordPlacePhotoSamples,
  imageKeywordHasPlaceIdentity,
  resolvePexelsImageKeywordForSearch,
} from '@/lib/pexels-keyword-place-photo-hit'

describe('pexels-keyword-place-photo-hit', () => {
  it('rejects Kurayoshi white-walled when Pexels returns Newhall lumber (wrong place)', () => {
    // legacy raw (blocklisted) — no place identity after resolve still fails samples path
    const legacy = evaluatePexelsKeywordPlacePhotoSamples('Kurayoshi White-walled Storehouses', [
      {
        alt: 'Newhall Lumber Company warehouse with white walls in California',
        url: 'https://www.pexels.com/photo/newhall-lumber-123/',
      },
      {
        alt: 'White walled industrial storehouses',
        url: 'https://www.pexels.com/photo/warehouse-456/',
      },
    ])
    // remapped search keyword should still reject USA lumber vs Japan place
    const remapped = evaluatePexelsKeywordPlacePhotoSamples('Kurayoshi Shirakabe Tottori Japan', [
      {
        alt: 'Newhall Lumber Company warehouse with white walls in California',
        url: 'https://www.pexels.com/photo/newhall-lumber-123/',
      },
      {
        alt: 'White industrial buildings in Los Angeles',
        url: 'https://www.pexels.com/photo/la-warehouse-456/',
      },
      {
        alt: 'Empty white wall facade',
        url: 'https://www.pexels.com/photo/wall-789/',
      },
    ])
    expect(legacy.ok).toBe(false)
    expect(remapped.ok).toBe(false)
    expect(remapped.reason).toBe('wrong_place')
  })

  it('accepts Eiffel Tower when alt mentions the place', () => {
    const v = evaluatePexelsKeywordPlacePhotoSamples('Eiffel Tower', [
      {
        alt: 'The Eiffel Tower in Paris under blue sky',
        url: 'https://www.pexels.com/photo/eiffel-tower-paris-1/',
      },
    ])
    expect(v.ok).toBe(true)
    expect(v.searchKeyword).toMatch(/Eiffel/i)
  })

  it('accepts Tokyo Disneyland when Tokyo hits exist even if Paris Disney mixes in', () => {
    const v = evaluatePexelsKeywordPlacePhotoSamples('Tokyo Disneyland', [
      {
        alt: 'Statue of Walt Disney and Mickey Mouse in front of Cinderella Castle, Tokyo Disneyland.',
        url: 'https://www.pexels.com/photo/disneyland-tokyo-mickey-and-castle-view-35644024/',
      },
      {
        alt: 'Vibrant Disney characters in a parade at Disneyland Paris',
        url: 'https://www.pexels.com/photo/colorful-disney-parade-at-disneyland-paris-28505388/',
      },
      {
        alt: 'Vibrant Disneyland Paris parade with iconic Disney mascot characters',
        url: 'https://www.pexels.com/photo/colorful-disney-parade-at-disneyland-paris-28505392/',
      },
    ])
    expect(v.ok).toBe(true)
  })

  it('accepts Wat Arun when alts are Bangkok scene without hard wrong-geo', () => {
    const v = evaluatePexelsKeywordPlacePhotoSamples('Wat Arun', [
      {
        alt: 'Skyline view of Bangkok highlighting traditional Thai architecture amidst modern buildings.',
        url: 'https://www.pexels.com/photo/bangkok-skyline-1/',
      },
    ])
    expect(imageKeywordHasPlaceIdentity('Wat Arun')).toBe(true)
    expect(v.ok).toBe(true)
  })

  it('rejects empty samples and unresolved Hangul keywords', () => {
    expect(evaluatePexelsKeywordPlacePhotoSamples('Eiffel Tower', []).ok).toBe(false)
    expect(evaluatePexelsKeywordPlacePhotoSamples('에펠탑만있는키워드', []).reason).toMatch(
      /unresolved_script|empty|no_place_identity/,
    )
  })

  it('keeps landmark/city identity; maps Hangul city; rejects blocked white-walled', () => {
    expect(imageKeywordHasPlaceIdentity('Tower Bridge')).toBe(true)
    expect(imageKeywordHasPlaceIdentity('Yu Garden')).toBe(true)
    expect(imageKeywordHasPlaceIdentity('Ba Na Hills')).toBe(true)
    expect(imageKeywordHasPlaceIdentity('Paris')).toBe(true)
    expect(imageKeywordHasPlaceIdentity('Kurayoshi White-walled Storehouses')).toBe(false)
    expect(resolvePexelsImageKeywordForSearch('아부다비')).toMatch(/Abu Dhabi/i)
    expect(imageKeywordHasPlaceIdentity('아부다비')).toBe(true)
  })

  it('resolves legacy Kurayoshi white-walled to Shirakabe Tottori Japan', () => {
    expect(resolvePexelsImageKeywordForSearch('Kurayoshi White-walled Storehouses')).toBe(
      'Kurayoshi Shirakabe Tottori Japan',
    )
    expect(distinctivePlaceTokensFromImageKeyword('Kurayoshi Shirakabe Tottori Japan').length).toBeGreaterThan(
      0,
    )
  })
})
