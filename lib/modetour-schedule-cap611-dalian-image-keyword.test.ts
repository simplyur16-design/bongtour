/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 대련·여순 CAP611 — 성해/러시아거리·연화산 일차 오매핑 금지 — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'

const CAP611_ROWS = [
  {
    day: 1,
    title: '대련',
    description: '',
    routeText: '대련 - 동항 - 동방수성 - 성해광장 - 서안로 먹자거리',
    imageKeyword: '',
    imageKeyword2: null as string | null,
  },
  {
    day: 2,
    title: '여순',
    description: '',
    routeText:
      '대련 - 여순관동법원 - 여순감옥 - 여순 기차역 (외부관람) - 대련 동관거리 - 연화산 전망대',
    imageKeyword: '',
    imageKeyword2: null as string | null,
  },
  {
    day: 3,
    title: '러시아거리',
    description: '',
    routeText: '대련 - 러시아거리',
    imageKeyword: '',
    imageKeyword2: null as string | null,
  },
]

describe('modetour CAP611 Dalian imageKeyword', () => {
  it('maps day POIs — no D1 Yanhuashan bleed; 동관≠Russian; D3 Russian Street', () => {
    expect(firstMatchingScheduleSpotEn('성해광장')).toMatch(/Xinghai/i)
    expect(firstMatchingScheduleSpotEn('러시아거리')).toMatch(/Russian\s*Street/i)
    expect(firstMatchingScheduleSpotEn('대련 동관거리')).toMatch(/Dongguan/i)
    expect(firstMatchingScheduleSpotEn('대련 동관거리')).not.toMatch(/Russian/i)
    expect(firstMatchingScheduleSpotEn('연화산 전망대')).toMatch(/Yanhuashan/i)

    const out = applyRegisterScheduleImageKeywordsBySupplier(CAP611_ROWS, {
      supplierKey: 'modetour',
      productDestination: '대련',
      productTitle: '대련+여순(뤼순) 3일<노쇼핑/안중근발자취>',
    })
    const pairs = out.map((r) => [String(r.imageKeyword ?? ''), String(r.imageKeyword2 ?? '')] as const)

    expect(pairs[0]!.join(' ')).toMatch(/Xinghai|Oriental|Xian\s*Road|Donggang/i)
    expect(pairs[0]!.join(' ')).not.toMatch(/Yanhuashan|Lushun|Russian/i)

    expect(pairs[1]!.join(' ')).toMatch(/Lushun|Yanhuashan|Dongguan|Prison|Court/i)
    expect(pairs[1]!.join(' ')).not.toMatch(/Russian\s*Street/i)

    expect(pairs[2]![0]).toMatch(/Russian\s*Street/i)
    expect(pairs[2]!.join(' ')).not.toMatch(/Yanhuashan/i)
  })
})
