import { describe, expect, it } from 'vitest'
import { buildBongtourRouteMapChain } from '@/lib/bongtour-route-map-chain-ssot'
import { buildBongtourRouteMapGeminiFallback } from '@/lib/bongtour-route-map-gemini-fallback'
import { generateBongtourRouteMapGemini } from '@/lib/bongtour-route-map-gemini-generate'
import { parseBongtourRouteMapGeminiText } from '@/lib/bongtour-route-map-gemini-parse'
import { buildBongtourRouteMapGeminiPrompt } from '@/lib/bongtour-route-map-gemini-prompt'
import {
  BONGTOUR_ROUTE_MAP_GEMINI_SAMPLE_DANANG,
  BONGTOUR_ROUTE_MAP_SAMPLE_CITIES,
  BONGTOUR_ROUTE_MAP_SAMPLE_SCHEDULE,
  buildBongtourRouteMapSampleInput,
} from '@/lib/bongtour-route-map-gemini-sample'
import { validateBongtourRouteMapGeminiDraft } from '@/lib/bongtour-route-map-gemini-validate'
import { inferBongtourRouteMapTransport } from '@/lib/bongtour-route-map-transport-ssot'

// REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: vitest — manifest

describe('bongtour-route-map-gemini-v1 geographic', () => {
  it('샘플 일정 체인', () => {
    const chain = buildBongtourRouteMapChain({ schedule: BONGTOUR_ROUTE_MAP_SAMPLE_SCHEDULE })
    expect(chain.cities).toEqual([...BONGTOUR_ROUTE_MAP_SAMPLE_CITIES])
  })

  it('샘플 draft 검증', () => {
    const v = validateBongtourRouteMapGeminiDraft(
      BONGTOUR_ROUTE_MAP_SAMPLE_CITIES,
      BONGTOUR_ROUTE_MAP_GEMINI_SAMPLE_DANANG
    )
    expect(v.ok).toBe(true)
    expect(BONGTOUR_ROUTE_MAP_GEMINI_SAMPLE_DANANG.layout).toBe('geographic')
    expect(BONGTOUR_ROUTE_MAP_GEMINI_SAMPLE_DANANG.edges[0]!.mode).toBe('cable_car')
  })

  it('도시 발명 거부', () => {
    const invent = validateBongtourRouteMapGeminiDraft(BONGTOUR_ROUTE_MAP_SAMPLE_CITIES, {
      ...BONGTOUR_ROUTE_MAP_GEMINI_SAMPLE_DANANG,
      nodes: [
        { order: 1, city: '다낭' },
        { order: 2, city: '호치민' },
        { order: 3, city: '호이안' },
      ],
    })
    expect(invent.ok).toBe(false)
  })

  it('좌표·형용사 거부', () => {
    const coords = validateBongtourRouteMapGeminiDraft(BONGTOUR_ROUTE_MAP_SAMPLE_CITIES, {
      ...BONGTOUR_ROUTE_MAP_GEMINI_SAMPLE_DANANG,
      nodes: BONGTOUR_ROUTE_MAP_GEMINI_SAMPLE_DANANG.nodes.map((n, i) =>
        i === 0 ? { ...n, lat: 16 } : n
      ),
    })
    expect(coords.ok).toBe(false)

    const fluff = validateBongtourRouteMapGeminiDraft(BONGTOUR_ROUTE_MAP_SAMPLE_CITIES, {
      ...BONGTOUR_ROUTE_MAP_GEMINI_SAMPLE_DANANG,
      routeSummary: '프리미엄 환상 동선',
    })
    expect(fluff.ok).toBe(false)
  })

  it('폴백은 원문 대형버스', () => {
    const fb = buildBongtourRouteMapGeminiFallback(['부다페스트', '프라하'], {
      schedule: [{ day: 1, title: '부다페스트', routeText: '부다페스트 - 프라하' }],
      sourceText: '45인승 이상 대형버스 이동',
    })
    expect(fb?.edges[0]?.mode).toBe('coach')
    expect(fb?.edges[0]?.label).toBe('대형버스')
  })

  it('프롬프트 skeleton·국내선', () => {
    const prompt = buildBongtourRouteMapGeminiPrompt(buildBongtourRouteMapSampleInput('다낭 4일'))
    expect(prompt).toContain('geographic')
    expect(prompt).toContain('domestic_flight')
    expect(prompt).toContain('skeleton=')
  })

  it('키 없으면 no_gemini_key', async () => {
    const prevG = process.env.GEMINI_API_KEY
    const prevO = process.env.GOOGLE_API_KEY
    delete process.env.GEMINI_API_KEY
    delete process.env.GOOGLE_API_KEY
    try {
      const r = await generateBongtourRouteMapGemini(buildBongtourRouteMapSampleInput('다낭 4일'))
      expect(r.ok).toBe(false)
      if (!r.ok) expect(r.reason).toBe('no_gemini_key')
    } finally {
      if (prevG !== undefined) process.env.GEMINI_API_KEY = prevG
      if (prevO !== undefined) process.env.GOOGLE_API_KEY = prevO
    }
  })

  it('펜스 JSON 파싱', () => {
    const fenced = ['```json', JSON.stringify(BONGTOUR_ROUTE_MAP_GEMINI_SAMPLE_DANANG), '```'].join(
      '\n'
    )
    expect(parseBongtourRouteMapGeminiText(BONGTOUR_ROUTE_MAP_SAMPLE_CITIES, fenced).ok).toBe(true)
  })

  it('일차 케이블카 추론', () => {
    const edges = inferBongtourRouteMapTransport(
      [...BONGTOUR_ROUTE_MAP_SAMPLE_CITIES],
      BONGTOUR_ROUTE_MAP_SAMPLE_SCHEDULE
    )
    expect(edges[0]!.mode).toBe('cable_car')
  })
})
