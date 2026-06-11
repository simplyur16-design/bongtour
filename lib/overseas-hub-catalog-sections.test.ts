import { describe, expect, it } from 'vitest'
import {
  buildOverseasHubCatalogSections,
  buildOverseasHubCatalogSectionsForUrl,
  buildOverseasHubMegaSubgroupSections,
} from '@/lib/overseas-hub-catalog-sections'
import type { ResultItem } from '@/components/products/ProductResultsList'

function item(
  partial: Partial<ResultItem> & { id: string; title: string },
): ResultItem {
  return partial as ResultItem
}

describe('buildOverseasHubCatalogSections', () => {
  it('groups items by overseas bucket in display order', () => {
    const sections = buildOverseasHubCatalogSections([
      item({ id: 'a', title: 'a', overseasBucket: 'japan' }),
      item({ id: 'b', title: 'b', overseasBucket: 'sea_taiwan' }),
      item({ id: 'c', title: 'c', overseasBucket: 'japan' }),
    ])
    expect(sections.map((s) => s.key)).toEqual(['bucket:sea_taiwan', 'bucket:japan'])
    expect(sections[0]?.items).toHaveLength(1)
    expect(sections[1]?.items).toHaveLength(2)
  })

  it('returns empty array when no items', () => {
    expect(buildOverseasHubCatalogSections([])).toEqual([])
  })
})

describe('buildOverseasHubMegaSubgroupSections', () => {
  it('splits japan products into mega subgroups', () => {
    const sections = buildOverseasHubMegaSubgroupSections(
      [
        item({
          id: '1',
          title: '삿포로 5일',
          primaryDestination: '삿포로',
          browseMegaSubgroupLabel: '홋카이도',
        }),
        item({
          id: '2',
          title: '오사카 4일',
          primaryDestination: '오사카',
          browseMegaSubgroupLabel: '간사이',
        }),
      ],
      'japan',
    )
    expect(sections.map((s) => s.label)).toEqual(['홋카이도', '간사이'])
    expect(sections[0]?.key).toBe('mega:japan:홋카이도')
  })
})

describe('buildOverseasHubCatalogSectionsForUrl', () => {
  it('uses buckets on default hub URL', () => {
    const sections = buildOverseasHubCatalogSectionsForUrl(
      [item({ id: 'a', title: 'a', overseasBucket: 'japan' })],
      new URLSearchParams('scope=overseas'),
    )
    expect(sections[0]?.key).toBe('bucket:japan')
    expect(sections[0]?.label).toBe('일본')
  })

  it('uses mega subgroups when only region tab is set', () => {
    const sections = buildOverseasHubCatalogSectionsForUrl(
      [
        item({
          id: '1',
          title: '삿포로',
          primaryDestination: '삿포로',
          browseMegaSubgroupLabel: '홋카이도',
          overseasBucket: 'japan',
        }),
        item({
          id: '2',
          title: '오사카',
          primaryDestination: '오사카',
          browseMegaSubgroupLabel: '간사이',
          overseasBucket: 'japan',
        }),
      ],
      new URLSearchParams('scope=overseas&region=japan'),
    )
    expect(sections.map((s) => s.label)).toEqual(['홋카이도', '간사이'])
    expect(sections.every((s) => s.key.startsWith('mega:japan:'))).toBe(true)
  })

  it('uses sports theme subgroups when region=sports_theme', () => {
    const sections = buildOverseasHubCatalogSectionsForUrl(
      [
        item({ id: '1', title: '골프 일본', sportsThemeTags: ['golf'] }),
        item({ id: '2', title: '러닝 파리', sportsThemeTags: ['running'] }),
      ],
      new URLSearchParams('scope=overseas&region=sports_theme'),
    )
    expect(sections.map((s) => s.label)).toEqual(['러닝', '골프'])
    expect(sections.every((s) => s.key.startsWith('sports:'))).toBe(true)
  })

  it('uses country flat heading when country param is set', () => {
    const sections = buildOverseasHubCatalogSectionsForUrl(
      [item({ id: 'a', title: '방콕', browseCountry: 'thailand', overseasBucket: 'sea_taiwan' })],
      new URLSearchParams('scope=overseas&region=southeast-asia&country=thailand'),
    )
    expect(sections).toHaveLength(1)
    expect(sections[0]?.key).toBe('country:thailand')
    expect(sections[0]?.label).toBe('태국')
  })
})
