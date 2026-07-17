/**
 * REGRESSION-FREEZE[register-schedule-route-place-noise]
 */
import { describe, expect, it } from 'vitest'
import {
  extractRegisterScheduleRoutePlaceLabel,
  isRegisterScheduleDomesticHubRouteSegment,
  isRegisterScheduleRoutePlaceNoise,
  sanitizeRegisterScheduleRouteText,
  stripRegisterScheduleRouteSegmentLodgingSuffix,
} from '@/lib/register-schedule-route-place-noise'
import { joinLottetourScheduleRouteText } from '@/lib/lottetour-register-api-schedule'
import { buildKyowontourScheduleRouteTextFromTabRows } from '@/lib/kyowontour-register-api-schedule'
import { applyRegisterScheduleImageKeywordsBySupplier } from '@/lib/register-schedule-image-keywords-apply'
import { modetourFactDaysToRegisterSchedule } from '@/lib/modetour-register-api-schedule'
import type { KyowontourScheduleRowParsed } from '@/lib/kyowontour-tour-event-tab-data'

describe('register schedule route place noise', () => {
  it('strips Hamilton Gardens multi-country theme list — keeps garden POI', () => {
    // REGRESSION-FREEZE[register-schedule-route-place-noise]: theme-garden country list strip — manifest
    const out = sanitizeRegisterScheduleRouteText(
      '오클랜드 - 해밀턴 가든 - 중국, 영국, 일본, 미국, 인도, 이탈리아의 전형적인 정원과 허브정원 - 해밀턴',
    )
    expect(out).toMatch(/해밀턴\s*가든/)
    expect(out).not.toMatch(/일본|이탈리아|중국/)
  })

  it('blocks hotel-grade suffix — keeps POI name for routeText/keywords', () => {
    expect(extractRegisterScheduleRoutePlaceLabel('메테오라 등 4성호텔')).toBe('메테오라')
    expect(stripRegisterScheduleRouteSegmentLodgingSuffix('메테오라 등 4성호텔')).toBe('메테오라')
    expect(sanitizeRegisterScheduleRouteText('메테오라 등 4성호텔')).toBe('메테오라')
  })

  it('blocks domestic hub segments — overseas routeText is tourism chain only', () => {
    expect(isRegisterScheduleDomesticHubRouteSegment('인천')).toBe(true)
    expect(isRegisterScheduleDomesticHubRouteSegment('Incheon')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('인천')).toBe(false)
    expect(sanitizeRegisterScheduleRouteText('인천 - 청도 - 잔교 - 인천')).toBe('청도 - 잔교')
    expect(sanitizeRegisterScheduleRouteText('인천 - 돗토리 - 미즈키시게루 로드')).toBe(
      '돗토리 - 미즈키시게루 로드',
    )
  })

  it('blocks airport·province·optional-tour segments', () => {
    expect(isRegisterScheduleRoutePlaceNoise('청도국제공항')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('산동성')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('전신마사지 (60분)')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('전신마사지 1시간')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('쇼핑센터')).toBe(true)
    expect(
      sanitizeRegisterScheduleRouteText('청도 - 산동성 - 청도국제공항 - 5·4광장 - 전신마사지 (60분)'),
    ).toBe('청도 - 5·4광장')
    expect(
      sanitizeRegisterScheduleRouteText('옌뜨 국립공원 - 전신마사지 1시간 - 하롱베이'),
    ).toBe('옌뜨 국립공원 - 하롱베이')
    expect(sanitizeRegisterScheduleRouteText('쇼핑센터 - 바딘광장 - 한기둥사원')).toBe(
      '바딘광장 - 한기둥사원',
    )
  })

  it('blocks airline carrier segments — not tourism landmarks', () => {
    expect(isRegisterScheduleRoutePlaceNoise('에어프레미아 항공')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('에어프리미아')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('Air Premia')).toBe(true)
    expect(sanitizeRegisterScheduleRouteText('에어프레미아 항공 - 에어프리미아')).toBeNull()
  })

  it('airline-only departure day — empty imageKeyword', () => {
    const out = applyRegisterScheduleImageKeywordsBySupplier(
      [{ day: 1, routeText: '에어프레미아 항공 - 에어프리미아', imageKeyword: '', imageKeyword2: null }],
      { supplierKey: 'hanatour', productDestination: '미국', productTitle: '미동부' },
    )
    expect(String(out[0]?.imageKeyword ?? '').trim()).toBe('')
    expect(sanitizeRegisterScheduleRouteText(out[0]?.routeText ?? '')).toBeNull()
  })

  it('blocks immigration/admin guidance segments', () => {
    expect(isRegisterScheduleRoutePlaceNoise('한국-일본 여행 입국시 관련 안내')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('여행일정')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('돗토리')).toBe(false)
    expect(isRegisterScheduleRoutePlaceNoise('미즈키시게루 로드')).toBe(false)
  })

  it('lottetour B41A — drops 증명서·포함일정·식사 SET from route', () => {
    // REGRESSION-FREEZE[lottetour-schedule-route-admin-noise]
    expect(isRegisterScheduleRoutePlaceNoise('영문 가족관계증명서')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('면세가능품목')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('포함일정')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('베트남 가정식 SET')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('소고기 쌀국수+반쎄오')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('그랜드월드')).toBe(false)
    const chain = joinLottetourScheduleRouteText([
      '영문 가족관계증명서',
      '푸꾸옥',
      '면세가능품목',
      '포함일정',
      '베트남 가정식 SET',
      '그랜드월드',
      '갑오징어 볶음',
    ])
    expect(chain).toBe('푸꾸옥 - 그랜드월드')
    expect(chain).not.toMatch(/증명서|포함일정|가정식|갑오징어|면세/)
  })

  it('lottetour batch — drops 현지가이드·필수서류·시차 안내용 route noise', () => {
    expect(isRegisterScheduleRoutePlaceNoise('작성 및 제출 방법')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('현지 가이드')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('체류 가능 기간 : 입국 시 최대 3개월')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('한국보다 1시간 느립니다.')).toBe(true)
    const chain = joinLottetourScheduleRouteText([
      '작성 및 제출 방법',
      '비엔티엔',
      '현지 가이드',
      '현지 연락처',
      '롯데',
      '자금성',
    ])
    expect(chain).toMatch(/비엔티엔|자금성/)
    expect(chain).not.toMatch(/제출|가이드|연락처|^롯데$/)
    expect(
      joinLottetourScheduleRouteText([
        '홍콩',
        '3시간 45분',
        '한국보다 1시간 느립니다.',
        '이태원',
        '에그타르트',
      ]),
    ).toBe('홍콩')
  })

  it('joinLottetourScheduleRouteText drops admin guidance', () => {
    const chain = joinLottetourScheduleRouteText([
      '인천',
      '돗토리',
      '한국-일본 여행 입국시 관련 안내',
      '미즈키시게루 로드',
    ])
    expect(chain).toBe('돗토리 - 미즈키시게루 로드')
    expect(chain).not.toMatch(/입국|관련\s*안내|한국-일본\s*여행/)
  })

  it('kyowontour tab rows skip admin guidance in routeText', () => {
    const rows: KyowontourScheduleRowParsed[] = [
      { step: 1, type: '이동', nameKo: '인천국제공항 출발', tmContent: '' },
      { step: 2, type: '이동', nameKo: '돗토리', tmContent: '' },
      { step: 3, type: '관광', nameKo: '한국-일본 여행 입국시 관련 안내', tmContent: '' },
      { step: 4, type: '관광', nameKo: '미즈키시게루 로드', tmContent: '' },
    ]
    expect(buildKyowontourScheduleRouteTextFromTabRows(rows)).toBe('돗토리 - 미즈키시게루 로드')
  })

  it('extractRegisterScheduleRoutePlaceLabel — 포르투갈 마케팅 카드명', () => {
    expect(extractRegisterScheduleRoutePlaceLabel('땅이 끝나고 바다가 시작되는 곳, 까보다로까')).toBe('까보다로까')
    expect(extractRegisterScheduleRoutePlaceLabel('유럽인들이 살고싶어 하는 최고의 포르투갈 휴양지, 카스카이스')).toBe(
      '카스카이스',
    )
    expect(extractRegisterScheduleRoutePlaceLabel('작은 동화속 마을 신트라 관광')).toBe('신트라')
    expect(extractRegisterScheduleRoutePlaceLabel('lisbon-7681991')).toBe('lisbon')
    expect(extractRegisterScheduleRoutePlaceLabel('포르투 이미지')).toBeNull()
  })

  it('sanitizeRegisterScheduleRouteText strips admin guidance from existing routeText', () => {
    expect(
      sanitizeRegisterScheduleRouteText(
        '인천 - 돗토리 - 한국-일본 여행 입국시 관련 안내 - 미즈키시게루 로드',
      ),
    ).toBe('돗토리 - 미즈키시게루 로드')
  })

  it('sanitizeRegisterScheduleRouteText preserves comma inside route segment (대,소석림)', () => {
    expect(sanitizeRegisterScheduleRouteText('여강고성 - 대,소석림')).toBe('여강고성 - 대,소석림')
    expect(joinLottetourScheduleRouteText(['여강고성', '대,소석림'])).toBe('여강고성 - 대,소석림')
  })

  it('EKP3057-like — 비행시간 괄호·산문 불리우는 → 명소 슬롯만', () => {
    expect(
      sanitizeRegisterScheduleRouteText(
        '[인천 - 인천공항 출발 (OZ545) - 프라하 공항 - 프라하 : 약 13시간 20분 소요] - 체스키크롬로프 이동 후 호텔 투숙 - [프라하',
      ),
    ).toBe('프라하 - 체스키크롬로프')
    expect(
      extractRegisterScheduleRoutePlaceLabel(
        '오스트리아의 베르사유궁전이라 불리는 쉔부른궁전',
      ),
    ).toBe('쉔부른궁전')
    expect(
      extractRegisterScheduleRoutePlaceLabel(
        '빈의 혼이라 불리우는 성 슈테판 대성당',
      ),
    ).toBe('성 슈테판 대성당')
    expect(
      extractRegisterScheduleRoutePlaceLabel(
        '아드리아해의 진주, 유럽 최고의 휴양도시로 손꼽히는 두브로브니크',
      ),
    ).toBe('두브로브니크')
    expect(
      extractRegisterScheduleRoutePlaceLabel('가이드 미팅 후 호이안 옛도시로 이동'),
    ).toBe('호이안 옛도시')
    expect(isRegisterScheduleRoutePlaceNoise('가이드 미팅')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('가이드 미팅 후 호이안 옛도시로 이동')).toBe(false)
    expect(
      extractRegisterScheduleRoutePlaceLabel('중세모습을 간직한 라트란거리'),
    ).toBe('라트란거리')
    expect(
      extractRegisterScheduleRoutePlaceLabel(
        '죽기전에 꼭 봐야 할 세계 건축 1001에 선정된 세인트 도나트교회',
      ),
    ).toBe('세인트 도나트교회')
    expect(extractRegisterScheduleRoutePlaceLabel('항구도시 자다르')).toBe('자다르')
    expect(
      extractRegisterScheduleRoutePlaceLabel('체스키크룸로프의 명소 이발사 다리'),
    ).toBe('이발사 다리')
    expect(
      extractRegisterScheduleRoutePlaceLabel('부다페스트의 전경이 한 눈에 보이는 어부의 요새'),
    ).toBe('어부의 요새')
    expect(
      extractRegisterScheduleRoutePlaceLabel('케이블카 탑승 후 가이드 미팅장소'),
    ).toBeNull()
    expect(
      sanitizeRegisterScheduleRouteText(
        '스플리트 : 약 2시간 소요] - 마리안 해변 및 항구 - [네움 - [트로기르 - 카를로바츠 약 3시간 20분 소요]',
      ),
    ).toMatch(/마리안/)
    expect(
      sanitizeRegisterScheduleRouteText(
        '스플리트 : 약 2시간 소요] - 마리안 해변 및 항구 - [네움 - [트로기르 - 카를로바츠 약 3시간 20분 소요]',
      ),
    ).not.toMatch(/소요|\[|\]/)
  })

  it('modetour apply — trip imageKeyword must not repeat across days (돗토리 3일)', () => {
    const days = modetourFactDaysToRegisterSchedule(
      [
        {
          day: 1,
          places: ['인천', '돗토리', '한국-일본 여행 입국시 관련 안내', '미즈키시게루 로드'],
          hotels: ['총 0개의 예정 호텔'],
          meals: [],
          transportNote: null,
        },
        {
          day: 2,
          places: [
            '요나고',
            '돗토리',
            '돗토리 사구 모래미술관',
            '20세기 배 기념관(나싯코관)',
            '코난 박물관 (아오야마 고쇼 기념관)',
          ],
          hotels: ['총 0개의 예정 호텔'],
          meals: [],
          transportNote: null,
        },
        {
          day: 3,
          places: ['마츠에', '인천', '아다치 미술관', '마쓰에성', '시오미나와테 거리'],
          hotels: [],
          meals: [],
          transportNote: null,
        },
      ],
      { productTitle: '[마이리틀시티 돗토리]요나고/마츠에 3일' },
    )
    const out = applyRegisterScheduleImageKeywordsBySupplier(days, {
      supplierKey: 'modetour',
      productDestination: '돗토리',
      productTitle: 'test',
    })
    const kws = out.map((r) => String(r.imageKeyword ?? '').trim()).filter(Boolean)
    expect(new Set(kws.map((k) => k.toLowerCase())).size).toBe(kws.length)
    expect(days[0]?.routeText).not.toMatch(/입국|관련\s*안내/)
    expect(String(out[2]?.imageKeyword ?? '').trim().length).toBeGreaterThan(0)
    expect(String(out[0]?.imageKeyword ?? '').trim().length).toBeGreaterThan(0)
  })

  // REGRESSION-FREEZE[register-schedule-route-place-noise]: AVP8307 meal·price·marketing — manifest
  it('strips price·meal·marketing noise — keeps Phu Quoc POI tails', () => {
    expect(isRegisterScheduleRoutePlaceNoise('비용 : 1만원/1인(아동동일)')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('베트남 맛집 두번째 미식')).toBe(true)
    expect(extractRegisterScheduleRoutePlaceLabel('바다가 보이는 딘커우 사원')).toBe('딘커우 사원')
    expect(extractRegisterScheduleRoutePlaceLabel('먹거리 볼거리 가득 소나시 야시장')).toBe('소나시 야시장')
    expect(extractRegisterScheduleRoutePlaceLabel('푸꾸옥 대표 야시장인 쯔엉동 야시장')).toBe(
      '쯔엉동 야시장',
    )
    expect(
      sanitizeRegisterScheduleRouteText(
        '입국신고서 - 비용 : 1만원/1인(아동동일) - 호국사 - 먹거리 볼거리 가득 소나시 야시장 - 베트남 맛집 두번째 미식',
      ),
    ).toBe('호국사 - 소나시 야시장')
  })

  // REGRESSION-FREEZE[register-schedule-route-place-noise]: AVP7297 meal·야간·마케팅 — manifest
  it('AVP7297-like — 호텔·식사·야간·동양유럽마을 노이즈, 포나가르·빈펄 꼬리 유지', () => {
    expect(isRegisterScheduleRoutePlaceNoise('호텔')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('분짜&반쎄오 세트')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('에프퍼눈 티')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('일정이 끝난 후 공항')).toBe(true)
    expect(extractRegisterScheduleRoutePlaceLabel('동양의 유럽마을 달랏')).toBeNull()
    expect(extractRegisterScheduleRoutePlaceLabel('참파 유적지 중 가장 오래된 포나가르 참 사원')).toBe(
      '포나가르 참 사원',
    )
    expect(extractRegisterScheduleRoutePlaceLabel('나트랑 빈펄 하버랜드 야간')).toBe(
      '나트랑 빈펄 하버랜드',
    )
    expect(sanitizeRegisterScheduleRouteText('깜란 - 호텔 - 나트랑')).toBe('깜란 - 나트랑')
  })

  // REGRESSION-FREEZE[register-schedule-route-place-noise]: outlet·영화제목 쇼핑/옵션 노이즈 — manifest
  it('strips DESIGNER OUTLET and Sound of Music — keeps city chain', () => {
    expect(isRegisterScheduleRoutePlaceNoise('DESIGNER OUTLET PANDORF')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('Sound of Music')).toBe(true)
    expect(
      sanitizeRegisterScheduleRouteText(
        '브르노 - 브라티슬라바 - 부다페스트 - DESIGNER OUTLET PANDORF',
      ),
    ).toBe('브르노 - 브라티슬라바 - 부다페스트')
  })

  // REGRESSION-FREEZE[register-schedule-route-place-noise]: 비엔나↔Vienna 한·영 도시 중복 제거 — manifest
  it('dedupes Vienna - Linz English duplicates after Korean cities', () => {
    expect(sanitizeRegisterScheduleRouteText('비엔나(Vienna) - 린츠 - Vienna - Linz')).toBe(
      '비엔나 - 린츠',
    )
  })

  // REGRESSION-FREEZE[register-schedule-route-place-noise]: 호텔명·교외토큰·단독 국가명 — manifest
  it('strips English hotel names, VELIZY suburb, bare country Italy', () => {
    expect(isRegisterScheduleRoutePlaceNoise('HOTEL FOREST HILL PARIS MEUDON')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('VELIZY')).toBe(true)
    expect(isRegisterScheduleRoutePlaceNoise('이탈리아')).toBe(true)
    expect(sanitizeRegisterScheduleRouteText('몽생미셸 뷰 레스토랑 - VELIZY')).toBe('몽생미셸')
    expect(sanitizeRegisterScheduleRouteText('이탈리아 - 사보나')).toBe('사보나')
  })
})
