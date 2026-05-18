# PR 5 작업 프롬프트 — 가드 완성 + 패턴 정교화 + 잔여 필드 정리

> 이전 작업: PR 1·2·3·4 완료, Supabase 14건 수동 정리 완료  
> 현재 상태: imageKeyword 필드 정리 완료, BANNED_KEYWORD_PATTERNS 정교화 필요  
> 목적: 가드 적용 누락 경로 14곳 정리 + Night Market 허용 + 다른 필드 정리

---

## 0. 현 상황 요약

### 완료된 작업
- ✅ PR 1: `--legacy-tolerant` 플래그
- ✅ PR 2: `assertCleanPlaceKeyword` 가드 (fail-fast)
- ✅ PR 3: 레거시 40건 백필 (` / ` 삼단 제거)
- ✅ PR 4: 등록·추출 파이프라인 14경로 가드 적용
- ✅ Supabase 수동 정리: 추가 14건 imageKeyword 정리 (보조어 패턴)

### 남은 작업
1. 관리자·API 저장 경로 가드 적용 (원래 PR 5 범위)
2. BANNED_KEYWORD_PATTERNS 정교화 (Night Market 허용)
3. `imagePlaceName`, `imageRehostSearchLabel` 등 다른 필드의 삼단 잔재 정리
4. 검증 스크립트 strict 모드 PASS 달성

---

## Task 1: BANNED_KEYWORD_PATTERNS 정교화

### 배경

Supabase 수동 정리 중 발견: "Night Market"은 한국인 관광 콘텐츠에서 **의미 있는 카테고리**임. 야시장은 동남아·대만·일본 관광의 핵심 콘텐츠. `night` 패턴으로 일괄 차단하면 의미 손실.

현재 DB의 의미 보존 케이스 (6건):
- `Kaohsiung Night Market` (hanatour)
- `Duong Dong Night Market` (hanatour - 푸꾸옥 즈엉동)
- `Nha Trang Night Market` (hanatour)
- `Taipei Night Market` (modetour)
- `Liuhe Night Market` (modetour - 가오슝 류허)
- `Dalat Night Market` (modetour)

### 작업 내용

**파일**: `lib/image-keyword-verify-guards.ts`

```typescript
// 명시적 허용 패턴 (allowlist) — 의미 있는 보조어
export const ALLOWED_KEYWORD_PATTERNS = [
  'night market',  // 야시장 — 한국인 관광 핵심 카테고리
  // 향후 다른 의미 있는 보조어 추가 가능
];

export const BANNED_KEYWORD_PATTERNS = [
  ' / landmark',
  ' / exterior',
  ' / interior',
  ' / street-level',
  ' / aerial',
  ' / skyline',
  ' / night view',
  ' landmark exterior',
  ' street-level view',
  ' skyline',
  // 'night' 패턴은 detectBannedSuffix 내에서 ALLOWED 체크 후 적용
];

export function detectBannedSuffix(keyword: string): string | null {
  if (!keyword) return null;
  const lowered = keyword.toLowerCase();
  
  // 1. 허용 패턴 우선 확인 — Night Market 같은 의미 보존 케이스
  for (const allowed of ALLOWED_KEYWORD_PATTERNS) {
    if (lowered.includes(allowed.toLowerCase())) {
      return null; // 허용 패턴 매치 시 위반 아님
    }
  }
  
  // 2. 차단 패턴 검사
  for (const pattern of BANNED_KEYWORD_PATTERNS) {
    if (lowered.includes(pattern.toLowerCase())) {
      return pattern;
    }
  }
  
  // 3. 단독 보조어 (night, view 등) — 허용 패턴 우회 후 검사
  const standaloneBanned = ['night', 'skyline', 'aerial', 'panoramic', 'wide shot'];
  for (const word of standaloneBanned) {
    // " word"로 들어있고 ALLOWED에 매치 안 됨
    const wordWithSpace = ` ${word}`;
    if (lowered.includes(wordWithSpace.toLowerCase())) {
      return word;
    }
  }
  
  return null;
}
```

### 단위 테스트 추가

`tests/image-keyword-verify-guards.test.ts` (신규 또는 기존에 추가):

```typescript
describe('detectBannedSuffix with allowlist', () => {
  // 허용 케이스
  it('Night Market는 허용', () => {
    expect(detectBannedSuffix('Kaohsiung Night Market')).toBeNull();
    expect(detectBannedSuffix('Taipei Night Market')).toBeNull();
    expect(detectBannedSuffix('Duong Dong Night Market')).toBeNull();
  });
  
  // 차단 케이스
  it('Night View는 차단', () => {
    expect(detectBannedSuffix('Budapest Night View')).not.toBeNull();
  });
  it('단독 night는 차단', () => {
    expect(detectBannedSuffix('Tokyo night')).not.toBeNull();
  });
  it('skyline 차단', () => {
    expect(detectBannedSuffix('Shanghai skyline')).not.toBeNull();
  });
  it('삼단 차단', () => {
    expect(detectBannedSuffix('Osaka Castle / landmark exterior')).not.toBeNull();
  });
});
```

### 검증

PR 5 머지 후:
```bash
npm run verify:image-keywords-by-supplier
# strict 모드 — Night Market 6건은 PASS, 다른 보조어 0건이어야 함
# 기대 결과: PASS
```

---

## Task 2: 관리자·API 저장 경로 가드 적용

### 대상 파일 (원래 PR 5 범위)

| 파일 | 작업 |
|---|---|
| `app/api/admin/products/[id]/schedule-images/route.ts` | `kw \|\| day_${day}` raw 저장 경로에 `finalizeScheduleImageKeyword` 적용 |
| `app/admin/register/page.tsx` | 수동 입력 + `buildPexelsKeyword` 자동값에 `finalizeScheduleImageKeyword` 적용 |
| `app/admin/pending/.../AdminPendingDetailPanel.tsx` | `Day ${d} travel` 기본값 제거 + API 저장 전 finalize |
| `app/api/travel/parse/route.ts` | `day N travel` 폴백 제거, finalize 적용 |
| `app/api/travel/parse-and-upsert/route.ts` | `day ${i.day} travel` 폴백 제거, finalize 적용 |

### 작업 원칙
- 각 경로의 DB 저장 직전에 `finalizeScheduleImageKeyword` 호출
- 폴백 `Day N travel`은 빈 문자열로 변경
- 가드 throw 발생 시 API 에러 응답 (HTTP 400) + Sentry/로깅

### 건드리지 말 것
- `app/api/travel/process-images/route.ts` — `premade_*`, `day_*`는 의도된 추적 키 (Pexels 장소명 아님)
- `parse-and-register-hanatour-schedule.ts` `applyHanatourAirtelFreeTravelImageKeywordsToScheduleIfNeeded` — 에어텔 전용 레거시 별도 추적

---

## Task 3: 다른 필드 정리 (보너스)

### 배경

DB 점검 중 발견: `imageKeyword` 외에 `imagePlaceName`, `imageRehostSearchLabel`에도 삼단/보조어 잔재가 있음. 검증 스크립트가 못 잡는 영역.

발견된 케이스 예시:
```
상품 cmp8qnrst039f3t9yxepbi2yc Day 3:
  imageKeyword: "Kota Kinabalu" (정리됨)
  imagePlaceName: "Kota Kinabalu Resort / landmark exterior / street-level view" (더러움)
  imageRehostSearchLabel: "Kota Kinabalu Resort / landmark exterior / street-level view" (더러움)

상품 cmp8j8hq400qs3t9yx2kxzg2v Day 8:
  imageKeyword: "Budapest Airport"
  imagePlaceName: "Budapest Airport"
  imageRehostSearchLabel: "Budapest"  ← 부분 정리됨, 비일관성
```

### 작업 내용

**1. 검증 스크립트 확장**
`scripts/verify-image-keywords-by-supplier.ts`:
- 기존 `imageKeyword` 검사에 추가로 `imagePlaceName`, `imageRehostSearchLabel`도 검사
- 출력에 어느 필드인지 표시
- `--fields=imageKeyword,imagePlaceName,imageRehostSearchLabel` 플래그로 검사 대상 선택 가능 (기본은 모두)

**2. 백필 스크립트 확장**
`scripts/backfill-legacy-image-keywords.ts`:
- 기존 `imageKeyword` 백필에 추가로 `imagePlaceName`, `imageRehostSearchLabel`도 처리
- 세 필드의 일관성 검증 (imageKeyword와 같은 값이어야 정상)
- 비일관성 감지 시 imageKeyword 값으로 통일

**3. 저장 시 가드 확장**
schedule JSON 저장 경로에서 세 필드 모두 `finalizeScheduleImageKeyword` 거치도록.
- 향후 일관성 자동 유지

### 변환 규칙
- `imagePlaceName`, `imageRehostSearchLabel`에 ` / ` 또는 보조어 패턴 있으면 `normalizeToPlaceName` 적용
- 변환 후 `imageKeyword`와 일치하지 않으면 — `imageKeyword`를 신뢰 (PR 4 이후 imageKeyword가 SSOT 통과한 값이므로)

---

## Task 4: 최종 검증

PR 5 머지 후 다음 모든 명령 PASS 여야 함:

```bash
# 단위 테스트
npm run test:pexels-place-name-keyword                    # PASS
npm run test:register-schedule-image-keyword-guard        # PASS
npm run test:image-keyword-verify-guards                  # PASS (신규)

# 검증 스크립트
npm run verify:pexels-place-name-keyword                  # PASS (9/9)
npm run verify:pexels-queries                             # PASS
npm run verify:image-keywords-by-supplier:ci              # PASS
npm run verify:image-keywords-by-supplier                 # PASS (strict 모드 ★)

# TypeScript
npx tsc --noEmit                                          # PASS
```

★ strict 모드 PASS = 이미지 키워드 작업 완전 종료 신호.

---

## 작업 순서

| # | 작업 | 예상 시간 |
|:-:|---|---|
| 1 | Task 1: BANNED_KEYWORD_PATTERNS 정교화 + 단위 테스트 | 30분 |
| 2 | Task 1 머지 후 strict 모드 검증 (Night Market 통과 확인) | 5분 |
| 3 | Task 2: 관리자·API 경로 5개 가드 적용 | 1-2시간 |
| 4 | Task 3-1: 검증 스크립트 확장 (다른 필드 추가) | 30분 |
| 5 | Task 3-2: 백필 스크립트 확장 (dry-run) | 30분 |
| 6 | Task 3-2 dry-run 결과 보고 후 승인 받고 --apply | 10분 |
| 7 | Task 3-3: 저장 경로 finalize 확장 | 1시간 |
| 8 | Task 4: 최종 검증 | 10분 |

**총: 반나절~1일**

---

## PR 분리 제안

| PR | 내용 | 의존성 |
|:-:|---|---|
| 5-1 | Task 1 (패턴 정교화) | 독립 |
| 5-2 | Task 2 (관리자·API 가드) | 5-1 필요 |
| 5-3 | Task 3 (다른 필드 정리) | 5-1 필요, 5-2와 병렬 가능 |

각 PR 머지 시 검증 결과 보고. PR 5-3의 백필 `--apply`는 별도 승인.

---

## 시작

```
PR 5-1부터 순서대로 진행해줘.
각 단계 완료 시 검증 결과 보고하고 다음 PR 진행 전 승인 받아.
PR 5-3의 --apply는 별도 승인 필수.
```

---

## 완료 후 — 마케팅 자동화 재개 조건

이 작업 완료 + PhotoPool 라이선스 작업(별도 spec) 완료 시점에 봉투어 마케팅 자동화 재개 가능.

PhotoPool spec은 PR 5 완료 후 별도로 제공 예정.
