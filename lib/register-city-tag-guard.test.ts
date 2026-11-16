import { describe, expect, it } from 'vitest'
import { clusterCityKeysForNode } from '@/lib/cluster-city-expansions'
import {
  buildRegisterCityVisitHaystackFromSchedule,
  haystackCityKeyHasVisitEvidence,
} from '@/lib/register-city-tag-guard'

const LEGIT = [
  { key: 'cz', terms: ['프라하', '체코'] },
  { key: 'hu', terms: ['부다페스트', '헝가리'] },
  { key: 'es', terms: ['바르셀로나', '스페인'] },
  { key: 'lasvegas', terms: ['라스베이거스'] },
  { key: 'sf', terms: ['샌프란시스코'] },
  { key: 'grandcanyon', terms: ['그랜드캐니언'] },
  { key: 'santiago', terms: ['산티아고'] },
  { key: 'lima', terms: ['리마'] },
  { key: 'buenos-aires', terms: ['부에노스아이레스'] },
] as const

describe('register city tag visit guard', () => {
  // REGRESSION-FREEZE[register-city-tag-visit-guard]: 정상 다도시 방문지는 통과 — manifest
  it('정상 다도시 이름은 방문 근거로 남는다', () => {
    const visit = [
      '프라하 - 부다페스트',
      '바르셀로나',
      '라스베이거스 샌프란시스코 그랜드캐니언',
      '산티아고 리마 부에노스아이레스',
    ].join('\n')
    for (const row of LEGIT) {
      expect(haystackCityKeyHasVisitEvidence(row.terms, visit)).toBe(true)
    }
  })

  // REGRESSION-FREEZE[register-city-tag-visit-guard]: 비유·거리·관저·경유·안내문은 추가 금지 — manifest
  it('오염 문맥은 도시 추가 근거가 아니다', () => {
    expect(haystackCityKeyHasVisitEvidence(['교토', 'kyoto'], '규슈의 작은 교토')).toBe(false)
    expect(haystackCityKeyHasVisitEvidence(['남경', '난징'], '상해 남경로 야경')).toBe(false)
    expect(haystackCityKeyHasVisitEvidence(['호치민', 'hochiminh'], '하노이 호치민 관저')).toBe(false)
    expect(haystackCityKeyHasVisitEvidence(['도하', 'doha'], '인천 출발\n도하 공항 경유')).toBe(false)
    expect(
      haystackCityKeyHasVisitEvidence(['상하이', '상해'], '총영사관 안내: 상하이 총영사관 연락처'),
    ).toBe(false)
  })

  it('본문의 비유는 지우고 실제 도시 문장은 남긴다', () => {
    const visit = buildRegisterCityVisitHaystackFromSchedule([
      {
        title: '규슈 온천',
        routeText: '벳부 - 유후인',
        description: '규슈의 작은 교토라는 별칭. 리마 시내 관광',
      },
    ])
    expect(visit).toContain('벳부')
    expect(visit).toContain('리마')
    expect(visit).not.toContain('교토')
    expect(haystackCityKeyHasVisitEvidence(['교토'], visit ?? '')).toBe(false)
    expect(haystackCityKeyHasVisitEvidence(['벳부'], visit ?? '')).toBe(true)
    expect(haystackCityKeyHasVisitEvidence(['리마'], visit ?? '')).toBe(true)
  })

  it('sichuan 대표 노드의 구성 도시는 본문 매칭이 아니라 노드 구성이다', () => {
    expect(clusterCityKeysForNode('sichuan')).toEqual(['chengdu', 'jiuzhaigou', 'chongqing'])
  })
})
