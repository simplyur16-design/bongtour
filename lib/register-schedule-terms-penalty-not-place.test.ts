/**
 * REGRESSION-FREEZE[register-schedule-terms-penalty-not-place]: 위약금·특약 절 ≠ day 지명 — manifest
 */
import { describe, expect, it } from 'vitest'
import {
  isRegisterScheduleTermsOrPenaltyClause,
  stripCounselingTermsFromScheduleRow,
  stripCounselingTermsFromScheduleText,
} from '@/lib/itinerary-counseling-terms-strip'
import { applyLottetourScheduleExpressionToRows } from '@/lib/lottetour-register-api-schedule'
import { healRegisterPrePhotoSchedule } from '@/lib/register-pre-photo-self-heal'
import { verifyRegisterPrePhoto } from '@/lib/register-pre-photo-verify'

describe('register-schedule-terms-penalty-not-place', () => {
  it('detects and strips 특약·위약금 별도적용 from day fields', () => {
    const clause = '특약에 따라 위약금이 별도 적용'
    expect(isRegisterScheduleTermsOrPenaltyClause(clause)).toBe(true)
    expect(isRegisterScheduleTermsOrPenaltyClause('위약금조항')).toBe(true)
    expect(isRegisterScheduleTermsOrPenaltyClause('상세보기')).toBe(true)
    expect(isRegisterScheduleTermsOrPenaltyClause('소요시간 : 약 1시간')).toBe(true)
    expect(isRegisterScheduleTermsOrPenaltyClause('리우데자네이루')).toBe(false)
    expect(stripCounselingTermsFromScheduleText(clause)).toBe('')
    const row = stripCounselingTermsFromScheduleRow({
      title: clause,
      routeText: clause,
      description: `인천에서 출발해 ${clause}에서 도착합니다.`,
    })
    expect(row.title).toBe('')
    expect(row.routeText).toBe('')
    expect(row.description).not.toMatch(/위약금/)
  })

  it('lottetour expression does not keep penalty clause as day title/route', () => {
    const out = applyLottetourScheduleExpressionToRows([
      {
        day: 1,
        title: '특약에 따라 위약금이 별도 적용',
        routeText: '특약에 따라 위약금이 별도 적용',
        description:
          '인천에서 출발해 특약에 따라 위약금이 별도 적용에서 도착합니다. 특약에 따라 위약금이 별도 적용에서 첫날 일정을 이어갑니다.',
        imageKeyword: 'Copacabana Beach Rio de Janeiro',
      },
      {
        day: 2,
        title: '리우데자네이루',
        routeText: '리우데자네이루 - 코파카바나',
        description: '리우데자네이루와 코파카바나를 둘러봅니다.',
        imageKeyword: 'Christ the Redeemer Rio de Janeiro',
      },
    ])
    const d1 = out[0]!
    expect(String(d1.title ?? '')).not.toMatch(/위약금|특약/)
    expect(String(d1.routeText ?? '')).not.toMatch(/위약금|특약/)
    expect(String(d1.description ?? '')).not.toMatch(/위약금|특약/)
  })

  it('verify fails on penalty clause and heal clears it', () => {
    const poisoned = [
      {
        day: 1,
        title: '특약에 따라 위약금이 별도 적용',
        routeText: '특약에 따라 위약금이 별도 적용',
        description:
          '인천에서 출발해 특약에 따라 위약금이 별도 적용에서 도착합니다. 첫날 리듬을 맞추며 일정을 이어갑니다.',
        imageKeyword: 'Copacabana Beach Rio de Janeiro',
        imageKeyword2: null as string | null,
      },
      {
        day: 2,
        title: '리우데자네이루',
        routeText: '리우데자네이루 - 코파카바나',
        description: '리우데자네이루와 코파카바나를 둘러봅니다. 코파카바나에서 주를 이어 둘러봅니다.',
        imageKeyword: 'Christ the Redeemer Rio de Janeiro',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '귀국',
        routeText: '리우데자네이루',
        description: '인천으로 귀국합니다. 이동 중심으로 마무리합니다.',
        imageKeyword: 'Rio de Janeiro',
        imageKeyword2: null,
      },
    ]
    const before = verifyRegisterPrePhoto({
      lane: 'package',
      productTitle: '남미 퍼펙트 일주 4개국 18일',
      productDestination: '중남미',
      countryKey: 'latin-caribbean',
      rows: poisoned,
    })
    expect(before.issues.some((i) => i.includes('terms_clause'))).toBe(true)

    const healed = healRegisterPrePhotoSchedule(poisoned, {
      supplierKey: 'lottetour',
      productDestination: '중남미',
      productTitle: '남미 퍼펙트 일주 4개국 18일',
      lane: 'package',
      countryKey: 'latin-caribbean',
    })
    const d1 = healed.rows.find((r) => r.day === 1)!
    expect(String(d1.title ?? '')).not.toMatch(/위약금|특약/)
    expect(String(d1.routeText ?? '')).not.toMatch(/위약금|특약/)
    expect(String(d1.description ?? '')).not.toMatch(/위약금|특약/)
    expect(healed.notes.some((n) => n.reason === 'terms_penalty_clause_scrub')).toBe(true)
  })
})
