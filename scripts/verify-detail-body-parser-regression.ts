/**
 * 공급사별 `detail-body-parser-*` 회귀. `samples[].text`는 **붙여넣기 본문 샘플**이다.
 *
 * 붙여넣기 본문 vs HTTP canonical 키: `docs/register-supplier-extraction-spec.md` 「표기·키 SSOT (요약)」.
 */
import { parseDetailBodyStructuredHanatour } from '@/lib/detail-body-parser-hanatour'
import { parseDetailBodyStructuredModetour } from '@/lib/detail-body-parser-modetour'
import { parseDetailBodyStructuredVerygoodtour } from '@/lib/detail-body-parser-verygoodtour'
import { parseDetailBodyStructuredYbtour } from '@/lib/detail-body-parser-ybtour'
import {
  parseVerygoodtourFlightInput,
  parseVerygoodtourOptionalInput,
  parseVerygoodtourShoppingInput,
} from '@/lib/register-input-parse-verygoodtour'

/** fixture 분류용 — API/DB `originSource` 예시는 canonical 키만 사용한다. */
type Sample = { supplier: 'modetour' | 'ybtour' | 'hanatour' | 'verygoodtour'; id: string; text: string }

function brandKeyForSample(s: Sample): string | null {
  return s.supplier
}

function parseDetailBodyForRegressionSample(s: Sample) {
  const bk = brandKeyForSample(s)
  if (bk === 'modetour') return parseDetailBodyStructuredModetour({ rawText: s.text })
  if (bk === 'verygoodtour') return parseDetailBodyStructuredVerygoodtour({ rawText: s.text })
  if (bk === 'hanatour') return parseDetailBodyStructuredHanatour({ rawText: s.text })
  if (bk === 'ybtour') return parseDetailBodyStructuredYbtour({ rawText: s.text })
  throw new Error(`no detail-body parser for brandKey=${bk}`)
}

const samples: Sample[] = [
  {
    supplier: 'modetour',
    id: 'M1',
    text: `여행핵심정보
여행기간 3박4일
항공여정
항공사: 중국남방항공
가는편: 인천 → 연길 2026.04.20(월) 19:20 / CZ6074
오는편: 연길 → 인천 2026.04.23(목) 13:25 / CZ6073
예정호텔
1일차 | 2026-04-20 | 연길 | 예정 | 파라다이스 호텔
선택관광
백두산 투어 USD 180 성인 소요시간 8시간
쇼핑정보
쇼핑품목 인삼 / 쇼핑장소 백화점 / 예상소요시간 40분 / 환불여부 조건부
포함사항 조식 포함
불포함사항 가이드비 별도`,
  },
  {
    supplier: 'modetour',
    id: 'M2',
    text: `상품 핵심정보
항공여정
출발 인천 → 다낭 2026.05.01 11:00 VJ123
입국 다낭 → 인천 2026.05.04 18:00 VJ124
호텔정보
일자/날짜/도시/예약/호텔
1일차/05-01/다낭/예정/A호텔
2일차/05-02/다낭/예정/B호텔
선택경비
선택관광 안내 문구입니다.`,
  },
  {
    supplier: 'modetour',
    id: 'M3',
    text: `여행 주요일정
항공사 대한항공
출발 2026.06.10 09:00
도착 2026.06.13 20:00
쇼핑횟수 총 1회
쇼핑안내
소비자의 권리 안내 장문`,
  },
  {
    supplier: 'ybtour',
    id: 'Y1',
    text: `여행상품 핵심정보
교통 항공편
가는편: 김포 → 오사카 2026-07-01 08:30 / KE721
오는편: 오사카 → 김포 2026-07-04 20:10 / KE722
호텔/숙소
DAY 1 | 07-01 | 오사카 | 예정 | 신사이바시 호텔
선택옵션
1. 유니버설 스튜디오 / 비용 120USD / 시간 6시간 / 미참가시 대기일정 자유시간
쇼핑
회차 1 | 쇼핑 품목 잡화 | 쇼핑 장소 면세점 | 소요시간 50분 | 환불여부 가능`,
  },
  {
    supplier: 'ybtour',
    id: 'Y2',
    text: `여행 주요일정
항공사 제주항공
출발 인천 2026.08.01 10:00
도착 후 일정표
DAY 1 관광
쇼핑 정보 없음`,
  },
  {
    supplier: 'ybtour',
    id: 'Y3',
    text: `상세일정
1일차 도쿄
2일차 도쿄
쇼핑 횟수 총 2회
쇼핑안내
환불규정 장문`,
  },
  {
    supplier: 'hanatour',
    id: 'H1',
    text: `여행핵심정보
출발: 인천 → 방콕 2026.09.10 12:10 / TG659
도착: 방콕 → 인천 2026.09.13 22:20 / TG658
예정호텔
일자 날짜 도시 예약 호텔
1일차 09-10 방콕 예정 A리조트
선택관광 없음
쇼핑센터
도시 방콕 / 쇼핑샵명(위치) ICON / 품목 잡화 / 소요시간 1시간 / 현지/귀국 후 환불여부 조건부`,
  },
  {
    supplier: 'hanatour',
    id: 'H2',
    text: `상품 안내
항공정보
항공사: 아시아나
출발 2026.10.01 07:00
입국 2026.10.04 21:00
호텔
예정호텔은 현지 사정에 따라 변경될 수 있습니다.`,
  },
  {
    supplier: 'hanatour',
    id: 'H3',
    text: `여행 주요일정
DAY 1
DAY 2
포함사항 조식
불포함사항 기사/가이드 팁`,
  },
  {
    supplier: 'verygoodtour',
    id: 'C1',
    text: `여행핵심정보
항공편
가는편: 인천 → 파리 2026.11.03 13:00 / AF267
오는편: 파리 → 인천 2026.11.09 09:00 / AF264
호텔정보
일자 날짜 지역 호텔 예약상태
1일차 11-03 파리 루브르호텔 예정
선택관광
세느강 유람선 통화 EUR 성인 55 소요시간 2시간 최소인원 2명`,
  },
  {
    supplier: 'verygoodtour',
    id: 'C2',
    text: `상품 핵심정보
항공사 루프트한자
출발 2026.12.01 09:20
도착 2026.12.05 17:40
쇼핑정보
품목 꿀 / 쇼핑장소 전통상점 / 소요시간 30분 / 환불여부 불가`,
  },
  {
    supplier: 'verygoodtour',
    id: 'C3',
    text: `간략일정
1일차
2일차
유의사항
예약 시 유의사항`,
  },
  {
    supplier: 'verygoodtour',
    id: 'C4',
    text: `여행핵심정보
항공편
출국
2026.07.15 (수) 12:35 인천 출발
2026.07.15 (수) 19:15 로마 도착
입국
2026.07.22 (수) 20:30 파리 출발
2026.07.23 (목) 15:40 인천 도착
호텔정보
전 일정 일급 호텔
2인 1실 기준
3인 1실 시 트리플룸
어린이 투숙 조건 별도 안내
숙박시설 미정이며 출발 전까지 홈페이지를 통해 안내드립니다
선택관광
번호 / 선택관광명 / 내용 / 비용 / 시간 / 미참가시 대기일정 / 대기장소 / 동행여부
1 / 콜로세움 내부관람 / 유적 설명 / EUR 80 / 3시간 / 자유시간 / 광장 / 동행
쇼핑정보
구분 / 쇼핑항목 / 쇼핑장소 / 소요시간 / 현지/귀국 후 환불여부
자유 / 명품 / 백화점 / 60분 / 현지
포함사항 조식`,
  },
  {
    supplier: 'verygoodtour',
    id: 'C5',
    text: `여행핵심정보
항공편
가는편: 인천 → 오사카 2026.10.01 09:00 / NH801
오는편: 오사카 → 인천 2026.10.05 16:00 / NH802
호텔정보
전 일정 특급 호텔
숙박시설 미정
포함사항 조식`,
  },
  {
    supplier: 'verygoodtour',
    id: 'C6',
    text: `여행핵심정보
항공편
가는편: 인천 → 방콕 2026.11.01 12:00 / TG601
오는편: 방콕 → 인천 2026.11.07 22:00 / TG602
호텔정보
숙박시설 미정
선택관광
쇼핑안내
소비자의 권리 및 의무에 관한 안내 장문입니다.
포함사항`,
  },
  {
    supplier: 'verygoodtour',
    id: 'C7',
    text: `여행핵심정보
항공편
가는편: 인천 → 도쿄 2026.08.01 10:00 / NH001
오는편: 도쿄 → 인천 2026.08.05 18:00 / NH002
호텔정보
전 일정 특급 호텔
숙박시설 미정
선택관광
포함사항 조식`,
  },
]

type Row = {
  supplier: string
  id: string
  hotelRows: number
  optRows: number
  shopRows: number
  hasFlightSlice: boolean
  required: number
  warning: number
  info: number
  optionalPollution: boolean
  shoppingLongRefundPollution: boolean
  hotelNarrativePollution: boolean
  flightFailure: string
  hotelFailure: string
  optionalFailure: string
  shoppingFailure: string
  flightRawLen: number
}

function analyzeSample(s: Sample): Row {
  const r = parseDetailBodyForRegressionSample(s)
  const optionalPollution = r.optionalToursStructured.rows.some((x) =>
    /(선택경비|마일리지|안내문|유의사항|본 상품은)/i.test(`${x.tourName} ${x.descriptionText}`)
  )
  const shoppingLongRefundPollution = r.shoppingStructured.rows.some((x) =>
    /(소비자의 권리|법률|장문|약관)/i.test(`${x.shoppingItem} ${x.refundPolicyText}`)
  )
  const hotelNarrativePollution = r.hotelStructured.rows.some((x) =>
    /(현지 사정에 따라 변경|안내문|유의사항)/i.test(x.hotelNameText)
  )
  const flightRawLen = (r.raw.flightRaw ?? '').trim().length
  const hasFlightSlice = flightRawLen >= 40
  return {
    supplier: s.supplier,
    id: s.id,
    hotelRows: r.hotelStructured.rows.length,
    optRows: r.optionalToursStructured.rows.length,
    shopRows: r.shoppingStructured.rows.length,
    hasFlightSlice,
    required: r.review.required.length,
    warning: r.review.warning.length,
    info: r.review.info.length,
    optionalPollution,
    shoppingLongRefundPollution,
    hotelNarrativePollution,
    flightFailure: (r.failurePatterns?.flight ?? []).join(',') || '-',
    hotelFailure: (r.failurePatterns?.hotel ?? []).join(',') || '-',
    optionalFailure: (r.failurePatterns?.optionalTour ?? []).join(',') || '-',
    shoppingFailure: (r.failurePatterns?.shopping ?? []).join(',') || '-',
    flightRawLen,
  }
}

/**
 * 참좋은: 본문 파서는 항공/옵션/쇼핑 필드를 비운다.
 * 동일 슬라이스를 **입력 파서**에 넘기면(= 정형칸에 붙인 것과 동일) 구조화되는지 검증한다.
 */
function assertVerygoodTourRegressionContract(): void {
  const c4 = samples.find((s) => s.id === 'C4')
  if (!c4) throw new Error('fixture C4 missing')
  const r4 = parseDetailBodyStructuredVerygoodtour({ rawText: c4.text })
  if (r4.brandKey !== 'verygoodtour') throw new Error('C4 brandKey must canonicalize to verygoodtour')
  if (r4.flightStructured.rawFlightLines.length !== 0) throw new Error('C4 body-parser must leave flightStructured empty')
  if (r4.optionalToursStructured.rows.length !== 0) throw new Error('C4 body-parser must leave optional empty')
  if (r4.shoppingStructured.rows.length !== 0) throw new Error('C4 body-parser must leave shopping empty')
  if (r4.hotelStructured.rows.length !== 0 || r4.hotelStructured.reviewNeeded)
    throw new Error('C4 policy hotel must be empty rows, no review')
  const fr = r4.raw.flightRaw?.trim() ?? ''
  if (!fr) throw new Error('C4 flightRaw slice expected')
  const fl = parseVerygoodtourFlightInput(fr, r4.normalizedRaw)
  if (fl.debug?.status !== 'success') throw new Error('C4 register-input flight on sliced flightRaw must succeed')
  const joinSec = (t: 'optional_tour_section' | 'shopping_section') =>
    r4.sections.filter((x) => x.type === t).map((s) => s.text).filter(Boolean).join('\n')
  const optSec = joinSec('optional_tour_section')
  const shopSec = joinSec('shopping_section')
  if (parseVerygoodtourOptionalInput(optSec).rows.length < 1) throw new Error('C4 optional input parser on section text')
  if (parseVerygoodtourShoppingInput(shopSec, null).rows.length < 1) throw new Error('C4 shopping input parser on section text')

  const c5 = samples.find((s) => s.id === 'C5')!
  const r5 = parseDetailBodyStructuredVerygoodtour({ rawText: c5.text })
  if (r5.optionalToursStructured.rows.length !== 0) throw new Error('C5 optional section absent → rows 0')
  if (r5.optionalToursStructured.reviewNeeded) throw new Error('C5 optional must not reviewNeeded')
  if ((r5.sectionReview.optional_tour_section?.required ?? []).length > 0)
    throw new Error('C5 optional section required must be empty')
  if ((r5.failurePatterns?.optionalTour ?? []).length > 0) throw new Error('C5 optional failurePatterns must be empty for verygoodtour')

  const c6 = samples.find((s) => s.id === 'C6')!
  const r6 = parseDetailBodyStructuredVerygoodtour({ rawText: c6.text })
  if (r6.shoppingStructured.rows.length !== 0) throw new Error('C6 shopping notice-only → rows 0')
  if (r6.shoppingStructured.reviewNeeded) throw new Error('C6 shopping must not reviewNeeded')
  if ((r6.sectionReview.shopping_section?.required ?? []).length > 0)
    throw new Error('C6 shopping section required must be empty')
  if ((r6.failurePatterns?.shopping ?? []).length > 0) throw new Error('C6 shopping failurePatterns must be empty for verygoodtour')

  const c7 = samples.find((s) => s.id === 'C7')!
  const r7 = parseDetailBodyStructuredVerygoodtour({ rawText: c7.text })
  if (r7.optionalToursStructured.rows.length !== 0) throw new Error('C7 optional title-only → rows 0')
  if (r7.optionalToursStructured.reviewNeeded) throw new Error('C7 optional must not reviewNeeded')
  if ((r7.sectionReview.optional_tour_section?.required ?? []).length > 0)
    throw new Error('C7 optional section required must be empty')
  if ((r7.failurePatterns?.optionalTour ?? []).length > 0) throw new Error('C7 optional failurePatterns must be empty for verygoodtour')
}

function main() {
  assertVerygoodTourRegressionContract()
  const rows = samples.map(analyzeSample)
  console.log(
    '| 공급사 | 샘플 | 호텔 rows | opt rows(본문) | shop rows(본문) | 항공슬라이스 | required | warning | info | 선택 오염 | 쇼핑 오염 | 호텔 서술 오염 |'
  )
  console.log('|---|---:|---:|---:|---:|---|---:|---:|---:|---|---|---|')
  for (const r of rows) {
    console.log(
      `| ${r.supplier} | ${r.id} | ${r.hotelRows} | ${r.optRows} | ${r.shopRows} | ${r.hasFlightSlice ? 'O' : 'X'} | ${r.required} | ${r.warning} | ${r.info} | ${r.optionalPollution ? '있음' : '없음'} | ${r.shoppingLongRefundPollution ? '있음' : '없음'} | ${r.hotelNarrativePollution ? '있음' : '없음'} |`
    )
  }

  const sum = (k: keyof Row) => rows.reduce((a, r) => a + (typeof r[k] === 'number' ? (r[k] as number) : 0), 0)
  const sliceNow = rows.filter((r) => r.hasFlightSlice).length
  const improved = {
    label: '현재(본문파서 단독)',
    flightSliceCount: sliceNow,
    hotelRows: sum('hotelRows'),
    optionalRows: sum('optRows'),
    shoppingRows: sum('shopRows'),
    required: sum('required'),
    warning: sum('warning'),
    info: sum('info'),
  }
  console.log(
    '\n| 단계 | 항공 슬라이스(길이≥40) 샘플 수 | 호텔 rows 합 | opt rows 합(본문=0) | shop rows 합(본문=0) | required 합 | warning 합 | info 합 |'
  )
  console.log('|---|---:|---:|---:|---:|---:|---:|---:|')
  console.log(
    `| ${improved.label} | ${improved.flightSliceCount} | ${improved.hotelRows} | ${improved.optionalRows} | ${improved.shoppingRows} | ${improved.required} | ${improved.warning} | ${improved.info} |`
  )

  const failureTable = rows.map((r) => ({
    supplier: r.supplier,
    id: r.id,
    flight: r.flightFailure,
    hotel: r.hotelFailure,
    optionalTour: r.optionalFailure,
    shopping: r.shoppingFailure,
  }))
  console.log('\nFailure patterns:')
  for (const f of failureTable) {
    console.log(`[${f.supplier}/${f.id}] flight=${f.flight} | hotel=${f.hotel} | optional=${f.optionalTour} | shopping=${f.shopping}`)
  }

  const flightFailures = new Set(['M2', 'Y2', 'H2', 'C2'])
  const flightFocus = rows.filter((r) => flightFailures.has(r.id))
  console.log('\nFlight slice focus (M2/Y2/H2/C2) — 본문 파서는 raw.flightRaw만 제공:')
  for (const f of flightFocus) {
    console.log(`- [${f.supplier}/${f.id}] flightRawLen=${f.flightRawLen} slice=${f.hasFlightSlice ? 'yes' : 'no'} patterns=${f.flightFailure}`)
  }

  const remained = new Set(['Y3', 'H3', 'C3'])
  console.log('\nShort flight seed samples (Y3/H3/C3):')
  for (const r of rows.filter((x) => remained.has(x.id))) {
    console.log(`- [${r.supplier}/${r.id}] flightRawLen=${r.flightRawLen} slice=${r.hasFlightSlice ? 'yes' : 'no'}`)
  }
}

main()

