# 등록대기 상태값 확장 및 2차 분류 표시

**목표**: 보류/반려를 상태값 기반으로 개선하고, 2차 분류를 등록대기·상품목록 리스트에 표시.

---

## 1. 상태값 개선 제안

### 1.1 `registrationStatus` 확장

| 값 | 의미 | 등록대기 목록 | 상품 목록 |
|----|------|----------------|-----------|
| **pending** | 등록대기(검수 대기) | ✅ 표시 | 대기 배지 |
| **on_hold** | 보류 | ❌ 제외 | 보류 배지 |
| **rejected** | 반려 | ❌ 제외 | 반려 배지 |
| **registered** | 검수 후 등록 완료 | ❌ 제외 | 등록됨 배지 |

- **Prisma**: 스키마 변경 없음. 기존 `registrationStatus String?`에 위 4가지 문자열만 허용하도록 API에서 검증.
- **등록대기 조회**: `pending`(및 null/빈 문자열)만 조회. `on_hold`/`rejected`는 목록에서 제외.
- **보류**: [보류] 클릭 시 PATCH `registrationStatus: 'on_hold'` → 해당 건은 등록대기 목록에서 사라짐. 데이터는 유지.
- **반려**: [반려] 클릭 시 PATCH `registrationStatus: 'rejected'` → 목록에서 제외. **DELETE 제거** (물리 삭제는 상품 상세 등 관리자 전용 액션으로만 유지 가능).

### 1.2 등록대기에서 보류/반려 UX

- **보류**: “나중에 다시 검수” → `on_hold` 저장. 등록대기 탭에는 안 보임. (후속: “보류 목록” 탭/필터로 `on_hold`만 별도 조회 가능.)
- **반려**: “이 상품은 등록하지 않음” → `rejected` 저장. 목록에서 제거, 데이터는 DB에 유지.
- **DELETE**: 등록대기 검수 패널에서는 호출하지 않음. 상품 목록·상세에서만 “삭제” 버튼로 유지 (예약 유무 검사 후 물리 삭제).

---

## 2. Prisma / API 수정안

### 2.1 Prisma

- **변경**: `schema.prisma`의 `registrationStatus` 주석만 수정.
  - `// pending=등록대기, on_hold=보류, rejected=반려, registered=검수 후 등록 완료`
- **마이그레이션**: 필드 타입/이름 변경 없음. 마이그레이션 불필요.

### 2.2 PATCH /api/admin/products/[id]

- **허용 값**: `registrationStatus`를 `'pending' | 'registered' | 'on_hold' | 'rejected'` 만 허용.
- 그 외 값이 오면 `null`로 저장하거나 무시 (구현에서는 위 4개만 허용해 반영).

### 2.3 GET /api/admin/products/pending

- **where**: `registrationStatus`가 `null` | `''` | `'pending'` 인 행만 조회.
- `on_hold`, `rejected`, `registered` 제외.
- **select**: `primaryRegion`, `displayCategory` 추가 → 응답에 2차 분류 일부 포함.

### 2.4 GET /api/admin/products/list

- **select**: `primaryRegion`, `displayCategory`, `themeTags` 추가.
- 응답 rows에 동일 필드 포함.

---

## 3. pending / products UI 수정안

### 3.1 등록대기 (/admin/pending)

- **리스트**
  - 행 클릭 시 우측 검수 패널 표시 (기존과 동일).
  - 각 행에 **2차 분류 요약**: `primaryRegion`, `displayCategory`가 있으면 한 줄로 표시 (예: `동남아 · 롯데몰노출`).
- **검수 패널**
  - [보류]: PATCH `on_hold` → 성공 시 목록에서 제거, 선택 해제.
  - [반려]: PATCH `rejected` (확인 다이얼로그) → 성공 시 목록에서 제거, 선택 해제.
  - [승인]: 기존처럼 PATCH `registered`.
  - 에러 시 [선택 해제]: API 호출 없이 `selectedId`만 초기화 (`onClearSelection`).

### 3.2 상품 목록 (/admin/products)

- **테이블**
  - **분류 컬럼** 추가: `primaryRegion`, `displayCategory` (필요 시 `themeTags` 첫 값) 한 셀에 표시. 길면 truncate + title로 전체 표시.
  - **상태 컬럼**: `registrationStatus`에 따라 배지 표시.
    - `registered` → 등록됨
    - `on_hold` → 보류
    - `rejected` → 반려
    - `pending`/null/'' → 대기
- **삭제**: 기존처럼 행별 [삭제] 유지 (DELETE). 반려와 별개.

---

## 4. 최소 구현안 (MVP) — 반영 내용

| 항목 | 내용 |
|------|------|
| **PATCH [id]** | `registrationStatus`에 `on_hold`, `rejected` 허용. |
| **GET pending** | `pending`(및 null/'')만 조회. 응답에 `primaryRegion`, `displayCategory` 포함. |
| **GET list** | 응답에 `primaryRegion`, `displayCategory`, `themeTags` 포함. |
| **AdminStatusBadge** | `on_hold`, `rejected` variant 추가. |
| **pending page** | `handleHold`(PATCH on_hold), `handleReject`(PATCH rejected). 리스트에 2차 분류 한 줄 표시. 패널에 `onClearSelection`. |
| **products page** | 분류 컬럼 추가. 상태 컬럼에 보류/반려/등록됨/대기 배지. |
| **DELETE** | 등록대기 검수 패널에서는 사용하지 않음. 상품 목록·상세에서만 삭제 유지. |

---

## 5. 후속 TODO

- **보류 목록 조회**: 등록대기 페이지에 “보류” 탭 또는 필터 추가 → `registrationStatus: 'on_hold'` 조회 API 및 UI.
- **반려 목록/복구**: 반려 건만 조회하는 화면 또는 필터, 필요 시 “다시 pending으로” 복구 버튼 (PATCH `pending`).
- **반려 사유**: `rejectedAt`, `rejectReason` 등 필드 추가 후 반려 시 사유 입력·표시.
- **2차 분류 필터**: 상품 목록에서 대표 지역·노출 카테고리·테마 태그로 필터/검색.
- **대시보드 KPI**: “보류 N건”, “반려 N건” (선택) 표시.
