/**
 * REGRESSION-FREEZE[register-pre-photo-pexels-keyword-must-hit]
 */
import { describe, expect, it } from 'vitest'
import {
  clearRegisterPrePhotoKeywordsFailingPlaceIdentityStatic,
  clearRegisterPrePhotoKeywordsMissingPexelsHit,
  collectScheduleImageKeywordsOnRoutedDays,
} from '@/lib/register-pre-photo-pexels-keyword-hit'
import { isRegisterPrePhotoParserFixIssue } from '@/lib/register-pre-photo-verify'

describe('register-pre-photo-pexels-keyword-must-hit', () => {
  it('clears keywords that Pexels hitMap marks false', () => {
    const notes: Array<{ day: number; field: string; reason: string }> = []
    const rows = clearRegisterPrePhotoKeywordsMissingPexelsHit(
      [
        { day: 1, imageKeyword: 'Eiffel Tower Paris', imageKeyword2: null },
        { day: 2, imageKeyword: 'Zzqx Nonexistent Landmark 99991', imageKeyword2: 'Louvre Museum' },
      ],
      new Map([
        ['Eiffel Tower Paris', true],
        ['Zzqx Nonexistent Landmark 99991', false],
        ['Louvre Museum', true],
      ]),
      notes,
    )
    expect(rows[0]?.imageKeyword).toBe('Eiffel Tower Paris')
    expect(rows[1]?.imageKeyword).toBe('Louvre Museum')
    expect(rows[1]?.imageKeyword2).toBeNull()
    expect(notes.some((n) => n.reason === 'keyword_pexels_miss')).toBe(true)
  })

  it('static place identity clears blocked white-walled and skips empty-route days for live collect', () => {
    const notes: Array<{ day: number; field: string; reason: string }> = []
    const rows = clearRegisterPrePhotoKeywordsFailingPlaceIdentityStatic(
      [
        {
          day: 1,
          routeText: '요나고 - 쿠라요시',
          imageKeyword: 'Kurayoshi White-walled Storehouses',
          imageKeyword2: null,
        },
        {
          day: 2,
          routeText: '',
          imageKeyword: 'Eiffel Tower',
          imageKeyword2: null,
        },
      ],
      notes,
    )
    expect(rows[0]?.imageKeyword).toBe('')
    expect(notes.some((n) => n.day === 1 && n.reason === 'keyword_pexels_miss')).toBe(true)
    const routed = collectScheduleImageKeywordsOnRoutedDays([
      { day: 1, routeText: '요나고 - 쿠라요시', imageKeyword: 'Kurayoshi Shirakabe Tottori Japan' },
      { day: 2, routeText: '', imageKeyword: 'ShouldNotProbe' },
    ])
    expect(routed).toEqual(['Kurayoshi Shirakabe Tottori Japan'])
  })

  it('treats keyword_pexels_miss as parserFixRequired', () => {
    expect(isRegisterPrePhotoParserFixIssue('day2_keyword_pexels_miss')).toBe(true)
    expect(isRegisterPrePhotoParserFixIssue('day1_route_empty')).toBe(true)
    expect(isRegisterPrePhotoParserFixIssue('day1_keyword_without_route')).toBe(true)
  })
})
