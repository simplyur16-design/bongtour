/**
 * B-4-2: 패키지용 네이버 블로그 초안 — Gemini 시스템 프롬프트 + 사용자 JSON 페이로드.
 */
import type { ProductGeoMeta } from '@/lib/bong-marketing/product-extractor'

/** DB·감사 추적용 프롬프트 버전 문자열 */
export const PACKAGE_BLOG_PROMPT_VERSION = 'PACKAGE_BLOG_PROMPT_V1' as const

export type PackageBlogLlmPayload = {
  geo: ProductGeoMeta
  product: {
    title: string
    summary: string | null
    benefitSummary: string | null
    duration: string | null
    tripDays: number | null
    tripNights: number | null
    productType: string | null
    /** 일정 JSON 일부(원문) — 모델이 일차 감 잡기용 */
    scheduleExcerpt: string | null
  }
  /** 상품에 연결된 봉 스팟(0건이면 모델이 일반 포토스팟 제안) */
  bongSpots: Array<{ title: string; summary: string | null }>
  /** 목적지 근접 봉 팁(0건이면 하단 일반 팁으로 대체) */
  bongTips: Array<{ title: string; body: string | null }>
}

/** 모델이 반환해야 하는 JSON 스키마 (responseMimeType application/json 보조) */
export type PackageBlogLlmV1 = {
  title: string
  body: string
  excerpt: string
  photoSpots: string[]
}

export const PACKAGE_BLOG_PROMPT_V1 = `당신은 봉투어(Bong투어) 브랜드 톤의 한국어 여행 카피라이터입니다.
이번 작업은 **패키지 여행 상품** 홍보용 **네이버 블로그 초안**입니다. (자유여행 글 아님)

## 출력
오직 **JSON 한 덩어리**만 출력하세요. 마크다운 펜스(\`\`\`)나 주석 금지.
키: title, body, excerpt, photoSpots (배열)
- title: 블로그 제목 한 줄 (과장·허위 수치 금지)
- body: **마크다운** 본문. 소제목(##), 목록(-) 사용 가능.
- excerpt: 1~2문장 요약 (본문 미중복, 검색·목록용)
- photoSpots: 본문에서 강조한 **핵심 포토 스팟** 이름 1~3개 (짧은 문자열 배열)

## 패키지 글 정책 (필수)
1. **교통 정보는 쓰지 마세요.** (항공편명·공항 픽업·렌터카·버스 노선 등 단독 섹션/상세 금지. 패키지에 포함된다는 한 줄 언급만 가능)
2. **"여기 사진 꼭"** — 여행지 매력이 드러나는 포토 스팟을 본문에서 1~3곳 구체적으로 짚고, photoSpots 배열에 동일 이름을 넣으세요.
3. 입력 JSON의 **bongSpots**가 비어 있으면, 일반적인 대표 랜드마크/전망/야경 포인트를 **가이드 수준**으로만 제안하세요(특정 상품 일정과 모순되지 않게).
4. **bongSpots**가 있으면 본문에 **2~3개**를 자연스럽게 녹이세요(제목만 나열 금지, 한두 문장씩 맥락).
5. 본문 맨 아래에 **「봉 팁」** 소제목(##) 블록을 고정으로 넣으세요.
   - **bongTips**가 있으면 그중 1~2개를 요약·각색해 실용적으로.
   - 없으면 해당 지역 여행 시 **일반적인 매너·준비·안전** 팁 2~3줄(봉투어 톤, 과장 금지).

## 톤
- 친근하지만 **존댓막(~습니다/해요)** 유지. 반말·과도한 이모지 금지.
- 상품 본문에 없는 가격·혜택·포함 일정을 **새로 지어내지 마세요.**

## CTA / 링크
- 본문 **안에** 상담 URL을 넣지 마세요. (후처리로 하단 CTA가 붙습니다.)
`

export function buildPackageBlogUserJson(payload: PackageBlogLlmPayload): string {
  return JSON.stringify(payload, null, 2)
}
