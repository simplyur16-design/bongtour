/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot] — kyowontour prebuild
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { applyKyowontourScheduleImageKeywordsToRows } from '../lib/kyowontour-schedule-image-keyword'

function norm(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

describe('applyKyowontourScheduleImageKeywordsToRows', () => {
  it('관광 일차 routeText 2 POI → kw1/kw2 (1≠2)', () => {
    const out = applyKyowontourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '레',
          description: '레 왕궁과 레 시장',
          routeText: '레 - 레 왕궁 - 레 시장',
          imageKeyword: 'Leh Palace',
          imageKeyword2: null,
        },
      ],
      { productDestination: 'India' },
    )
    assert.ok(out[0]!.imageKeyword?.trim(), `kw1: ${out[0]!.imageKeyword}`)
    assert.ok(out[0]!.imageKeyword2?.trim(), `kw2: ${out[0]!.imageKeyword2}`)
    assert.notEqual(norm(out[0]!.imageKeyword!), norm(out[0]!.imageKeyword2!))
  })

  it('출발일 — imageKeyword2 null, 해외 도착지 우선(Seoul 아님)', () => {
    const out = applyKyowontourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '출발',
          description: '인천 국제공항 출발',
          routeText: '인천 - 레',
          imageKeyword: 'Leh',
          imageKeyword2: 'Leh Palace',
        },
      ],
      { productDestination: 'India' },
    )
    assert.equal(out[0]!.imageKeyword2, null)
    assert.ok(out[0]!.imageKeyword?.trim())
    assert.doesNotMatch(out[0]!.imageKeyword!, /Seoul/i)
  })

  it('Canada day1 — Calgary not Seoul', () => {
    const out = applyKyowontourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '캘거리 도착',
          description: '인천 출발 캘거리 도착',
          routeText: '인천 - 캘거리',
          imageKeyword: 'Seoul',
        },
      ],
      { productDestination: '캐나다' },
    )
    assert.match(out[0]!.imageKeyword!, /Calgary/i)
    assert.doesNotMatch(out[0]!.imageKeyword!, /Seoul/i)
  })

  it('Canada day3 tourism — Banff not International generic', () => {
    const out = applyKyowontourScheduleImageKeywordsToRows(
      [
        {
          day: 3,
          title: '아사바스카 폭포',
          description: '밴프 이동',
          routeText: '힌튼 - 아사바스카 폭포 - 밴프',
          imageKeyword: 'International City Travel Destination',
        },
      ],
      { productDestination: '캐나다' },
    )
    assert.match(out[0]!.imageKeyword!, /Athabasca|Banff/i)
    assert.doesNotMatch(out[0]!.imageKeyword!, /International|Seoul/i)
  })

  it('Maldives — movement day1 destination not airline; day2 not Leh; return not Incheon', () => {
    const out = applyKyowontourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '출발',
          description: '인천 국제공항에서 싱가포르항공을 이용하여 몰디브로',
          routeText: '인천',
          imageKeyword: 'Singapore Airlines',
        },
        {
          day: 2,
          title: '입성',
          description: '수상비행기로 몰디브 리조트 이동',
          routeText: '말레 - 르메르디앙 몰디브 리조트&스파',
          imageKeyword: 'Leh',
        },
        {
          day: 3,
          title: '스노클링',
          description: '하우스 리프 스노클링',
          routeText: '르메르디앙 몰디브 리조트&스파',
          imageKeyword: 'House Reef',
        },
        {
          day: 7,
          title: '귀국',
          description: '인천 국제공항 도착',
          routeText: '싱가포르 - 인천',
          imageKeyword: 'Incheon',
        },
      ],
      { productDestination: '몰디브' },
    )
    assert.match(out[0]!.imageKeyword!, /Maldives/i)
    assert.doesNotMatch(out[0]!.imageKeyword!, /Singapore|Airlines|Incheon/i)
    assert.match(out[1]!.imageKeyword!, /Maldives|Meridien/i)
    assert.doesNotMatch(out[1]!.imageKeyword!, /Leh/i)
    assert.equal(out[3]!.imageKeyword?.trim() ?? '', '')
    assert.equal(out[3]!.imageKeyword2, null)
  })

  it('Canada return day — last foreign landmark not Calgary Tower bleed', () => {
    const out = applyKyowontourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '캘거리',
          description: '캘거리 다운타운',
          routeText: '인천 - 캘거리 - 캘거리 다운타운',
          imageKeyword: 'Calgary Tower',
        },
        {
          day: 4,
          title: '레이크 루이스',
          description: '모레인 호수',
          routeText: '밴프 - 보우 폭포 - 레이크 루이스 - 모레인 호수 - 캘거리',
          imageKeyword: 'Lake Louise',
        },
        {
          day: 6,
          title: '인천 도착',
          description: '인천 국제공항 도착',
          routeText: '인천',
          imageKeyword: 'Calgary Tower',
        },
      ],
      { productDestination: '캐나다' },
    )
    assert.equal(out[2]!.imageKeyword?.trim() ?? '', '')
    assert.equal(out[2]!.imageKeyword2, null)
  })

  it('dedupe·route 폴백 없이도 관광 2일차 각각 kw2 채움', () => {
    const out = applyKyowontourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '레',
          description: '레 왕궁',
          routeText: '레 - 레 왕궁 - 레 시장',
          imageKeyword: 'Leh Palace',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '달',
          description: '달 호수',
          routeText: '달 - 판공초 사원',
          imageKeyword: 'Pangong Lake',
          imageKeyword2: null,
        },
      ],
      { productDestination: 'India', productTitle: '라다크' },
    )
    assert.ok(out[0]!.imageKeyword2?.trim(), `day2 kw2: ${out[0]!.imageKeyword2}`)
    assert.ok(out[1]!.imageKeyword?.trim(), `day3 kw1: ${out[1]!.imageKeyword}`)
  })
})
