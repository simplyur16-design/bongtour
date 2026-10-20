import { describe, expect, it } from 'vitest'
import {
  buildBongtourRouteMapCitiesCaption,
  buildBongtourRouteMapImagePrompt,
  generateBongtourRouteMapImage,
} from '@/lib/bongtour-route-map-image'
import {
  buildBongtourRouteMapPinOverlaySvg,
  buildBongtourRouteMapSvg,
} from '@/lib/bongtour-route-map-svg-render'
import type { BongtourRouteMapGeminiDraft } from '@/lib/bongtour-route-map-gemini-types'

const draft: BongtourRouteMapGeminiDraft = {
  version: 'route-map-gemini-v1',
  layout: 'geographic',
  nodes: [
    { order: 1, city: '부다페스트' },
    { order: 2, city: '브르노' },
    { order: 3, city: '프라하' },
  ],
  edges: [
    { from: 1, to: 2, mode: 'coach', label: '대형버스' },
    { from: 2, to: 3, mode: 'coach', label: '대형버스' },
  ],
  routeSummary: '부다페스트 → 브르노 → 프라하',
}

describe('route map image', () => {
  it('caption is cities only', () => {
    expect(buildBongtourRouteMapCitiesCaption(draft)).toBe('부다페스트 → 브르노 → 프라하')
  })

  it('svg matches turkiye flat style: land, capsules, city names, country label', () => {
    const svg = buildBongtourRouteMapSvg(draft)
    expect(svg).toContain('#c5d6b4')
    expect(svg).toContain('#ffffff')
    expect(svg).toContain('#1a6fd4')
    expect(svg).toContain('CENTRAL EUROPE')
    expect(svg).toContain('부다페스트')
    expect(svg).toContain('브르노')
    expect(svg).toContain('프라하')
    expect(svg).toContain('약')
    expect(svg.match(/>1</g)?.length).toBe(1)
    expect(svg.match(/>2</g)?.length).toBe(1)
    expect(svg.match(/>3</g)?.length).toBe(1)
  })

  it('gemini prompt asks for blank recognizable map landmass only', () => {
    const p = buildBongtourRouteMapImagePrompt(draft)
    expect(p).toContain('BLANK tour-brochure political MAP')
    expect(p).toContain('ZERO pins')
    expect(p).toContain('ZERO numbers/digits')
    expect(p).toContain('Budapest, Hungary')
    expect(p).toMatch(/not a random blob/i)
    expect(p).not.toMatch(/basemap|leaflet|carto|arcgisonline/i)
  })

  it('pin overlay has each order digit once', () => {
    const svg = buildBongtourRouteMapPinOverlaySvg(draft, 1280, 720)
    expect(svg.match(/>1</g)?.length).toBe(1)
    expect(svg.match(/>2</g)?.length).toBe(1)
    expect(svg.match(/>3</g)?.length).toBe(1)
  })

  it('coach segments are straight; flight segments are curved', () => {
    const coachSvg = buildBongtourRouteMapPinOverlaySvg(draft, 1280, 720)
    expect(coachSvg).toMatch(/\sL\s/)
    expect(coachSvg).not.toMatch(/\sQ\s/)

    const flightDraft: BongtourRouteMapGeminiDraft = {
      ...draft,
      edges: [
        { from: 1, to: 2, mode: 'flight', label: '항공' },
        { from: 2, to: 3, mode: 'coach', label: '대형버스' },
      ],
    }
    const mixed = buildBongtourRouteMapPinOverlaySvg(flightDraft, 1280, 720)
    expect(mixed).toMatch(/\sQ\s/)
    expect(mixed).toMatch(/\sL\s/)
  })

  it('renders png (deterministic turkiye-flat svg)', async () => {
    const out = await generateBongtourRouteMapImage(draft)
    expect(out.ok).toBe(true)
    if (out.ok) {
      expect(out.source).toBe('deterministic_svg')
      expect(out.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
      expect(out.dataUrl.length).toBeGreaterThan(5000)
    }
  }, 30_000)
})
