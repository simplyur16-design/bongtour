/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 북유럽 ENP121 — Preikestolen·십자가언덕·레르달 — manifest
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: L&aelig;rdal HTML entity → æ — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { cleanRegisterScheduleRoutePlaceLabel } from '@/lib/register-schedule-route-place-noise'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'

describe('kyowontour ENP121 Nordic imageKeyword mapping', () => {
  it('decodes L&aelig;rdal and maps Preikestolen / Hill of Crosses', () => {
    expect(cleanRegisterScheduleRoutePlaceLabel('레르달L&aelig;rdal')).toMatch(/Lærdal|Laerdal|레르달/i)
    expect(firstMatchingScheduleSpotEn('프레이케스톨렌')).toMatch(/Preikestolen|Pulpit/i)
    expect(firstMatchingScheduleSpotEn('십자가의 언덕')).toMatch(/Hill\s*of\s*Crosses/i)
    expect(firstMatchingScheduleSpotEn('레르달Lærdal')).toMatch(/Laerdal/i)
  })

  it('Day5 Preikestolen not empty; Day8 Stockholm ≠ Bergen Bryggen bleed', () => {
    const rows = [
      {
        day: 4,
        title: '레르달',
        description: '',
        routeText: '레르달L&aelig;rdal - 플롬 열차 - 브뤼겐 거리 - 베르겐 어시장 - 헤우게순',
        imageKeyword: '',
        imageKeyword2: null as string | null,
      },
      {
        day: 5,
        title: '프레이케스톨론',
        description: '',
        routeText:
          '헤우게순/프레이케스톨론트래킹/스타방에르 - 노르웨이/보크나피오르드 - 노르웨이/프레이케스톨렌 - 노르웨이/뤼세피오르드 - 뤼세피요르드 - 크비네스달',
        imageKeyword: '',
        imageKeyword2: null as string | null,
      },
      {
        day: 8,
        title: '스톡홀름 시청',
        description: '',
        routeText:
          '스톡홀름 시청 - 스웨덴 왕궁 - 감라스탄 - 바이킹라인 또는 실자라인 탑승 후 투르크 - 바이킹 또는 실자라인',
        imageKeyword: '',
        imageKeyword2: null as string | null,
      },
      {
        day: 10,
        title: '십자가의 언덕',
        description: '',
        routeText: '십자가의 언덕 - 리투아니아/트라카이 - 트라카이 성 - 라트비아/빌뉴스',
        imageKeyword: '',
        imageKeyword2: null as string | null,
      },
    ]

    const out = applyRegisterScheduleImageKeywordsBySupplier(rows, {
      supplierKey: 'kyowontour',
      productDestination: '북유럽',
      productTitle: '북유럽&발트 7개국 12일',
    })

    const d5 = out.find((r) => r.day === 5)!
    expect(String(d5.imageKeyword ?? '')).toMatch(/Preikestolen|Pulpit|Stavanger|Haugesund/i)
    expect(`${d5.imageKeyword} ${d5.imageKeyword2}`).not.toMatch(/Bryggen/i)

    const d8 = out.find((r) => r.day === 8)!
    expect(String(d8.imageKeyword ?? '')).toMatch(/Stockholm|Gamla|City\s*Hall|Royal\s*Palace/i)
    expect(`${d8.imageKeyword} ${d8.imageKeyword2}`).not.toMatch(/Bryggen|Bergen|Stavanger|Preikestolen|Haugesund/i)
    expect(String(d8.imageKeyword2 ?? '')).toMatch(/Stockholm|Gamla|City\s*Hall|Royal\s*Palace/i)

    const d10 = out.find((r) => r.day === 10)!
    expect(`${d10.imageKeyword} ${d10.imageKeyword2}`).toMatch(/Hill\s*of\s*Crosses|Trakai/i)
  })
})
