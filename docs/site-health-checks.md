# 매시 자동 점검(공용 틀)

사장님 2026-11-22 00:12 지시: "작업마무리에 붙여서 다음작업을 미리 준비할수잇는 베이스를 만들어라. 그리고 AEO, SEO최적화도 이루어지게하면서 진행해야할것이다."

## 언제 도나
- 웹 매시 30분 자동 사진 채움 틱(`lib/instrumentation-register-pre-photo-self-heal-cron.ts`)에서 `runAutoPhotoRegisterJob({ siteHealth: true })` → `lib/site-health-run.ts` `runSiteHealthHourly` 가 채움 앞에서 돈다.
- AI 토큰을 쓰지 않는다. 사진 HEAD 40개·흑백 6개·페이지 13개 안팎을 간격·지터를 두고 읽는다.

## 무엇을 하나
- `kind: 'data'` 항목은 데이터만 고친다. 사진은 재채움 가능한 일차만 칸을 비우고(AssetUsageLog `site-health-clear`, 이전 URL 기록 → 되돌림 가능) 같은 실행의 공개 상품 채움이 먼저 다시 채운다. 한 실행 비우기 상한 = 공개 채움 상한(10).
- 비운 칸 우선 채움(11/22): 점검이든 수동(흑백 제거 등)이든 칸을 비울 때 AssetUsageLog `sourceType: site-health-clear` 기록을 남기면, 최근 14일 안에 기록된 상품은 다음 :30 공개 채움 맨 앞에 들어간다(상한 30, 일반 순번 10개는 따로).
- `kind: 'code'` 항목은 기록만 한다(stdout `site-health-done` 한 줄: found·fixed·codeIssues, 항목별 표본 5개).
- 일정 글·title·가격·스키마는 고치지 않는다. 수동 선택 사진과 대표사진은 비우지 않는다.

## 항목 추가 방법(다음 작업용)
1. 해당 영역 파일의 배열에 `HealthCheck` 하나를 추가한다.
   - 사진: `lib/site-health-photo-checks.ts` `PHOTO_HEALTH_CHECKS`
   - SEO·AEO: `lib/site-health-seo-checks.ts` `SEO_HEALTH_CHECKS`
   - 새 영역(수집 분류·국내 판정, 메가메뉴 빈 메뉴, 톡톡, 로고 등): `lib/site-health-<영역>-checks.ts` 에 배열과 ctx 를 만들고 `runSiteHealthHourly` 에서 `runHealthChecks(배열, ctx)` 한 줄을 더한다.
2. `id`·`area`·`kind`·`summary`·`find`(+ data 면 `fix`)만 채운다. 집계·실패 격리·기록은 공용 틀이 한다.
3. `lib/site-health.test.ts` 에 그 항목 테스트를 추가한다.

## eSIM 문구 규칙
고객 화면에 유심사 표기 금지, 'eSIM(여행용)'·'고객센터'로 쓴다(`aeo-esim-wording`).
