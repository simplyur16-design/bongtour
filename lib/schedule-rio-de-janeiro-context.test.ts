/**
 * REGRESSION-FREEZE[schedule-rio-de-janeiro-context]: bare 리우/Rio 금지 — manifest
 */
import { describe, expect, it } from 'vitest'

import { hasRioDeJaneiroContext } from '@/lib/schedule-rio-de-janeiro-context'
import { applyYbtourScheduleImageKeywordsToRows } from '@/lib/ybtour-schedule-image-keyword'
import { fillRegisterScheduleMiddleDayImageKeywordGaps } from '@/lib/register-schedule-trip-image-keyword-dedupe'

describe('schedule-rio-de-janeiro-context', () => {
  it('불리우는·헐리우드 — 리우 부분문자열 false', () => {
    expect(hasRioDeJaneiroContext('빈의 혼이라 불리우는 성 슈테판 대성당')).toBe(false)
    expect(hasRioDeJaneiroContext('헐리우드 로드')).toBe(false)
    expect(hasRioDeJaneiroContext('프라하 - 인천')).toBe(false)
  })

  it('리우데자네이로·Corcovado — true', () => {
    expect(hasRioDeJaneiroContext('리우데자네이로 코르코바도')).toBe(true)
    expect(hasRioDeJaneiroContext('Rio de Janeiro Christ the Redeemer')).toBe(true)
    expect(hasRioDeJaneiroContext('브라질')).toBe(true)
  })

  it('EKP3057-like — 불리우는 일정에 Sugar Loaf Brazil 금지', () => {
    const base = [
      {
        day: 1,
        title: '출발',
        routeText: '[인천 - 프라하]',
        description: 'x',
        imageKeyword: '',
        imageKeyword2: null as string | null,
      },
      {
        day: 9,
        title: '쉔부른',
        routeText:
          '오스트리아의 베르사유궁전이라 불리는 쉔부른궁전 - 빈의 혼이라 불리우는 성 슈테판 대성당 - 프라하 야경',
        description: 'x',
        imageKeyword: '',
        imageKeyword2: null as string | null,
      },
      {
        day: 11,
        title: '귀국',
        routeText: '[프라하 - 인천 : 약 11시간 20분 소요]',
        description: 'x',
        imageKeyword: '',
        imageKeyword2: null as string | null,
      },
    ]
    const applied = applyYbtourScheduleImageKeywordsToRows(base, '유럽')
    const out = fillRegisterScheduleMiddleDayImageKeywordGaps(applied)
    for (const r of out) {
      const blob = `${r.imageKeyword ?? ''}\n${r.imageKeyword2 ?? ''}`
      expect(blob, `day ${r.day}`).not.toMatch(
        /Sugar\s*Loaf|Rio\s*de\s*Janeiro|\bBrazil\b|Christ\s*the\s*Redeemer/i,
      )
    }
  })
})
