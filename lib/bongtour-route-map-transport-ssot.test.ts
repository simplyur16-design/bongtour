import { describe, expect, it } from 'vitest'
import {
  formatBongtourRouteMapTransportSummary,
  inferBongtourRouteMapTransport,
  inferPackageLandTransportDefault,
  inferTransportModeFromText,
  transportLabelForMode,
} from '@/lib/bongtour-route-map-transport-ssot'

// REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: transport vitest — manifest

describe('inferBongtourRouteMapTransport', () => {
  it('국내선 → domestic_flight 라벨', () => {
    expect(inferTransportModeFromText('김포 국내선 이동 후 제주')).toBe('domestic_flight')
    expect(transportLabelForMode('domestic_flight')).toBe('국내선 이동')
  })

  it('원문 대형버스 — 전용차량 아님', () => {
    const src = '1. 왕복항공요금 2. 45인승 이상 대형버스 이동 3. 전문 인솔자 동행'
    const land = inferPackageLandTransportDefault(src)
    expect(land?.mode).toBe('coach')
    expect(land?.label).toBe('대형버스')

    const cities = ['부다페스트', '브르노', '프라하']
    const edges = inferBongtourRouteMapTransport(
      cities,
      [
        { day: 1, title: '부다페스트 · 브르노', description: '시내 관광' },
        { day: 2, title: '브르노 · 프라하', description: '프라하 성' },
      ],
      { sourceText: src }
    )
    expect(edges.every((e) => e.mode === 'coach')).toBe(true)
    expect(edges[0]!.label).toBe('대형버스')
    expect(edges.some((e) => e.mode === 'private_car')).toBe(false)
    expect(formatBongtourRouteMapTransportSummary(cities, edges)).toContain('대형버스')
  })

  it('전용차량은 원문에 있을 때만', () => {
    expect(inferTransportModeFromText('전용차량으로 이동')).toBe('private_car')
    expect(inferTransportModeFromText('차량이나 배 등 이동 수단')).toBeNull()
    const edges = inferBongtourRouteMapTransport(
      ['다낭', '호이안'],
      [{ day: 1, title: '다낭 - 호이안', description: '시내' }],
      { sourceText: '전용차량 이동 포함' }
    )
    expect(edges[0]!.mode).toBe('private_car')
    expect(edges[0]!.label).toBe('전용차량')
  })

  it('단서 없으면 transfer — 추측 금지', () => {
    const edges = inferBongtourRouteMapTransport(['프라하', '빈'], [
      { day: 1, title: '프라하', description: '시내 관광' },
      { day: 2, title: '빈', description: '궁전 관람' },
    ])
    expect(edges[0]!.mode).toBe('transfer')
    expect(edges[0]!.inferredFromSchedule).toBe(false)
  })

  it('케이블카는 일차 텍스트', () => {
    const edges = inferBongtourRouteMapTransport(
      ['다낭', '바나힐'],
      [
        {
          day: 2,
          title: '다낭 - 바나힐',
          description: '케이블카로 바나힐 이동',
        },
      ]
    )
    expect(edges[0]!.mode).toBe('cable_car')
  })
})
