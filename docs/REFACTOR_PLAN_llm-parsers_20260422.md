# LLM 파서 4종 공통화 — 리팩터 계획 (Phase 2 Step 1)

작성일: 2026-04-22  
브랜치(후속 작업용): `refactor/llm-parsers-commonization-20260422`  
참고: `docs/REFACTORING_ANALYSIS_20260422.md` §2  
원칙: **기능 변경 0**, 단계마다 빌드 검증, `register-parse-*` 경로 회귀 유지.

---

## Step 1 요약 (분석만, 코드 변경 없음)

네 파일은 **공개 엔트리 1개(`parseForRegisterLlm*`)** 와, 그 앞뒤로 **동일·근동일 로직이 수백 줄 단위로 복제**되어 있다. 공통화 이득이 큰 구간은 **상수·토큰 상한·붙여넣기 정규화·섹션 repair 루프·메인/리페어 `parseLlmJsonObject` 패턴**이다. 반면 **`RegisterParsed` / `RegisterGeminiLlmJson` / 감사 필드**는 공급사별 스키마 파일에 묶여 있어 **제네릭 한 방에 묶기는 비권장**이며, 절차 공통화(함수 추출 + 동일 호출 순서 유지)가 안전하다.

**Step 2는 본 문서 검토 후 사용자 OK를 받은 뒤에만 진행한다.**

---

## 1-1. 함수 시그니처 비교

### 공개 export

| 파일 | export |
|------|--------|
| `register-from-llm-hanatour.ts` | `export async function parseForRegisterLlmHanatour` **단일** |
| `register-from-llm-modetour.ts` | `export async function parseForRegisterLlmModetour` **단일** |
| `register-from-llm-verygoodtour.ts` | `export async function parseForRegisterLlmVerygoodtour` **단일** |
| `register-from-llm-ybtour.ts` | `export async function parseForRegisterLlmYbtour` **단일** |

각 파일은 그 외 **모듈 스코프 `function`/`async function` 다수(비 export)** 로 구성된다.

### `parseForRegisterLlm*` 시그니처 (형태)

공통 형태:

```ts
async function parseForRegisterLlm{Supplier}(
  rawText: string,
  originSource: string = '직접입력',
  options?: RegisterLlmParseOptionsCommon
): Promise<RegisterParsed>
```

- **인자 3개·기본값·반환 `Promise<RegisterParsed>`** 는 네 곳 모두 동일 패턴.
- **타입 명칭은 파일마다 다름**: `RegisterLlmParseOptionsCommon`, `RegisterParsed`, `RegisterGeminiLlmJson` 등은 각각 `register-llm-schema-{supplier}`에서 import → **TypeScript 상으로는 서로 다른 nominal 타입**(필드가 대부분 같아도 공용 타입 병합 시 리스크).
- **하나투어 전용 옵션**: `register-llm-schema-hanatour`의 `RegisterLlmParseOptionsCommon`에만  
  `skipScheduleExtractLlm?`, `skipMustKnowWebSupplement?` 존재. 나머지 세 공급사 스키마에는 해당 키 없음.

### 호출 경로

`lib/register-parse-{supplier}.ts` 가 유일하게 `parseForRegisterLlm*`를 직접 import 한다 (`Parameters<typeof parseForRegisterLlm*>` 로 옵션 타입 추출).

---

## 1-2. 공통 로직 식별

### `presetDetailBody` 필수 가드

- 네 파일 모두 **`options?.presetDetailBody` 없으면 즉시 `throw new Error(...)`**.
- 메시지는 공급사·함수명·`register-parse-{supplier}` 문자열만 다르고, **의미·가이드(전용 API만 사용)** 는 동일.

### Gemini 섹션 repair 루프

- 공통: `decideSectionRepairPolicy(detailBody)` → `repairPlan` 순회.
- `maxDetailSectionRepairs`(기본 3), `skipDetailSectionGeminiRepairs` 옵션 동일.
- `pastedBlocks`에 hotel / airlineTransport / optionalTour / shopping 이 있으면 해당 섹션 **repair 스킵** + `repairLog` 사유 문자열 동일 계열.
- `runDetailSectionGeminiRepair(model, target, sectionText)` 호출.
- `options?.onTiming?.('before-section-repairs' | 'after-section-repairs')` 동일.

### `parseLlmJsonObject` 호출 패턴

- 메인 응답: `forPreview` 분기로 **preview용 `Record<string, unknown>`** 파싱 후, 본 파싱에서 **`RegisterGeminiLlmJson`** + `logLabel: 'parseForRegisterLlm{Supplier}'`.
- JSON 실패 시: **조건부로 repair `generateContent` 1회** → `logLabel: 'parseForRegisterLlm{Supplier}-repair-retry'`.
- 실패 시 **`RegisterLlmParseError` throw** (네 파일 모두 동일 예외 타입, 스키마 파일만 다름).

### 스케줄 / 가격 / 후처리 import 묶음

네 파일 공통으로 반복되는 축(일부 서브 경로만 공급사별):

- `gemini-client`: `getGenAI`, `getModelName`, `geminiTimeoutOpts`
- `register-schedule-extract-common`: `inferExpectedScheduleDayCountFromPaste`, `mergeScheduleWithFirstPassPreferExtractRows`, `registerPromptWithScheduleEmptyForConfirm`, `runScheduleExtractLlm`, `CommonScheduleDayRow`
- `bongtour-tone-manner-llm-ssot`: 톤·JSON 규율·스케줄 필드 블록 등 (하나투어만 **추가 인트로** 상수)
- `flight-leg-heuristics`, `optional-tour-limits`, `shopping-structured-row-to-persist`, `must-know-web-supplement`, `llm-json-extract`, `infant-price-extract`, `product-price-table-extract`, `minimum-departure-extract`, `detail-body-parser`(타입), `register-optional-tours-detail-final-merge`, `register-manual-paste-ssot`, `gemini-repair-chain`, `register-destination-coherence`, `product-excluded-display` 등

### 에러 핸들링 패턴

- `presetDetailBody` 없음 → 일반 `Error`.
- LLM JSON 파싱/검증 실패 → **`RegisterLlmParseError`** (공급사별 클래스이지만 구조 동형).
- `console.error('[{supplier}-llm]', …)` 로 MAX_TOKENS·파싱 실패 로그.

### 로깅 패턴

- **`options?.onTiming`** 라벨 세트가 네 파일에서 동일:  
  `before-section-repairs` → `after-section-repairs` → `llm-start` / `llm-end` → `parse-start` / `after-parse` / `parse-failed` → `repair-*` → `must-know-supplement-*` → `register-parsed-ready` 등.
- **`console.error` prefix만 공급사별** (`hanatour-llm`, `modetour-llm`, `verygood-llm`, `ybtour-llm`).

---

## 1-3. 공급사별 차이 식별

| 영역 | 차이 요약 |
|------|-----------|
| **스키마** | `register-llm-schema-{supplier}` — `RegisterParsed`, `RegisterGeminiLlmJson`, `RegisterLlmParseError`, 감사 필드 등 |
| **구조화 신호** | `structured-tour-signals-{supplier}` |
| **블록·세그먼트** | `register-llm-blocks-{supplier}`, `segmentSupplierPasteForLlm` |
| **리뷰/쇼핑 정책** | `review-policy-{supplier}`, `optional-tour-row-gate-{supplier}` |
| **호텔 일자 계획** | `day-hotel-plans-{supplier}` |
| **가격 프로모션** | `price-promotion-{supplier}` |
| **하나투어** | `REGISTER_LLM_ROLE_DATA_AUDITOR_HANATOUR_COMPACT_INTRO`, `register-hanatour-shopping`, `detail-body-parser-hanatour`, `parse-and-register-hanatour-schedule` 등 **일정·이미지·쇼핑** 무게 증가 |
| **참좋은** | `verygoodtour-schedule-recovery-clip`, `verygoodtour-paste-normalize-*`, `register-verygoodtour-price`, `must-know-trip-readiness-pipe-verygoodtour`, `applyVerygoodPreviewSsotOptionalShopping` 등 **전용 서브파이프라인** |
| **노랑풍선** | `register-ybtour-basic` (`extractYbtourVerbatimListingTitle`) 등 **기본 메타** |
| **모두투어** | `modetour-schedule-image-keyword` 등 |
| **`REGISTER_BRAND` / 프롬프트 보조** | 문자열·소개 블록만 상이 |
| **내부 헬퍼 이름** | `{supplier}ClearLlmWhenDedicatedPasteEmpty` 등 동형 복제 |

---

## 1-4. 공통화 가능한 유틸 후보 (우선순위: 안전 → 고위험)

### A. 즉시 추출 가능(순수·상수·동일 구현)

| 후보 | 근거 |
|------|------|
| `resolveRegisterFullMaxOutputTokens()` | `REGISTER_FULL_MAX_OUTPUT_TOKENS` 계산식이 **네 파일 동일** |
| `REGISTER_PASTE_MAX_CHARS` / `MAX_SHOPPING_STOPS` | 값 동일 |
| `EMPTY_PASTE_PLACEHOLDER` | 문자열 **완전 동일** |
| `normalizeRegisterPasteNewlines` | 구현 **완전 동일** |
| `clipRegisterLlmAuditText` / `clipRegisterAdminLlmParsedJsonString` | 네 파일에서 **동일 패턴**(검증 권장) |

### B. 저위험 절차 추출 (옵션·콜백 주입)

| 후보 | 근거 |
|------|------|
| `assertPresetDetailBody(options, ctx: { fnName: string; parseModule: string })` | throw 메시지 템플릿만 파라미터화하면 **동작 동일** 유지 용이 |
| `runRegisterDetailSectionGeminiRepairs(args)` | `detailBody` 갱신 + `repairLog` + `sectionRepairsUsed` + `pastedBlocks` 스킵 — **라인별 diff로 이행**하면 회귀 통제 가능 |

### C. 중간 난이도 (대량 중복 헬퍼)

동일 이름·거의 동일 본문: `numOrNull`, `strOrNull`, `mergeOptionalToursStructured`, `mergeShoppingStopsJson`, `parseLlmExtractionFieldIssues`, preview 병합 계열 등.  
**타입만 공급사 스키마에서 오므로** 제네릭 `<T extends RegisterGeminiLlmJson>` 또는 `import type` 한정으로 한 파일에 모을 수 있으나, **한 줄이라도 공급사 분기가 섞이면 위험** — 2차 이후 단계 권장.

### D. 고위험 / 비권장(초기 단계)

- `buildRegisterSignalsHaystack` — 본문은 유사하나 **접두 함수명·주석·미세 분기** 가능.
- **통합 `buildSupplierParserPipeline` 팩토리** — 단계 순서 바뀜 = 등록 결과 변경 위험.

---

## 1-5. 공통화 후 예상 디렉터리 구조

사용자 제안안을 기준으로, **하위 호환**을 위해 루트의 `register-from-llm-*.ts`는 **re-export 얇은 래퍼**로 유지하는 것을 권장한다.

```text
lib/
  register-from-llm/
    common/
      constants.ts          # 토큰 상한, PASTE_MAX, EMPTY_PLACEHOLDER, MAX_SHOPPING_STOPS
      paste-normalize.ts    # normalizeRegisterPasteNewlines
      preset-guard.ts       # assertPresetDetailBody
      gemini-repair-sections.ts  # (후속) 섹션 repair 루프
      types.ts              # 공통 옵션의 non-branded 최소 타입 또는 re-export only 주의
    hanatour.ts             # 슬림 본체
    modetour.ts
    verygoodtour.ts
    ybtour.ts
  register-from-llm-hanatour.ts   # export * from './register-from-llm/hanatour' 등
  register-from-llm-modetour.ts
  register-from-llm-verygoodtour.ts
  register-from-llm-ybtour.ts
```

`types.ts`는 **스키마 통합 전에는** `DetailBodyParseSnapshot` 등 외부 타입만 두고, `RegisterParsed`는 각 스키마에 남기는 편이 안전하다.

---

## 부록: 현재 줄 수 (PowerShell `Get-Content` 기준)

| 파일 | 줄 수 |
|------|------|
| `lib/register-from-llm-hanatour.ts` | 2585 |
| `lib/register-from-llm-modetour.ts` | 2376 |
| `lib/register-from-llm-verygoodtour.ts` | 2551 |
| `lib/register-from-llm-ybtour.ts` | 2310 |

---

## Step 2 제안 (실행 대기 — 사용자 OK 후)

**한 가지만** 먼저 추출할 경우 권장 순서:

1. **`lib/register-from-llm/common/constants.ts`** (+ 필요 시 `resolveRegisterFullMaxOutputTokens`) — 네 파일에서 동일한 상수·환경변수 읽기 제거, 빌드 1회.
2. **`paste-normalize.ts`**에 `normalizeRegisterPasteNewlines` — 1줄 함수이나 중복 제거 명확, 리스크 극소.
3. 그 다음 **`assertPresetDetailBody`** — throw 문자열만 인자화해 회귀 비교 쉬움.

각 추출 후 **`npx next build`** 및 (가능하면) **관리자 상품 자동 등록 스모크** 권장.

---

## Step 3 리포트용 플레이스홀더 (Step 2 완료 후 채움)

| 항목 | 상태 |
|------|------|
| Step 1 분석 | **본 문서로 완료** |
| Step 2 추출 유틸 | 사용자 OK 후 작성 |
| 줄 수 변화 | Step 2 후 측정 |
| 빌드 결과 | Step 2 후 기록 |
| 다음 단계 추천 | Step 2 완료 후 갱신 |
