# 등록대기 2차 분류 — 스키마·API·UI 설계 및 MVP

**목표**: 등록대기 검수 패널에서 2차 분류(대표 지역, 테마 태그, 노출 카테고리, 타깃 고객)를 실제로 저장/수정할 수 있게 한다.

---

## 1. 2차 분류 필드 제안 표

| 필드명 | 한글명 | DB 타입 | 설명 | 저장 형식 |
|--------|--------|---------|------|-----------|
| **primaryRegion** | 대표 지역 | String? | 검색/필터용 대표 지역 1개 | 단일 문자열 (예: 동남아, 유럽) |
| **themeTags** | 테마 태그 | String? | 여러 테마를 구분자로 저장 | 쉼표 구분 문자열 (예: 허니문,오션뷰) |
| **displayCategory** | 노출 카테고리 | String? | 노출 위치/채널 구분 | 단일 문자열 (예: 롯데몰노출, 메인베너) |
| **targetAudience** | 타깃 고객 | String? | 타깃 세그먼트 | 쉼표 구분 문자열 (예: 성인가족,신혼부부) |

- **타입 선택 이유**
  - SQLite + Prisma: 배열 타입 없음. JSON 컬럼은 가능하나, 검색·필터 시 단순 LIKE가 편하므로 **모두 String?** 으로 통일.
  - 다중값(테마, 타깃)은 **쉼표 구분 문자열**로 저장. UI에서 split/join으로 처리. 나중에 검색 시 `LIKE '%태그%'` 또는 정규화 테이블로 확장 가능.

---

## 2. Prisma 수정안

**변경 내용**: `Product` 모델에 4개 필드 추가.

```prisma
  // 2차 분류 (등록대기 검수 시 확정)
  primaryRegion         String?        // 대표 지역 (예: 동남아, 유럽)
  themeTags             String?        // 테마 태그 쉼표 구분 (예: 허니문,오션뷰)
  displayCategory       String?        // 노출 카테고리 (예: 롯데몰노출, 메인베너)
  targetAudience        String?        // 타깃 고객 쉼표 구분 (예: 성인가족,신혼부부)
```

**Migration 영향**
- 기존 row: 새 컬럼은 NULL. 기존 데이터/동작 영향 없음.
- `npx prisma migrate dev --name add_secondary_classification` 실행 후 스키마 적용.
- Prisma client 재생성: `npx prisma generate` (output이 prisma-gen인 경우 다른 프로세스가 lock 중이면 종료 후 실행).

---

## 3. API 수정안

### GET /api/admin/products/[id]
- **응답**: `primaryRegion`, `themeTags`, `displayCategory`, `targetAudience` 포함.
- `select` 객체에 위 4필드 추가.

### PATCH /api/admin/products/[id]
- **body**에서 2차 분류 필드 수신: `primaryRegion`, `themeTags`, `displayCategory`, `targetAudience`.
- **처리**: `undefined`가 아닌 경우에만 update 객체에 넣고, `strOrNull(v)` 로 정규화 (trim, 최대 500자).
- **validation (최소)**:
  - 타입: string 또는 null/빈 문자열 → DB에는 null 또는 trim된 문자열.
  - 길이: 500자 초과 시 slice(0, 500).

---

## 4. AdminPendingDetailPanel UI 패치 초안

- **ProductDetail 타입**: `primaryRegion`, `themeTags`, `displayCategory`, `targetAudience` (모두 `string | null`) 추가.
- **상태**: `primaryRegion`, `themeTags`, `displayCategory`, `targetAudience` 로컬 state 4개. `detail` 로드/변경 시 `useEffect`로 동기화.
- **UI**:
  - 대표 지역: `<input type="text">` (placeholder: 예: 동남아, 유럽)
  - 테마 태그: `<input type="text">` (placeholder: 예: 허니문, 오션뷰) — 안내 문구: "쉼표 구분"
  - 노출 카테고리: `<input type="text">` (placeholder: 예: 롯데몰노출, 메인베너)
  - 타깃 고객: `<input type="text">` (placeholder: 예: 성인가족, 신혼부부) — "쉼표 구분"
  - **[분류 저장]** 버튼: 클릭 시 PATCH로 4필드만 전송. 성공 시 `setDetail`로 로컬 상세 갱신, "저장되었습니다." 표시. 실패 시 에러 메시지 표시.
- 승인/보류/반려와 독립적으로, **승인 전에** 분류 저장 가능.

---

## 5. 반려/보류 개선 제안

### 현재 동작
- **보류**: 선택 해제만. API/DB 변경 없음.
- **반려**: DELETE로 물리 삭제. 예약 있으면 400.

### 개선 방향 (후속)

| 옵션 | 보류 | 반려 | 비고 |
|------|------|------|------|
| **A. 상태값 확장** | `registrationStatus = 'on_hold'` 추가. 보류 클릭 시 PATCH로 on_hold. 등록대기 리스트는 `pending`만 조회하면 보류 건 제외. | `registrationStatus = 'rejected'` 추가. 반려 클릭 시 PATCH로 rejected. 리스트에서 제외. 삭제 안 함. | 스키마에 enum처럼 쓰는 문자열만 추가. migration 단순. |
| **B. 반려 사유** | — | `rejectedAt` (DateTime?), `rejectReason` (String?) 추가. 반려 시 PATCH로 status=rejected + reason 저장. | 이력/사유 조회 가능. |
| **C. 현행 유지** | 선택 해제만. | DELETE 유지. | 구현 없음. |

**권장**: 먼저 **A** 적용. 보류 = `on_hold`로 남겨두고 나중에 처리, 반려 = `rejected`로 논리 삭제. 필요 시 **B**로 반려 사유 필드 추가.

---

## 6. 먼저 구현할 최소안 (MVP)

1. **Prisma**: Product에 `primaryRegion`, `themeTags`, `displayCategory`, `targetAudience` (모두 String?) 추가 → migration 적용.
2. **API**: GET/PATCH `/api/admin/products/[id]` 에 4필드 포함·수정. PATCH 시 strOrNull, 500자 제한.
3. **UI**: AdminPendingDetailPanel에 4개 input + [분류 저장] 버튼. 저장 시 PATCH 호출 후 상세 갱신·메시지 표시.
4. **반려/보류**: 이번 턴에서는 변경 없음. 상태값 확장(보류/반려)은 후속 TODO로 문서화만.

위 MVP까지 반영된 상태입니다. Migration은 로컬에서 `npx prisma migrate dev --name add_secondary_classification` 로 실행하면 됩니다.
