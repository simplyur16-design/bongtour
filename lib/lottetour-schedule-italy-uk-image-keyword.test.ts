/**
 * REGRESSION-FREEZE[schedule-poi-regex-ssot]: 이탈리아·영국 일주 명소 — manifest
 * REGRESSION-FREEZE[lottetour-schedule-expression]: 이탈리아·영국 vibe 분화 — manifest
 * REGRESSION-FREEZE[register-schedule-route-place-noise]: 독일·유럽 admin·교통 세그먼트 — manifest
 * REGRESSION-FREEZE[lottetour-register-destination]: TKT/ONLY·항공코드 뱃지 목적지 금지 — manifest
 */
import { describe, expect, it } from 'vitest'
import { applyLottetourScheduleImageKeywordsToRows } from '@/lib/lottetour-schedule-image-keyword'
import { applyLottetourScheduleExpressionToRows } from '@/lib/lottetour-register-api-schedule'
import { sanitizeRegisterScheduleRouteText } from '@/lib/register-schedule-route-place-noise'
import { firstMatchingScheduleSpotEn } from '@/lib/schedule-poi-regex-ssot'
import { resolveLottetourRegisterDestination } from '@/lib/lottetour-register-destination-from-paste'

describe('lottetour Italy / UK schedule quality', () => {
  it('does not map 베니스 → Nice / France Riviera vibe', () => {
    expect(firstMatchingScheduleSpotEn('베니스')).toMatch(/Venice/i)
    expect(firstMatchingScheduleSpotEn('베니스')).not.toMatch(/\bNice\b|Promenade/i)
    expect(firstMatchingScheduleSpotEn('니스')).toMatch(/\bNice\b|Promenade/i)

    const expressed = applyLottetourScheduleExpressionToRows([
      {
        day: 1,
        title: '밀라노',
        description: '',
        routeText: '밀라노',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 6,
        title: '베니스',
        description: '',
        routeText: '로마 - 플로렌스 - 베니스 - 외관',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 7,
        title: '베로나',
        description: '',
        routeText: '베니스 - 베로나 - 밀라노 - 외관',
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
    expect(expressed[1]?.description).not.toMatch(/리비에라/)
    expect(expressed[1]?.description).toMatch(/베네토|운하|토스카나|광장/)
    expect(expressed[2]?.description).not.toMatch(/리비에라/)
  })

  it('maps Cinque Terre · Como · Florence alias · bare Rome', () => {
    expect(firstMatchingScheduleSpotEn('친퀘테레')).toMatch(/Cinque\s*Terre/i)
    expect(firstMatchingScheduleSpotEn('꼬모')).toMatch(/Como/i)
    expect(firstMatchingScheduleSpotEn('플로렌스')).toMatch(/Florence/i)
    expect(firstMatchingScheduleSpotEn('로마')).toMatch(/Colosseum|Rome/i)
  })

  it('strips 내부·외관·입장·사진촬영·몬테카티니 lodging hub', () => {
    expect(
      sanitizeRegisterScheduleRouteText('로마 - 내부 - 외관 - 몬테카티니테르메'),
    ).toBe('로마')
    expect(
      sanitizeRegisterScheduleRouteText('밀라노 - 꼬모 - 외관 - 몬테카티니테르메'),
    ).toBe('밀라노 - 꼬모')
    expect(
      sanitizeRegisterScheduleRouteText('몬테카티니테르메 - 시에나 - 로마 - 사진 촬영 후 이동'),
    ).toBe('시에나 - 로마')
    expect(
      sanitizeRegisterScheduleRouteText('에딘버러 - 내부 - AFTERNOON TEA'),
    ).toBe('에딘버러')
    expect(
      sanitizeRegisterScheduleRouteText('더블린 - 콘위 - 글로스터 - 롯데관광 유일 - 내부'),
    ).toBe('더블린 - 콘위 - 글로스터')
  })

  it('Italy apply — Cinque/Pisa, Rome day, Venice not Nice, Como filled', () => {
    const expressed = applyLottetourScheduleExpressionToRows([
      { day: 1, title: '밀라노', description: '', routeText: '밀라노', imageKeyword: '', imageKeyword2: null },
      {
        day: 2,
        title: '',
        description: '',
        routeText: '밀라노 - 친퀘테레 - 피사 - 몬테카티니테르메',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '',
        description: '',
        routeText: '로마 - 내부 - 외관 - 몬테카티니테르메',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 6,
        title: '',
        description: '',
        routeText: '로마 - 플로렌스 - 베니스 - 외관',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 7,
        title: '',
        description: '',
        routeText: '베니스 - 베로나 - 밀라노 - 외관',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 8,
        title: '',
        description: '',
        routeText: '밀라노 - 꼬모 - 외관 - 몬테카티니테르메',
        imageKeyword: '',
        imageKeyword2: null,
      },
      { day: 9, title: '귀국', description: '귀국', routeText: '', imageKeyword: '', imageKeyword2: null },
    ])
    const out = applyLottetourScheduleImageKeywordsToRows(expressed, {
      productDestination: '이탈리아',
      productTitle: '이탈리아 9일',
    })
    expect(out[1]?.imageKeyword).toMatch(/Cinque\s*Terre|Pisa/i)
    expect(out[1]?.imageKeyword).not.toMatch(/Montecatini|Nice|Promenade/i)
    expect(out[2]?.imageKeyword).toMatch(/Colosseum|Rome/i)
    expect(out[3]?.imageKeyword).toMatch(/Venice|Florence/i)
    expect(out[3]?.imageKeyword).not.toMatch(/\bNice\b|Promenade/i)
    expect(String(out[4]?.imageKeyword2 || out[4]?.imageKeyword)).not.toMatch(/\bNice\b|Promenade/i)
    expect(out[5]?.imageKeyword).toMatch(/Como/i)
    expect(out[6]?.imageKeyword).toBeTruthy()
  })

  it('UK destination from TKT/ONLY title → 영국 regions', () => {
    const dest = resolveLottetourRegisterDestination({
      title:
        "[TKT/ONLY]『셰익스피어에게 여행을 묻다』영국(잉글랜드/스코틀랜드/아일랜드/웨일즈)완전일주 10일",
    })
    expect(dest.destination).toMatch(/영국/)
    expect(dest.destination).not.toMatch(/TKT|ONLY/)
  })

  it('UK apply — Oxford·Edinburgh·Bath keywords, no AFTERNOON TEA', () => {
    const expressed = applyLottetourScheduleExpressionToRows([
      { day: 1, title: '런던', description: '', routeText: '런던', imageKeyword: '', imageKeyword2: null },
      {
        day: 2,
        title: '',
        description: '',
        routeText: '런던 - 옥스포드 - 스트래트포드 어폰 에이번 - 리버풀 - 내부',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 4,
        title: '',
        description: '',
        routeText: '에딘버러 - 내부 - AFTERNOON TEA',
        imageKeyword: '',
        imageKeyword2: null,
      },
      {
        day: 8,
        title: '',
        description: '',
        routeText: '코번트리 - 바이버리 - 코츠월드 - 바스 - 솔즈베리 - 런던 - 내부',
        imageKeyword: '',
        imageKeyword2: null,
      },
      { day: 10, title: '귀국', description: '귀국', routeText: '', imageKeyword: '', imageKeyword2: null },
    ])
    const out = applyLottetourScheduleImageKeywordsToRows(expressed, {
      productDestination: '영국',
      productTitle: '영국 완전일주 10일',
    })
    expect(out[1]?.imageKeyword).toMatch(/Oxford|Stratford|Liverpool/i)
    expect(out[2]?.imageKeyword).toMatch(/Edinburgh/i)
    expect(out[2]?.imageKeyword).not.toMatch(/AFTERNOON|TEA/i)
    expect(out[3]?.imageKeyword).toMatch(/Bibury|Cotswold|Bath|Stonehenge/i)
    expect(out[1]?.description).not.toMatch(/특정 장소보다|전체적인 흐름/)
    expect(out[2]?.description).toMatch(/스코틀랜드|성곽/)
  })
})
