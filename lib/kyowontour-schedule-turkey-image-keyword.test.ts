/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 튀르키예 명소 — manifest
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: 튀르키예의 수도·체험 꼬리 — manifest
 * REGRESSION-FREEZE[lottetour-schedule-expression]: 튀르키예 vibe 분화 — manifest
 * REGRESSION-FREEZE[kyowontour-schedule-expression]: 튀르키예 일정 route·keyword — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyKyowontourScheduleExpressionToRows } from '@/lib/kyowontour-register-api-schedule'
import { applyKyowontourScheduleImageKeywordsToRows } from '@/lib/kyowontour-schedule-image-keyword'
import { sanitizeRegisterScheduleRouteText } from '@/lib/register-schedule-route-place-noise'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'

describe('kyowontour Turkey schedule quality (ECP102)', () => {
  it('maps Turkey landmarks without skyline/interior modifiers', () => {
    expect(firstMatchingScheduleSpotEn('성소피아 성당')).toBe('Hagia Sophia Istanbul')
    expect(firstMatchingScheduleSpotEn('지하물궁전')).toMatch(/Basilica Cistern/i)
    expect(firstMatchingScheduleSpotEn('돌마바흐체 궁전')).toMatch(/Dolmabahce/i)
    expect(firstMatchingScheduleSpotEn('파묵칼레')).toMatch(/Pamukkale/i)
    expect(firstMatchingScheduleSpotEn('카파도키아')).toMatch(/Cappadocia Fairy Chimneys/i)
    expect(firstMatchingScheduleSpotEn('성소피아')).not.toMatch(/interior|dome|skyline/i)
  })

  it('strips capital-of prose and activity tails from routeText', () => {
    expect(sanitizeRegisterScheduleRouteText('튀르키예의 수도 앙카라')).toBe('앙카라')
    expect(
      sanitizeRegisterScheduleRouteText(
        '이스탄불지하물궁전+성소피아 성당+돌마바흐체 궁전 - 튀르키예의 수도 앙카라',
      ),
    ).toMatch(/성소피아|지하물궁전|돌마바흐/)
    expect(
      sanitizeRegisterScheduleRouteText(
        '이스탄불지하물궁전+성소피아 성당+돌마바흐체 궁전 - 튀르키예의 수도 앙카라',
      ),
    ).not.toMatch(/튀르키예의\s*수도/)
    expect(sanitizeRegisterScheduleRouteText('카라반들의 숙소 오브룩한')).toMatch(/오브룩/)
    expect(sanitizeRegisterScheduleRouteText('카파도키아 지프차 - 밸리댄스')).toBe('카파도키아')
    expect(sanitizeRegisterScheduleRouteText('파묵칼레 카트')).toBe('파묵칼레')
    expect(sanitizeRegisterScheduleRouteText('부르사 - 이스탄불 이동 - 이스탄불 야경')).toMatch(
      /부르사.*이스탄불/,
    )
    expect(sanitizeRegisterScheduleRouteText('부르사 - 이스탄불 이동 - 이스탄불 야경')).not.toMatch(
      /이동|야경/,
    )
  })

  it('apply keywords — no skyline, no Day1 Cappadocia bleed, Turkey vibes differ', () => {
    const expressed = applyKyowontourScheduleExpressionToRows([
      {
        day: 1,
        title: '이스탄불 국제 공항',
        description: '도착',
        routeText: '이스탄불 국제 공항',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '이스탄불지하물궁전+성소피아 성당+돌마바흐체 궁전',
        description: '관광',
        routeText: '이스탄불지하물궁전+성소피아 성당+돌마바흐체 궁전 - 튀르키예의 수도 앙카라',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '투즈골다',
        description: '',
        routeText: '투즈골다 - 투즈골다레 - 카파도키아 지프차 - 밸리댄스',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '카라반들의 숙소 오브룩한',
        description: '',
        routeText: '카라반들의 숙소 오브룩한 - 안탈리아 올림포스 케이블카',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 5,
        title: '파묵칼레 카트',
        description: '',
        routeText: '파묵칼레 카트 - 튀르키예의 수도 앙카라',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 6,
        title: '쉬린제',
        description: '',
        routeText: '쉬린제 - 에페소유적지',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 7,
        title: '부르사',
        description: '',
        routeText: '부르사 - 이스탄불 이동 - 이스탄불 야경',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 8,
        title: '이스탄불 공항',
        description: '',
        routeText: '이스탄불 공항 - 튀르키예의 수도 앙카라',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 9,
        title: '귀국',
        description: '귀국',
        routeText: '',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ])

    const out = applyKyowontourScheduleImageKeywordsToRows(expressed, {
      productDestination: '튀르키예',
      productTitle:
        '튀르키예 일주 9일 [여행의 정석] #아시아나항공 #월드체인3박 #10대특식 #10대도시 #양갈비 HIT',
    })

    const viaApply = applyRegisterScheduleImageKeywordsBySupplier(expressed, {
      originSource: 'kyowontour',
      productDestination: '튀르키예',
      productTitle:
        '튀르키예 일주 9일 [여행의 정석] #아시아나항공 #월드체인3박 #10대특식 #10대도시 #양갈비 HIT',
    })

    for (const rows of [out, viaApply]) {
      const joined = rows.map((r) => `${r.imageKeyword ?? ''} ${r.imageKeyword2 ?? ''}`).join(' | ')
      expect(joined).not.toMatch(/skyline/i)
      expect(joined).not.toMatch(/interior\s*dome/i)
      expect(rows[0]?.imageKeyword ?? '').not.toMatch(/Cappadocia/i)
      expect(rows[1]?.imageKeyword ?? '').toMatch(/Hagia Sophia|Basilica Cistern|Dolmabahce/i)
      expect(rows[1]?.routeText ?? '').not.toMatch(/튀르키예의\s*수도/)
      expect(rows[2]?.imageKeyword ?? '').toMatch(/Lake Tuz|Cappadocia|Fairy Chimneys/i)
      expect(rows[4]?.imageKeyword ?? '').toMatch(/Pamukkale/i)
      expect(rows[5]?.imageKeyword ?? '').toMatch(/Sirince|Ephesus/i)
      expect(rows[6]?.description ?? '').not.toMatch(/스카이라인|하루 동안 여러 장면/)
      expect(rows[6]?.description ?? '').toMatch(/부르사|이스탄불/)
      expect(rows[1]?.description).not.toBe(rows[4]?.description)
      expect(rows[2]?.description).not.toMatch(/하루 동안 여러 장면/)
      expect(rows[4]?.description ?? '').toMatch(/파묵칼레|앙카라|석회|유적/)
      expect(rows[8]?.description).toMatch(/귀국|마무리|이동 중심/)
    }
  })
})
