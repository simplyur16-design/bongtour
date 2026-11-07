/**
 * REGRESSION-FREEZE[package-supplier-fact-schedule-rebuild]: 대기열 힐이 공급사 팩트로 일정요약·설명을 다시 만든다 — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  mergePackageSupplierScheduleRows,
  packageSupplierFactDaysToSchedule,
} from '@/lib/register-pre-photo-package-supplier-rematerialize'
import type { CanonicalOverseasSupplierKey } from '@/lib/overseas-supplier-canonical-keys'
import type { RegisterFactScheduleDay } from '@/lib/register-facts/types'

const INVENTED = /체크아웃\s*후[^.。]{0,24}귀국합니다/u
const SUPPLIERS: CanonicalOverseasSupplierKey[] = [
  'hanatour',
  'modetour',
  'ybtour',
  'verygoodtour',
  'kyowontour',
  'lottetour',
  'naeiltour',
]

function days(): RegisterFactScheduleDay[] {
  return [
    { day: 1, places: ['홍콩', '소호'], hotels: [], meals: [], transportNote: null },
    { day: 2, places: ['인천'], hotels: [], meals: [], transportNote: null, supplierText: '인천공항 도착' },
  ]
}

describe('automatic supplier-fact schedule rebuild', () => {
  it.each(SUPPLIERS)('%s builds a return day without the invented checkout sentence', (supplier) => {
    const rows = packageSupplierFactDaysToSchedule(supplier, days(), '홍콩 3일')
    expect(rows?.length).toBe(2)
    const last = rows!.find((r) => r.day === 2)!
    expect(String(last.description ?? '')).not.toMatch(INVENTED)
  })

  it('keeps 원문 보기 while replacing the summary', () => {
    const original = { items: [{ name: '자이승전망대', note: '공급사 카드' }] }
    const merged = mergePackageSupplierScheduleRows(
      [{ day: 3, title: '3일차', description: '체크아웃 후 인천으로 귀국합니다.', imageUrl: 'https://cdn.example/a.jpg', supplierOriginal: original }],
      [{ day: 3, title: '자이승전망대', description: '자이승전망대를 둘러봅니다.', routeText: '자이승전망대', supplierOriginal: original }],
    )
    expect(merged[0]?.description).toBe('자이승전망대를 둘러봅니다.')
    expect(merged[0]?.imageUrl).toBe('https://cdn.example/a.jpg')
    expect(merged[0]?.supplierOriginal).toEqual(original)
  })
})