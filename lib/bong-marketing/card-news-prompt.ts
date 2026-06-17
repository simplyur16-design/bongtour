/**
 * 카드뉴스 카피 생성 프롬프트 빌더 (v1.2 룰).
 *
 * Gemini 에 보낼 시스템/유저 프롬프트를 만든다. 실제 호출은 `card-news-generator.ts`.
 * - 톤: ~해요체, 여행 큐레이터
 * - 매 슬라이드 후킹(숫자/반전/비주얼)
 * - 금지: 과장("최고/유일/100%/완벽/절대"), AI 클리셰, 가격·출발건수·상품ID 침투
 * - 모범/금지 후킹은 few-shot 예시로 직접 주입
 * - JSON 형식 반환 강제
 */

import { buildBrandGuide } from '@/lib/bong-marketing/bongtour-brand-guide'

export const CARD_NEWS_PROMPT_VERSION = 'card-news-v1.2'

export interface CardNewsPromptContext {
  themeTitle: string
  selectedCities: string[]
  tripNights: number
  tripDays: number
  season: string | null
  operatorContext: {
    themeIntent?: string
    targetAudience?: string
    hotInfo?: string
    avoidTone?: string
    customKeywords?: string
  }
  episode: {
    episodeNumber: number
    episodeType: 'package' | 'tip' | 'caution'
    formatType: 'deep' | 'list'
    title: string
    targetCity?: string
    targetPlace?: string
    operatorNote?: string
    linkedProduct?: {
      id: string
      title: string
      country?: string
      city?: string
    }
  }
  hookLibrary: {
    good: Array<{ hookText: string; context?: string }> // 모범 후킹 (최대 10)
    bad: Array<{ hookText: string; context?: string }> // 금지 후킹 (최대 10)
  }
  trendContext?: string // web_search 결과 (PR 5에서 본격화, PR 2는 빈 문자열 허용)
}

/** Deep/List × episodeType 별 슬라이드 역할(5장 고정) */
const SLIDE_ROLE_BLUEPRINTS: Record<string, { roles: string[]; structure: string }> = {
  'package:deep': {
    roles: ['hook', 'background', 'depth', 'distinction', 'cta'],
    structure:
      '한 명소를 깊게 파고드는 5장 구조.\n' +
      '  1) hook: 스크롤을 멈추게 하는 강한 첫 문장(숫자/반전/비주얼)\n' +
      '  2) background: 그 명소의 배경·맥락(왜 특별한지)\n' +
      '  3) depth: 한 단계 더 깊은 디테일(현지인 시선, 의외의 사실)\n' +
      '  4) distinction: 다른 곳과의 차별점(여기서만 가능한 경험)\n' +
      '  5) cta: 부드러운 행동 유도(상담/더보기 — 직접적 판매 금지)',
  },
  'package:list': {
    roles: ['hook', 'place1', 'place2', 'place3', 'cta'],
    structure:
      '여러 명소(3~4곳)를 묶는 리스트형 5장 구조.\n' +
      '  1) hook: 시리즈를 관통하는 강한 첫 문장\n' +
      '  2) place1: 첫 번째 명소 한 컷\n' +
      '  3) place2: 두 번째 명소 한 컷\n' +
      '  4) place3: 세 번째 명소 한 컷(필요시 한 장에 2곳 묶어도 됨)\n' +
      '  5) cta: 부드러운 행동 유도',
  },
  'tip:deep': {
    roles: ['hook', 'why', 'how', 'detail', 'cta'],
    structure:
      '하나의 여행 팁을 깊게 푸는 5장 구조: hook → 왜 중요한지 → 어떻게 → 디테일/예외 → cta.',
  },
  'tip:list': {
    roles: ['hook', 'tip1', 'tip2', 'tip3', 'cta'],
    structure:
      '여행 팁 3개를 모으는 리스트형 5장 구조.\n' +
      '  1) hook: "[도시] 가기 전 꼭 챙기는 5가지" 같은 정보 후킹 — 친근한 큐레이터 톤\n' +
      '  2) tip1: 첫 번째 팁 (구체적 항목, 숫자·예시 포함)\n' +
      '  3) tip2: 두 번째 팁\n' +
      '  4) tip3: 세 번째 팁\n' +
      '  5) cta: "더 자세한 팁은 Bong투어 블로그" 같은 부드러운 연결\n' +
      '팁 카테고리 힌트: 짐 챙기기, 현지 도착 직후, 음식·식당, 교통·이동, 결제·환전, 의사소통, 안전·치안, 날씨·복장, 통신·인터넷',
  },
  'caution:deep': {
    roles: ['hook', 'risk', 'reason', 'howto', 'cta'],
    structure:
      '하나의 주의사항을 깊게 푸는 5장: hook(경각심) → 무엇이 위험한지 → 이유 → 대처법 → cta.',
  },
  'caution:list': {
    roles: ['hook', 'caution1', 'caution2', 'caution3', 'cta'],
    structure:
      '주의사항 3개를 모으는 리스트형 5장 구조.\n' +
      '  1) hook: "[도시] 처음 가는 분 주의하세요" 같은 경고 후킹 — 공포 마케팅 X, "~알고 가시면 안심이에요" 톤\n' +
      '  2) caution1: 첫 번째 주의사항 (구체적 상황·대처)\n' +
      '  3) caution2: 두 번째 주의사항\n' +
      '  4) caution3: 세 번째 주의사항\n' +
      '  5) cta: "여행 전 Bong투어와 상담" 같은 안전 연결\n' +
      '주의사항 카테고리 힌트: 사기·바가지, 분실·도난, 음식 알레르기·위생, 종교·문화 금기, 자연재해·기후, 비자·입국 서류, 환전·통화 사기',
  },
}

function blueprintKey(ctx: CardNewsPromptContext): string {
  return `${ctx.episode.episodeType}:${ctx.episode.formatType}`
}

export function buildCardNewsSystemPrompt(): string {
  const brandGuide = buildBrandGuide('package')

  return [
    '당신은 Bong투어의 인스타그램 카드뉴스 카피 작성자입니다.',
    '여행을 깊이 아는 큐레이터의 시선으로, 한 편(5장)의 카드뉴스 카피를 쓴다.',
    '',
    brandGuide,
    '',
    '## 카드뉴스 작성 사양 (엄격히)',
    '',
    '### 회사명 표기 — 반드시 "Bong투어"',
    '- 본문·헤드라인·부제·캡션 모두 "Bong투어"로 표기',
    '- 한글 "봉투어" 단독 사용 X',
    '- "Bong투어"가 자연스럽게 들어가는 위치: 5번 슬라이드(CTA), 캡션',
    '',
    '### 가이드 언급 금지',
    '- "가이드"라는 단어를 카피에 절대 사용하지 마세요',
    '- 본문·헤드라인·부제·캡션 모두 동일',
    '',
    '## 톤 & 보이스',
    '- 문체는 "~해요체"로 통일한다. 정중하지만 친근하게.',
    '- 여행 큐레이터의 시선: 정보를 나열하지 말고, 장면이 그려지게 한다.',
    '- 매 슬라이드는 그 자체로 후킹이 있어야 한다 — 숫자, 반전, 구체적 비주얼 중 하나 이상.',
    '',
    '## 절대 금지',
    '- 과장 단어: "최고", "유일", "100%", "완벽", "절대", "무조건", "역대급" 등.',
    '- AI 클리셰: "여러분~", "함께 알아볼까요", "오늘은 ~에 대해 알아보겠습니다", "지금 바로", "어떠셨나요".',
    '- 가격, 출발 가능 건수, 상품 ID, 내부 코드가 카피 문장에 침투하면 안 된다.',
    '- 모범 후킹을 그대로 베끼지 말 것(패턴만 학습). 금지 후킹 패턴은 절대 사용 금지.',
    '',
    '## 슬라이드 카피 사양 (엄격히)',
    '',
    '### 헤드라인 (headline) — 필수',
    '- **공백 포함 12자 이내** (12자 초과 금지)',
    '- 후킹 역할: 시선 끌기',
    '- 후킹 패턴 6가지 중 하나 사용:',
    '  1. 호기심형',
    '  2. 반전형',
    '  3. 질문형',
    '  4. 공감형',
    '  5. 희소성',
    '  6. 감정형',
    '- **금지**: 사실 진술, 정보 나열, 평이한 설명',
    '',
    '### 부제 (subtitle) — 선택',
    '- **공백 포함 15자 이내** (그대로)',
    '- 정보·맥락 역할, 명사구 위주',
    '- 헤드라인과 다른 역할 (후킹 X)',
    '',
    '### 본문 (body) — 선택',
    '- **공백 포함 50자 이내, 2-3줄**',
    '- 본격 설명, ~해요체 큐레이터 톤',
    '- **반드시 완전한 문장으로 끝나야 함** (마침표 또는 자연스러운 끝맺음)',
    '',
    '### Pexels 키워드 (pexelsKeyword) — 필수',
    '- 영어 2-4단어',
    '- 도시·랜드마크·시즌·분위기 조합',
    '',
    '## ⭐ 1번 슬라이드 (표지) 특별 사양',
    '',
    '1번 슬라이드는 인스타 피드에서 사용자의 손가락을 멈추게 하는 결정적 순간. 가장 신경 써야 함.',
    '',
    '### 1번 헤드라인 — 최고 임팩트',
    '- 6가지 후킹 패턴 중 가장 강한 것 선택',
    '- 일반 사실 진술 절대 X',
    '- 좋은 예: "초록색 사막?", "비행기값 반값", "이게 진짜야?"',
    '- 나쁜 예: "여름의 다낭", "이탈리아 여행"',
    '',
    '### 1번 부제 — 호기심 풀어주는 미끼',
    '- 헤드라인이 던진 질문의 살짝 답 (완전 답은 본문에서)',
    '- 예: 헤드라인 "초록색 사막?" → 부제 "여름 몽골 테를지"',
    '',
    '### 1번 본문 — 추가 후킹',
    '- 본격 설명 시작 금지',
    '- 2-3번 슬라이드로 이어지는 미끼 역할',
    '- "끝까지 보세요" 톤',
    '- 예: "사막만 떠올렸다면 놀라실 거예요. 여름 몽골이 보여주는 진짜 풍경, 함께 볼까요?"',
    '',
    '### 2-5번 슬라이드는 정보·설명·CTA',
    '- 2-3: 본격 정보·설명 (호기심 해결)',
    '- 4: 차별점·반전',
    '- 5: CTA (행동 유도, Bong투어 큐레이션 자연스럽게)',
    '',
    '### ⭐ 5번 슬라이드 (CTA) Bong투어 어필 가이드',
    '- "Bong투어 추천상품이에요" 톤 사용',
    '- ⭐ 무제한 봉심 eSIM 혜택 자연스럽게 언급:',
    '  - 예: "Bong투어 패키지엔 봉심 eSIM이 함께 드려져요"',
    '  - 예: "예약하시면 봉심 무제한 eSIM도 함께"',
    '- "여행사의 모든 혜택을 다 챙겨드립니다" 톤 활용 가능',
    '- 단정형 금지',
    '',
    '## 출력 예시 (Gemini가 이 톤 그대로 흉내내세요)',
    '',
    '### 표지 슬라이드 1',
    '{',
    '  "headline": "초록색 사막?",',
    '  "subtitle": "여름 몽골 테를지",',
    '  "body": "사막만 떠올렸다면 놀라실 거예요. 여름 몽골이 보여주는 진짜 풍경, 함께 볼까요?",',
    '  "pexelsKeyword": "Mongolia green steppe summer"',
    '}',
    '',
    '### 콜로세움 카드뉴스 슬라이드 3 (반전)',
    '{',
    '  "headline": "모래 아래 미로?",',
    '  "subtitle": "콜로세움 지하 구조",',
    '  "body": "무대 아래엔 검투사와 맹수가 대기하던 미로가 있었어요. 80개 승강 장치로 등장.",',
    '  "pexelsKeyword": "Colosseum interior underground"',
    '}',
    '',
    '### 콜로세움 카드뉴스 슬라이드 5 (CTA)',
    '{',
    '  "headline": "혼자 가긴 아쉬워요",',
    '  "subtitle": "Bong투어 추천상품",',
    '  "body": "여행서 한 줄로는 부족해요. Bong투어가 골라드린 잊지 못할 장면이에요.",',
    '  "pexelsKeyword": "Italy travel curated"',
    '}',
    '',
    '## 광고법 + 안전 룰',
    '- "최고/유일/100%/완벽/절대/최저가" 단정형 금지',
    '- "가이드" 단어 사용 금지',
    '- 가격 단정 ("XX만원이에요" 같은) — "가격대" 정도로 일반화',
    '',
    '## 출력 형식 (반드시 JSON, 그 외 텍스트 금지)',
    '{',
    '  "slides": [',
    '    { "slideNumber": 1, "slideRole": "hook", "headline": "...", "subtitle": "...", "body": "...", "pexelsKeyword": "..." }',
    '    // 정확히 5개',
    '  ]',
    '}',
    '- slides 는 정확히 5개. slideNumber 는 1..5, slideRole 은 지시된 역할을 그대로 사용.',
    '- 모든 슬라이드에 headline 과 pexelsKeyword 는 필수. subtitle/body 는 채우되 비워도 무방.',
  ].join('\n')
}

function formatHookExamples(hooks: Array<{ hookText: string; context?: string }>): string {
  if (!hooks.length) return '  (등록된 예시 없음)'
  return hooks
    .map((h, i) => `  ${i + 1}. "${h.hookText}"${h.context ? ` — ${h.context}` : ''}`)
    .join('\n')
}

function formatSeasonLabel(season: string | null): string {
  if (!season) return ''
  const map: Record<string, string> = {
    spring: '봄',
    summer: '여름',
    autumn: '가을',
    winter: '겨울',
    all_year: '연중',
  }
  return map[season] ?? season
}

function episodeTypeGuidance(ctx: CardNewsPromptContext): string | null {
  const city = ctx.episode.targetCity ?? ctx.selectedCities[0] ?? '이번 도시'
  const { episodeType, formatType } = ctx.episode

  if (episodeType === 'tip' && formatType === 'list') {
    return [
      '### 편 유형 가이드 (tip · list)',
      `- 톤: 친근한 큐레이터 ("이거 챙기면 마음 편해요") — ~해요체 유지`,
      `- hook: "${city} 가기 전 꼭 챙기는 팁" 느낌의 정보 후킹`,
      `- tip1~tip3: 각각 다른 카테고리(짐, 교통, 음식, 결제, 통신, 날씨 등)에서 구체적·실용적 팁`,
      `- 공포·과장 없이 실용 정보 위주`,
    ].join('\n')
  }

  if (episodeType === 'caution' && formatType === 'list') {
    return [
      '### 편 유형 가이드 (caution · list)',
      `- 톤: 경고하되 공포 마케팅 X ("이거 알고 가시면 안심이에요") — ~해요체 유지`,
      `- hook: "${city} 처음 가는 분 주의하세요" 느낌의 부드러운 경각`,
      `- caution1~caution3: 사기·분실·음식·문화·기후·비자 등 서로 다른 주의 포인트`,
      `- 불안 조장·극단적 표현 금지`,
    ].join('\n')
  }

  if (episodeType === 'package' && formatType === 'deep') {
    return [
      '### 편 유형 가이드 (package · deep)',
      '- 관광상품 추천형: 도시·시즌 매력을 깊게 풀고, 연결 상품 맥락을 자연스럽게 반영',
      '- hook: 도시·시즌 후킹 → background → depth → distinction → cta',
    ].join('\n')
  }

  return null
}

export function buildCardNewsUserPrompt(ctx: CardNewsPromptContext): string {
  const key = blueprintKey(ctx)
  const blueprint =
    SLIDE_ROLE_BLUEPRINTS[key] ?? SLIDE_ROLE_BLUEPRINTS[`${ctx.episode.episodeType}:deep`]
  const { roles, structure } = blueprint

  const lines: string[] = []
  const oc = ctx.operatorContext

  lines.push('## 이번 카드뉴스 한 편을 써라')
  lines.push('')
  lines.push('### 시리즈 컨텍스트')
  lines.push(`- 주제: ${ctx.themeTitle}`)
  if (ctx.selectedCities.length) lines.push(`- 대상 도시: ${ctx.selectedCities.join(', ')}`)
  lines.push(`- 여행 일정: ${ctx.tripNights}박 ${ctx.tripDays}일 (카피에 숫자 직접 나열은 자제, 체감 일정감만 반영)`)
  const seasonLabel = formatSeasonLabel(ctx.season)
  if (seasonLabel) {
    lines.push(`- 시즌: ${seasonLabel} 시즌 (계절감·분위기를 카피에 자연스럽게 반영)`)
  } else if (oc.themeIntent) {
    lines.push('- 시즌: 미지정 — 운영자 의도(themeIntent)에서 계절감을 추론해 반영')
  }
  const hasOc = oc.themeIntent || oc.targetAudience || oc.hotInfo || oc.customKeywords
  if (hasOc) {
    lines.push('')
    lines.push('### 운영자 의도 (반드시 반영)')
    if (oc.themeIntent) lines.push(`- 이번 주 의도: ${oc.themeIntent}`)
    if (oc.targetAudience) lines.push(`- 타겟 독자: ${oc.targetAudience}`)
    if (oc.hotInfo) lines.push(`- 핫한 정보(카피에 녹여라): ${oc.hotInfo}`)
    if (oc.customKeywords) lines.push(`- 강조 키워드: ${oc.customKeywords}`)
  }
  if (oc.avoidTone) {
    lines.push('')
    lines.push(`### ⚠️ 피해야 할 톤 (운영자 지정): ${oc.avoidTone}`)
    lines.push('  위 톤은 negative example 이다. 이런 느낌이 나면 다시 써라.')
  }

  // 이번 편
  lines.push('')
  lines.push('### 이번 편')
  lines.push(`- 편 번호: ${ctx.episode.episodeNumber}`)
  lines.push(`- 제목: ${ctx.episode.title}`)
  lines.push(`- 유형: ${ctx.episode.episodeType} / 포맷: ${ctx.episode.formatType}`)
  if (ctx.episode.targetCity) lines.push(`- 대상 도시: ${ctx.episode.targetCity}`)
  if (ctx.episode.targetPlace) lines.push(`- 대상 명소: ${ctx.episode.targetPlace}`)
  if (ctx.episode.operatorNote) lines.push(`- 운영자 메모: ${ctx.episode.operatorNote}`)
  if (ctx.episode.linkedProduct) {
    const p = ctx.episode.linkedProduct
    lines.push(
      `- 연결 상품(맥락 참고용, 카피에 상품명/ID 직접 노출 금지): ${p.title}${
        p.city ? ` / ${p.city}` : ''
      }${p.country ? ` / ${p.country}` : ''}`,
    )
  }

  // 구조
  lines.push('')
  lines.push('### 슬라이드 구조 (5장 고정)')
  lines.push(structure)
  lines.push(`- 각 슬라이드의 slideRole 은 순서대로: ${roles.join(' → ')}`)

  const typeGuide = episodeTypeGuidance(ctx)
  if (typeGuide) {
    lines.push('')
    lines.push(typeGuide)
  }

  // 트렌드
  if (ctx.trendContext && ctx.trendContext.trim()) {
    lines.push('')
    lines.push('### 최신 트렌드 참고')
    lines.push(ctx.trendContext.trim())
  }

  // few-shot 후킹
  lines.push('')
  lines.push('### 모범 후킹 (패턴을 학습하되 그대로 베끼지 말 것)')
  lines.push(formatHookExamples(ctx.hookLibrary.good))
  lines.push('')
  lines.push('### 금지 후킹 (이런 패턴은 절대 쓰지 말 것)')
  lines.push(formatHookExamples(ctx.hookLibrary.bad))

  lines.push('')
  lines.push('위 컨텍스트로 정확히 5장의 슬라이드를 JSON 으로만 출력해라.')

  return lines.join('\n')
}

/** 생성기·테스트 공용: 컨텍스트 → 기대 slideRole 배열 */
export function expectedSlideRoles(
  episodeType: 'package' | 'tip' | 'caution',
  formatType: 'deep' | 'list',
): string[] {
  const bp =
    SLIDE_ROLE_BLUEPRINTS[`${episodeType}:${formatType}`] ??
    SLIDE_ROLE_BLUEPRINTS[`${episodeType}:deep`]
  return bp.roles
}
