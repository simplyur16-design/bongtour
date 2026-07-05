/**
 * REGRESSION-FREEZE[register-schedule-mongolia-image-keyword]: departure kw2 null — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleRouteTextKeywordsWithSupplierFallback } from '@/lib/register-schedule-image-keywords-route-supplier-merge'

describe('register-schedule-image-keywords-route-supplier-merge', () => {
  it('keeps departure kw2 null when routeText SSOT already set kw1', () => {
    const rows = [
      {
        day: 1,
        routeText: '아리야발 사원 - 테렐지 국립공원 - 거북 바위',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        routeText: '테렐지 국립공원 - MIRAGE TOURIST CAMP - 초원 승마체험',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ]
    const out = applyRegisterScheduleRouteTextKeywordsWithSupplierFallback(rows, {
      supplierKey: 'hanatour',
      productDestination: '몽골',
    })
    const d1 = out.find((r) => r.day === 1)
    expect(String(d1?.imageKeyword ?? '').trim().length).toBeGreaterThan(0)
    expect(String(d1?.imageKeyword2 ?? '').trim()).toBe('')
  })
})
