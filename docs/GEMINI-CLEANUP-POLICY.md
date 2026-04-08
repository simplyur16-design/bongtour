# Gemini 생성 이미지 저장/정리 정책

## 1) 현재 Gemini 파일 관리의 문제점

- 등록대기에서 Gemini 생성 시 `public/uploads/gemini/<baseId>-0.png`, `-1.png`, `-2.png` 형태로 3장 저장된다.
- 운영자가 그중 1장만 대표 이미지로 선택하면 `Product.bgImageUrl`에 해당 상대 경로(예: `/uploads/gemini/<baseId>-1.png`)가 저장된다.
- **선택되지 않은 2장 + 다른 세션에서 생성된 미선택 후보**는 디스크에 그대로 남아, 시간이 지나면 폴더가 비대해진다.
- 참조 중인 파일과 미사용 후보를 구분하는 로직이 없었고, 정리 정책도 없었다.

## 2) 추천 정리 정책

- **A. Product.bgImageUrl로 참조 중인 파일은 절대 삭제하지 않는다.**  
  - DB에서 `bgImageUrl`이 `/uploads/gemini/...` 로 시작하는 모든 URL을 수집해 “참조 중” Set을 만들고, 이 Set에 포함된 파일은 삭제 대상에서 제외한다.
- **B. 참조되지 않는 Gemini 파일은 N일 경과 후 삭제 대상.**  
  - 파일의 수정 시각(mtime) 기준으로, “현재 시각 − mtime > N일”이면 “오래된 미선택 후보”로 간주하고 삭제 대상에 넣는다.
- **C. 유예기간**  
  - **N = 7일** 권장.  
  - 이유: 등록대기 검수는 보통 며칠 안에 끝나고, “다시 보기”를 위해 1주일 정도는 남겨 두는 편이 안전하다. 14일·30일은 디스크 사용량이 커질 수 있어, MVP에서는 7일로 두고 필요 시 `graceDays`로 조정한다.

## 3) 참조 중 파일 판별 규칙

- **대상 경로**: `Product.bgImageUrl` 값.
- **Gemini 참조로 인정하는 조건**:  
  - `bgImageUrl`이 비어 있지 않고,  
  - (앞의 `/` 유무와 관계없이) **`/uploads/gemini/`** 로 시작하는 경로만 “Gemini 업로드 참조”로 본다.
- **정규화**: 비교 시 항상 `/uploads/gemini/<filename>` 형태로 통일해, `uploads/gemini/...` 같이 앞 슬래시가 빠진 저장값도 동일 파일로 인식한다.
- **파일 시스템과의 매칭**: `public/uploads/gemini/` 디렉터리를 읽어 얻은 각 `filename`에 대해 웹 경로 `/uploads/gemini/<filename>`이 참조 Set에 있으면 “참조 중” → 삭제하지 않는다.

## 4) 구현 방식 추천 (수동 / 배치 / 병행)

- **MVP: 수동 실행만 구현.**
  - **POST /api/admin/gemini/cleanup** 한 번으로 “지금 기준으로 정리 규칙 적용”을 실행.
  - 관리자가 대시보드/등록대기 근처에서 “Gemini 미사용 파일 정리” 버튼을 눌러 호출하거나, 필요 시 스크립트/curl로 호출.
- **이유**
  - 정리 빈도가 높지 않고, “언제 정리했는지”를 운영자가 인지하는 편이 안전하다.
  - dry-run으로 먼저 삭제 대상만 확인할 수 있어, 오동작 위험을 줄일 수 있다.
- **후속**
  - 주 1회 등 정기 실행이 필요해지면, 기존 스케줄러(예: `app/api/admin/scheduler/`)에 “cleanup 호출” 작업을 하나 추가하는 방식으로 배치를 붙이면 된다.  
  - 초기 MVP에서는 **수동 실행만** 두고, 동작이 안정적으로 확인된 뒤 배치를 추가하는 것을 권장한다.

## 5) 수정/생성한 파일 목록

| 파일 | 조치 |
|------|------|
| `lib/gemini-cleanup.ts` | **신규** — 참조 Set 조회, 디렉터리 스캔, 유예기간 적용, 삭제(또는 dry-run) 및 결과 반환 |
| `app/api/admin/gemini/cleanup/route.ts` | **신규** — POST, requireAdmin, body.dryRun / body.graceDays, runGeminiCleanup 호출 후 JSON 응답 |
| `docs/GEMINI-CLEANUP-POLICY.md` | **신규** — 위 정책·규칙·구현 방식 요약 |

## 6) API 사용 예시

- **dry-run(삭제 없이 대상만 확인)**  
  `POST /api/admin/gemini/cleanup`  
  `Content-Type: application/json`  
  `body: { "dryRun": true }`  
  → `{ ok: true, dryRun: true, scannedCount, preservedCount, deletedCount, deletedFiles }`
- **실제 정리**  
  `body: {}` 또는 `body: { "dryRun": false }`  
  → 참조되지 않고 유예기간(기본 7일)이 지난 파일만 삭제 후 동일 형태 응답.
- **유예기간 변경**  
  `body: { "graceDays": 14 }` (1~90 범위, 그 외는 기본 7일 사용)

## 7) 안전장치

- **참조 중인 파일은 절대 삭제하지 않음**: `getReferencedGeminiPaths()`로 Product.bgImageUrl 중 `/uploads/gemini/` 경로만 Set에 넣고, 삭제 전에 Set에 있으면 건너뜀.
- **dry-run**: `dryRun: true`면 삭제하지 않고, 삭제될 파일 목록만 `deletedFiles`로 반환.
- **로그**: 실제 삭제 시 `unlink` 실패만 console.warn. (선택적으로 삭제된 파일 목록을 서버 로그에 남기도록 확장 가능.)
- **삭제 개수 제한**: MVP에서는 제한 두지 않음. 한 번에 수백 개가 나올 수 있지만, 유예기간이 지난 미사용 파일만 대상이므로 필요 시 후속으로 “한 번에 최대 K개” 같은 상한을 둘 수 있다.

## 8) 현재 운영 흐름 (유지)

- **실행 위치**: `/admin/scheduler-settings` → 파일 정리 카드.
- **흐름**: 유예기간(일) 입력(1~90, 기본 7) → “삭제 예정 확인 (dry-run)”으로 대상 확인 → “실제 정리 실행”으로 삭제. dry-run 권장 후 실행.
- **결과 표시**: 스캔/보존/삭제 개수, 삭제 파일 목록(최대 10개 + 외 N개). dry-run 시 amber, 실제 실행 시 gray.
- **참조 중 파일**: Product.bgImageUrl에 연결된 경로는 삭제 대상에서 항상 제외. UI·API·lib 모두 동일 규칙 유지.

## 9) 후속 TODO

- ~~관리자 UI에 “Gemini 미사용 파일 정리” 버튼 추가~~ → `/admin/scheduler-settings` 파일 정리 카드로 구현됨.
- **최근 정리 이력**: 마지막 실행 시각·결과(삭제 건수)를 로컬 state 또는 간단 저장소에 남겨 “최근 정리: N일 전, N개 삭제” 등 표시.
- **graceDays 프리셋**: UI에 “7일 / 14일 / 30일” 버튼으로 빠르게 선택.
- **주기적 스케줄 연동**: 스케줄러에 “Gemini 정리” 작업 등록(주 1회 등). 동일 cleanup API 또는 runGeminiCleanup 로직 호출.
- **Supabase/S3 이전 시**: “참조 중” 판별는 동일하게 `Product.bgImageUrl` 기준으로 하되, 삭제는 해당 스토리지의 객체 삭제 API로 수행하도록 `runGeminiCleanup` 확장.
