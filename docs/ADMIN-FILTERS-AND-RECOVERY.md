# 상품 상태 운영성·2차 분류 활용 — 필터 강화 및 복구 흐름

**목표**: 보류/반려 상품을 찾고 복구할 수 있게 하고, 상품목록에서 상태·2차 분류 필터를 강화한다.

---

## 1. 현재 운영상 부족한 점

- **보류/반려 건 조회**: 등록대기에서는 pending만 보여서, 한번 보류/반려한 상품을 다시 찾으려면 상품목록에서 상태로 걸러야 하는데 **상태 필터가 없었다**.
- **복구 흐름**: 보류/반려 → 다시 검수하고 싶을 때 "pending으로 되돌리기" 액션이 없어, **재검수로 보내기**가 불가능했다.
- **2차 분류 활용**: 대표 지역·노출 카테고리·테마 태그가 리스트에는 표시되지만, **필터로 좁혀서 보기**가 안 됐다.
- **반려 사유**: 반려 시 사유를 남기지 않아, 나중에 왜 반려했는지 **이력이 남지 않음** (후속 검토).

---

## 2. 상품목록 필터 강화안

| 필터 | 타입 | 동작 | 비고 |
|------|------|------|------|
| **상태** | select | `status` 쿼리: 전체 / 등록됨(registered) / 대기(pending) / 보류(on_hold) / 반려(rejected) | 등록대기에서 빠진 보류·반려 건만 보기 가능 |
| **대표 지역** | select | `primaryRegion` 쿼리. 옵션은 API에서 distinct 조회 | 포함 검색(contains) |
| **노출 카테고리** | select | `displayCategory` 쿼리. 옵션은 API에서 distinct 조회 | 포함 검색(contains) |
| **테마 태그** | text input | `themeTags` 쿼리. 부분 검색(contains) | MVP: 입력값으로 포함 검색만 (후속: 디바운스) |

- **API**: `GET /api/admin/products/list?status=on_hold&primaryRegion=동남아&displayCategory=메인&themeTags=허니문` 형태로 전달.
- **options**: `GET /api/admin/products/list/options` 응답에 `primaryRegions`, `displayCategories` 배열 추가 (distinct 값).

---

## 3. 보류/반려 복구 흐름 제안

- **복구 의미**: 보류(on_hold) 또는 반려(rejected) 상태를 **다시 등록대기(pending)** 로 되돌려, 등록대기 목록에서 다시 검수할 수 있게 함.
- **API**: 기존 `PATCH /api/admin/products/[id]` 에서 `registrationStatus: 'pending'` 허용되어 있으므로 **추가 수정 없음**.
- **UI**: 상품목록에서 상태가 보류/반려인 행에 **[재검수로 보내기]** 버튼 추가. 클릭 시 PATCH `registrationStatus: 'pending'` 호출 후 목록 갱신. 해당 행은 목록에서 사라지고(상태가 pending이 되므로, "상태 전체"일 때는 여전히 보임), 등록대기 페이지에서 다시 보임.

---

## 4. API/UI 최소 패치 초안

### 4.1 GET /api/admin/products/list

- **쿼리 파라미터 추가**: `status`, `primaryRegion`, `displayCategory`, `themeTags`.
- **where**:
  - `status`가 `registered` | `on_hold` | `rejected` → `where.registrationStatus = status`.
  - `status`가 `pending` → `where.OR = [{ registrationStatus: null }, { registrationStatus: '' }, { registrationStatus: 'pending' }]`.
  - `primaryRegion` 있음 → `where.primaryRegion = { contains: primaryRegion }`.
  - `displayCategory` 있음 → `where.displayCategory = { contains: displayCategory }`.
  - `themeTags` 있음 → `where.themeTags = { contains: themeTags }`.

### 4.2 GET /api/admin/products/list/options

- **응답에 추가**: `primaryRegions`, `displayCategories` (Product 테이블에서 distinct).

### 4.3 상품목록 페이지 (app/admin/products/page.tsx)

- **state**: `statusFilter`, `primaryRegionFilter`, `displayCategoryFilter`, `themeTagsSearch`, `restoringId`.
- **fetchList**: 위 4개를 쿼리 파라미터에 포함.
- **필터 UI**: 상태 select, 대표 지역 select(options.primaryRegions), 노출 카테고리 select(options.displayCategories), 테마 태그 text input.
- **행 액션**: `registrationStatus === 'on_hold' || === 'rejected'` 일 때 **[재검수로 보내기]** 버튼 표시. 클릭 시 `handleSendToPending(id)` → PATCH `pending` → `fetchList()`.

---

## 5. 반려 사유(rejectReason) 최소안 제안

- **필요성**: 운영에서 "왜 반려했는지" 남기면 재검수·이력 확인에 유리.
- **MVP 판단**: 이번 턴에서는 **구현하지 않고 후속 TODO로만 정리**. 이유:
  - 스키마·API·폼·목록 표시까지 넣으면 범위가 커짐.
  - 현재만으로도 "반려 → 상품목록에서 상태 필터로 찾기 → 재검수로 보내기" 흐름은 가능.
- **후속 시**: `Product`에 `rejectedAt`, `rejectReason` 추가, 반려 시 PATCH로 저장, 상품 상세/목록에서 표시.

---

## 6. 후속 TODO

- **테마 태그 필터**: 입력 디바운스 또는 "적용" 버튼으로 요청 횟수 조절.
- **반려 사유**: `rejectedAt`, `rejectReason` 스키마·API·등록대기 반려 UI·상품목록/상세 표시.
- **보류 목록 전용 뷰**: 등록대기 페이지에 "보류" 탭 추가해 `on_hold`만 조회 (또는 상품목록 상태=보류로 대체).
- **2차 분류 옵션 캐시**: options 호출 빈도/데이터 양이 커지면 캐시 또는 별도 API로 분리 검토.
