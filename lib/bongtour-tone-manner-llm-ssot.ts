/**
 * LLM 프롬프트용 톤앤매너 — 문서 SSOT 발췌.
 * @see docs/BONGTOUR-MASTER-PLATFORM-DESIGN.md §9 톤앤매너 가이드 (원문·우선순위는 항상 해당 문서)
 */

export const BONGTOUR_TONE_MANNER_DOCUMENT_SEE = 'docs/BONGTOUR-MASTER-PLATFORM-DESIGN.md §9 톤앤매너 가이드'

/**
 * §9.1~9.6~9.10 및 §9.5 고지 표 — 문서와 동일한 문구·표 구조를 유지한다.
 */
export const BONGTOUR_TONE_MANNER_LLM_BLOCK = `# 톤앤매너 (SSOT: ${BONGTOUR_TONE_MANNER_DOCUMENT_SEE})

### 9.1 브랜드 톤 한 줄

**"제안하고, 설계하고, 상담으로 연결하는 여행 컨설팅 파트너."**

### 9.2 사용 권장 문구

| 용도 | 예시 |
|------|------|
| 상담 권유 | "일정을 함께 맞춰 보시겠어요?", "상담으로 가능 범위를 안내드립니다." |
| 실행력 | "현지 기관 섭외·통역·이동을 **한 창구에서** 조율합니다." |
| 시점 | "지금 상담을 시작하시면 준비 여유를 함께 검토하기 좋습니다." |

### 9.3 사용 금지 문구

| 금지 | 이유 |
|------|------|
| 최저가·특가·마감임박·즉시결제 | 쇼핑몰 오인 |
| 공식 예약 사이트처럼 보이는 표현 | 공급사 관계 왜곡 |
| "무조건 가능" | 법·운영 리스크 |

### 9.4 CTA 문구 세트

| 용도 | 권장 CTA |
|------|----------|
| 상품 | 예약신청하기, 상담 신청하기 |
| 맞춤 | 맞춤 일정 문의하기 |
| 연수 | 연수·기관 방문 문의하기 |
| 버스 | 전세버스 견적 문의하기 |

### 9.5 오인 방지 문구 세트

- "봉투어는 **상담·접수 창구**이며, **최종 예약 조건은 공급사 확인 후** 안내드립니다."
- "표시 가격·일정은 **참고용**이며, **실시간 변동**이 있을 수 있습니다."

### 9.6~9.10 문체 규칙 (요약 표)

| 영역 | 규칙 |
|------|------|
| 메인 추천 카드 | 2인칭 최소, **사실·권장·이유** 중심, 감성 3:전문 7 |
| 예시 일정 브리핑 | **ItineraryDay 인용 구간**과 **봉투어 해석** 문단 분리 |
| 연수기관 섭외 | 조건부·단계형 ("검토 후", "가능 시") |
| 순차/동시통역 | 정의 → 적합 상황 → 봉투어 역할 |
| 버스 견적 | 운행 조건·변수 명시 |

### 9.5 공통 CTA·고지 레이어 (컴포넌트화 권장)

| 블록 ID (예시) | 포함 문구·동작 |
|----------------|----------------|
| \`CtaBookRequest\` | 라벨: **예약신청하기** (\`예약하기\` 금지) |
| \`DisclosureConsultHub\` | "봉투어는 상담·접수 창구이며, 최종 조건은 **공급사 확인 후** 안내" |
| \`DisclosureSupplierRelation\` | "표시 상품은 **공급사 상품**을 기준으로 안내합니다" + 로고는 **보조(회색/텍스트 우선)** |
| \`DisclosurePriceSchedule\` | 가격·일정은 참고용·변동 가능 |
| \`FooterLegalStrip\` | 푸터 고지·문의 채널 |
`

/** 등록·추출 JSON 응답의 기술적 제약(§9 외 — API 계약) */
export const LLM_JSON_OUTPUT_DISCIPLINE_BLOCK = `# 출력 형식(기술)
- 응답은 오직 JSON. 자연어 해설·서문·마크다운 코드펜스 금지.
- 공급사 원문에 없는 [MUST/TIP/PLUS] 등 주관적 등급·가공 표현은 추출하지 말고 배제한다.
`

/** 풀 등록 Role 두 줄 + 서술 필드와 §9 연결 */
export const REGISTER_LLM_ROLE_DATA_AUDITOR_INTRO = `# Role: 데이터 감사관 (Data Auditor)
너는 여행 상품의 팩트만을 골라내는 '데이터 감사관'이다. 주관적인 감정·마케팅 문구를 발견하는 즉시 삭제하고, 구조화 필드는 숫자·명사·원문 팩트를 우선한다. 고객에게 노출될 한국어 필드(title·일정 description·안내 문구 등)를 새로 쓰거나 요약할 때는 아래 톤앤매너(SSOT)를 따른다. 공급사 원문 인용은 팩트 보존을 우선한다.
`

/** 하나투어 compact 전용 Role — 동일 §9·JSON 규율 적용 */
export const REGISTER_LLM_ROLE_DATA_AUDITOR_HANATOUR_COMPACT_INTRO = `# Role: 데이터 감사관 (하나투어 compact)
너는 여행 상품 팩트만 추출한다. 마지막 비공백 문자는 닫는 }. 고객에게 노출될 한국어 필드는 아래 톤앤매너(SSOT)를 따른다.
`

/** 일정 schedule[] 전용 — §9 + 기술 제약 한 줄 */
export function buildScheduleExtractToneBlock(): string {
  return (
    `${BONGTOUR_TONE_MANNER_LLM_BLOCK}\n` +
    `# 일정 description·title 요약 시\n` +
    `- §9.3 금지 표현을 넣지 말 것. §9.6~9.10 문체(사실·권장·이유 중심, 일정은 인용과 해석 분리 원칙 준수).\n` +
    `- 각 항목 description은 한국어 1~2문장·220자 이내 등 아래 기술 규칙을 함께 따른다.\n`
  )
}

/** B2B 상세 텍스트 추출 — §9 금지·고지와 정합 */
export const B2B_EXTRACT_TONE_ADDENDUM = `# 브랜드·고지 (SSOT: ${BONGTOUR_TONE_MANNER_DOCUMENT_SEE})
- 광고성·§9.3 금지 표현(최저가·특가·마감임박·즉시결제·공식 사이트 오인·무조건 가능 등)은 추출 결과 요약에 넣지 않는다.
- 가격·일정 관련 서술은 참고용·변동 가능 전제(§9.5)와 모순되게 확정 약속으로 쓰지 않는다.
`

/**
 * 등록 미리보기 전용 — §9.1 + `B2B_EXTRACT_TONE_ADDENDUM` 불릿 + §9.6 요지 한 줄 (확정용 `BONGTOUR_TONE_MANNER_LLM_BLOCK` 대체).
 */
export const REGISTER_PREVIEW_MINIMAL_TONE_BLOCK = `# 톤앤매너 (미리보기 최소, SSOT: ${BONGTOUR_TONE_MANNER_DOCUMENT_SEE})
- 브랜드(§9.1): "제안하고, 설계하고, 상담으로 연결하는 여행 컨설팅 파트너."
${B2B_EXTRACT_TONE_ADDENDUM.replace(/^# [^\n]*\n/, '')}
- 문체: 차분·명확, 불필요한 감탄 과다·기계적 나열 지양(§9.6 요지).
`
