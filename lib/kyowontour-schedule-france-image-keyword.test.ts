/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 프랑스 일주 명소 — manifest
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: 호텔명·교외토큰·단독 국가명 — manifest
 * REGRESSION-FREEZE[lottetour-schedule-expression]: 프랑스 일주 vibe 분화 — manifest
 * REGRESSION-FREEZE[kyowontour-schedule-expression]: 프랑스 일정 route·keyword — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyKyowontourScheduleExpressionToRows } from '@/lib/kyowontour-register-api-schedule'
import { applyKyowontourScheduleImageKeywordsToRows } from '@/lib/kyowontour-schedule-image-keyword'
import { sanitizeRegisterScheduleRouteText } from '@/lib/register-schedule-route-place-noise'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { isBareCityOrCountryKeyword } from '@/lib/pexels-place-name-keyword'

describe('kyowontour France schedule quality', () => {
  it('maps French landmarks from Korean route segments', () => {
    expect(firstMatchingScheduleSpotEn('몽생미셸')).toMatch(/Mont Saint Michel/i)
    expect(firstMatchingScheduleSpotEn('쉬농소성')).toMatch(/Chenonceau/i)
    expect(firstMatchingScheduleSpotEn('생테밀리옹')).toMatch(/Saint Emilion/i)
    expect(firstMatchingScheduleSpotEn('아비뇽 구시가지')).toMatch(/Avignon|Popes/i)
    expect(firstMatchingScheduleSpotEn('빛의 채석장')).toMatch(/Carrieres|Lumieres/i)
    expect(firstMatchingScheduleSpotEn('니스 해변')).toMatch(/Promenade|Nice/i)
    expect(firstMatchingScheduleSpotEn('교황청')).toMatch(/Avignon|Popes/i)
    expect(firstMatchingScheduleSpotEn('포르트 카이요')).toMatch(/Porte Cailhau/i)
    expect(firstMatchingScheduleSpotEn('포르트 카이요')).not.toMatch(/Cairo/i)
  })

  it('strips hotel names, VELIZY, restaurant suffix, country prefix/bare country', () => {
    expect(sanitizeRegisterScheduleRouteText('HOTEL FOREST HILL PARIS MEUDON - VELIZY')).toBeNull()
    expect(sanitizeRegisterScheduleRouteText('몽생미셸 뷰 레스토랑 - VELIZY')).toBe('몽생미셸')
    expect(sanitizeRegisterScheduleRouteText('프랑스/루아르 고성지대 - 쉬농소성')).toMatch(
      /루아르|쉬농소/,
    )
    expect(sanitizeRegisterScheduleRouteText('프랑스/루아르 고성지대 - 쉬농소성')).not.toMatch(
      /프랑스\//,
    )
    expect(sanitizeRegisterScheduleRouteText('이탈리아 - 사보나')).toBe('사보나')
  })

  it('apply keywords — landmarks not hotel/VELIZY/Monaco bleed; vibe differs by day', () => {
    const expressed = applyKyowontourScheduleExpressionToRows([
      {
        day: 1,
        title: '파리 도착',
        description: '도착',
        routeText: 'HOTEL FOREST HILL PARIS MEUDON - VELIZY',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 2,
        title: '개선문',
        description: '파리',
        routeText: '개선문 - 에펠탑 - 샹젤리제 거리 - 오르세 미술관 - 프랑스/지베르니',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 3,
        title: '몽생미셸',
        description: '노르망디',
        routeText: '몽생미셸 뷰 레스토랑 - VELIZY',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '루아르',
        description: '고성',
        routeText: '프랑스/루아르 고성지대 - 쉬농소성 - 앙부와즈 성 - 보르도 부르스광장',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 5,
        title: '생테밀리옹',
        description: '와인',
        routeText: '프랑스/생테밀리옹 - 보르도 생테밀리옹 와이너리 - 카르카손',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 6,
        title: '아비뇽',
        description: '구시가지',
        routeText: '아비뇽 구시가지 - 교황청 - 고대극장',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 7,
        title: '빛의 채석장',
        description: '프로방스',
        routeText: '빛의 채석장 - 레보드 프로방스 뷰 레스토랑 - 미라보 광장 & 거리 - 생폴드방스',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 8,
        title: '니스',
        description: '해변',
        routeText: '니스 해변 - 프롬나드 데 장글래 - 니스 - 샤갈 미술관 - 에즈 - 모나코 대성당',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 9,
        title: '이탈리아',
        description: '이동',
        routeText: '이탈리아 - 사보나',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 10,
        title: '숙박 없음(귀국)',
        description: '귀국',
        routeText: '',
        imageKeyword: '',
        imageKeyword2: null,
      },
    ])
    const out = applyKyowontourScheduleImageKeywordsToRows(expressed, {
      productDestination: '프랑스',
      productTitle: '프랑스 일주 남프랑스 10일',
    })

    expect(out[0]?.routeText ?? '').not.toMatch(/HOTEL|VELIZY/i)
    expect(out[2]?.routeText).toMatch(/몽생미셸/)
    expect(out[2]?.routeText).not.toMatch(/VELIZY|레스토랑/i)
    expect(out[2]?.imageKeyword).toMatch(/Mont Saint Michel/i)
    expect(String(out[2]?.imageKeyword2 ?? '')).not.toMatch(/VELIZY/i)

    expect(out[3]?.imageKeyword).toMatch(/Chenonceau|Amboise|Bourse|Loire/i)
    expect(out[3]?.imageKeyword).not.toMatch(/프랑스\//)
    expect(isBareCityOrCountryKeyword(out[3]?.imageKeyword ?? '')).toBe(false)

    expect(out[5]?.imageKeyword).toMatch(/Avignon|Popes|Orange/i)
    expect([out[5]?.imageKeyword, out[5]?.imageKeyword2].join(' ')).not.toMatch(/Carcassonne/i)

    expect(out[6]?.imageKeyword).toMatch(/Carrieres|Lumieres|Les Baux|Saint Paul/i)
    expect(out[7]?.imageKeyword).toMatch(/Promenade|Nice|Chagall|Eze|Monaco/i)
    expect(normPair(out[7]?.imageKeyword, out[7]?.imageKeyword2)).toBe(false)

    expect(out[8]?.routeText).toMatch(/사보나/)
    expect(out[8]?.routeText).not.toMatch(/이탈리아/)
    expect([out[8]?.imageKeyword, out[8]?.imageKeyword2].join(' ')).not.toMatch(/Monaco/i)

    expect(out[1]?.description).not.toBe(out[2]?.description)
    expect(out[2]?.description).not.toMatch(/하루 동안 여러 장면/)
    expect(out[6]?.description).not.toMatch(/하루 동안 여러 장면/)
    expect(out[9]?.description).toMatch(/귀국|마무리|이동 중심/)
  })
})

function normPair(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = String(a ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  const y = String(b ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  if (!x || !y) return false
  return x === y || x.includes(y) || y.includes(x)
}
