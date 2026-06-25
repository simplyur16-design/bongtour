/**
 * REGRESSION-FREEZE[schedule-image-keyword-dual-slot] — modetour prebuild
 * REGRESSION-FREEZE[modetour-schedule-image-keyword-ko-route]
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyModetourScheduleImageKeywordsToRows,
  classifyModetourScheduleCardDayKind,
  isModetourCrossContinentHallucinationKeyword,
  isModetourDomesticHubToken,
} from '../lib/modetour-schedule-image-keyword'

describe('isModetourDomesticHubToken', () => {
  it('국내 출발지 토큰을 true로', () => {
    assert.equal(isModetourDomesticHubToken('인천'), true)
    assert.equal(isModetourDomesticHubToken('대구'), true)
    assert.equal(isModetourDomesticHubToken('Da Nang'), false)
  })
})

describe('isModetourCrossContinentHallucinationKeyword', () => {
  it('베트남 목적지에서 Paris는 환각', () => {
    assert.equal(isModetourCrossContinentHallucinationKeyword('Paris', 'Vietnam'), true)
    assert.equal(isModetourCrossContinentHallucinationKeyword('Da Nang', 'Vietnam'), false)
    assert.equal(isModetourCrossContinentHallucinationKeyword('Hoi An', '다낭'), false)
  })
})

describe('applyModetourScheduleImageKeywordsToRows — LLM 2순위 + routeText 영문 폴백', () => {
  const vietnamOpts = { productDestination: 'Vietnam' }

  it('LLM Da Nang / Hoi An → 1·2순위 (finalize SSOT: Da / Hoi)', () => {
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '다낭',
          description: '다낭과 호이안 관광',
          routeText: 'Da Nang - Hoi An',
          imageKeyword: 'Da Nang',
          imageKeyword2: 'Hoi An',
        },
      ],
      vietnamOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Da')
    assert.equal(out[0]!.imageKeyword2, 'Hoi')
  })

  it('routeText Da Nang - Hoi An, LLM 없음 → routeText 1·2순위', () => {
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '다낭',
          description: '관광',
          routeText: 'Da Nang - Hoi An',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      vietnamOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Da')
    assert.equal(out[0]!.imageKeyword2, 'Hoi')
  })

  it('대구 출발 — LLM Daegu 거부, routeText 첫 영문 Da Nang', () => {
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '출발',
          description: '대구 출발',
          routeText: '대구 - Da Nang',
          imageKeyword: 'Daegu',
          imageKeyword2: null,
        },
      ],
      vietnamOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Da')
    assert.equal(out[0]!.imageKeyword2, null)
  })

  it('Vietnam + LLM Paris 환각 차단 — routeText 1순위 유지', () => {
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '다낭',
          description: '관광',
          routeText: 'Da Nang - Hoi An',
          imageKeyword: 'Paris',
          imageKeyword2: 'Hoi An',
        },
      ],
      vietnamOpts,
    )
    assert.equal(out[0]!.imageKeyword, 'Da')
    assert.equal(out[0]!.imageKeyword2, 'Hoi')
  })

  it('출발/귀국일 — 2순위 null', () => {
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '인천',
          description: '인천 ICN 출발 → 다낭 도착',
          routeText: 'Incheon - Da Nang',
          imageKeyword: 'Da Nang',
          imageKeyword2: 'Hoi An',
        },
        {
          day: 5,
          title: '귀국',
          description: '다낭 출발 인천 국제공항 도착',
          routeText: 'Da Nang - Incheon',
          imageKeyword: 'Da Nang',
          imageKeyword2: 'Hoi An',
        },
      ],
      { productDestination: '다낭, 호이안' },
    )
    assert.equal(out[0]!.imageKeyword, 'Da')
    assert.equal(out[0]!.imageKeyword2, null)
    assert.equal(out[1]!.imageKeyword2, null)
  })

  it('LLM Ba Na Hills가 모든 일차에 반복되면 routeText 일차별 명소 우선', () => {
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 2,
          title: '다낭',
          description: '미케 비치',
          routeText: 'Da Nang - My Khe Beach',
          imageKeyword: 'Ba Na Hills',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '바나힐',
          description: '바나힐',
          routeText: 'Da Nang - Ba Na Hills',
          imageKeyword: 'Ba Na Hills',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '호이안',
          description: '호이안 올드타운',
          routeText: 'Da Nang - Hoi An Ancient Town',
          imageKeyword: 'Ba Na Hills',
          imageKeyword2: null,
        },
      ],
      { productDestination: '다낭' },
    )
    assert.match(out[0]!.imageKeyword!, /My Khe/i)
    assert.equal(out[1]!.imageKeyword, 'Ba Na Hills')
    assert.match(out[2]!.imageKeyword!, /Hoi/i)
    assert.ok(out[0]!.imageKeyword2?.trim(), `day2 kw2: ${out[0]!.imageKeyword2}`)
    assert.ok(out[2]!.imageKeyword2?.trim(), `day4 kw2: ${out[2]!.imageKeyword2}`)
    assert.notEqual(
      normLoose(out[0]!.imageKeyword!),
      normLoose(out[0]!.imageKeyword2!),
    )
  })
})

describe('classifyModetourScheduleCardDayKind — 인천 귀국', () => {
  it('마지막 일차 인천 국제공항 도착 → return_home', () => {
    assert.equal(
      classifyModetourScheduleCardDayKind(
        9,
        9,
        '인천 국제공항 도착\n이동 경로: 인천',
      ),
      'return_home',
    )
  })
})

describe('applyModetourScheduleImageKeywordsToRows — 라다크·인도 한글 routeText', () => {
  const indiaOpts = { productDestination: '인도, 라다크' }

  const ladakhRows = [
    {
      day: 1,
      title: '인천 출발 및 델리 도착',
      description: '',
      routeText: '인천 - 델리',
      imageKeyword: 'Delhi',
      imageKeyword2: null,
    },
    {
      day: 2,
      title: '레 도착 및 시내 관광',
      description: '',
      routeText: '델리 - 레 - 레 왕궁 - 레 시장',
      imageKeyword: 'Delhi',
      imageKeyword2: 'Leh Market',
    },
    {
      day: 7,
      title: '델리 귀환 및 시내 관광',
      description: '',
      routeText: '레 - 델리 - 아그라센 키 바올리 - 구르드와라 방글라 사힙 - 인디아 게이트(차창)',
      imageKeyword: 'Delhi',
      imageKeyword2: 'Gurudwara Bangla Sahib',
    },
    {
      day: 8,
      title: '델리 유적 관람 및 출국',
      description: '',
      routeText: '델리 - 꾸뜹미나르 - 델리 공항',
      imageKeyword: 'Delhi',
      imageKeyword2: null,
    },
    {
      day: 9,
      title: '인천 국제공항 도착',
      description: '',
      routeText: '인천',
      imageKeyword: 'Delhi',
      imageKeyword2: null,
    },
  ]

  it('Day2 — Delhi LLM 대신 routeText 레 구간 랜드마크', () => {
    const out = applyModetourScheduleImageKeywordsToRows(ladakhRows, indiaOpts)
    const d2 = out.find((r) => r.day === 2)!
    assert.match(d2.imageKeyword!, /Leh/i)
    assert.notEqual(normLoose(d2.imageKeyword!), 'delhi')
    assert.match(d2.imageKeyword2!, /Leh Market/i)
  })

  it('Day7·8 — 도시명 Delhi 대신 routeText 명소', () => {
    const out = applyModetourScheduleImageKeywordsToRows(ladakhRows, indiaOpts)
    const d7 = out.find((r) => r.day === 7)!
    const d8 = out.find((r) => r.day === 8)!
    assert.match(d7.imageKeyword!, /Agrasen|India Gate/i)
    assert.match(d8.imageKeyword!, /Qutub/i)
  })

  it('Day9 귀국 — 인천만 있으면 키워드 비움', () => {
    const out = applyModetourScheduleImageKeywordsToRows(ladakhRows, indiaOpts)
    const d9 = out.find((r) => r.day === 9)!
    assert.equal(d9.imageKeyword, '')
    assert.equal(d9.imageKeyword2, null)
  })

  it('푸켓 — LLM Phuket 반복 시 route 명소 우선·귀국일 비움', () => {
    const phuketOpts = { productDestination: 'Thailand' }
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '인천 출발 및 푸켓 도착',
          description: '인천 출발 푸켓 도착',
          routeText: '인천 - 푸켓',
          imageKeyword: 'Phuket',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '팡아만',
          description: '팡아만 해상 국립공원 관광',
          routeText: '푸켓 - 팡아만',
          imageKeyword: 'Phuket',
          imageKeyword2: 'James Bond Island',
        },
        {
          day: 3,
          title: '산호섬',
          description: '산호섬 휴양 및 칠바 마켓',
          routeText: '푸켓 - 산호섬 - 칠바 마켓',
          imageKeyword: 'Phuket',
          imageKeyword2: 'Chillva Market',
        },
        {
          day: 5,
          title: '인천 도착',
          description: '인천 국제공항 도착',
          routeText: '푸켓 - 인천',
          imageKeyword: 'Phuket',
          imageKeyword2: null,
        },
      ],
      phuketOpts,
    )
    const d2 = out.find((r) => r.day === 2)!
    const d3 = out.find((r) => r.day === 3)!
    const d5 = out.find((r) => r.day === 5)!
    assert.match(d2.imageKeyword!, /James Bond/i)
    assert.match(d3.imageKeyword!, /Coral Island|Chillva/i)
    assert.equal(d5.imageKeyword, '')
    assert.equal(d5.imageKeyword2, null)
  })

  it('푸꾸옥 한글 routeText — 도시명 대신 일차별 명소 1·2순위', () => {
    const phuQuocOpts = { productDestination: '푸꾸옥' }
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 1,
          title: '인천 출발',
          description: '인천 ICN 출발 푸꾸옥 도착',
          routeText: '인천 - 푸꾸옥',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 2,
          title: '선셋타운',
          description: '선셋타운 키스브릿지',
          routeText: '푸꾸옥 - 선셋타운 - 키스 브릿지 - 부이페스트 야시장',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 3,
          title: '사나토',
          description: '선셋 사나토 비치 그랜드월드',
          routeText: '푸꾸옥 - 선셋 사나토 비치 - 바구니배 체험 - 그랜드월드',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 4,
          title: '남부',
          description: '호국사 코코넛 수용소 사오 비치',
          routeText: '푸꾸옥 - 호국사 - 코코넛 수용소 - 사오 비치 - 소나시 야시장',
          imageKeyword: '',
          imageKeyword2: null,
        },
        {
          day: 5,
          title: '인천 도착',
          description: '인천 국제공항 도착',
          routeText: '인천',
          imageKeyword: '',
          imageKeyword2: null,
        },
      ],
      phuQuocOpts,
    )
    const d1 = out.find((r) => r.day === 1)!
    const d2 = out.find((r) => r.day === 2)!
    const d3 = out.find((r) => r.day === 3)!
    const d4 = out.find((r) => r.day === 4)!
    const d5 = out.find((r) => r.day === 5)!
    assert.equal(d1.imageKeyword, 'Phu Quoc')
    assert.equal(d1.imageKeyword2, null)
    assert.match(d2.imageKeyword!, /Sunset Town/i)
    assert.match(d2.imageKeyword2!, /Kiss Bridge/i)
    assert.match(d3.imageKeyword!, /Sunset Sanato/i)
    assert.match(d3.imageKeyword2!, /Grand World/i)
    assert.match(d4.imageKeyword!, /Ho Quoc|Coconut Tree/i)
    assert.match(d4.imageKeyword2!, /Sao Beach/i)
    assert.equal(d5.imageKeyword, '')
    assert.equal(d5.imageKeyword2, null)
  })

  it('한글 routeText만 — 알치·판공초 1·2순위', () => {
    const out = applyModetourScheduleImageKeywordsToRows(
      [
        {
          day: 3,
          title: '알치와 라마유르 탐방',
          routeText: '레 - 알치 - 알치 곰파 - 라마유르 - 라마유르 곰파 - 레',
          imageKeyword: 'Alchi Monastery',
          imageKeyword2: 'Lamayuru Monastery',
        },
        {
          day: 5,
          title: '판공초',
          routeText: '누브라 밸리 - 판공초 - 메락 마을',
          imageKeyword: 'Pangong Tso',
          imageKeyword2: 'Merak Village',
        },
      ],
      indiaOpts,
    )
    assert.match(out[0]!.imageKeyword!, /Alchi/i)
    assert.match(out[0]!.imageKeyword2!, /Lamayuru/i)
    assert.match(out[1]!.imageKeyword!, /Pangong/i)
    assert.match(out[1]!.imageKeyword2!, /Merak/i)
  })
})

describe('applyModetourScheduleImageKeywordsToRows — 칭다오 한글 routeText', () => {
  const qingdaoOpts = { productDestination: '칭다오' }
  const qingdaoRows = [
    {
      day: 1,
      title: '출입국',
      description: '출입국 정보',
      routeText: '출입국 정보 - 중산로 - 천주교당(성미카엘성당) - 잔교',
      imageKeyword: '',
      imageKeyword2: null,
    },
    {
      day: 2,
      title: '칭다오',
      description: '극지 해양 스타벅스',
      routeText: '지모루 시장 - 칭다오 올림픽 요트경기장 - 청도 54광장',
      imageKeyword: '',
      imageKeyword2: null,
    },
    {
      day: 3,
      title: '청도',
      description: '청도',
      routeText: null,
      imageKeyword: '',
      imageKeyword2: null,
    },
  ]

  it('출발·관광·마지막 일차 — routeText 명소 1·2순위·중복 없음', () => {
    const out = applyModetourScheduleImageKeywordsToRows(qingdaoRows, qingdaoOpts)
    const d1 = out.find((r) => r.day === 1)!
    const d2 = out.find((r) => r.day === 2)!
    const d3 = out.find((r) => r.day === 3)!
    assert.match(d1.imageKeyword!, /Michael|Zhanqiao/i)
    assert.equal(d1.imageKeyword2, null)
    assert.match(d2.imageKeyword!, /Jimo/i)
    assert.ok(d2.imageKeyword2?.trim(), `day2 kw2: ${d2.imageKeyword2}`)
    assert.notEqual(normLoose(d2.imageKeyword!), normLoose(d2.imageKeyword2!))
    assert.match(d3.imageKeyword!, /Zhanqiao|May Fourth|Olympic/i)
    assert.notEqual(d3.imageKeyword, 'Qingdao')
    assert.equal(d3.imageKeyword2, null)
    const used = [d1.imageKeyword, d2.imageKeyword, d2.imageKeyword2, d3.imageKeyword]
      .filter(Boolean)
      .map((k) => normLoose(String(k)))
    assert.equal(new Set(used).size, used.length)
  })
})

describe('applyModetourScheduleImageKeywordsToRows — 대만 한글 routeText (공용 POI 사전)', () => {
  const taiwanOpts = { productDestination: '대만' }
  const taiwanRows = [
    {
      day: 1,
      title: '입국',
      description: '타이페이 도착',
      routeText:
        '인천 - 타이페이(桃園)국제공항 - 대만입국수속 - 국립 고궁박물관 - 용문 - 타이베이 101전망대[선택관광]',
      imageKeyword: '',
      imageKeyword2: null,
    },
    {
      day: 2,
      title: '북부',
      description: '예류·지우펀',
      routeText: '기룽 - 타이페이 - 예류지질공원 - 지우펀 - 스펀 - 스펀 천등 체험',
      imageKeyword: '',
      imageKeyword2: null,
    },
    {
      day: 3,
      title: '우라이',
      description: '우라이 마을',
      routeText: '우라이 - 타이페이 - 우라이 마을 - 야산 산책로',
      imageKeyword: '',
      imageKeyword2: null,
    },
    {
      day: 4,
      title: '귀국',
      description: '인천 도착',
      routeText: '인천 - 타이페이(桃園)국제공항 - 대만팁',
      imageKeyword: '',
      imageKeyword2: null,
    },
  ]

  it('routeText만으로 일차별 명소 1·2순위 — modetour 전용 ROI 목록 불필요', () => {
    const out = applyModetourScheduleImageKeywordsToRows(taiwanRows, taiwanOpts)
    const d1 = out.find((r) => r.day === 1)!
    const d2 = out.find((r) => r.day === 2)!
    const d3 = out.find((r) => r.day === 3)!
    const d4 = out.find((r) => r.day === 4)!
    assert.match(d1.imageKeyword!, /Palace|101/i)
    assert.match(d2.imageKeyword!, /Yehliu|Jiufen|Shifen/i)
    assert.match(d2.imageKeyword2!, /Yehliu|Jiufen|Shifen/i)
    assert.notEqual(
      normLoose(d2.imageKeyword!),
      normLoose(d2.imageKeyword2!),
    )
    assert.match(d3.imageKeyword!, /Wulai/i)
    assert.equal(d4.imageKeyword, '')
    assert.equal(d4.imageKeyword2, null)
  })
})

describe('applyModetourScheduleImageKeywordsToRows — 북경 한글 routeText', () => {
  const beijingOpts = { productDestination: '중국' }
  const beijingRows = [
    {
      day: 1,
      title: '1일차',
      description: '인천 출발 북경 입국',
      routeText:
        '인천 - 북경 - 중국 입국 유의사항/온라인 입국신고서 작성 안내사항 - 입국 도시(북경) - 북경 자금성 안내사항 - 북경 서커스',
      imageKeyword: '',
      imageKeyword2: null,
    },
    {
      day: 2,
      title: '2일차',
      description: '북경 관광',
      routeText: '북경 - 천안문광장 - 자금성 - 십찰해 - 전문대가 - 세무천계',
      imageKeyword: '',
      imageKeyword2: null,
    },
    {
      day: 3,
      title: '3일차',
      description: '이화원 만리장성',
      routeText: '북경 - 이화원 - 용경협[선택관광용] $60/인(성인&아동동일) - 만리장성(야경)',
      imageKeyword: '',
      imageKeyword2: null,
    },
    {
      day: 4,
      title: '4일차',
      description: '귀국',
      routeText: '북경 - 인천 - 798예술구',
      imageKeyword: '',
      imageKeyword2: null,
    },
  ]

  it('routeText 명소 — 일정 세그먼트·POI 사전(지역 regex 없음) 1·2순위', () => {
    const out = applyModetourScheduleImageKeywordsToRows(beijingRows, beijingOpts)
    const d2 = out.find((r) => r.day === 2)!
    const d3 = out.find((r) => r.day === 3)!
    const d4 = out.find((r) => r.day === 4)!
    assert.match(d2.imageKeyword!, /Tiananmen|Forbidden/i)
    assert.ok(d2.imageKeyword2?.trim())
    assert.notEqual(normLoose(d2.imageKeyword!), normLoose(d2.imageKeyword2!))
    assert.match(d3.imageKeyword!, /Summer Palace|Great Wall/i)
    assert.ok(d3.imageKeyword2?.trim())
    assert.match(d4.imageKeyword!, /798/i)
    assert.equal(d4.imageKeyword2, null)
  })
})

function normLoose(s: string): string {
  return s.trim().toLowerCase()
}
