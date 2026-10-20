/**
 * M0 샘플 — geographic + transport (실호출 아님).
 * REGRESSION-FREEZE[bongtour-route-map-gemini-v1]: sample danang — manifest
 */

import { validateBongtourRouteMapGeminiDraft } from '@/lib/bongtour-route-map-gemini-validate'
import type {
  BongtourRouteMapGeminiDraft,
  BongtourRouteMapGeminiInput,
  BongtourRouteMapGeminiScheduleDay,
} from '@/lib/bongtour-route-map-gemini-types'

export const BONGTOUR_ROUTE_MAP_SAMPLE_SCHEDULE: BongtourRouteMapGeminiScheduleDay[] = [
  {
    day: 1,
    title: '다낭 도착',
    routeText: '인천 - 다낭',
    description: '오후 다낭 국제공항 도착 후 시내 호텔 체크인.',
  },
  {
    day: 2,
    title: '바나힐 당일',
    routeText: '다낭 - 바나힐 - 다낭',
    description: '케이블카로 바나힐 이동. 골든브릿지 관람 후 다낭 복귀.',
  },
  {
    day: 3,
    title: '호이안 야경',
    routeText: '다낭 - 호이안',
    description: '전용차량으로 호이안 구시가지.',
  },
  {
    day: 4,
    title: '귀국',
    routeText: '다낭 - 인천',
    description: '다낭 공항 출국.',
  },
]

export const BONGTOUR_ROUTE_MAP_SAMPLE_CITIES = ['다낭', '바나힐', '호이안'] as const

const RAW = {
  version: 'route-map-gemini-v1',
  layout: 'geographic',
  nodes: [
    { order: 1, city: '다낭' },
    { order: 2, city: '바나힐' },
    { order: 3, city: '호이안' },
  ],
  edges: [
    { from: 1, to: 2, mode: 'cable_car', label: '케이블카' },
    { from: 2, to: 3, mode: 'private_car', label: '전용차량' },
  ],
  routeSummary: '다낭 —케이블카→ 바나힐 —전용차량→ 호이안',
}

const validated = validateBongtourRouteMapGeminiDraft(BONGTOUR_ROUTE_MAP_SAMPLE_CITIES, RAW)
if (!validated.ok) {
  throw new Error(`route-map sample invalid: ${validated.reason} ${validated.detail ?? ''}`)
}

export const BONGTOUR_ROUTE_MAP_GEMINI_SAMPLE_DANANG: BongtourRouteMapGeminiDraft = validated.draft

export function buildBongtourRouteMapSampleInput(heroShortTitle: string): BongtourRouteMapGeminiInput {
  return {
    productId: 'MOCK-DANANG-01',
    heroShortTitle,
    cities: [...BONGTOUR_ROUTE_MAP_SAMPLE_CITIES],
    schedule: BONGTOUR_ROUTE_MAP_SAMPLE_SCHEDULE,
  }
}
