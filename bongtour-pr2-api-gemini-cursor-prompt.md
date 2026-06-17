# 봉투어 마케팅 자동화 PR 2 — 카드뉴스 API + Gemini 2.5 Pro 통합

## 목표
PR 1에서 만든 DB 스키마(6개 테이블)를 활용해 카드뉴스 자동 생성 백엔드 구축.
**API CRUD + Gemini 호출 + 카피 생성 + DB 저장**까지. UI는 PR 3에서.

## 사용 LLM
- **Gemini 2.5 Pro** (`gemini-2.5-pro`)
- 봉투어 기존 인프라 재활용 (`lib/bong-marketing/gemini-*`)
- Claude API·Anthropic SDK 추가 금지

---

## 신규 파일 (8개)

### 1. lib/bong-marketing/card-news-prompt.ts
Gemini에 보낼 시스템 프롬프트 빌더.

```typescript
export interface CardNewsPromptContext {
  themeTitle: string;
  selectedCities: string[];
  targetDepartureFrom: Date;
  targetDepartureTo: Date;
  operatorContext: {
    themeIntent?: string;
    targetAudience?: string;
    hotInfo?: string;
    avoidTone?: string;
    customKeywords?: string;
  };
  episode: {
    episodeNumber: number;
    episodeType: 'package' | 'tip' | 'caution';
    formatType: 'deep' | 'list';
    title: string;
    targetCity?: string;
    targetPlace?: string;
    operatorNote?: string;
    linkedProduct?: {
      id: string;
      title: string;
      country?: string;
      city?: string;
    };
  };
  hookLibrary: {
    good: Array<{ hookText: string; context?: string }>;  // 모범 후킹 (10개)
    bad: Array<{ hookText: string; context?: string }>;   // 금지 후킹 (10개)
  };
  trendContext?: string;  // web_search 결과 (선택)
}

export function buildCardNewsSystemPrompt(): string {
  // v1.1 룰 기반 시스템 프롬프트
  // - ~해요체, 큐레이터 톤
  // - 매 슬라이드 후킹 (숫자/반전/비주얼)
  // - 금지: "최고/유일/100%/완벽/절대"
  // - AI 클리셰 금지 ("여러분~/함께 알아볼까요/오늘은 ~에 대해 알아보겠습니다")
  // - 가격·출발건수·상품ID 카피에 침투 금지
  // - JSON 형식 반환 강제
  ...
}

export function buildCardNewsUserPrompt(ctx: CardNewsPromptContext): string {
  // Deep/List 패턴별로 다른 프롬프트
  // - Deep: 1 명소 5장 구조 (hook → 배경 → 깊이 → 차별성 → CTA)
  // - List: 4-5 명소 5장 구조 (hook → 명소1 → 명소2 → 명소3 → CTA)
  // - Tip/Caution: 항목별 5장 구조
  ...
}
```

**중요 룰**:
- 모범/금지 후킹은 프롬프트에 직접 예시로 박을 것 (few-shot)
- 운영자 컨텍스트의 `avoidTone`이 있으면 negative example로 강조
- 운영자 컨텍스트의 `hotInfo`는 카피 내용에 반영
- JSON 응답 구조 명확히 지정:
  ```json
  {
    "slides": [
      {
        "slideNumber": 1,
        "slideRole": "hook",
        "headline": "...",
        "subtitle": "...",
        "body": "...",
        "pexelsKeyword": "..."
      },
      ...
    ]
  }
  ```

### 2. lib/bong-marketing/card-news-generator.ts
Gemini 호출 + JSON 파싱 + DB 저장.

```typescript
import { buildCardNewsSystemPrompt, buildCardNewsUserPrompt } from './card-news-prompt';
import { generateGeminiJsonResponse } from './gemini-json-parse'; // 기존 봉투어 인프라
import { prisma } from '@/lib/prisma';

export interface CardNewsGenerationResult {
  episodeId: string;
  slides: Array<{
    slideNumber: number;
    slideRole: string;
    headline: string;
    subtitle?: string;
    body?: string;
    pexelsKeyword?: string;
  }>;
}

export async function generateCardNewsEpisode(
  episodeId: string
): Promise<CardNewsGenerationResult> {
  // 1. Episode + Series + LinkedProduct + Context 풀 로드
  const episode = await prisma.bongCardNewsEpisode.findUnique({
    where: { id: episodeId },
    include: { series: true, linkedProduct: true }
  });
  if (!episode) throw new Error(`Episode ${episodeId} not found`);
  
  // 2. 해당 주차의 운영자 컨텍스트 로드
  const operatorContext = await prisma.bongMarketingContext.findUnique({
    where: { weekKey: episode.series.weekKey }
  });
  
  // 3. 후킹 라이브러리 로드 (active만, good 10 + bad 10)
  const hooks = await prisma.bongHookLibrary.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
    take: 30
  });
  const goodHooks = hooks.filter(h => h.hookType === 'good').slice(0, 10);
  const badHooks = hooks.filter(h => h.hookType === 'bad').slice(0, 10);
  
  // 4. 트렌드 컨텍스트 (web_search) — PR 2에서는 일단 빈 문자열 OK, PR 5에서 본격 구현
  const trendContext = '';
  
  // 5. 프롬프트 빌드
  const systemPrompt = buildCardNewsSystemPrompt();
  const userPrompt = buildCardNewsUserPrompt({
    themeTitle: episode.series.themeTitle,
    selectedCities: episode.series.selectedCities,
    targetDepartureFrom: episode.series.targetDepartureFrom,
    targetDepartureTo: episode.series.targetDepartureTo,
    operatorContext: {
      themeIntent: operatorContext?.themeIntent ?? undefined,
      targetAudience: operatorContext?.targetAudience ?? undefined,
      hotInfo: operatorContext?.hotInfo ?? undefined,
      avoidTone: operatorContext?.avoidTone ?? undefined,
      customKeywords: operatorContext?.customKeywords ?? undefined,
    },
    episode: {
      episodeNumber: episode.episodeNumber,
      episodeType: episode.episodeType as 'package' | 'tip' | 'caution',
      formatType: episode.formatType as 'deep' | 'list',
      title: episode.title,
      targetCity: episode.targetCity ?? undefined,
      targetPlace: episode.targetPlace ?? undefined,
      operatorNote: episode.operatorNote ?? undefined,
      linkedProduct: episode.linkedProduct ? {
        id: episode.linkedProduct.id,
        title: episode.linkedProduct.title,
        country: episode.linkedProduct.country ?? undefined,
        city: episode.linkedProduct.city ?? undefined,
      } : undefined,
    },
    hookLibrary: {
      good: goodHooks.map(h => ({ hookText: h.hookText, context: h.context ?? undefined })),
      bad: badHooks.map(h => ({ hookText: h.hookText, context: h.context ?? undefined })),
    },
    trendContext,
  });
  
  // 6. Gemini 2.5 Pro 호출
  const response = await generateGeminiJsonResponse({
    model: 'gemini-2.5-pro',
    systemPrompt,
    userPrompt,
    maxOutputTokens: 4096,
  });
  
  // 7. 응답 검증
  if (!response.slides || !Array.isArray(response.slides) || response.slides.length !== 5) {
    throw new Error(`Invalid response: expected 5 slides, got ${response.slides?.length}`);
  }
  
  // 8. DB 저장 (트랜잭션)
  await prisma.$transaction(async (tx) => {
    // 기존 슬라이드 삭제 (재생성 시)
    await tx.bongCardNewsSlide.deleteMany({ where: { episodeId } });
    
    // 새 슬라이드 생성
    for (const slide of response.slides) {
      await tx.bongCardNewsSlide.create({
        data: {
          episodeId,
          slideNumber: slide.slideNumber,
          slideRole: slide.slideRole,
          headline: slide.headline,
          subtitle: slide.subtitle ?? null,
          body: slide.body ?? null,
          pexelsKeyword: slide.pexelsKeyword ?? null,
          status: 'draft',
        }
      });
    }
    
    // Episode 상태 업데이트
    await tx.bongCardNewsEpisode.update({
      where: { id: episodeId },
      data: { status: 'ready' }
    });
  });
  
  return {
    episodeId,
    slides: response.slides,
  };
}

// 시리즈 전체 편 일괄 생성
export async function generateCardNewsSeries(seriesId: string) {
  const episodes = await prisma.bongCardNewsEpisode.findMany({
    where: { seriesId },
    orderBy: { episodeNumber: 'asc' },
  });
  
  const results = [];
  for (const ep of episodes) {
    const result = await generateCardNewsEpisode(ep.id);
    results.push(result);
  }
  
  await prisma.bongCardNewsSeries.update({
    where: { id: seriesId },
    data: { status: 'ready' }
  });
  
  return results;
}
```

### 3. lib/bong-marketing/pexels-keyword-builder.ts
Pexels 키워드 생성 헬퍼. Gemini가 1차 생성하지만 보조용으로도 사용.

```typescript
const SEASON_KEYWORDS_BY_MONTH: Record<number, string[]> = {
  1: ['winter', 'cold season'],
  2: ['winter', 'late winter'],
  3: ['spring', 'cherry blossom'],
  4: ['spring', 'mild weather'],
  5: ['late spring', 'green season'],
  6: ['early summer', 'rainy season'],
  7: ['summer', 'monsoon', 'tropical'],
  8: ['summer', 'tropical', 'dry season'],
  9: ['autumn', 'early autumn'],
  10: ['autumn', 'fall foliage'],
  11: ['late autumn', 'cool season'],
  12: ['winter', 'christmas season'],
};

export function buildPexelsKeyword(
  city: string,
  place: string | null,
  departureMonth: number,
  mode?: string  // 'sunset', 'golden hour', 'daytime', etc.
): string {
  const seasonWords = SEASON_KEYWORDS_BY_MONTH[departureMonth] ?? [];
  const seasonWord = seasonWords[0] ?? '';
  
  const parts = [city];
  if (place) parts.push(place);
  if (seasonWord) parts.push(seasonWord);
  if (mode) parts.push(mode);
  
  return parts.join(' ');
}
```

### 4. app/api/admin/marketing/card-news/series/route.ts
시리즈 목록·생성 API.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/admin/marketing/card-news/series
export async function GET(request: NextRequest) {
  const series = await prisma.bongCardNewsSeries.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      episodes: {
        orderBy: { episodeNumber: 'asc' },
        select: { id: true, episodeNumber: true, title: true, formatType: true, status: true },
      },
    },
  });
  
  return NextResponse.json({ series });
}

// POST /api/admin/marketing/card-news/series
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const series = await prisma.bongCardNewsSeries.create({
    data: {
      weekKey: body.weekKey,
      themeTitle: body.themeTitle,
      selectedCities: body.selectedCities,
      targetDepartureFrom: new Date(body.targetDepartureFrom),
      targetDepartureTo: new Date(body.targetDepartureTo),
      operatorNote: body.operatorNote ?? null,
    },
  });
  
  return NextResponse.json({ series }, { status: 201 });
}
```

### 5. app/api/admin/marketing/card-news/series/[id]/route.ts
시리즈 상세·수정·삭제.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET 상세
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const series = await prisma.bongCardNewsSeries.findUnique({
    where: { id: params.id },
    include: {
      episodes: {
        orderBy: { episodeNumber: 'asc' },
        include: {
          slides: { orderBy: { slideNumber: 'asc' } },
          linkedProduct: { select: { id: true, title: true, country: true, city: true } },
        },
      },
    },
  });
  if (!series) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ series });
}

// PATCH 수정
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json();
  const updated = await prisma.bongCardNewsSeries.update({
    where: { id: params.id },
    data: {
      themeTitle: body.themeTitle,
      selectedCities: body.selectedCities,
      targetDepartureFrom: body.targetDepartureFrom ? new Date(body.targetDepartureFrom) : undefined,
      targetDepartureTo: body.targetDepartureTo ? new Date(body.targetDepartureTo) : undefined,
      operatorNote: body.operatorNote,
      status: body.status,
    },
  });
  return NextResponse.json({ series: updated });
}

// DELETE
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.bongCardNewsSeries.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
```

### 6. app/api/admin/marketing/card-news/series/[id]/episodes/route.ts
편 추가·목록.

```typescript
// GET: 편 목록
// POST: 편 추가 (운영자 수동, 토글로 Deep/List 선택)
```

### 7. app/api/admin/marketing/card-news/series/[id]/episodes/[episodeId]/route.ts
편 수정·삭제 (Deep/List 토글 포함).

```typescript
// PATCH: episodeType, formatType, title, linkedProductId, targetCity, targetPlace, operatorNote 수정
// DELETE: 편 삭제 (슬라이드 cascade)
```

### 8. app/api/admin/marketing/card-news/series/[id]/generate/route.ts
시리즈 카피 자동 생성 트리거.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateCardNewsSeries } from '@/lib/bong-marketing/card-news-generator';
import { prisma } from '@/lib/prisma';

// POST: 시리즈 내 모든 편의 카피를 Gemini로 자동 생성
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  // 시리즈 상태를 generating으로
  await prisma.bongCardNewsSeries.update({
    where: { id: params.id },
    data: { status: 'generating' },
  });
  
  try {
    const results = await generateCardNewsSeries(params.id);
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    await prisma.bongCardNewsSeries.update({
      where: { id: params.id },
      data: { status: 'draft' },
    });
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
```

---

## 운영자 컨텍스트 API (보너스, 작은 추가)

### 9. app/api/admin/marketing/context/route.ts

```typescript
// GET ?weekKey=YYYY-WW : 해당 주차 컨텍스트
// POST : 컨텍스트 upsert (weekKey 기준)
```

운영자가 시리즈 만들기 전 이번 주 의도·핫 정보·타겟 입력하는 용도.

---

## 기존 봉투어 인프라 활용 (변경 X)

다음은 **그대로 재사용**. 신규 생성·변경 금지:

- `lib/bong-marketing/gemini-json-parse.ts` (Gemini JSON 응답 파싱)
- `lib/bong-marketing/blog-draft-prompt.ts` (블로그 프롬프트 빌더, 참고만)
- `lib/prisma.ts` (Prisma 클라이언트)
- 기존 인증 미들웨어 (admin auth)

`gemini-json-parse.ts`에 `generateGeminiJsonResponse({ model, systemPrompt, userPrompt, maxOutputTokens })` 같은 헬퍼가 없으면 **추가 생성 또는 기존 함수 시그니처에 맞춰 호출**. 코드 작업 시 기존 인프라 시그니처 먼저 확인 후 통합.

---

## 검증 절차

### Step 1: 타입체크·빌드
```bash
npx tsc --noEmit
npm run build
```
exit 0 통과.

### Step 2: 단위 테스트 (가능하면)
- `lib/bong-marketing/card-news-prompt.ts` 의 프롬프트 빌더 테스트
- `lib/bong-marketing/pexels-keyword-builder.ts` 의 키워드 빌더 테스트

### Step 3: 통합 테스트 — 실제 시리즈 1개 생성
```sql
-- 테스트용 시리즈·편 시드 (Supabase 직접 INSERT 가능)
INSERT INTO "BongCardNewsSeries" (id, "weekKey", "themeTitle", "selectedCities", "targetDepartureFrom", "targetDepartureTo")
VALUES ('test-series-1', '2026-W25', '여름 몽골', ARRAY['울란바토르'], '2026-08-14', '2026-09-14');

INSERT INTO "BongCardNewsEpisode" (id, "seriesId", "episodeNumber", "episodeType", "formatType", title, "targetCity", "targetPlace")
VALUES ('test-ep-1', 'test-series-1', 1, 'package', 'deep', '몽골 테를지', '울란바토르', '테를지');
```

이후:
```bash
curl -X POST http://localhost:3000/api/admin/marketing/card-news/series/test-series-1/generate \
  -H "Authorization: Bearer <admin_token>"
```

응답에 5개 슬라이드 카피가 채워졌는지 확인.

### Step 4: Supabase에서 슬라이드 검증
```sql
SELECT "slideNumber", "slideRole", headline, subtitle, body, "pexelsKeyword"
FROM "BongCardNewsSlide"
WHERE "episodeId" = 'test-ep-1'
ORDER BY "slideNumber";
```

5개 슬라이드 모두 카피·키워드 채워졌는지.

---

## 제약 (필수)

- Claude API·Anthropic SDK 추가 금지. **Gemini만 사용**.
- 봉투어 기존 `gemini-*` 인프라 재활용. 새 LLM 클라이언트 만들지 마.
- UI 파일 생성 금지 (PR 3에서)
- 자동 발행·자동 cron 금지 (운영자 수동 트리거만)
- 환경변수 추가: 없음 (기존 `GEMINI_API_KEY` 활용)

## 보고 형식

```
[PR 2 완료 보고]

1. 신규 파일 8-9개 목록 + 줄 수
2. 변경된 파일 (있으면)
3. 빌드 결과 (npm run build exit 0)
4. 통합 테스트 결과:
   - 테스트 시리즈·편 시드 SQL
   - generate API 호출 응답
   - Supabase BongCardNewsSlide 5개 row 확인
5. Gemini 응답 샘플 (실제 5장 카피 1편 발췌)
6. 미해결 이슈 (있으면)
```

## 다음 PR 예고

PR 3: 카드뉴스 관리자 UI (Deep/List 토글, 결과 표시·편집)
PR 4: 후킹 라이브러리 페이지 (모범 10 + 금지 10 입력)
PR 5: 블로그 주제 자동선정 (기존 BongBlogPost 확장)
