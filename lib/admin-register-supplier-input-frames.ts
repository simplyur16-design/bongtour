/**
 * 관리자 상품 등록 — 공급사별 정형 입력 프레임·placeholder·우선순위.
 * 초정밀 규약 전문: `docs/admin-register-supplier-precise-spec.md`
 * (어댑터/스크래퍼/DB 스키마와 무관)
 */
import { normalizeBrandKeyToCanonicalSupplierKey } from '@/lib/overseas-supplier-canonical-keys'

export type RegisterSupplierFrameKey =
  | 'modetour'
  | 'verygoodtour'
  | 'hanatour'
  | 'ybtour'
  | 'kyowontour'
  | 'lottetour'

export type RegisterPastePlaceholders = {
  body: string
  airlineTransport: string
  hotel: string
  optionalTour: string
  shopping: string
}

/** 관리자 등록 상단 `travelScope` — 국내 선택 시 모두투어 항공칸에 버스·기차 안내를 덧붙임 */
export type AdminRegisterTravelScope = 'overseas' | 'domestic' | 'air_hotel_free'

/** 표/도움말용: 축별 기본 형태·슬롯 요약 */
export type SupplierInputFrameAxis = {
  axis: '본문(LLM)' | '항공' | '호텔' | '옵션' | '쇼핑'
  shape: string
  slots: string
}

export type SupplierInputFrameSpec = {
  displayName: string
  axes: SupplierInputFrameAxis[]
  placeholders: RegisterPastePlaceholders
}

function ph(lines: string[]): string {
  return lines.join('\n')
}

/** 모두투어 항공칸 placeholder — 해외·에어텔 등 기본 (국내 전용 줄은 `MODETOUR_AIRLINE_PLACEHOLDER_DOMESTIC_EXTRA`) */
const MODETOUR_AIRLINE_PLACEHOLDER_LINES = [
  '항공사: 중국남방항공',
  '출발 : 인천(ICN) 2026.07.07(월) 19:20 → 연길 2026.07.07(월) 20:40 CZ6074',
  '도착 : 연길 2026.07.10(목) 10:10 → 인천 2026.07.10(목) 13:25 CZ6073',
  '— 또는 A→B 후 귀국 C→A 예 —',
  '출발 : 인천 2026.08.01 10:00 → 하노이 2026.08.01 13:30 VN408',
  '도착 : 다낭 2026.08.08 14:00 → 인천 2026.08.08 20:00 VN409',
]

const MODETOUR_AIRLINE_PLACEHOLDER_DOMESTIC_EXTRA = [
  '— 국내 버스·기차(항공칸에 동일 형식) —',
  '버스여행',
  '출발 : 2026.04.21(화) 07:00 → 2026.04.21(화) 11:30',
  '도착 : 2026.04.22(수) 15:00 → 2026.04.22(수) 20:00',
]

const MODETOUR: SupplierInputFrameSpec = {
  displayName: '모두투어',
  axes: [
    {
      axis: '본문(LLM)',
      shape: '서술 전용 (섹션 슬라이스 + LLM)',
      slots:
        '담당: 일정·관광·식사·이동·일차별 서술, 포함/불포함, 주의사항. 날짜 예) 2026.07.07(화). 비담당: 항공/호텔/옵션/쇼핑 표의 최종 SSOT.',
    },
    {
      axis: '항공',
      shape: '항공사 1줄 + 출발(가는편) 1줄 + 도착(오는편) 1줄',
      slots:
        '슬롯(출발편/귀국편 분리): 항공사 | 각 편: 출발도시·출발일시·도착도시·도착일시·편명. 공항코드 보존. 소요시간 보조. A→B→A 및 A→B + C→A 허용.',
    },
    {
      axis: '호텔',
      shape: '일자별 반복 표 (= hotelByDay)',
      slots: '일차 | 날짜 | 도시 | 호텔명 (동일 호텔 연박 반복 허용).',
    },
    {
      axis: '옵션',
      shape: '표형 (30행+ 허용)',
      slots:
        '옵션명 | 통화 | 성인가 | 아동가 | 소요시간 | 최소인원 | 동행여부 | 미참여시 대기장소·일정. 도시별 반복·중복 유지(당장 병합 안 함).',
    },
    {
      axis: '쇼핑',
      shape: '품목·대표장소·추가장소 + 횟수 분리',
      slots:
        '쇼핑항목 | 대표쇼핑장소 | 추가장소목록[] | 소요시간 | 환불여부. shoppingVisitCount는 본문/메타/상단 한 줄과 분리; 리스트와 불일치 시 리스트·교정 우선.',
    },
  ],
  placeholders: {
    body: ph([
      '[모두투어 본문 — LLM·서술만]',
      '1일차: … 관광 · 점심 … 이동 …',
      '2일차: …',
      '▶ 포함: …  ▶ 불포함: …  ▶ 유의사항: …',
      '(항공·호텔·선택관광·쇼핑 확정 데이터는 아래 정형칸. 본문만으로 SSOT 대체 안 함)',
    ]),
    airlineTransport: ph(MODETOUR_AIRLINE_PLACEHOLDER_LINES),
    hotel: ph([
      '일차 | 날짜 | 도시 | 호텔명',
      '1일차 | 2026-07-07 | 연길 | ○○호텔 (예정)',
      '2일차 | 2026-07-08 | 연길 | 동일',
    ]),
    optionalTour: ph([
      '옵션명 | 통화 | 성인 | 아동 | 소요시간 | 최소인원 | 동행 | 미참여시 대기',
      '백두산 북파 | CNY | 800 | 600 | 약 8시간 | 4명 | 비동행 | 호텔 로비 대기',
    ]),
    shopping: ph([
      '쇼핑 횟수: 2회   (← shoppingVisitCount와 동일 의미로 적어도 됨, 리스트와 별개)',
      '쇼핑항목 | 대표장소 | 추가장소 | 시간 | 환불',
      '인삼·약재 | ○○인삼센터 | △△상점, □□마트 | 40분 | 조건부',
    ]),
  },
}

const VERYGOOD: SupplierInputFrameSpec = {
  displayName: '참좋은여행사',
  axes: [
    {
      axis: '본문(LLM)',
      shape: '서술 + 여정 요약문',
      slots:
        '담당: 일정·관광, 이동·식사, 포함/불포함, 호텔 설명형, 유의사항. 비담당: 항공·호텔표·옵션표·쇼핑표 최종 SSOT.',
    },
    {
      axis: '항공',
      shape: '출국 블록 + 입국 블록',
      slots:
        '항공사. 출국: 출발도시·출발일시·도착도시·도착일시·편명. 입국: 동일 슬롯. 공항코드·소요시간 보조.',
    },
    {
      axis: '호텔',
      shape: '미정·설명형 허용',
      slots: '호텔유형 | 확정여부 | 호텔명 또는 미정 | 설명/비고.',
    },
    {
      axis: '옵션',
      shape: '번호 포함 표',
      slots: '번호 | 옵션명 | 내용요약 | 비용 | 소요시간 | 미참가시 대기일정 | 대기장소 | 동행여부.',
    },
    {
      axis: '쇼핑',
      shape: '쇼핑총횟수 + 회차 리스트',
      slots: '1행: 쇼핑 총 N회. 이후: 회차 | 쇼핑항목 | 쇼핑장소 | 소요시간 | 환불여부.',
    },
  ],
  placeholders: {
    body: ph([
      '[참좋은 본문 — LLM·서술]',
      '[여행여정 요약] … (있으면 그대로)',
      '일정·관광·식사·이동, 포함/불포함, 호텔은 ○급·미정 등 설명, 유의사항.',
    ]),
    airlineTransport: ph([
      '항공사: ○○항공',
      '【출국】 인천(ICN) 2026-08-01 09:00 → 방콕(BKK) 2026-08-01 13:20  OZ○○○',
      '【입국】 방콕 2026-08-08 14:30 → 인천 2026-08-08 21:00  OZ○○○',
    ]),
    hotel: ph([
      '호텔유형 | 확정여부 | 호텔명/미정 | 비고',
      '4성급 | 예정 | 미정 | 방콕 시내 호텔급, 확정 시 안내',
    ]),
    optionalTour: ph([
      '번호 | 옵션명 | 요약 | 비용 | 시간 | 미참가 대기일정 | 대기장소 | 동행',
      '1 | 메콩델타 | … | 50USD | 2시간 | 호텔대기 | 로비 | 비동행',
    ]),
    shopping: ph([
      '쇼핑 총 3회',
      '회차 | 항목 | 장소 | 시간 | 환불',
      '1 | 실크 | ○○상점 | 30분 | 불가',
    ]),
  },
}

const HANATOUR: SupplierInputFrameSpec = {
  displayName: '하나투어',
  axes: [
    {
      axis: '본문(LLM)',
      shape: '서술 (미팅·가이드·호텔 소개 길게)',
      slots:
        '담당: 일정·관광·식사, 포함/불포함, 주의사항, 가이드/미팅, 호텔 소개 문구. 비담당: 항공·호텔 후보 리스트·옵션·쇼핑 행 최종 SSOT.',
    },
    {
      axis: '항공',
      shape: '출발편 / 귀국편 (요약·상세 혼용)',
      slots:
        '항공사. 각 편: 출발도시·출발공항·출발일시·도착도시·도착공항·도착일시·편명·소요시간(선택).',
    },
    {
      axis: '호텔',
      shape: '예정호텔 다중 후보',
      slots: '호텔유형 | 후보호텔목록[] | 객실기준 | 확정시점 | 설명/비고.',
    },
    {
      axis: '옵션',
      shape: '옵션 블록 반복',
      slots: '옵션명, 성인가, 아동가, 소요시간, 대체일정, 미선택시 가이드동행, 비고.',
    },
    {
      axis: '쇼핑',
      shape: '쇼핑 후보지(방문 후보) 목록',
      slots:
        '도시 | 쇼핑샵명 | 위치 | 품목 | 소요시간. 이 칸은 **방문 횟수**가 아니라 **후보 매장·면세·몰**을 적는 곳. 쇼핑 N회는 본문 상단·일정 문구에서 별도 추출.',
    },
  ],
  placeholders: {
    body: ph([
      '[하나투어 본문 — LLM·서술]',
      '상품 소개, 일정 요약, 관광·식사, 포함/불포함, 미팅장소·가이드 안내, 호텔 소개 문구(다후보 설명), 유의사항.',
    ]),
    airlineTransport: ph([
      '항공사: 아시아나항공',
      '【출발편】',
      'ICN 인천국제공항 2026-09-10 14:00 → LAX 로스앤젤레스 2026-09-10 10:00  OZ202  (약 11시간)',
      '【귀국편】',
      'LAX 로스앤젤레스 2026-09-20 12:00 → ICN 인천 2026-09-21 17:30  OZ203',
    ]),
    hotel: ph([
      '호텔유형 | 후보호텔(복수) | 객실 | 확정시점 | 비고',
      '4성급 | 그랜드○○ / 시티△△ / 에어포트□□ | 2인1실 | 출발 7일전 | 동급 변경 가능',
    ]),
    optionalTour: ph([
      '○○ 나이아가라 당일투어',
      '성인 USD 150 / 아동 USD 120 | 약 10시간',
      '미선택 시 가이드 동행 | 대체: 자유일정 | 비고: …',
    ]),
    shopping: ph([
      '[쇼핑 후보지 — 횟수(쇼핑 N회)는 여기가 아니라 본문에서 추출]',
      '도시 | 쇼핑샵명 | 위치 | 품목 | 시간',
      '후쿠오카 | 시내면세점 | 시내 | 면세 | 약 60분',
      '후쿠오카 | 라라포트 후쿠오카 | 도시 근교 | 잡화 | 약 90분',
    ]),
  },
}

const YELLOW: SupplierInputFrameSpec = {
  displayName: '노랑풍선',
  axes: [
    {
      axis: '본문(LLM)',
      shape: '서술',
      slots:
        '담당: 일정·관광, 포함/불포함, 주의사항, 상품 소개. 비담당: 항공·호텔·옵션·쇼핑 표 SSOT. 옵션/쇼핑 혼동 주의 → 정형칸으로 분리.',
    },
    {
      axis: '항공',
      shape: '출발편 / 귀국편 블록',
      slots: '항공사. 각 편: 편명, 출발도시, 출발일시, 도착도시, 도착일시.',
    },
    {
      axis: '호텔',
      shape: '미정·설명형',
      slots: '일정구간 또는 도시 | 호텔명 | 확정여부 | 비고 | 또는 호텔설명만.',
    },
    {
      axis: '옵션',
      shape: '설명형 + 비용/시간',
      slots: '옵션명 | 비용 | 소요시간 | 미참여시 내용 | 동행여부 | 비고.',
    },
    {
      axis: '쇼핑',
      shape: '회차형',
      slots: '쇼핑총횟수 + 회차 | 쇼핑품목 | 쇼핑장소 | 소요시간 | 환불여부.',
    },
  ],
  placeholders: {
    body: ph([
      '[노랑풍선 본문 — LLM·서술]',
      '일정·관광, 포함/불포함, 주의사항, 상품 특징.',
      '(옵션·쇼핑은 문구가 비슷해도 아래 각각 정형칸에 분리)',
    ]),
    airlineTransport: ph([
      '항공사: 제주항공',
      '— 출발편 —',
      '7C○○○ | 김포 2026-10-01 08:00 → 제주 2026-10-01 09:10',
      '— 귀국편 —',
      '7C○○○ | 제주 2026-10-05 19:00 → 김포 2026-10-05 20:10',
    ]),
    hotel: ph([
      '구간/도시 | 호텔명 | 확정 | 비고/호텔설명',
      '제주 2박 | ○○리조트 | 예정 | 신규급 리조트 안내',
    ]),
    optionalTour: ph([
      '○○ 체험 | 비용 성인 5만원 | 소요 약 2시간',
      '미참여: 호텔 자유시간 | 동행: 가이드 미동행 | 비고: …',
    ]),
    shopping: ph([
      '쇼핑 총 2회',
      '회차 | 품목 | 장소 | 시간 | 환불',
      '1 | 한라봉·초콜릿 | ○○마트 | 30분 | 불가',
    ]),
  },
}

/** 교원이지(kyowontour) — 정형칸 SSOT (본문 LLM과 분리). */
/** 롯데관광(lottetour) — 상세 URL·마스터/행사 이원·정형칸 SSOT (교원이지 프레임을 베이스로 사이트 구조만 반영). */
const LOTTETOUR: SupplierInputFrameSpec = {
  displayName: '롯데관광',
  axes: [
    {
      axis: '본문(LLM)',
      shape: '서술 전용 (DAY n·포함/불포함·일정표 SSR)',
      slots:
        '담당: 일정·관광·식사·이동·포함/불포함·인솔자·주의사항. 비담당: 항공·호텔·옵션·쇼핑 확정 데이터는 아래 정형칸이 우선(SSOT). 상품 URL은 `originUrl`에 `/evtDetail/{menuNo1}/{menuNo2}/{menuNo3}/{menuNo4}?evtCd=…` 형태로 저장.',
    },
    {
      axis: '항공',
      shape: '한국출발 / 한국도착 블록 (전세기·KE0000 placeholder 가능)',
      slots:
        '항공사·편명(placeholder 포함). 한국출발·현지도착·현지출발·한국도착 일시·공항. 정형칸이 있으면 본문 항공 추출보다 우선.',
    },
    {
      axis: '호텔',
      shape: '도시별 예정·다후보·[미정]',
      slots: '도시별 호텔 후보(최대 4안)·[미정]·동급 변경 문구. 일정표 SSR과 정형칸 병행 시 표가 우선.',
    },
    {
      axis: '옵션',
      shape: '유로/원 표 + 소요시간 + 인솔자 동행 여부',
      slots: '선택관광명 | 통화·1인요금 | 소요시간 | 대체일정 | 인솔자 동행(미동반 등).',
    },
    {
      axis: '쇼핑',
      shape: '품목·장소·시간·환불',
      slots: '쇼핑 횟수 요약(선택) | 품목 | 장소 | 소요시간 | 환불 가능 여부.',
    },
  ],
  placeholders: {
    body: ph([
      '[롯데관광 본문 — LLM·서술]',
      'originUrl 예: https://www.lottetour.com/evtDetail/826/854/1000/4900?evtCd=E01A260624KE007',
      '식별: godId(마스터)=65222, evtCd(행사·팀)=E01A260624KE007, menuNo1~4=826/854/1000/4900',
      '일차별 DAY 1~DAY n, 포함/불포함, 인솔자·현지필수경비(불포함) 등.',
    ]),
    airlineTransport: ph([
      '항공사: 대한항공 (전세기)',
      '한국출발: 2026-06-24(수) 11:40 KE0000 인천 → …',
      '한국도착: 2026-07-02(목) 13:35 KE0000 인천',
      '(KE0000 등 placeholder는 정형칸·파서에서 사이트 스크랩 결과로 치환)',
    ]),
    hotel: ph([
      '도시 | 예정 호텔 후보(미정 가능)',
      '베니스 | A호텔 / B호텔 / C호텔 / D호텔 또는 [미정]',
    ]),
    optionalTour: ph([
      '선택관광명 | 1인요금 | 소요시간 | 인솔자',
      '베니스 곤돌라 | €60 | 약 40분 | 미동반',
    ]),
    shopping: ph([
      '쇼핑 횟수(요약)',
      '품목 | 장소 | 시간 | 환불',
    ]),
  },
}

const KYOWONTOUR: SupplierInputFrameSpec = {
  displayName: '교원이지',
  axes: [
    {
      axis: '본문(LLM)',
      shape: '서술 전용',
      slots:
        '담당: 일정·관광·식사·이동·포함/불포함·주의사항. 비담당: 항공·호텔·옵션·쇼핑 확정 데이터는 아래 정형칸이 우선(SSOT).',
    },
    {
      axis: '항공',
      shape: 'LCC/정규편 — 한국↔현지 구간 슬롯',
      slots:
        '항공사(예: 비엣젯 VJ) | 가는편: 한국 출발 공항·일시 → 현지 도착 공항·일시 | 오는편: 현지 출발 → 한국 도착. 편명·공항코드 보존.',
    },
    {
      axis: '호텔',
      shape: '등급·구간 요약',
      slots: '도시별 "시내 4성급 또는 동급" 등급·숙박일수·동급 변경 가능 여부.',
    },
    {
      axis: '옵션',
      shape: 'USD 성인·아동·유아 + 소요시간 + 대체일정',
      slots:
        '옵션명 | 성인 USD | 아동 USD | 유아 USD | 소요시간 | 미참여 시 대체일정(호텔 대기/자유 등) | 동행 여부.',
    },
    {
      axis: '쇼핑',
      shape: '품목·장소·시간·환불',
      slots: '쇼핑 횟수 요약(선택) | 품목 | 대표 장소 | 소요시간 | 환불 가능 여부.',
    },
  ],
  placeholders: {
    body: ph([
      '[교원이지 본문 — LLM·서술]',
      '일차별 관광·식사·이동, 포함/불포함, 유의사항.',
      '(항공·호텔·옵션·쇼핑은 아래 정형칸이 본문 자동추출보다 우선)',
    ]),
    airlineTransport: ph([
      '항공사: 비엣젯 (VJ)',
      '— 한국 출발 —',
      'VJ○○○ | 인천(ICN) 2026-08-10 09:20 → 다낭(DAD) 2026-08-10 12:05',
      '— 현지 출발(귀국) —',
      'VJ○○○ | 다낭(DAD) 2026-08-15 13:10 → 인천(ICN) 2026-08-15 19:40',
      '— 현지 구간(국내선) 예시 —',
      'VN○○○ | 호치민 2026-08-12 08:00 → 다낭 2026-08-12 09:30',
    ]),
    hotel: ph([
      '다낭 3박 | 시내 4성급 또는 동급 | 예정 | 동급 변경 가능',
      '호이안 1박 | 구시가지 4성 호텔급 | 예정',
    ]),
    optionalTour: ph([
      '옵션명 | 성인 USD | 아동 USD | 유아 USD | 소요시간 | 대체일정',
      '바나힐 케이블카+내부 관광 | 85 | 75 | 0 | 약 6시간 | 미참여: 호텔 자유(가이드 미동행)',
      '챠밍 데이 투어 | 45 | 40 | 0 | 약 4시간 | 미참여: 인근 해변 자유',
    ]),
    shopping: ph([
      '쇼핑 총 2회(요약)',
      '품목 | 장소 | 시간 | 환불',
      '실크·대나무 제품 | 호이안 올드타운 기념품 거리 | 40분 | 조건부',
      '커피·과자 | 다낭 대형 마트 | 30분 | 불가',
    ]),
  },
}

const SPECS: Record<RegisterSupplierFrameKey, SupplierInputFrameSpec> = {
  modetour: MODETOUR,
  verygoodtour: VERYGOOD,
  hanatour: HANATOUR,
  ybtour: YELLOW,
  kyowontour: KYOWONTOUR,
  lottetour: LOTTETOUR,
}

/** canonical 해외 공급사는 전용 프레임. 그 외·비표준 키는 하나투어 프레임으로 안내 */
export function registerSupplierFrameKey(brandKey: string | null | undefined): RegisterSupplierFrameKey {
  const canon = normalizeBrandKeyToCanonicalSupplierKey(brandKey)
  if (canon) return canon
  return 'hanatour'
}

export function getSupplierInputFrameSpec(
  brandKey: string | null | undefined,
  travelScope?: AdminRegisterTravelScope | null
): SupplierInputFrameSpec {
  const key = registerSupplierFrameKey(brandKey)
  const base = SPECS[key]
  if (key !== 'modetour' || travelScope !== 'domestic') {
    return base
  }
  return {
    ...base,
    axes: base.axes.map((axis) =>
      axis.axis === '항공'
        ? {
            axis: '항공',
            shape: '항공사 1줄 + 출발(가는편) 1줄 + 도착(오는편) 1줄 (국내 버스·기차도 동일 슬롯)',
            slots:
              '슬롯(출발편/귀국편 분리): 항공사(또는 버스여행·기차여행 등 1줄) | 각 편: 출발도시·출발일시·도착도시·도착일시·편명. 국내 버스·기차는 일시만(→ 좌우)도 가능. 공항코드 보존. 소요시간 보조. A→B→A 및 A→B + C→A 허용.',
          }
        : axis
    ),
    placeholders: {
      ...base.placeholders,
      airlineTransport: ph([...MODETOUR_AIRLINE_PLACEHOLDER_LINES, ...MODETOUR_AIRLINE_PLACEHOLDER_DOMESTIC_EXTRA]),
    },
  }
}

export function getRegisterPastePlaceholders(
  brandKey: string | null | undefined,
  travelScope?: AdminRegisterTravelScope | null
): RegisterPastePlaceholders {
  return getSupplierInputFrameSpec(brandKey, travelScope).placeholders
}

/** 관리자 `<details>` 패널 — 공급사 무관 공통 우선순위 */
export const REGISTER_INPUT_PRIORITY_RULES: string[] = [
  '본문 LLM이 맡는 것: 일정·관광·식사·이동·포함/불포함·주의사항·일차별 서술·(참좋은) 여정 요약·호텔/상품 설명형 문구.',
  '정형칸이 맡는 것: 항공(출발편/귀국편 슬롯), 호텔 표·후보·일자별 행, 옵션 표/블록 전 행, 쇼핑 표 행 + (별도) 쇼핑 횟수 요약.',
  '항공이 본문 flight_section과 정형칸에 같이 있으면: flightRaw에 병합 후 파싱. 충돌 시 정형칸을 확정에 가깝게 운영.',
  '호텔 후보(표)와 호텔 설명이 같이 있으면: 정형칸 표가 구조화 SSOT 우선, 설명은 본문·비고에 병행.',
  '쇼핑 횟수(shoppingVisitCount)와 쇼핑 리스트(shoppingItems/행)가 충돌하면: 리스트·교정·검수로 사실 확정, 횟수 필드는 요약 정합을 맞춤.',
  '옵션관광 최종 SSOT: 정형칸에 내용이 있으면 그 블록이 1차 SSOT; 본문 LLM 보조 JSON은 그에 종속.',
  '정형칸에 비어 있지 않으면 해당 섹션은 본문 자동추출보다 항상 우선(섹션 텍스트 덮어쓰기 + 항공 flightRaw 병합).',
  '본문 LLM만으로 항공·호텔·옵션·쇼핑의 최종 SSOT를 대체하지 않는다.',
]

/**
 * 등록 API 잔여물 축소·삭제 검토용 — 모두/참좋은/하나/노랑은 전용 route, 교원·기타·내부 스크립트 등은 `/parse-and-register` fallback.
 * 실삭제 전 grep/테스트 필수. 상세: docs/admin-register-supplier-precise-spec.md §7
 */
export const REGISTER_ADMIN_ROUTE_DEPRECATION_CANDIDATES: Array<{
  id: string
  path: string
  whyCandidate: string
  verifyBeforeDelete: string
  impactIfRemoved: string
}> = [
  {
    id: 'route-parse-and-register',
    path: 'app/api/travel/parse-and-register/route.ts',
    whyCandidate: '410 전용 엔드포인트(레거시 호출 차단). 완전 삭제는 클라이언트·스크립트 잔여 참조 제거 후',
    verifyBeforeDelete: 'grep `/api/travel/parse-and-register`',
    impactIfRemoved: '구 클라이언트가 410 외 기대하면 깨짐',
  },
  {
    id: 'doc-admin-register-single-ux',
    path: 'docs/ADMIN-REGISTER-SINGLE-UX.md',
    whyCandidate: '역사적 단일 엔드포인트 서술 링크 점검(본 문서·§7 개정 후 재검토)',
    verifyBeforeDelete: '문서 링크 참조 여부',
    impactIfRemoved: '문서만; 코드 무영향',
  },
  {
    id: 'script-qa-verygoodtour',
    path: 'scripts/qa-verygoodtour-preview-smoke.ts',
    whyCandidate: '참좋은 스모크가 전용 URL만 치는지·주석이 공용을 암시하는지 주기 확인',
    verifyBeforeDelete: 'CI/로컬 스모크에서 사용 여부',
    impactIfRemoved: '스크립트·주석 정리 시 영향',
  },
]
