/**
 * REGRESSION-FREEZE[home-seo-travel-index]: 홈은 색인·여행 키워드 — manifest
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  HOME_PAGE_DESCRIPTION,
  HOME_PAGE_H1,
  HOME_PAGE_KEYWORDS,
  HOME_PAGE_ROBOTS,
  HOME_PAGE_TITLE,
  buildHomePageMetadata,
} from '../lib/home-page-metadata'
import { buildSiteJsonLdGraph } from '../lib/seo/site-json-ld'

describe('home-seo-travel-index', () => {
  it('제목·설명·H1에 해외여행 패키지·자유여행이 들어간다', () => {
    assert.match(HOME_PAGE_TITLE, /해외여행/)
    assert.match(HOME_PAGE_TITLE, /패키지/)
    assert.match(HOME_PAGE_TITLE, /자유여행/)
    assert.match(HOME_PAGE_DESCRIPTION, /해외여행/)
    assert.match(HOME_PAGE_DESCRIPTION, /패키지/)
    assert.match(HOME_PAGE_DESCRIPTION, /자유여행/)
    assert.match(HOME_PAGE_H1, /해외여행/)
    assert.ok(HOME_PAGE_KEYWORDS.includes('해외여행'))
    assert.ok(HOME_PAGE_KEYWORDS.includes('자유여행'))
  })

  it('홈 H1은 화면에 보이지 않는다', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app/components/seo/HomeDocumentH1.tsx'),
      'utf8',
    )
    assert.match(src, /sr-only/)
    assert.doesNotMatch(src, /text-center/)
  })

  it('PC·모바일 홈 메타는 색인을 연다', () => {
    const meta = buildHomePageMetadata([{ url: '/og/default.webp', alt: 'Bong투어' }])
    const robots = meta.robots
    assert.equal(typeof robots, 'object')
    assert.ok(robots && typeof robots === 'object' && !Array.isArray(robots))
    const r = robots as { index?: boolean; follow?: boolean }
    assert.equal(r.index, true)
    assert.equal(r.follow, true)
    // index: true — 모바일 홈 noindex 회귀 방지
    assert.equal(
      Boolean(HOME_PAGE_ROBOTS && typeof HOME_PAGE_ROBOTS === 'object' && !Array.isArray(HOME_PAGE_ROBOTS) && HOME_PAGE_ROBOTS.index),
      true,
    )
    assert.equal(meta.alternates?.canonical, '/')
  })

  it('홈 JSON-LD에 TravelAgency와 여행 서비스 목록이 있다', () => {
    const graph = buildSiteJsonLdGraph()
    const nodes = graph['@graph']
    assert.ok(Array.isArray(nodes))
    const types = nodes.map((n) => (n as { '@type'?: string })['@type'])
    assert.ok(types.includes('TravelAgency'))
    assert.ok(types.includes('WebPage'))
    assert.ok(types.includes('ItemList'))
    const agency = nodes.find((n) => (n as { '@type'?: string })['@type'] === 'TravelAgency') as {
      knowsAbout?: string[]
    }
    assert.ok(agency.knowsAbout?.some((x) => x.includes('해외여행')))
  })
})
