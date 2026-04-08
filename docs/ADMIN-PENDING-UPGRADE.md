# 등록대기 페이지 고도화 — 검수 작업 화면

**목표**: `/admin/pending`을 단순 대기열이 아니라 **이미지 수급·2차 분류·승인/보류/반려**를 처리하는 검수 작업 화면으로 고도화.

---

## 1. 현재 pending의 한계

- **단일 컬럼 리스트만 존재**: 목록 + 행별 [상세][승인]만 있어, 한 화면에서 검수 플로우를 수행하기 어렵다.
- **상세는 별도 페이지**: [상세] 클릭 시 `/admin/products/[id]`로 이동하므로, 등록대기 화면을 벗어나야 상품 정보를 본다.
- **이미지 수급 UI 없음**: Pexels/Gemini/수동 업로드가 TODO로만 남아 있고, 대시보드·자동 생성에 의존한다.
- **2차 분류 UI 없음**: 대표 지역·테마 태그·노출 카테고리·타깃 고객 등 확정/편집 UI가 없다.
- **결정 액션 부족**: 승인만 있고, 보류(선택 해제)·반려(제거)가 없어 검수 워크플로가 불완전하다.
- **API/스키마 제약**: `Product.registrationStatus`는 `pending` | `registered`만 지원하고, 2차 분류 필드(대표 지역 등)는 스키마에 없음.

---

## 2. 고도화 후 화면 구조 제안

```
+------------------------------------------------------------------+
| AdminPageHeader: 등록대기 / 부제                                   |
+------------------------------------------------------------------+
| [성공 메시지 블록] (승인 시)                                       |
+------------------------------------------------------------------+
| KPI: 등록대기 N건 | 이미지 필요 N건 | 승인 가능 N건                  |
+------------------------------------------------------------------+
| 등록대기 리스트 (좌)     | 검수 패널 (우)                           |
|                         | +--------------------------------------+ |
| [상품 A] selected       | 상품 요약                                |
| [상품 B]                |   제목, 코드, 출처, 목적지, 기간, 사진상태  |
| [상품 C]                | +--------------------------------------+ |
| ...                    | 이미지 수급                               |
|                         |   [Pexels 검색] [Gemini 생성] [수동 업로드]|
|                         | +--------------------------------------+ |
|                         | 2차 분류 확정                             |
|                         |   대표 지역, 테마 태그, 노출 카테고리, 타깃 |
|                         | +--------------------------------------+ |
|                         | [승인] [보류] [반려]                      |
+------------------------------------------------------------------+
```

- **좌측**: 등록대기 리스트. 행 클릭 시 해당 상품이 선택되고 우측 검수 패널에 표시.
- **우측 상단**: 선택 상품 요약 (제목, 코드, 출처, 목적지, 기간, 사진 완료/이미지 수급 배지).
- **우측 중단**: 이미지 수급 패널 (Pexels / Gemini / 수동 — MVP에서는 placeholder).
- **우측 하단**: 2차 분류 확정 패널 (대표 지역 등 — MVP에서는 placeholder/읽기 전용).
- **하단 액션**: 승인(등록) / 보류(선택 해제) / 반려(삭제 확인 후 제거).

---

## 3. MVP 반영안 (이번 턴에 반영된 것)

| 항목 | 내용 |
|------|------|
| **레이아웃** | 좌측 리스트 + 우측 검수 패널 2단 구조. 반응형 그리드(`lg:grid-cols-[1fr_1.2fr]`). |
| **선택 플로우** | 리스트 행 클릭 → `selectedId` 설정 → 우측에 검수 패널 표시. |
| **상품 요약** | 선택 시 GET `/api/admin/products/[id]`로 상세 로드 후, 요약 섹션에 제목·코드·출처·목적지·기간·수정일·사진 상태 배지 표시. |
| **이미지 수급 패널** | Pexels 검색 / Gemini 생성 / 수동 업로드 버튼 3개 **placeholder**(비활성 + "후속 연동 예정" 안내). |
| **2차 분류 패널** | 대표 지역·테마 태그·노출 카테고리·타깃 고객 4항목 **placeholder**("—" 표시 + "후속 반영 예정" 문구). |
| **승인** | 기존과 동일. PATCH `registrationStatus: 'registered'` → 목록에서 제거, 선택 해제, 성공 메시지. |
| **보류** | 선택 해제만 수행. `selectedId = null`. (API 변경 없음) |
| **반려** | 확인 후 DELETE `/api/admin/products/[id]` 호출 → 목록에서 제거, 선택 해제. |
| **상세 페이지 링크** | 리스트 각 행에 "상세 페이지 →" 링크 유지 (클릭 시 `/admin/products/[id]`, 이벤트 전파 차단). |
| **공통 컴포넌트** | AdminPageHeader, AdminKpiCard, AdminStatusBadge, AdminEmptyState, 신규 AdminPendingDetailPanel 사용. |

---

## 4. 신규 컴포넌트 후보

| 컴포넌트 | 용도 | MVP 상태 |
|----------|------|----------|
| **AdminPendingDetailPanel** | 우측 검수 패널 전체. 상품 요약 + 이미지 수급 + 2차 분류 + 승인/보류/반려. `productId`·`listItem`·콜백 props. | ✅ 구현됨 (한 파일에 모든 섹션 포함) |
| AdminPendingSummary | 상품 요약만 분리 | 후속: 패널 내부를 세분화할 때 추출 |
| AdminPendingImagePanel | 이미지 수급 버튼/UI만 분리 | 후속: Pexels/Gemini/업로드 연동 시 |
| AdminPendingClassificationPanel | 2차 분류 폼만 분리 | 후속: 스키마·API 추가 후 |
| AdminPendingDecisionBar | 승인/보류/반려 버튼만 분리 | 후속: 필요 시 DetailPanel에서 추출 |

---

## 5. 수정 대상 파일 목록

| 파일 | 작업 |
|------|------|
| `app/admin/pending/page.tsx` | 리스트·선택 상태·반려 핸들러 추가, 좌/우 2단 레이아웃, AdminPendingDetailPanel 연동 |
| `app/admin/pending/components/AdminPendingDetailPanel.tsx` | **신규**. 검수 패널 (요약·이미지·2차 분류·액션). |
| `docs/ADMIN-PENDING-UPGRADE.md` | **신규**. 본 고도화 요약·MVP·후속 TODO. |

---

## 6. 파일별 코드 패치 초안

### 6.1 `app/admin/pending/page.tsx`

- **상태 추가**: `selectedId`, `deletingId`.
- **핸들러**: `handleReject(productId)` — confirm 후 DELETE 호출, 성공 시 목록/선택 갱신. `handleRegister` 성공 시 `setSelectedId(null)`.
- **헤더 부제**: "이미지 수급·2차 분류 확인 후 승인하면 … 좌측에서 상품을 선택해 검수하세요." 로 변경.
- **레이아웃**: `list.length > 0`일 때 `grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]`. 좌측은 리스트(버튼 행, 클릭 시 `setSelectedId(item.id)`, 선택 행 강조). 우측은 `<AdminPendingDetailPanel productId={selectedId} listItem={...} onApproved={...} onHold={...} onReject={...} isRegistering isDeleting />`.
- **리스트 행**: [상세 페이지 →] 링크만 유지 (stopPropagation). 인라인 [승인] 버튼 제거 → 패널에서만 승인.

### 6.2 `app/admin/pending/components/AdminPendingDetailPanel.tsx`

- **Props**: `productId | null`, `listItem: PendingItem | null`, `onApproved(id)`, `onHold()`, `onReject(id)`, `isRegistering`, `isDeleting`.
- **productId === null**: AdminEmptyState("상품을 선택하세요", 설명문).
- **productId 설정 시**: GET `/api/admin/products/[id]` 로 상세 로드. 로딩/에러 시 메시지 + [선택 해제].
- **정상 로드 후**:
  - **상품 요약**: listItem 우선, 없으면 API 응답으로 요약. AdminStatusBadge(사진 완료/이미지 수급).
  - **이미지 수급**: 3개 버튼 disabled, "후속 연동 예정" 툴팁/문구.
  - **2차 분류**: 4행 읽기 전용(대표 지역 등) "—", "2차 분류 UI·API는 후속 반영 예정" 문구.
  - **액션**: [승인] [보류] [반려]. 보류는 onHold, 반려는 onReject(id).

---

## 7. 후속 TODO

- **이미지 수급 연동**
  - Pexels 검색 API·UI 연동 (검색어·선택 이미지 → 상품 메인/일정 반영).
  - Gemini 이미지 생성 API·UI 연동.
  - 수동 업로드 (파일 선택 → 업로드 API → bgImageUrl/schedule 반영).

- **2차 분류**
  - Product 스키마에 필드 추가 (예: `representativeRegion`, `themeTags`, `displayCategory`, `targetCustomer` 또는 JSON 필드 1개).
  - PATCH `/api/admin/products/[id]`에서 해당 필드 수정 허용.
  - AdminPendingClassificationPanel에서 편집 폼·저장 버튼 구현.

- **보류 의미 강화** (선택)
  - 현재 보류 = 선택 해제만. 필요 시 `registrationStatus: 'on_hold'` 등 별도 상태 추가 후 API/스키마 확장.

- **반려 vs 삭제**
  - 현재 반려 = DELETE로 등록대기에서 제거. "반려"를 논리 삭제·사유 저장으로 바꾸려면 스키마(예: `rejectedAt`, `rejectReason`) 및 API 확장.

- **패널 분리**
  - AdminPendingDetailPanel을 AdminPendingSummary, AdminPendingImagePanel, AdminPendingClassificationPanel, AdminPendingDecisionBar로 분리해 재사용·테스트 용이하게 정리.
