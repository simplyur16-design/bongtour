import { describe, expect, it } from 'vitest'
import {
  AURORA_PRIMARY_IMAGE_KEYWORD,
  ensureAuroraPrimaryImageKeyword,
  imageKeywordMentionsAurora,
  isAuroraHuntingProductTitle,
} from '@/lib/register-aurora-primary-image-keyword'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { healRegisterPrePhotoSchedule } from '@/lib/register-pre-photo-self-heal'

describe('register-aurora-primary-image-keyword', () => {
  it('detects aurora product titles', () => {
    // REGRESSION-FREEZE[register-aurora-primary-image-keyword]
    expect(isAuroraHuntingProductTitle('『와라!보라!오로라!』아이슬란드 일주 8일')).toBe(true)
    expect(isAuroraHuntingProductTitle('옐로나이프 오로라')).toBe(true)
    expect(isAuroraHuntingProductTitle('아이슬란드 8일 #오로라헌팅')).toBe(true)
    expect(isAuroraHuntingProductTitle('아이슬란드 일주 8일')).toBe(false)
  })

  it('maps 오로라 빌리지 to Yellowknife aurora, not Laura Village AU', () => {
    // REGRESSION-FREEZE[register-aurora-primary-image-keyword]: 오로라≠로라 — manifest
    expect(firstMatchingScheduleSpotEn('올드타운 - 오로라 빌리지')).toMatch(/Aurora|Northern Lights|Yellowknife/i)
    expect(firstMatchingScheduleSpotEn('올드타운 - 오로라 빌리지')).not.toMatch(/Laura Village/i)
    expect(firstMatchingScheduleSpotEn('로라 빌리지')).toMatch(/Laura Village Blue Mountains/i)
  })

  it('injects primary aurora once when product is aurora hunting', () => {
    const rows = ensureAuroraPrimaryImageKeyword(
      [
        { day: 1, routeText: '옐로나이프 공항', imageKeyword: 'Yellowknife', imageKeyword2: null },
        {
          day: 2,
          routeText: '올드타운 - 오로라 빌리지',
          imageKeyword: 'Yellowknife Old Town',
          imageKeyword2: null,
        },
        {
          day: 3,
          routeText: '오로라 헌팅',
          imageKeyword: 'Prince of Wales Northern Heritage Centre',
          imageKeyword2: null,
        },
        { day: 4, routeText: '공항', imageKeyword: 'Yellowknife', imageKeyword2: null },
      ],
      '옐로나이프 오로라',
    )
    const primaries = rows.map((r) => String(r.imageKeyword ?? ''))
    expect(primaries.filter((k) => imageKeywordMentionsAurora(k))).toHaveLength(1)
    const auroraDay = rows.find((r) => imageKeywordMentionsAurora(r.imageKeyword))
    expect(auroraDay?.day).toBe(2)
    expect(auroraDay?.imageKeyword).toBe(AURORA_PRIMARY_IMAGE_KEYWORD)
    expect(String(auroraDay?.imageKeyword2 ?? '')).toMatch(/Old Town/i)
  })

  it('keeps existing primary aurora', () => {
    const rows = ensureAuroraPrimaryImageKeyword(
      [
        { day: 1, routeText: '레이캬비크', imageKeyword: 'Reykjavik', imageKeyword2: null },
        {
          day: 2,
          routeText: '오로라 헌팅',
          imageKeyword: 'Northern Lights aurora sky',
          imageKeyword2: null,
        },
      ],
      '아이슬란드 #오로라',
    )
    expect(rows[1]?.imageKeyword).toBe('Northern Lights aurora sky')
    expect(rows[0]?.imageKeyword).toBe('Reykjavik')
  })

  it('FIT heal also injects aurora primary (not package-only)', () => {
    // REGRESSION-FREEZE[register-aurora-primary-image-keyword]: FIT도 오로라 primary — manifest
    const healed = healRegisterPrePhotoSchedule(
      [
        { day: 1, routeText: '옐로나이프 공항', imageKeyword: 'Yellowknife', imageKeyword2: null },
        {
          day: 2,
          routeText: '올드타운 - 오로라 빌리지',
          imageKeyword: 'Laura Village Blue Mountains',
          imageKeyword2: null,
        },
        {
          day: 3,
          routeText: '오로라 헌팅',
          imageKeyword: 'Prince of Wales Northern Heritage Centre',
          imageKeyword2: null,
        },
        { day: 4, routeText: '공항', imageKeyword: 'Yellowknife', imageKeyword2: null },
      ],
      {
        supplierKey: 'hanatour',
        productDestination: '옐로나이프',
        productTitle: '옐로나이프 오로라',
        lane: 'air_hotel_free',
      },
    )
    expect(healed.rows.some((r) => imageKeywordMentionsAurora(r.imageKeyword))).toBe(true)
    expect(healed.rows.find((r) => Number(r.day) === 2)?.imageKeyword).not.toMatch(/Laura Village/i)
  })
})
