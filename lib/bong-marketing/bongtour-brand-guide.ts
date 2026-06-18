/**
 * Bong투어 비즈니스 정체성 + 3대 차별점 가이드.
 * 카드뉴스·블로그 Gemini 프롬프트에 통합되어 일관된 어필 톤과 표시광고법 안전성을 보장한다.
 */

export const BONGTOUR_BUSINESS_IDENTITY = `
## Bong투어 비즈니스 정체성 (절대 위반 금지)

Bong투어는 **한국인 대상 해외여행 + eSIM** 전문 회사입니다.
- **국내 여행·국내 관광 상품은 취급하지 않습니다.**
- 마케팅 콘텐츠에 **한국 국내 축제·지역 행사**(논산 딸기축제, 진해 군항제 등)를 노출하지 마세요.
- 한국 시즌·연휴·방학 정보는 **한국인이 해외로 출국하기 좋은 타이밍** 분석용으로만 사용합니다.
- **여행지 추천**은 운영자 UI에서 **1~12월 월별**로 노출됩니다 (봄/여름/가을/겨울 4분류 아님).

Bong투어는 **여행상품 판매대행** 회사입니다.
- 공급사(여행사·항공사·호텔 등)의 상품을 큐레이션해서 Bong투어 사이트에서 판매합니다.
- Bong투어가 직접 일정·식단·호텔을 운영하지 않습니다.
- Bong투어는 **고르는 사람** (큐레이터), 만드는 사람 X.

## 회사명 표기 (필수)
- 본문에는 반드시 **"Bong투어"** 표기 사용
- 한글 "봉투어" 단독 사용 X
- 해시태그에서만 #봉투어 + #Bong투어 둘 다 사용

## 절대 사용 금지 표현
❌ "Bong투어 큐레이터가 일정을 설계했습니다"
❌ "Bong투어 전문 가이드"
❌ "전문 가이드가 동행" — "가이드"라는 단어 자체 사용 금지
❌ "현지 가이드의 깊이"
❌ "Bong투어가 호텔을 엄선했습니다"
❌ "Bong투어 자체 식단으로 구성했습니다"
❌ Bong투어를 상품 제작자처럼 표현
❌ "절대 무제한", "100% 무료", "최고", "유일", "완벽" 등 단정형

## 허용 표현 (정직한 어필)
✅ "Bong투어 추천상품이에요"
✅ "Bong투어가 평점 좋은 상품 골라드렸어요"
✅ "이 상품의 호텔은 시내 중심에 위치해 있어요" (상품 정보 전달)
✅ "이 상품에는 신선한 해산물·수프카레가 포함돼요" (상품 정보 전달)
✅ "고객 후기 평점이 높은 상품으로 골랐어요"
✅ "수많은 공급사 상품 중 Bong투어 기준으로 큐레이션한 패키지예요"
`.trim()

export const BONGTOUR_DIFFERENTIATORS = `
## Bong투어 3대 차별점 (어필 OK)

### 1. 여행사의 모든 혜택을 다 챙겨드립니다
- 공급사 직접 구매와 가격·혜택·서비스·옵션 모두 동일
- Bong투어가 가격 올리지 않고 혜택 줄이지 않음
- 표현 예: "여행사의 모든 혜택을 다 챙겨드립니다"
- 표현 예: "공급사에서 직접 사는 것과 같은 가격·혜택, Bong투어에서 편하게 예약하세요"

### 2. ⭐ 무제한 봉심 eSIM 혜택 (패키지 한정)
- Bong투어에서 **패키지** 예약 시 봉심(Bong투어 eSIM) 무료 제공
- **모든 상품 · 모든 국가** 적용
- **진짜 무제한 데이터** (속도 제한·용량 제한 없음)
- **추가 비용 없음**
- **성인 1인당 1 eSIM**, 모든 성인 인원에게 제공
- 표현 예: "Bong투어에서 패키지 예약하시면, 여행 기간 동안 무제한 데이터를 사용할 수 있는 봉심 eSIM을 성인 1인당 1개씩 무료로 드려요. 모든 나라에서 사용 가능하고 추가 비용도 없어요."

### 3. 검증된 상품 큐레이션
- 수많은 공급사 상품 중 평점·후기 검증된 상품만 모음
- Bong투어 기준으로 좋은 상품 골라 추천
- 표현 예: "Bong투어 추천상품이에요"
- 표현 예: "후기 평점 좋은 상품을 Bong투어가 골라 한 곳에 모았어요"
`.trim()

export const TRACK_APPEAL_GUIDE = {
  package: `
## 패키지 어필 (3대 차별점 모두 활용)
- 큐레이션: "Bong투어 추천상품이에요"
- 여행사 혜택: "여행사의 모든 혜택을 다 챙겨드립니다"
- ⭐ 무제한 eSIM: Bong투어 패키지 예약 시 봉심 무료 제공 (모든 국가·진짜 무제한·성인 1인당 1개)
- 마무리 CTA에서 봉심 eSIM 혜택 자연스럽게 언급
`.trim(),

  airtel: `
## 자유여행(항공+호텔) 어필
- 큐레이션: 검증된 공급사의 항공+호텔 조합 추천
- 여행사 혜택: "여행사의 모든 혜택을 다 챙겨드립니다"
- ⚠️ 무제한 eSIM 혜택은 자유여행에 자동 포함 안 됨
- 봉심 eSIM 별도 안내 가능: "eSIM이 필요하시면 봉심에서 따로 구매하실 수 있어요"
`.trim(),
}

export function buildBrandGuide(track?: 'package' | 'airtel'): string {
  const parts = [BONGTOUR_BUSINESS_IDENTITY, BONGTOUR_DIFFERENTIATORS]
  if (track && TRACK_APPEAL_GUIDE[track]) {
    parts.push(TRACK_APPEAL_GUIDE[track])
  }
  return parts.join('\n\n')
}

export interface IdentityViolation {
  pattern: string
  message: string
  matchedText: string
}

const FORBIDDEN_PATTERNS: Array<{ regex: RegExp; message: string }> = [
  { regex: /가이드/g, message: '가이드 언급 자체 금지 (안전 룰)' },
  {
    regex: /(봉투어|Bong투어)\s*(자체|전문)\s*가이드/g,
    message: 'Bong투어 자체 가이드 X',
  },
  {
    regex: /(봉투어|Bong투어)\s*(큐레이터)?가?\s*일정을?[^.!\n]{0,24}(설계|구성|만들)/g,
    message: 'Bong투어가 일정 설계 X',
  },
  {
    regex: /(봉투어|Bong투어)\s*(큐레이터)?가?\s*(호텔|숙소)을?\s*엄선/g,
    message: 'Bong투어가 호텔 엄선 X',
  },
  { regex: /(봉투어|Bong투어)\s*(자체|직접)\s*식단/g, message: 'Bong투어 자체 식단 X' },
  { regex: /(절대|100%|완벽한?|최고의?|유일한?)\s*무제한/g, message: '단정형 무제한 표현 금지' },
  { regex: /(100%|완전\s*무료|절대\s*무료)/g, message: '단정형 무료 표현 금지' },
]

export function detectIdentityViolations(text: string): IdentityViolation[] {
  const violations: IdentityViolation[] = []
  for (const { regex, message } of FORBIDDEN_PATTERNS) {
    for (const match of text.matchAll(regex)) {
      violations.push({
        pattern: regex.source,
        message,
        matchedText: match[0],
      })
    }
  }
  return violations
}

export function validateRequiredHashtags(hashtags: string[]): {
  valid: boolean
  missing: string[]
} {
  const required = ['#봉투어', '#Bong투어']
  const lowerHashtags = hashtags.map((h) => h.toLowerCase())
  const missing = required.filter((r) => !lowerHashtags.includes(r.toLowerCase()))
  return {
    valid: missing.length === 0,
    missing,
  }
}

/** 필수 해시태그 보장 + 개수 맞춤 (중복 제거) */
export function ensureRequiredHashtags(
  hashtags: string[],
  maxCount: number,
  fallbacks: string[] = ['#여행', '#해외여행', '#여행스타그램'],
): string[] {
  const normalized = hashtags
    .map((h) => (typeof h === 'string' ? h.trim() : ''))
    .filter(Boolean)
    .map((h) => (h.startsWith('#') ? h : `#${h}`))

  const check = validateRequiredHashtags(normalized)
  let result = check.valid ? [...normalized] : [...check.missing, ...normalized]

  const seen = new Set<string>()
  result = result.filter((h) => {
    const key = h.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  result = result.slice(0, maxCount)

  let padIndex = 0
  while (result.length < maxCount) {
    const fromFallback = fallbacks[padIndex % fallbacks.length] ?? '#여행'
    const suffix = padIndex >= fallbacks.length ? String(Math.floor(padIndex / fallbacks.length) + 1) : ''
    const candidate = suffix ? `${fromFallback}${suffix}` : fromFallback
    if (!seen.has(candidate.toLowerCase())) {
      result.push(candidate)
      seen.add(candidate.toLowerCase())
    }
    padIndex++
    if (padIndex > maxCount * 3) break
  }

  return result.slice(0, maxCount)
}
