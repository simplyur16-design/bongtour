import { describe, expect, it } from 'vitest'
import { mapMatchToOverseasDisplayBucket, resolveOverseasDisplayBucketForBrowse } from '@/lib/overseas-display-buckets'
import { deriveProductLocationKeyFieldsForPrisma } from '@/lib/product-location-key-match'

describe('deriveProductLocationKeyFieldsForPrisma — 미서부 패키지', () => {
  it('목적지가 특전 한 줄이어도 일정 본문으로 americas 매칭', () => {
    const geo = deriveProductLocationKeyFieldsForPrisma({
      title: '5대캐년 9일',
      originSource: 'verygoodtour',
      primaryDestination: '세도나캐년숙박',
      destinationRaw: '세도나캐년숙박',
      bodyText: [
        'DAY 1 샌프란시스코',
        'DAY 2 요세미티 국립공원',
        'DAY 5 라스베이거스',
        'DAY 6 그랜드캐년',
      ].join('\n'),
    })
    expect(geo.groupKey).toBe('americas')
    expect(geo.countryKey).toBe('usa-west')
    expect(mapMatchToOverseasDisplayBucket({
      scope: 'leaf',
      groupKey: geo.groupKey!,
      countryKey: geo.countryKey!,
      leafKey: geo.nodeKey!,
      groupLabel: '',
      countryLabel: '미국 서부',
      leafLabel: '',
      matchedTerm: '샌프란시스코',
    })).toBe('americas')
  })
})

describe('resolveOverseasDisplayBucketForBrowse — 미서부 키워드', () => {
  it('매칭 실패(other)여도 본문에 5대캐년이면 americas', () => {
    const bucket = resolveOverseasDisplayBucketForBrowse(
      {
        title: '5대캐년 9일',
        originSource: 'verygoodtour',
        primaryDestination: '세도나캐년숙박',
      },
      null,
    )
    expect(bucket).toBe('americas')
  })
})

describe('deriveProductLocationKeyFieldsForPrisma — 인도네시아', () => {
  it('자카르타/족자카르타 제목으로 동남아(indonesia) 매칭', () => {
    const geo = deriveProductLocationKeyFieldsForPrisma({
      title: '자카르타/족자카르타 6일 · 따만미니케이블카',
      originSource: 'verygoodtour',
      primaryDestination: '노쇼핑 · 노옵션 · 노팁',
      destinationRaw: '노쇼핑 · 노옵션 · 노팁',
      bodyText: 'DAY 1 인천-자카르타\nDAY 2 자카르타-족자카르타\n보로부두르',
    })
    expect(geo.groupKey).toBe('sea-taiwan-south-asia')
    expect(geo.countryKey).toBe('indonesia')
    expect(['jakarta', 'yogyakarta']).toContain(geo.nodeKey)
  })
})
